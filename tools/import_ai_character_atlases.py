from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

import generate_character_assets as base


ROOT = Path(__file__).resolve().parents[1]
GENERATED = Path(r"C:\Users\이승준\.codex\generated_images\019f623a-d939-7d71-92e5-a783247ab881")
OUTPUT = ROOT / "public" / "art" / "characters"

ATLASES = {
    "evan": "exec-175f64b5-051d-41b9-95b7-e3fca5765888.png",
    "eitan": "exec-c44002f8-c6db-4456-a7a8-412802c20533.png",
    "akari": "exec-dd46ea16-2dc8-425f-bffe-64be4c11d25f.png",
    "bellatrice": "exec-acf9d668-8c6a-4189-bc2e-6af74bc5f043.png",
    "boksonga": "exec-5646d1e3-ad69-4e66-958c-84683c6eb774.png",
    "laila": "exec-c4940b46-2e6a-46b1-8153-3f8e6c9164d3.png",
    "yeri": "exec-d29ec366-541a-4cb0-8fac-5f7b77aad5d8.png",
    "night": "exec-d2701405-e2bb-47de-9b1b-e30723c8d8d0.png",
    "colin": "exec-231d062a-20be-4a7e-881c-025911242827.png",
    "tena-elion": "exec-2822ad9c-df4d-40ce-b8ec-d8947cea00da.png",
    "achero": "exec-bcc2204f-d79b-4580-bb5c-2a8ff2dc11f4.png",
    "remesis": "exec-4d610104-64fb-474b-9796-9aba3370e30e.png",
    "kael": "exec-5d7a9d6a-5e13-48d1-8d15-c484b29f410a.png",
}

# The image model consistently returns 25 panels. These indices preserve all five
# chronological rows while dropping the least distinct bonus panel from each row.
SELECTED_CELLS = [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22, 24]


def remove_magenta(image: Image.Image) -> Image.Image:
    array = np.asarray(image.convert("RGBA")).copy()
    red = array[:, :, 0]
    green = array[:, :, 1]
    blue = array[:, :, 2]
    chroma = (red > 170) & (blue > 145) & (green < 125) & ((red.astype(np.int16) + blue.astype(np.int16) - green.astype(np.int16) * 2) > 180)
    array[chroma, 3] = 0
    result = Image.fromarray(array, mode="RGBA")
    alpha = result.getchannel("A").filter(ImageFilter.GaussianBlur(0.65))
    result.putalpha(alpha)
    return result


def trim_cell_frame(image: Image.Image) -> Image.Image:
    """Remove the model-generated atlas rails before chroma extraction."""
    horizontal_margin = max(6, round(image.width * 0.035))
    vertical_margin = max(6, round(image.height * 0.035))
    return image.crop(
        (
            horizontal_margin,
            vertical_margin,
            image.width - horizontal_margin,
            image.height - vertical_margin,
        )
    )


def detect_grid_edges(atlas: Image.Image, axis: int) -> list[int]:
    """Locate hand-drawn atlas dividers that are not always evenly spaced."""
    pixels = np.asarray(atlas.convert("RGB"))
    dark = np.all(pixels < 55, axis=2)
    scores = dark.sum(axis=axis)
    length = atlas.width if axis == 0 else atlas.height
    search_radius = max(18, round(length * (0.025 if axis == 0 else 0.055)))
    edges = [0]
    for division in range(1, 5):
        expected = round(length * division / 5)
        start = max(edges[-1] + 8, expected - search_radius)
        end = min(length - 8, expected + search_radius)
        strongest = start + int(np.argmax(scores[start:end]))
        edges.append(strongest)
    edges.append(length)
    return edges


def fit_subject(subject: Image.Image, box: tuple[int, int]) -> Image.Image:
    alpha = subject.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        subject = subject.crop(bounds)
    scale = min(box[0] / subject.width, box[1] / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    layer = Image.new("RGBA", box, (0, 0, 0, 0))
    x = (box[0] - subject.width) // 2
    y = max(0, box[1] - subject.height - 2)
    layer.paste(subject, (x, y), subject)
    return layer


def render_ai_card(character: dict, stage_index: int, subject: Image.Image) -> Image.Image:
    slug, label, description, phase, spoiler = base.STAGES[stage_index]
    accent = base.hex_rgb(character["accent"])
    canvas = base.stage_background(accent, stage_index, phase).convert("RGBA")
    fitted = fit_subject(subject, (430, 548))
    shadow = fitted.getchannel("A").filter(ImageFilter.GaussianBlur(13))
    shadow_layer = Image.new("RGBA", fitted.size, (0, 0, 0, 0))
    shadow_layer.putalpha(shadow.point(lambda value: min(150, value)))
    canvas.alpha_composite(shadow_layer, (25, 42))
    canvas.alpha_composite(fitted, (25, 36))
    base.add_stage_effects(canvas, character, stage_index, accent)

    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle((31, 582, 449, 686), 17, fill=(8, 10, 13, 218), outline=(*base.blend(accent, (232, 201, 135), 0.35), 180), width=2)
    draw.text((52, 598), f"{stage_index + 1:02d}  {character['romanized']}", font=base.font(base.FONT_SERIF, 18), fill=(226, 211, 178, 245))
    draw.text((52, 626), label, font=base.font(base.FONT_KR_BOLD, 23), fill=(248, 242, 225, 255))
    draw.text((52, 658), description, font=base.font(base.FONT_KR, 13), fill=(188, 194, 198, 245))
    draw.text((420, 600), f"S{spoiler}", font=base.font(base.FONT_SERIF, 13), fill=(*accent, 255), anchor="ra")
    draw.text((240, 32), character["name"], font=base.font(base.FONT_KR_BOLD, 22), fill=(238, 226, 201, 240), anchor="ma")
    draw.text((240, 695), character["generation"], font=base.font(base.FONT_KR, 12), fill=(181, 169, 146, 225), anchor="ma")
    return canvas.convert("RGB")


def main() -> None:
    source_data = json.loads((ROOT / "tools" / "character_assets.json").read_text(encoding="utf-8"))
    by_id = {entry["id"]: entry for entry in source_data["characters"]}
    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    requested = set(sys.argv[1:])
    atlas_entries = [(character_id, filename) for character_id, filename in ATLASES.items() if not requested or character_id in requested]
    unknown = requested.difference(ATLASES)
    if unknown:
        raise ValueError(f"Unknown character ids: {', '.join(sorted(unknown))}")

    for index, (character_id, filename) in enumerate(atlas_entries, start=1):
        target_dir = OUTPUT / character_id
        target_dir.mkdir(parents=True, exist_ok=True)
        local_source = target_dir / "ai-source-atlas.webp"
        legacy_source = target_dir / "ai-source-atlas.png"
        source_path = local_source if local_source.exists() else legacy_source if legacy_source.exists() else GENERATED / filename
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        character = by_id[character_id]
        if source_path != local_source:
            Image.open(source_path).convert("RGB").save(local_source, "WEBP", lossless=True, method=6)

        atlas = Image.open(source_path).convert("RGBA")
        column_edges = detect_grid_edges(atlas, axis=0)
        row_edges = detect_grid_edges(atlas, axis=1)
        source_cells = []
        for cell_index in range(25):
            column = cell_index % 5
            row = cell_index // 5
            crop = atlas.crop((column_edges[column], row_edges[row], column_edges[column + 1], row_edges[row + 1]))
            source_cells.append(remove_magenta(trim_cell_frame(crop)))

        cards = []
        for stage_index, cell_index in enumerate(SELECTED_CELLS):
            card = render_ai_card(character, stage_index, source_cells[cell_index])
            slug = base.STAGES[stage_index][0]
            card.save(target_dir / f"{stage_index + 1:02d}-{slug}.webp", "WEBP", quality=88, method=4)
            cards.append(card)
        base.contact_sheet(cards, character).save(target_dir / "contact-sheet.webp", "WEBP", quality=90, method=4)
        cards[18].resize(base.THUMB_SIZE, Image.Resampling.LANCZOS).save(target_dir / "thumb.webp", "WEBP", quality=88, method=4)

        record = next(item for item in manifest["characters"] if item["id"] == character_id)
        record["aiEnhanced"] = True
        record["sourceAtlas"] = f"/art/characters/{character_id}/ai-source-atlas.webp"
        print(f"[{index:02d}/{len(atlas_entries):02d}] upgraded {character['name']}", flush=True)

    manifest["aiEnhancedCharacterCount"] = len(ATLASES)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
