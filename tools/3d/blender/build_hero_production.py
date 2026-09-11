import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_hero_pilot import build_animations, create_armature, skin_mesh


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--texture-dir", required=True)
    parser.add_argument("--target-faces", type=int, default=28000)
    parser.add_argument("--texture-size", type=int, default=2048)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


MATERIALS = {
    "Skin": ((0.48, 0.27, 0.17), 0.52, 0.0, "skin"),
    "Hair": ((0.035, 0.018, 0.009), 0.4, 0.0, "hair"),
    "Shirt": ((0.42, 0.34, 0.23), 0.74, 0.0, "cloth"),
    "Coat": ((0.018, 0.027, 0.05), 0.62, 0.03, "cloth"),
    "Leather": ((0.07, 0.032, 0.014), 0.5, 0.0, "leather"),
    "Metal": ((0.1, 0.12, 0.16), 0.25, 0.9, "metal"),
    "Gold": ((0.3, 0.13, 0.025), 0.3, 0.75, "gold"),
}


def save_image(name, pixels, path, colorspace="sRGB"):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=True, float_buffer=False)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    return image


def make_pattern(size, kind, seed):
    rng = np.random.default_rng(seed)
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    x, y = np.meshgrid(axis, axis)
    noise = rng.normal(0.0, 1.0, (size, size)).astype(np.float32)
    if kind == "skin":
        pattern = noise * 0.025 + np.sin(x * 160.0) * np.sin(y * 143.0) * 0.008
    elif kind == "hair":
        pattern = np.sin(x * math.tau * 72.0 + np.sin(y * 14.0) * 2.0) * 0.08 + noise * 0.018
    elif kind == "cloth":
        weave = np.sin(x * math.tau * 96.0) * np.sin(y * math.tau * 96.0)
        pattern = weave * 0.035 + noise * 0.012
    elif kind == "leather":
        grain = np.sin((x + noise * 0.004) * math.tau * 24.0) * np.sin(y * math.tau * 31.0)
        pattern = grain * 0.035 + noise * 0.026
    elif kind in {"metal", "gold"}:
        brushed = np.sin(y * math.tau * 210.0 + np.sin(x * 11.0))
        pattern = brushed * 0.025 + noise * 0.009
    else:
        pattern = noise * 0.015
    return np.clip(pattern, -0.12, 0.12)


def generate_pbr_set(texture_dir, size):
    texture_dir.mkdir(parents=True, exist_ok=True)
    generated = {}
    for index, (role, (base, roughness, metallic, kind)) in enumerate(MATERIALS.items()):
        pattern = make_pattern(size, kind, 9137 + index * 101)
        base_pixels = np.ones((size, size, 4), dtype=np.float32)
        tint = np.array(base, dtype=np.float32)
        base_pixels[..., :3] = np.clip(tint[None, None, :] * (1.0 + pattern[..., None]), 0.0, 1.0)

        gradient_y, gradient_x = np.gradient(pattern)
        normal = np.dstack((-gradient_x * 3.0, -gradient_y * 3.0, np.ones_like(pattern)))
        normal /= np.linalg.norm(normal, axis=2, keepdims=True)
        normal_pixels = np.ones((size, size, 4), dtype=np.float32)
        normal_pixels[..., :3] = normal * 0.5 + 0.5

        orm_pixels = np.ones((size, size, 4), dtype=np.float32)
        orm_pixels[..., 0] = np.clip(0.94 - np.abs(pattern) * 0.35, 0.72, 1.0)
        orm_pixels[..., 1] = np.clip(roughness + pattern * 0.45, 0.08, 0.96)
        orm_pixels[..., 2] = metallic

        prefix = f"Raon_{role}"
        base_image = save_image(f"{prefix}_BaseColor", base_pixels, texture_dir / f"{prefix}_BaseColor.png")
        normal_image = save_image(f"{prefix}_Normal", normal_pixels, texture_dir / f"{prefix}_Normal.png", "Non-Color")
        orm_image = save_image(f"{prefix}_ORM", orm_pixels, texture_dir / f"{prefix}_ORM.png", "Non-Color")
        generated[role] = {
            "base": base_image,
            "normal": normal_image,
            "orm": orm_image,
            "roughness": roughness,
            "metallic": metallic,
        }
    return generated


def create_pbr_material(role, images, alpha=False):
    material = bpy.data.materials.new(f"Raon_{role}_PBR")
    material.use_nodes = True
    material.use_backface_culling = not alpha
    if alpha:
        material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.image = images["base"]
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.image = images["normal"]
    normal_node.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.image = images["orm"]
    orm_node.image.colorspace_settings.name = "Non-Color"
    separate = nodes.new("ShaderNodeSeparateColor")
    gltf_output_group = bpy.data.node_groups.get("glTF Material Output")
    if gltf_output_group is None:
        gltf_output_group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        gltf_output_group.interface.new_socket(
            name="Occlusion",
            in_out="INPUT",
            socket_type="NodeSocketFloat",
        )
    gltf_output = nodes.new("ShaderNodeGroup")
    gltf_output.node_tree = gltf_output_group
    links.new(base_node.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Red"], gltf_output.inputs["Occlusion"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])
    if alpha:
        links.new(base_node.outputs["Alpha"], principled.inputs["Alpha"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return material


def assign_materials(obj, texture_sets):
    obj.data.materials.clear()
    role_indices = {}
    for role in MATERIALS:
        role_indices[role] = len(obj.data.materials)
        obj.data.materials.append(create_pbr_material(role, texture_sets[role]))

    for polygon in obj.data.polygons:
        center = obj.matrix_world @ polygon.center
        x, y, z = center
        front = y < -0.05
        if (z > 1.47 and front) or (abs(x) > 0.25 and 0.85 < z < 1.14):
            role = "Skin"
        elif z > 1.53:
            role = "Hair"
        elif abs(x) < 0.18 and 1.08 < z < 1.45 and front:
            role = "Shirt"
        elif abs(x) > 0.16 and 1.15 < z < 1.48:
            role = "Metal"
        elif z < 0.34 or 0.84 < z < 1.04:
            role = "Leather"
        elif abs(x) < 0.24 and 0.86 < z < 1.14 and not front:
            role = "Gold"
        else:
            role = "Coat"
        polygon.material_index = role_indices[role]


def retopologize(source, target_faces):
    source.name = "Raon_Retopo_LOD0"
    reference = source.copy()
    reference.data = source.data.copy()
    reference.name = "Raon_HighPoly_Reference"
    bpy.context.collection.objects.link(reference)
    reference.hide_render = True
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    before = {"vertices": len(source.data.vertices), "polygons": len(source.data.polygons)}
    mode = "quad-remesh-modifier-depth7"
    modifier = source.modifiers.new("Deformation_Quad_Retopo", "REMESH")
    modifier.mode = "SMOOTH"
    modifier.octree_depth = 7
    modifier.scale = 0.9
    modifier.threshold = 1.0
    modifier.use_remove_disconnected = True
    modifier.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    voxel_stage = {"vertices": len(source.data.vertices), "polygons": len(source.data.polygons)}
    shrinkwrap = source.modifiers.new("Retopo_Surface_Projection", "SHRINKWRAP")
    shrinkwrap.target = reference
    shrinkwrap.wrap_method = "NEAREST_SURFACEPOINT"
    shrinkwrap.wrap_mode = "ON_SURFACE"
    bpy.ops.object.modifier_apply(modifier=shrinkwrap.name)
    for polygon in source.data.polygons:
        polygon.use_smooth = True
    after = {"vertices": len(source.data.vertices), "polygons": len(source.data.polygons)}
    after["quadRatio"] = sum(1 for polygon in source.data.polygons if len(polygon.vertices) == 4) / max(1, len(source.data.polygons))
    bpy.data.objects.remove(reference, do_unlink=True)
    return mode, before, voxel_stage, after


def ensure_uv(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=0.018, area_weight=0.2)
    bpy.ops.object.mode_set(mode="OBJECT")


def create_shape_keys(obj):
    basis = obj.shape_key_add(name="Basis", from_mix=False)
    basis.interpolation = "KEY_LINEAR"
    coordinates = np.array([vertex.co[:] for vertex in obj.data.vertices], dtype=np.float32)
    x = coordinates[:, 0]
    y = coordinates[:, 1]
    z = coordinates[:, 2]
    head = z > 1.42
    front_threshold = np.quantile(y[head], 0.42) if np.any(head) else -0.05
    front = head & (y <= front_threshold)

    shapes = {
        "Blink_Left": np.zeros_like(coordinates),
        "Blink_Right": np.zeros_like(coordinates),
        "Eye_Look_Left": np.zeros_like(coordinates),
        "Eye_Look_Right": np.zeros_like(coordinates),
        "Brow_Inner_Up": np.zeros_like(coordinates),
        "Brow_Down_Left": np.zeros_like(coordinates),
        "Brow_Down_Right": np.zeros_like(coordinates),
        "Jaw_Open": np.zeros_like(coordinates),
        "Mouth_Smile_Left": np.zeros_like(coordinates),
        "Mouth_Smile_Right": np.zeros_like(coordinates),
        "Mouth_Frown_Left": np.zeros_like(coordinates),
        "Mouth_Frown_Right": np.zeros_like(coordinates),
        "Mouth_Pucker": np.zeros_like(coordinates),
        "Mouth_Wide": np.zeros_like(coordinates),
        "Cheek_Puff": np.zeros_like(coordinates),
        "Nose_Sneer_Left": np.zeros_like(coordinates),
        "Nose_Sneer_Right": np.zeros_like(coordinates),
        "Viseme_AA": np.zeros_like(coordinates),
        "Viseme_OH": np.zeros_like(coordinates),
        "Viseme_FV": np.zeros_like(coordinates),
    }

    left_eye = front & (x > 0.015) & (x < 0.14) & (z > 1.555) & (z < 1.62)
    right_eye = front & (x < -0.015) & (x > -0.14) & (z > 1.555) & (z < 1.62)
    eye_center = 1.586
    shapes["Blink_Left"][left_eye, 2] = (eye_center - z[left_eye]) * 0.85
    shapes["Blink_Right"][right_eye, 2] = (eye_center - z[right_eye]) * 0.85
    eye_region = left_eye | right_eye
    shapes["Eye_Look_Left"][eye_region, 0] = 0.006
    shapes["Eye_Look_Right"][eye_region, 0] = -0.006

    brow = front & (z > 1.61) & (z < 1.68) & (np.abs(x) < 0.15)
    shapes["Brow_Inner_Up"][brow, 2] = 0.018 * (1.0 - np.clip(np.abs(x[brow]) / 0.15, 0, 1))
    shapes["Brow_Down_Left"][brow & (x > 0), 2] = -0.014
    shapes["Brow_Down_Right"][brow & (x < 0), 2] = -0.014

    mouth = front & (z > 1.47) & (z < 1.545) & (np.abs(x) < 0.13)
    lower_mouth = mouth & (z < 1.51)
    shapes["Jaw_Open"][lower_mouth, 2] = -0.055
    shapes["Jaw_Open"][lower_mouth, 1] = -0.012
    shapes["Viseme_AA"][lower_mouth, 2] = -0.035
    shapes["Viseme_OH"][mouth, 0] = -np.sign(x[mouth]) * 0.014
    shapes["Viseme_OH"][lower_mouth, 2] = -0.02
    shapes["Viseme_FV"][lower_mouth, 2] = 0.012

    left_corner = mouth & (x > 0.055)
    right_corner = mouth & (x < -0.055)
    shapes["Mouth_Smile_Left"][left_corner, 2] = 0.022
    shapes["Mouth_Smile_Left"][left_corner, 0] = 0.012
    shapes["Mouth_Smile_Right"][right_corner, 2] = 0.022
    shapes["Mouth_Smile_Right"][right_corner, 0] = -0.012
    shapes["Mouth_Frown_Left"][left_corner, 2] = -0.018
    shapes["Mouth_Frown_Right"][right_corner, 2] = -0.018
    shapes["Mouth_Pucker"][mouth, 0] = -np.sign(x[mouth]) * 0.02
    shapes["Mouth_Pucker"][mouth, 1] = -0.012
    shapes["Mouth_Wide"][mouth, 0] = np.sign(x[mouth]) * 0.018

    cheeks = front & (z > 1.50) & (z < 1.59) & (np.abs(x) > 0.07) & (np.abs(x) < 0.18)
    shapes["Cheek_Puff"][cheeks, 1] = -0.018
    nose = front & (z > 1.545) & (z < 1.595) & (np.abs(x) < 0.09)
    shapes["Nose_Sneer_Left"][nose & (x > 0), 2] = 0.013
    shapes["Nose_Sneer_Right"][nose & (x < 0), 2] = 0.013

    for name, offsets in shapes.items():
        key = obj.shape_key_add(name=name, from_mix=False)
        for index, offset in enumerate(offsets):
            if np.any(offset):
                key.data[index].co = coordinates[index] + offset
        key.slider_min = 0.0
        key.slider_max = 1.0
    return list(shapes)


def create_hair_atlas(texture_dir, size):
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    x, y = np.meshgrid(axis, axis)
    strands = np.power(np.maximum(0.0, np.cos((x * 42.0 + np.sin(y * 13.0) * 0.55) * math.pi)), 18.0)
    edge = np.clip(np.sin(x * math.pi) * 2.4, 0.0, 1.0)
    taper = np.clip(np.sin(y * math.pi) * 1.7, 0.0, 1.0)
    alpha = np.clip((0.18 + strands * 0.88) * edge * taper, 0.0, 1.0)
    base = np.ones((size, size, 4), dtype=np.float32)
    variation = 0.7 + strands * 0.3
    base[..., 0] = 0.055 * variation
    base[..., 1] = 0.026 * variation
    base[..., 2] = 0.012 * variation
    base[..., 3] = alpha
    return save_image("Raon_HairCards_BaseColor", base, texture_dir / "Raon_HairCards_BaseColor.png")


def create_hair_cards(armature, texture_dir, size):
    atlas = create_hair_atlas(texture_dir, size)
    material = bpy.data.materials.new("Raon_HairCards")
    material.use_nodes = True
    material.use_backface_culling = False
    material.surface_render_method = "DITHERED"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = atlas
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
    principled.inputs["Roughness"].default_value = 0.42

    vertices = []
    uvs = []
    faces = []
    card_count = 32
    for index in range(card_count):
        angle = math.tau * index / card_count
        back_bias = 0.82 + 0.18 * max(0.0, math.sin(angle))
        radius_x = 0.115
        radius_y = 0.105
        root = Vector((math.cos(angle) * radius_x, math.sin(angle) * radius_y + 0.015, 1.68))
        length = 0.25 + 0.18 * back_bias + 0.035 * math.sin(index * 2.7)
        width = 0.042 + 0.012 * (index % 3)
        outward = Vector((math.cos(angle), math.sin(angle), 0.0)).normalized()
        tangent = Vector((-math.sin(angle), math.cos(angle), 0.0)).normalized()
        middle = root + outward * 0.045 + Vector((0, 0, -length * 0.48))
        tip = root + outward * 0.07 + Vector((0, 0, -length))
        start = len(vertices)
        vertices.extend([
            root - tangent * width,
            root + tangent * width,
            middle - tangent * width * 0.82,
            middle + tangent * width * 0.82,
            tip - tangent * width * 0.18,
            tip + tangent * width * 0.18,
        ])
        uvs.extend([(0, 0), (1, 0), (0, 0.5), (1, 0.5), (0.42, 1), (0.58, 1)])
        faces.extend([
            (start, start + 1, start + 3, start + 2),
            (start + 2, start + 3, start + 5, start + 4),
        ])

    mesh = bpy.data.meshes.new("Raon_HairCards")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    hair = bpy.data.objects.new("Raon_HairCards", mesh)
    bpy.context.collection.objects.link(hair)
    hair.data.materials.append(material)

    head_group = hair.vertex_groups.new(name="Head")
    head_group.add([vertex.index for vertex in hair.data.vertices], 1.0, "REPLACE")
    modifier = hair.modifiers.new(name="Raon_HairCards_Skin", type="ARMATURE")
    modifier.object = armature
    hair.parent = armature
    hair.matrix_parent_inverse = armature.matrix_world.inverted()
    return hair, card_count


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
        export_vertex_color="NONE",
        export_image_format="WEBP",
        export_image_quality=76,
        export_image_webp_fallback=False,
        export_unused_images=False,
        export_unused_textures=False,
    )


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one source mesh, found {len(meshes)}")
    hero = meshes[0]
    retopo_mode, before, voxel_stage, after = retopologize(hero, args.target_faces)
    ensure_uv(hero)
    texture_dir = Path(args.texture_dir).resolve()
    texture_sets = generate_pbr_set(texture_dir, args.texture_size)
    assign_materials(hero, texture_sets)
    lod1 = create_lod(hero, "Raon_Production_LOD1", 0.55)
    lod2 = create_lod(hero, "Raon_Production_LOD2", 0.25)
    shape_keys = create_shape_keys(hero)

    armature = create_armature()
    armature.name = "Raon_Production_Humanoid"
    armature.data.name = "Raon_Production_Humanoid"
    armature["characterId"] = "raon"
    armature["canonicalHeightMeters"] = 1.78
    armature["targetEngine"] = "Unity 6 URP"
    armature["retopology"] = retopo_mode
    skin_mesh(hero, armature)
    skin_mesh(lod1, armature)
    skin_mesh(lod2, armature)
    clips = build_animations(armature)
    for action in clips:
        action.use_fake_user = True
    hair, hair_card_count = create_hair_cards(armature, texture_dir, min(args.texture_size, 2048))

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    export_selection(output, [armature, hero, hair])

    lod1_path = output.with_name("raon-production-lod1-v2.glb")
    lod2_path = output.with_name("raon-production-lod2-v2.glb")
    export_selection(lod1_path, [armature, lod1, hair])
    export_selection(lod2_path, [armature, lod2, hair])

    blend_path = Path(args.blend).resolve()
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    report = {
        "characterId": "raon",
        "source": str(Path(args.input).resolve()),
        "runtime": str(output),
        "blend": str(blend_path),
        "retopology": {
            "mode": retopo_mode,
            "manual": False,
            "status": "automated deformation candidate; manual edge-loop pass remains required",
            "before": before,
            "voxelStage": voxel_stage,
            "after": after,
        },
        "vertices": len(hero.data.vertices),
        "polygons": len(hero.data.polygons),
        "materials": [material.name for material in hero.data.materials],
        "textureResolution": args.texture_size,
        "textureFiles": sorted(str(path) for path in texture_dir.glob("*.png")),
        "bones": len(armature.data.bones),
        "animations": [action.name for action in clips],
        "shapeKeys": shape_keys,
        "hairCards": hair_card_count,
        "lods": {
            "LOD0": {"polygons": len(hero.data.polygons), "triangles": triangle_count(hero)},
            "LOD1": {"polygons": len(lod1.data.polygons), "triangles": triangle_count(lod1)},
            "LOD2": {"polygons": len(lod2.data.polygons), "triangles": triangle_count(lod2)},
        },
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
