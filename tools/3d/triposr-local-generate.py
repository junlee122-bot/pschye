import argparse
import json
import os
import sys
import time
import types
from pathlib import Path

import numpy as np
import torch
import trimesh
from PIL import Image
from skimage import measure


def cpu_marching_cubes(level: torch.Tensor, threshold: float):
    volume = level.detach().float().cpu().numpy()
    vertices, faces, _, _ = measure.marching_cubes(
        volume,
        level=threshold,
        allow_degenerate=False,
    )
    return (
        torch.from_numpy(np.ascontiguousarray(vertices)).float(),
        torch.from_numpy(np.ascontiguousarray(faces.astype(np.int64))).long(),
    )


torchmcubes = types.ModuleType("torchmcubes")
torchmcubes.marching_cubes = cpu_marching_cubes
sys.modules["torchmcubes"] = torchmcubes


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--resolution", type=int, default=256)
    parser.add_argument("--chunk-size", type=int, default=2048)
    parser.add_argument("--foreground-ratio", type=float, default=0.85)
    parser.add_argument("--target-height", type=float, default=1.78)
    parser.add_argument("--postprocess-only", action="store_true")
    return parser.parse_args()


def canonicalize_character_mesh(mesh: trimesh.Trimesh, target_height: float):
    mesh.apply_transform(
        trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1])
    )
    height = float(mesh.extents[1])
    if height <= 0:
        raise ValueError("Cannot canonicalize a mesh with zero height.")
    mesh.apply_scale(target_height / height)
    bounds = mesh.bounds
    center_x = float((bounds[0][0] + bounds[1][0]) / 2)
    center_z = float((bounds[0][2] + bounds[1][2]) / 2)
    mesh.apply_translation([-center_x, -float(bounds[0][1]), -center_z])
    return {
        "upAxis": "Y",
        "heightMeters": round(float(mesh.extents[1]), 4),
        "grounded": True,
        "bounds": np.asarray(mesh.bounds).round(6).tolist(),
    }


def main():
    args = parse_args()
    source_root = Path(args.source_root).resolve()
    sys.path.insert(0, str(source_root))

    import rembg
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    artifact_dir = Path(args.artifact_dir).resolve()
    artifact_dir.mkdir(parents=True, exist_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.postprocess_only:
        print("TripoSR local: canonicalizing existing GLB", flush=True)
        mesh = trimesh.load_mesh(output_path, file_type="glb", force="mesh", process=False)
        canonicalization = canonicalize_character_mesh(mesh, args.target_height)
        mesh.export(output_path)
        metadata_path = artifact_dir / "local-generation.json"
        metadata = {}
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["canonicalization"] = canonicalization
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(json.dumps(canonicalization, ensure_ascii=False, indent=2), flush=True)
        return

    timings = {}

    started = time.perf_counter()
    print("TripoSR local: loading model", flush=True)
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.renderer.set_chunk_size(args.chunk_size)
    model.to("cpu")
    model.eval()
    timings["modelLoadSeconds"] = round(time.perf_counter() - started, 3)

    started = time.perf_counter()
    print("TripoSR local: removing background", flush=True)
    rembg_session = rembg.new_session()
    image = remove_background(Image.open(input_path), rembg_session)
    image = resize_foreground(image, args.foreground_ratio)
    composited = np.array(image).astype(np.float32) / 255.0
    composited = (
        composited[:, :, :3] * composited[:, :, 3:4]
        + (1 - composited[:, :, 3:4]) * 0.5
    )
    image = Image.fromarray((composited * 255.0).astype(np.uint8))
    processed_path = artifact_dir / "processed-input.png"
    image.save(processed_path)
    timings["preprocessSeconds"] = round(time.perf_counter() - started, 3)

    started = time.perf_counter()
    print("TripoSR local: reconstructing scene code on CPU", flush=True)
    with torch.inference_mode():
        scene_codes = model([image], device="cpu")
    timings["reconstructionSeconds"] = round(time.perf_counter() - started, 3)

    started = time.perf_counter()
    print(
        f"TripoSR local: extracting {args.resolution}^3 mesh on CPU",
        flush=True,
    )
    meshes = model.extract_mesh(
        scene_codes,
        has_vertex_color=True,
        resolution=args.resolution,
    )
    timings["meshExtractionSeconds"] = round(time.perf_counter() - started, 3)

    started = time.perf_counter()
    print("TripoSR local: exporting GLB", flush=True)
    canonicalization = canonicalize_character_mesh(meshes[0], args.target_height)
    meshes[0].export(output_path)
    timings["exportSeconds"] = round(time.perf_counter() - started, 3)

    metadata = {
        "provider": "Stability AI",
        "model": "TripoSR",
        "execution": "local-cpu",
        "input": str(input_path),
        "output": str(output_path),
        "processedInput": str(processed_path),
        "settings": {
            "resolution": args.resolution,
            "chunkSize": args.chunk_size,
            "foregroundRatio": args.foreground_ratio,
        },
        "mesh": {
            "vertices": int(len(meshes[0].vertices)),
            "faces": int(len(meshes[0].faces)),
        },
        "canonicalization": canonicalization,
        "timings": timings,
        "torch": torch.__version__,
    }
    (artifact_dir / "local-generation.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
