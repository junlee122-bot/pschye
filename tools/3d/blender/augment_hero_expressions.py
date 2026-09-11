import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_hero_pilot import build_animations


EXPRESSION_CLIPS = {
    "expressionSmile": {
        1: {},
        12: {"Mouth_Smile_Left": 1.0, "Mouth_Smile_Right": 1.0, "Cheek_Puff": 0.18},
        24: {},
    },
    "expressionBlink": {
        1: {},
        5: {"Blink_Left": 1.0, "Blink_Right": 1.0},
        9: {},
    },
    "expressionConcern": {
        1: {},
        14: {"Brow_Inner_Up": 0.75, "Mouth_Frown_Left": 0.45, "Mouth_Frown_Right": 0.45},
        28: {},
    },
    "expressionTalk": {
        1: {},
        8: {"Viseme_AA": 0.9, "Jaw_Open": 0.35},
        16: {"Viseme_OH": 0.85},
        24: {"Viseme_FV": 0.8},
        32: {},
    },
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def add_eye_shape(hero, name, delta_x):
    shape_keys = hero.data.shape_keys
    if shape_keys and shape_keys.key_blocks.get(name):
        return
    key = hero.shape_key_add(name=name, from_mix=False)
    front_vertices = [
        vertex for vertex in hero.data.vertices
        if 1.555 < vertex.co.z < 1.62 and abs(vertex.co.x) < 0.14 and vertex.co.y < -0.01
    ]
    for vertex in front_vertices:
        key.data[vertex.index].co.x += delta_x
    key.slider_min = 0.0
    key.slider_max = 1.0


def build_expression_animations(hero):
    shape_keys = hero.data.shape_keys
    if not shape_keys:
        raise RuntimeError("Facial shape keys are missing")
    shape_keys.animation_data_create()
    all_key_names = [key.name for key in shape_keys.key_blocks if key.name != "Basis"]
    clips = []
    for name, frames in EXPRESSION_CLIPS.items():
        previous = bpy.data.actions.get(name)
        if previous:
            bpy.data.actions.remove(previous)
        action = bpy.data.actions.new(name=name)
        action.use_fake_user = True
        shape_keys.animation_data.action = action
        for key_name in all_key_names:
            shape_keys.key_blocks[key_name].value = 0.0
        for frame, values in frames.items():
            for key_name in all_key_names:
                key = shape_keys.key_blocks[key_name]
                key.value = values.get(key_name, 0.0)
                key.keyframe_insert(data_path="value", frame=frame, group="Facial Expressions")
        clips.append(action)
    shape_keys.animation_data.action = None
    for key_name in all_key_names:
        shape_keys.key_blocks[key_name].value = 0.0
    return clips


def install_nla_tracks(owner, actions):
    owner.animation_data_create()
    owner.animation_data.action = None
    for track in list(owner.animation_data.nla_tracks):
        owner.animation_data.nla_tracks.remove(track)
    for action in actions:
        track = owner.animation_data.nla_tracks.new()
        track.name = action.name
        start = int(action.frame_range[0])
        strip = track.strips.new(action.name, start, action)
        strip.name = action.name


def export_nla(path, objects):
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
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_morph=True,
        export_vertex_color="NONE",
        export_image_format="WEBP",
        export_image_quality=76,
        export_image_webp_fallback=False,
        export_unused_images=False,
        export_unused_textures=False,
    )


def main():
    args = parse_args()
    hero = bpy.data.objects.get("Raon_Retopo_LOD0")
    armature = bpy.data.objects.get("Raon_Production_Humanoid")
    hair = bpy.data.objects.get("Raon_HairCards")
    if not hero or not armature or not hair:
        raise RuntimeError("Production hero, armature or hair cards are missing from the blend file")
    add_eye_shape(hero, "Eye_Look_Left", 0.006)
    add_eye_shape(hero, "Eye_Look_Right", -0.006)
    required_actions = {
        "idle", "walk", "run", "sprint", "jump", "land",
        "dodge", "attackLight", "attackHeavy", "guard", "hit", "talkNeutral",
    }
    if not required_actions.issubset({action.name for action in bpy.data.actions}):
        for action in list(bpy.data.actions):
            bpy.data.actions.remove(action)
        clips = build_animations(armature)
    else:
        clips = [bpy.data.actions[name] for name in sorted(required_actions)]
    expression_clips = build_expression_animations(hero)
    clips.extend(expression_clips)
    for action in clips:
        action.use_fake_user = True

    body_clips = [action for action in clips if action.name not in EXPRESSION_CLIPS]
    install_nla_tracks(armature, body_clips)
    install_nla_tracks(hero.data.shape_keys, expression_clips)

    output = Path(args.output).resolve()
    export_nla(output, [armature, hero, hair])
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)

    report_path = Path(args.report).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["shapeKeys"] = [key.name for key in hero.data.shape_keys.key_blocks if key.name != "Basis"]
    report["animations"] = [action.name for action in clips]
    report["expressionAnimations"] = [action.name for action in expression_clips]
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"shapeKeys": report["shapeKeys"], "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
