import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--action", default="idle")
    parser.add_argument("--frame", type=int, default=30)
    parser.add_argument("--expression", default="")
    parser.add_argument("--expression-weight", type=float, default=1.0)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main():
    args = parse_args()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 600
    scene.render.resolution_y = 750
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.color = (0.025, 0.025, 0.035)

    armature = bpy.data.objects.get("Raon_Production_Humanoid") or bpy.data.objects.get("Raon_Humanoid")
    if armature is None:
        armature = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
    action = bpy.data.actions.get(args.action)
    if armature and action:
        armature.animation_data_create()
        armature.animation_data.action = action
    if args.expression:
        for obj in scene.objects:
            shape_keys = getattr(getattr(obj, "data", None), "shape_keys", None)
            key = shape_keys.key_blocks.get(args.expression) if shape_keys else None
            if key:
                key.value = max(0.0, min(1.0, args.expression_weight))
    scene.frame_set(args.frame)

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.25, -3.8, 1.72)
    camera_data.lens = 72
    point_camera(camera, (0, 0, 0.92))
    scene.camera = camera

    key_data = bpy.data.lights.new("Key", type="AREA")
    key = bpy.data.objects.new("Key", key_data)
    bpy.context.collection.objects.link(key)
    key.location = (-2.4, -2.6, 3.4)
    key_data.energy = 1100
    key_data.shape = "DISK"
    key_data.size = 3.0

    fill_data = bpy.data.lights.new("Fill", type="AREA")
    fill = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (2.7, -1.4, 2.1)
    fill_data.energy = 720
    fill_data.size = 2.5

    rim_data = bpy.data.lights.new("Rim", type="AREA")
    rim = bpy.data.objects.new("Rim", rim_data)
    bpy.context.collection.objects.link(rim)
    rim.location = (0.5, 2.2, 2.8)
    rim_data.energy = 1250
    rim_data.color = (0.55, 0.65, 1.0)
    rim_data.size = 2.0

    ground_data = bpy.data.meshes.new("Ground")
    ground = bpy.data.objects.new("Ground", ground_data)
    bpy.context.collection.objects.link(ground)
    ground_data.from_pydata([(-4, -4, 0), (4, -4, 0), (4, 4, 0), (-4, 4, 0)], [], [(0, 1, 2, 3)])
    ground_material = bpy.data.materials.new("GroundMaterial")
    ground_material.use_nodes = True
    ground_material.diffuse_color = (0.035, 0.04, 0.055, 1)
    ground_material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.035, 0.04, 0.055, 1)
    ground_material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.82
    ground.data.materials.append(ground_material)

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(str(output))


if __name__ == "__main__":
    main()
