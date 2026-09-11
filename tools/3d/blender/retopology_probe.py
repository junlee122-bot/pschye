import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def mesh_stats(obj):
    mesh = obj.data
    bmesh_data = bmesh.new()
    bmesh_data.from_mesh(mesh)
    boundary_edges = sum(1 for edge in bmesh_data.edges if edge.is_boundary)
    non_manifold_edges = sum(1 for edge in bmesh_data.edges if not edge.is_manifold)
    bmesh_data.free()
    polygon_sizes = {}
    for polygon in mesh.polygons:
        polygon_sizes[len(polygon.vertices)] = polygon_sizes.get(len(polygon.vertices), 0) + 1
    quads = polygon_sizes.get(4, 0)
    return {
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "polygonSizes": polygon_sizes,
        "quadRatio": quads / max(1, len(mesh.polygons)),
        "boundaryEdges": boundary_edges,
        "nonManifoldEdges": non_manifold_edges,
    }


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
    source = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    results = {"source": mesh_stats(source), "candidates": []}
    quadriflow = source.copy()
    quadriflow.data = source.data.copy()
    quadriflow.name = "QuadriflowRecalculated"
    bpy.context.collection.objects.link(quadriflow)
    bpy.ops.object.select_all(action="DESELECT")
    quadriflow.select_set(True)
    bpy.context.view_layer.objects.active = quadriflow
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.quadriflow_remesh(
        target_faces=28000,
        use_preserve_sharp=True,
        use_preserve_boundary=False,
        preserve_attributes=False,
        smooth_normals=True,
        use_mesh_symmetry=False,
        seed=41,
    )
    results["candidates"].append({"method": "quadriflow-recalculated", **mesh_stats(quadriflow)})
    bpy.data.objects.remove(quadriflow, do_unlink=True)
    for depth in (6, 7, 8):
        candidate = source.copy()
        candidate.data = source.data.copy()
        candidate.name = f"RemeshDepth{depth}"
        bpy.context.collection.objects.link(candidate)
        bpy.ops.object.select_all(action="DESELECT")
        candidate.select_set(True)
        bpy.context.view_layer.objects.active = candidate
        modifier = candidate.modifiers.new(f"QuadRemesh{depth}", "REMESH")
        modifier.mode = "SMOOTH"
        modifier.octree_depth = depth
        modifier.scale = 0.9
        modifier.threshold = 1.0
        modifier.use_remove_disconnected = True
        modifier.use_smooth_shade = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        results["candidates"].append({"method": "remesh-modifier", "octreeDepth": depth, **mesh_stats(candidate)})
        bpy.data.objects.remove(candidate, do_unlink=True)
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
