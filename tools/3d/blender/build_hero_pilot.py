import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def create_material(name, base_color, roughness, metallic):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*base_color, 1)
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*base_color, 1)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return material


def polygon_color(mesh, polygon):
    attribute = mesh.color_attributes.get("Color")
    if not attribute:
        return (0.25, 0.22, 0.2, 1)
    colors = []
    if attribute.domain == "CORNER":
        colors = [attribute.data[index].color_srgb for index in polygon.loop_indices]
    elif attribute.domain == "POINT":
        colors = [attribute.data[index].color_srgb for index in polygon.vertices]
    if not colors:
        return (0.25, 0.22, 0.2, 1)
    return tuple(sum(color[channel] for color in colors) / len(colors) for channel in range(4))


def assign_materials(obj):
    definitions = [
        ("Raon_Skin", (0.52, 0.31, 0.20), 0.52, 0.0),
        ("Raon_GoldTrim", (0.27, 0.12, 0.025), 0.3, 0.72),
        ("Raon_Hair", (0.025, 0.014, 0.009), 0.42, 0.0),
        ("Raon_Shirt", (0.38, 0.31, 0.22), 0.76, 0.0),
        ("Raon_Coat", (0.018, 0.026, 0.044), 0.64, 0.04),
        ("Raon_Leather", (0.055, 0.026, 0.012), 0.54, 0.0),
        ("Raon_Metal", (0.11, 0.13, 0.16), 0.24, 0.88),
    ]
    obj.data.materials.clear()
    for name, base_color, roughness, metallic in definitions:
        obj.data.materials.append(create_material(name, base_color, roughness, metallic))

    for polygon in obj.data.polygons:
        color = polygon_color(obj.data, polygon)
        red, green, blue = color[:3]
        brightness = (red + green + blue) / 3
        saturation = max(red, green, blue) - min(red, green, blue)
        center = obj.matrix_world @ polygon.center
        is_hand = abs(center.x) > 0.255 and 0.86 < center.z < 1.13
        is_face = center.z > 1.48 and red > blue * 1.06 and brightness > 0.26
        if is_hand or is_face:
            polygon.material_index = 0
        elif center.z > 1.55:
            polygon.material_index = 2
        elif abs(center.x) < 0.17 and 1.12 < center.z < 1.46 and brightness > 0.32:
            polygon.material_index = 3
        elif abs(center.x) > 0.17 and 1.18 < center.z < 1.48 and saturation < 0.2:
            polygon.material_index = 6
        elif center.z < 0.34 or 0.84 < center.z < 1.02:
            polygon.material_index = 5
        elif saturation > 0.18 and red > blue * 1.2 and brightness < 0.5:
            polygon.material_index = 1
        else:
            polygon.material_index = 4


def create_armature():
    armature_data = bpy.data.armatures.new("Raon_Humanoid")
    armature = bpy.data.objects.new("Raon_Humanoid", armature_data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    armature.show_in_front = True
    bpy.ops.object.mode_set(mode="EDIT")

    bones = {}

    def add(name, head, tail, parent=None, deform=True):
        bone = armature_data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        bone.use_deform = deform
        if parent:
            bone.parent = bones[parent]
        bones[name] = bone

    add("Root", (0, 0, 0), (0, 0, 0.18), deform=False)
    add("Hips", (0, 0, 0.86), (0, 0, 1.0), "Root")
    add("Spine", (0, 0, 0.98), (0, 0, 1.15), "Hips")
    add("Chest", (0, 0, 1.14), (0, 0, 1.33), "Spine")
    add("UpperChest", (0, 0, 1.31), (0, 0, 1.46), "Chest")
    add("Neck", (0, 0, 1.44), (0, 0, 1.55), "UpperChest")
    add("Head", (0, 0, 1.53), (0, 0, 1.76), "Neck")

    for side, direction in (("Left", 1), ("Right", -1)):
        add(f"{side}UpperLeg", (0.105 * direction, 0, 0.9), (0.115 * direction, 0, 0.51), "Hips")
        add(f"{side}LowerLeg", (0.115 * direction, 0, 0.52), (0.105 * direction, 0, 0.13), f"{side}UpperLeg")
        add(f"{side}Foot", (0.105 * direction, 0, 0.14), (0.105 * direction, -0.18, 0.07), f"{side}LowerLeg")
        add(f"{side}Toes", (0.105 * direction, -0.16, 0.07), (0.105 * direction, -0.28, 0.065), f"{side}Foot")
        add(f"{side}Shoulder", (0.05 * direction, 0, 1.42), (0.18 * direction, 0, 1.4), "UpperChest")
        add(f"{side}UpperArm", (0.17 * direction, 0, 1.39), (0.24 * direction, 0, 1.22), f"{side}Shoulder")
        add(f"{side}LowerArm", (0.24 * direction, 0, 1.22), (0.31 * direction, 0, 1.02), f"{side}UpperArm")
        add(f"{side}Hand", (0.31 * direction, 0, 1.03), (0.33 * direction, 0, 0.91), f"{side}LowerArm")
        for finger_index, finger in enumerate(("Thumb", "Index", "Middle", "Ring", "Little")):
            y_offset = -0.025 + finger_index * 0.012
            add(
                f"{side}{finger}Proximal",
                (0.325 * direction, y_offset, 0.98),
                (0.35 * direction, y_offset, 0.94),
                f"{side}Hand",
            )

    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def normalize_weights(vertex_groups, entries):
    total = sum(weight for _, weight in entries)
    if total <= 0:
        return
    for name, weight in entries:
        vertex_groups[name].add([entries.vertex_index], weight / total, "REPLACE")


def skin_mesh(obj, armature):
    bone_names = [bone.name for bone in armature.data.bones if bone.use_deform]
    groups = {name: obj.vertex_groups.new(name=name) for name in bone_names}

    def apply(vertex, entries):
        total = sum(weight for _, weight in entries)
        for name, weight in entries:
            groups[name].add([vertex.index], weight / total, "REPLACE")

    for vertex in obj.data.vertices:
        position = obj.matrix_world @ vertex.co
        x, _, z = position
        side = "Left" if x >= 0 else "Right"
        arm_region = abs(x) > 0.17 and 0.84 < z < 1.46
        if arm_region:
            if z < 0.98:
                entries = [(f"{side}Hand", 0.82), (f"{side}LowerArm", 0.18)]
            elif z < 1.17:
                blend = (z - 0.98) / 0.19
                entries = [(f"{side}LowerArm", 1 - blend * 0.35), (f"{side}UpperArm", blend * 0.35)]
            else:
                blend = min(1.0, (z - 1.17) / 0.25)
                entries = [(f"{side}UpperArm", 1 - blend * 0.35), (f"{side}Shoulder", blend * 0.35)]
        elif z < 0.16:
            entries = [(f"{side}Foot", 0.9), (f"{side}Toes", 0.1)]
        elif z < 0.54:
            blend = (z - 0.16) / 0.38
            entries = [(f"{side}LowerLeg", 0.85), (f"{side}UpperLeg", 0.15 * blend)]
        elif z < 0.94:
            blend = (z - 0.54) / 0.4
            entries = [(f"{side}UpperLeg", 0.82), ("Hips", 0.18 * blend)]
        elif z < 1.11:
            blend = (z - 0.94) / 0.17
            entries = [("Hips", 1 - blend * 0.55), ("Spine", 0.45 + blend * 0.1)]
        elif z < 1.31:
            blend = (z - 1.11) / 0.2
            entries = [("Spine", 1 - blend), ("Chest", blend)]
        elif z < 1.48:
            blend = (z - 1.31) / 0.17
            entries = [("Chest", 1 - blend), ("UpperChest", blend)]
        elif z < 1.57:
            blend = (z - 1.48) / 0.09
            entries = [("Neck", 1 - blend * 0.35), ("Head", blend * 0.35)]
        else:
            entries = [("Head", 1.0)]
        apply(vertex, entries)

    modifier = obj.modifiers.new(name="Raon_Humanoid_Skin", type="ARMATURE")
    modifier.object = armature
    obj.parent = armature


def reset_pose(armature):
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)


def key_pose(armature, frame, rotations=None, locations=None):
    rotations = rotations or {}
    locations = locations or {}
    for name, rotation in rotations.items():
        bone = armature.pose.bones.get(name)
        if bone:
            bone.rotation_euler = rotation
            bone.keyframe_insert("rotation_euler", frame=frame, group=name)
    for name, location in locations.items():
        bone = armature.pose.bones.get(name)
        if bone:
            bone.location = location
            bone.keyframe_insert("location", frame=frame, group=name)


def create_action(armature, name, frame_end, poses):
    reset_pose(armature)
    action = bpy.data.actions.new(name)
    armature.animation_data_create()
    armature.animation_data.action = action
    for frame, rotations, locations in poses:
        key_pose(armature, frame, rotations, locations)
    armature.animation_data.action = None
    return action


def build_animations(armature):
    clips = []
    clips.append(create_action(armature, "idle", 60, [
        (1, {"Chest": (0, 0, -0.015), "Head": (0.01, 0, 0)}, {"Hips": (0, 0, 0)}),
        (30, {"Chest": (0.018, 0, 0.015), "Head": (-0.01, 0, 0.012)}, {"Hips": (0, 0, 0.008)}),
        (60, {"Chest": (0, 0, -0.015), "Head": (0.01, 0, 0)}, {"Hips": (0, 0, 0)}),
    ]))

    def locomotion(name, frames, amplitude, stride):
        return create_action(armature, name, frames, [
            (1, {"LeftUpperLeg": (stride, 0, 0), "RightUpperLeg": (-stride, 0, 0), "LeftUpperArm": (-stride * 0.7, 0, 0), "RightUpperArm": (stride * 0.7, 0, 0)}, {"Hips": (0, 0, amplitude)}),
            (frames // 2, {"LeftUpperLeg": (-stride, 0, 0), "RightUpperLeg": (stride, 0, 0), "LeftUpperArm": (stride * 0.7, 0, 0), "RightUpperArm": (-stride * 0.7, 0, 0)}, {"Hips": (0, 0, -amplitude)}),
            (frames, {"LeftUpperLeg": (stride, 0, 0), "RightUpperLeg": (-stride, 0, 0), "LeftUpperArm": (-stride * 0.7, 0, 0), "RightUpperArm": (stride * 0.7, 0, 0)}, {"Hips": (0, 0, amplitude)}),
        ])

    clips.extend([
        locomotion("walk", 30, 0.018, 0.34),
        locomotion("run", 24, 0.03, 0.58),
        locomotion("sprint", 20, 0.045, 0.78),
        create_action(armature, "jump", 24, [(1, {"LeftUpperLeg": (-0.2, 0, 0), "RightUpperLeg": (-0.2, 0, 0)}, {"Hips": (0, 0, -0.05)}), (12, {"Chest": (-0.16, 0, 0)}, {"Hips": (0, 0, 0.28)}), (24, {"LeftUpperLeg": (0.18, 0, 0), "RightUpperLeg": (0.18, 0, 0)}, {"Hips": (0, 0, 0.05)})]),
        create_action(armature, "land", 18, [(1, {"Chest": (-0.12, 0, 0)}, {"Hips": (0, 0, 0.1)}), (9, {"LeftUpperLeg": (0.42, 0, 0), "RightUpperLeg": (0.42, 0, 0), "Chest": (0.22, 0, 0)}, {"Hips": (0, 0, -0.18)}), (18, {}, {"Hips": (0, 0, 0)})]),
        create_action(armature, "dodge", 18, [(1, {}, {"Hips": (0, 0, 0)}), (9, {"Chest": (0, 0, -0.35)}, {"Hips": (0.42, 0, -0.08)}), (18, {}, {"Hips": (0, 0, 0)})]),
        create_action(armature, "attackLight", 24, [(1, {"RightUpperArm": (-0.25, 0.15, -0.45), "RightLowerArm": (-0.3, 0, 0)}, {}), (12, {"Chest": (0, 0, 0.45), "RightUpperArm": (-0.9, 0.1, 0.65), "RightLowerArm": (-0.5, 0, 0)}, {}), (24, {}, {})]),
        create_action(armature, "attackHeavy", 34, [(1, {"RightUpperArm": (-1.0, 0.15, -0.2), "LeftUpperArm": (-0.8, -0.1, 0.25)}, {}), (20, {"Chest": (0.2, 0, 0.65), "RightUpperArm": (-0.5, 0.1, 0.85), "LeftUpperArm": (-0.35, 0, 0.6)}, {"Hips": (0, 0, -0.08)}), (34, {}, {})]),
        create_action(armature, "guard", 30, [(1, {"RightUpperArm": (-0.55, 0, 0.35), "LeftUpperArm": (-0.55, 0, -0.35), "RightLowerArm": (-0.6, 0, 0), "LeftLowerArm": (-0.6, 0, 0)}, {}), (30, {"RightUpperArm": (-0.55, 0, 0.35), "LeftUpperArm": (-0.55, 0, -0.35), "RightLowerArm": (-0.6, 0, 0), "LeftLowerArm": (-0.6, 0, 0)}, {})]),
        create_action(armature, "hit", 16, [(1, {}, {}), (7, {"Chest": (0.16, 0, -0.28), "Head": (-0.08, 0, 0.18)}, {"Hips": (0, 0.08, -0.04)}), (16, {}, {})]),
        create_action(armature, "talkNeutral", 75, [(1, {"Head": (0, 0, -0.04)}, {}), (24, {"Head": (0.025, 0, 0.05), "Chest": (0, 0, 0.015)}, {}), (48, {"Head": (-0.015, 0, -0.02)}, {}), (75, {"Head": (0, 0, -0.04)}, {})]),
    ])
    armature["animationClips"] = [action.name for action in clips]
    return clips


def ensure_uv(obj):
    if obj.data.uv_layers:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def export_selection(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(Path(path).resolve()),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=True,
        export_vertex_color="ACTIVE",
    )


def create_lod(source, name, ratio):
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = name
    duplicate.data.name = name
    bpy.context.collection.objects.link(duplicate)
    modifier = duplicate.modifiers.new(name=f"{name}_Decimate", type="DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = duplicate
    duplicate.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return duplicate


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one source mesh, found {len(meshes)}")
    hero = meshes[0]
    hero.name = "Raon_LOD0"
    hero.data.name = "Raon_LOD0"
    ensure_uv(hero)
    assign_materials(hero)

    armature = create_armature()
    armature["characterId"] = "raon"
    armature["canonicalHeightMeters"] = 1.78
    armature["targetEngine"] = "Unity 6 URP"
    skin_mesh(hero, armature)
    clips = build_animations(armature)

    lod1_marker = bpy.data.objects.new("Raon_LOD1_AVAILABLE", None)
    lod2_marker = bpy.data.objects.new("Raon_LOD2_AVAILABLE", None)
    bpy.context.collection.objects.link(lod1_marker)
    bpy.context.collection.objects.link(lod2_marker)
    armature["lodFiles"] = ["raon-blender-rigged-lod1-v1.glb", "raon-blender-rigged-lod2-v1.glb"]

    output = Path(args.output).resolve()
    export_selection(output, [armature, hero, lod1_marker, lod2_marker])
    lod1 = create_lod(hero, "Raon_LOD1", 0.55)
    lod2 = create_lod(hero, "Raon_LOD2", 0.22)
    export_selection(output.with_name("raon-blender-rigged-lod1-v1.glb"), [armature, lod1])
    export_selection(output.with_name("raon-blender-rigged-lod2-v1.glb"), [armature, lod2])

    blend_path = Path(args.blend).resolve()
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    report = {
        "characterId": "raon",
        "source": str(Path(args.input).resolve()),
        "runtime": str(output),
        "blend": str(blend_path),
        "vertices": len(hero.data.vertices),
        "triangles": len(hero.data.polygons),
        "materials": [material.name for material in hero.data.materials],
        "bones": len(armature.data.bones),
        "animations": [action.name for action in clips],
        "lods": {
            "LOD0": len(hero.data.polygons),
            "LOD1": len(lod1.data.polygons),
            "LOD2": len(lod2.data.polygons),
        },
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
