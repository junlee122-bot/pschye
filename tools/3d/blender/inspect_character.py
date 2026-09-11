import argparse
import json
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(__import__("sys").argv[__import__("sys").argv.index("--") + 1 :])


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    report = {
        "input": str(Path(args.input).resolve()),
        "objects": [],
        "scene": {
            "meshCount": len(mesh_objects),
            "armatureCount": len([obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]),
        },
    }
    for obj in mesh_objects:
        world_corners = [obj.matrix_world @ __import__("mathutils").Vector(corner) for corner in obj.bound_box]
        mins = [min(corner[index] for corner in world_corners) for index in range(3)]
        maxs = [max(corner[index] for corner in world_corners) for index in range(3)]
        mesh = obj.data
        color_stats = {}
        for attribute in mesh.color_attributes:
            linear = [item.color for item in attribute.data]
            srgb = [item.color_srgb for item in attribute.data]
            color_stats[attribute.name] = {
                "domain": attribute.domain,
                "dataType": attribute.data_type,
                "linearMean": [sum(color[channel] for color in linear) / len(linear) for channel in range(4)],
                "srgbMean": [sum(color[channel] for color in srgb) / len(srgb) for channel in range(4)],
                "linearMin": [min(color[channel] for color in linear) for channel in range(4)],
                "linearMax": [max(color[channel] for color in linear) for channel in range(4)],
            }
        report["objects"].append(
            {
                "name": obj.name,
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
                "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
                "colorAttributes": [attribute.name for attribute in mesh.color_attributes],
                "colorStats": color_stats,
                "uvLayers": [layer.name for layer in mesh.uv_layers],
                "bounds": {"min": mins, "max": maxs},
            }
        )

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
