from __future__ import annotations

import hashlib
import json
import math
import random
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = ROOT / "tools" / "character_assets.json"
OUTPUT_ROOT = ROOT / "public" / "art" / "characters"
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
CARD_SIZE = (480, 720)
THUMB_SIZE = (320, 480)

FONT_KR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_KR_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")
FONT_SERIF = Path(r"C:\Windows\Fonts\georgiab.ttf")

STAGES = [
    ("origin", "기원", "선발 이전의 일상", "origin", 0),
    ("call", "소집", "라미군 또는 프시케의 부름", "origin", 0),
    ("candidate", "지원자", "첫 장비와 불완전한 자세", "entry", 0),
    ("induction", "입단식", "소속을 얻은 첫날", "entry", 0),
    ("drill", "기초 훈련", "기본기를 몸에 새기는 시기", "entry", 0),
    ("first-mission", "첫 임무", "실전의 공포를 처음 마주함", "entry", 1),
    ("field", "야전복", "장거리 작전 표준 장비", "campaign", 1),
    ("bond", "동료의 밤", "야영과 관계 장면", "campaign", 1),
    ("formal", "정복", "조장·사단장 공식 예복", "campaign", 1),
    ("covert", "잠입", "바이올렛·정찰 임무 변형", "campaign", 1),
    ("winter", "동계전", "혹한·설원 임무", "campaign", 1),
    ("wounded", "부상", "승리보다 생환이 중요해진 순간", "campaign", 2),
    ("resolve", "결의", "신념이 전투 방식이 되는 시기", "war", 2),
    ("signature", "본류", "대표 체능의 완성형", "war", 2),
    ("great-war", "대전쟁", "세대의 전성기 또는 두 번째 전쟁", "war", 3),
    ("extreme", "극의의 경계", "미래를 당겨 쓰는 금지된 한계", "war", 3),
    ("aftermath", "전후", "상처와 선택이 남은 직후", "aftermath", 3),
    ("reconstruction", "재건", "전쟁 뒤의 새로운 역할", "aftermath", 3),
    ("present", "현재", "본편 시점의 확정 실루엣", "legacy", 1),
    ("legacy", "유산", "에필로그·기록 보관소 해금화", "legacy", 4),
]

PHASE_COLORS = {
    "origin": (125, 105, 82),
    "entry": (82, 99, 110),
    "campaign": (77, 88, 76),
    "war": (107, 55, 49),
    "aftermath": (92, 79, 76),
    "legacy": (159, 126, 64),
}


@lru_cache(maxsize=64)
def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


@lru_cache(maxsize=64)
def load_source(path_string: str) -> Image.Image:
    with Image.open(path_string) as loaded:
        return ImageOps.exif_transpose(loaded).convert("RGB")


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def blend(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(a[i] * (1 - amount) + b[i] * amount) for i in range(3))


def stable_seed(*parts: str) -> int:
    digest = hashlib.sha256("::".join(parts).encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def stage_background(accent: tuple[int, int, int], stage_index: int, phase: str) -> Image.Image:
    width, height = CARD_SIZE
    phase_color = PHASE_COLORS[phase]
    top = blend((20, 18, 17), phase_color, 0.38)
    bottom = blend((7, 8, 10), accent, 0.25)
    gradient = Image.new("RGB", (1, height))
    gradient_pixels = gradient.load()
    for y in range(height):
        ratio = y / max(height - 1, 1)
        gradient_pixels[0, y] = tuple(round(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(3))
    canvas = gradient.resize(CARD_SIZE, Image.Resampling.BILINEAR)

    draw = ImageDraw.Draw(canvas, "RGBA")
    glow = Image.new("RGBA", CARD_SIZE, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, "RGBA")
    glow_draw.ellipse((54, 76, width - 54, 470), fill=(*accent, 32))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(52))).convert("RGB")
    draw = ImageDraw.Draw(canvas, "RGBA")
    rng = random.Random(stage_index * 901)
    for _ in range(46):
        x = rng.randrange(width)
        y = rng.randrange(height)
        radius = rng.randrange(1, 4)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*accent, rng.randrange(10, 35)))
    for inset, alpha in ((14, 130), (20, 70)):
        draw.rounded_rectangle((inset, inset, width - inset, height - inset), 18, outline=(*blend(accent, (220, 190, 130), 0.35), alpha), width=2)
    return canvas


def crop_from_source(character: dict, stage_index: int) -> Image.Image | None:
    source = character.get("source")
    if not source:
        return None
    path = ROOT / source
    if not path.exists():
        return None
    image = load_source(str(path))

    kind = character.get("sourceKind", "sheet")
    if kind in {"groupPortrait", "stripPortrait"}:
        center_x, center_y, width_ratio, height_ratio = character["focus"]
        left = int((center_x - width_ratio / 2) * image.width)
        top = int((center_y - height_ratio / 2) * image.height)
        right = int((center_x + width_ratio / 2) * image.width)
        bottom = int((center_y + height_ratio / 2) * image.height)
        crop = image.crop((max(0, left), max(0, top), min(image.width, right), min(image.height, bottom)))
    else:
        sheet_crops = [
            (0.04, 0.08, 0.50, 0.52),
            (0.50, 0.08, 0.96, 0.52),
            (0.03, 0.47, 0.51, 0.93),
            (0.49, 0.47, 0.97, 0.94),
        ]
        box = sheet_crops[stage_index % len(sheet_crops)]
        crop = image.crop((int(box[0] * image.width), int(box[1] * image.height), int(box[2] * image.width), int(box[3] * image.height)))

    return crop


def procedural_portrait(character: dict, stage_index: int, accent: tuple[int, int, int]) -> Image.Image:
    width, height = 360, 560
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    rng = random.Random(stable_seed(character["id"], str(stage_index)))
    gender = character.get("gender", "male")
    hair_map = {
        "black": (34, 31, 34), "white": (215, 211, 202), "ash": (142, 137, 132),
        "red": (123, 52, 45), "peach": (177, 105, 91), "brown": (82, 56, 43),
        "green": (58, 83, 70), "blond": (180, 150, 98),
    }
    hair = hair_map.get(character.get("hair", "black"), (45, 40, 39))
    skin = (207, 172, 143) if character["id"] != "achero" else (222, 209, 186)
    cloth = blend((30, 31, 35), accent, 0.28 + (stage_index % 4) * 0.05)
    armor = blend((84, 79, 70), accent, 0.22)

    shoulder_y = 292
    shoulder = 128 if gender == "male" else 112
    draw.polygon([(180 - shoulder, 520), (118, shoulder_y), (153, 250), (207, 250), (242, shoulder_y), (180 + shoulder, 520)], fill=(*cloth, 255))
    draw.polygon([(76, 520), (111, 318), (143, 286), (156, 520)], fill=(*armor, 235))
    draw.polygon([(204, 520), (217, 286), (249, 318), (284, 520)], fill=(*armor, 235))
    for offset in range(0, 88, 18):
        draw.line((104, 333 + offset, 150, 345 + offset), fill=(*blend(armor, (210, 180, 120), 0.35), 190), width=4)
        draw.line((256, 333 + offset, 210, 345 + offset), fill=(*blend(armor, (210, 180, 120), 0.35), 190), width=4)

    draw.ellipse((124, 92, 236, 260), fill=(*skin, 255))
    fringe = [(119, 120), (139, 68), (176, 54), (216, 72), (244, 126), (226, 112), (218, 151), (197, 110), (182, 160), (160, 112), (145, 153), (132, 115)]
    if stage_index % 3 == 1:
        fringe[2] = (183, 43)
        fringe[5] = (237, 91)
    draw.polygon(fringe, fill=(*hair, 255))
    if gender == "female" or stage_index > 12:
        draw.polygon([(126, 122), (103, 326), (153, 278), (168, 133)], fill=(*hair, 235))
        draw.polygon([(232, 122), (255, 330), (207, 281), (192, 134)], fill=(*hair, 235))
    eye = blend((30, 30, 34), accent, 0.52)
    draw.line((147, 172, 168, 168), fill=(*eye, 255), width=4)
    draw.line((192, 168, 213, 172), fill=(*eye, 255), width=4)
    draw.line((176, 183, 181, 199), fill=(120, 88, 70, 180), width=2)
    draw.arc((163, 199, 198, 225), 15, 165, fill=(95, 64, 59, 210), width=3)

    draw.polygon([(153, 250), (180, 286), (207, 250), (201, 331), (180, 351), (159, 331)], fill=(*blend(cloth, (8, 8, 10), 0.4), 255))
    draw.line((180, 286, 180, 518), fill=(*blend(accent, (230, 197, 131), 0.35), 200), width=4)
    for y in range(328, 505, 47):
        draw.ellipse((172, y, 188, y + 16), fill=(*blend(accent, (226, 192, 119), 0.45), 220))

    weapon = character.get("weapon", "검")
    weapon_color = blend((182, 177, 164), accent, 0.18)
    if "지팡이" in weapon or "창" in weapon or "봉" in weapon:
        draw.line((296, 58, 254, 541), fill=(*weapon_color, 255), width=8)
        draw.polygon([(294, 46), (310, 88), (293, 76), (278, 92)], fill=(*blend(weapon_color, accent, 0.25), 255))
    elif "도끼" in weapon or "대검" in weapon:
        draw.line((287, 100, 245, 547), fill=(*weapon_color, 255), width=9)
        draw.polygon([(253, 105), (316, 70), (308, 139), (280, 156)], fill=(*blend(weapon_color, accent, 0.18), 250))
    elif "장갑" in weapon or "격투" in weapon:
        draw.ellipse((45, 392, 115, 494), fill=(*armor, 255), outline=(*weapon_color, 220), width=5)
        draw.ellipse((245, 392, 315, 494), fill=(*armor, 255), outline=(*weapon_color, 220), width=5)
    else:
        draw.line((286, 86, 236, 552), fill=(*weapon_color, 255), width=7)
        draw.polygon([(286, 62), (300, 106), (284, 92), (269, 108)], fill=(*weapon_color, 255))

    if stage_index in {11, 15, 16}:
        for _ in range(8):
            x = rng.randint(112, 238)
            y = rng.randint(150, 360)
            draw.line((x, y, x + rng.randint(7, 24), y + rng.randint(-7, 17)), fill=(123, 35, 31, 150), width=3)
    if stage_index >= 17:
        draw.line((123, 260, 237, 260), fill=(220, 211, 196, 120), width=5)
    return layer


def prepare_subject(character: dict, stage_index: int, accent: tuple[int, int, int]) -> Image.Image:
    crop = crop_from_source(character, stage_index)
    if crop is None:
        return procedural_portrait(character, stage_index, accent)

    subject = ImageOps.fit(crop, (388, 584), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    subject = ImageEnhance.Contrast(subject).enhance(1.05)
    subject = ImageEnhance.Color(subject).enhance(0.84 if stage_index in {11, 16, 17} else 1.04)
    if stage_index == 10:
        blue = Image.new("RGB", subject.size, (90, 121, 144))
        subject = Image.blend(subject, blue, 0.12)
    elif stage_index in {14, 15}:
        red = Image.new("RGB", subject.size, (116, 45, 37))
        subject = Image.blend(subject, red, 0.14)
    elif stage_index >= 18:
        gold = Image.new("RGB", subject.size, (170, 139, 83))
        subject = Image.blend(subject, gold, 0.08)
    return subject.convert("RGBA")


def add_stage_effects(canvas: Image.Image, character: dict, stage_index: int, accent: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    rng = random.Random(stable_seed(character["id"], "fx", str(stage_index)))
    width, height = CARD_SIZE
    if stage_index == 7:
        for _ in range(18):
            x, y = rng.randrange(width), rng.randrange(280, height)
            draw.ellipse((x, y, x + 4, y + 4), fill=(224, 177, 83, rng.randrange(45, 130)))
    if stage_index == 10:
        for _ in range(55):
            x, y = rng.randrange(width), rng.randrange(height)
            draw.line((x, y, x - 6, y + 12), fill=(226, 238, 245, rng.randrange(55, 150)), width=2)
    if stage_index in {11, 16}:
        for _ in range(13):
            x, y = rng.randrange(width), rng.randrange(height)
            draw.line((x, y, x + rng.randrange(-18, 28), y + rng.randrange(10, 52)), fill=(118, 26, 24, rng.randrange(50, 125)), width=rng.randrange(1, 4))
    if stage_index in {13, 15}:
        center = (width // 2, 330)
        for ray in range(22):
            angle = (math.tau / 22) * ray + rng.uniform(-0.03, 0.03)
            radius = rng.randrange(120, 290)
            x = center[0] + math.cos(angle) * radius
            y = center[1] + math.sin(angle) * radius
            draw.line((center[0], center[1], x, y), fill=(*blend(accent, (240, 211, 142), 0.4), 42), width=2)
    if stage_index == 15:
        for _ in range(8):
            x = rng.randrange(48, width - 48)
            draw.line((x, 78, x + rng.randrange(-60, 60), height - 120), fill=(245, 219, 154, 82), width=2)
    if stage_index >= 18:
        draw.arc((112, 92, width - 112, 366), 190, 350, fill=(225, 191, 113, 80), width=3)


def render_card(character: dict, stage_index: int) -> Image.Image:
    slug, label, description, phase, spoiler = STAGES[stage_index]
    accent = hex_rgb(character["accent"])
    canvas = stage_background(accent, stage_index, phase)
    subject = prepare_subject(character, stage_index, accent)

    if subject.size == (388, 584):
        shadow = Image.new("RGBA", subject.size, (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 180), (0, 0, *subject.size), rounded_mask(subject.size, 25))
        shadow = shadow.filter(ImageFilter.GaussianBlur(14))
        canvas.paste(shadow, (50, 76), shadow)
        mask = rounded_mask(subject.size, 25)
        canvas.paste(subject, (46, 68), ImageChops.multiply(subject.getchannel("A"), mask))
    else:
        canvas.paste(subject, (60, 78), subject)

    add_stage_effects(canvas, character, stage_index, accent)
    draw = ImageDraw.Draw(canvas, "RGBA")
    panel_top = 582
    draw.rounded_rectangle((31, panel_top, 449, 686), 17, fill=(8, 10, 13, 214), outline=(*blend(accent, (232, 201, 135), 0.35), 180), width=2)
    draw.text((52, 598), f"{stage_index + 1:02d}  {character['romanized']}", font=font(FONT_SERIF, 18), fill=(226, 211, 178, 245))
    draw.text((52, 626), label, font=font(FONT_KR_BOLD, 23), fill=(248, 242, 225, 255))
    draw.text((52, 658), description, font=font(FONT_KR, 13), fill=(188, 194, 198, 245))
    draw.text((420, 600), f"S{spoiler}", font=font(FONT_SERIF, 13), fill=(*accent, 255), anchor="ra")
    draw.text((240, 32), character["name"], font=font(FONT_KR_BOLD, 22), fill=(238, 226, 201, 240), anchor="ma")
    draw.text((240, 695), character["generation"], font=font(FONT_KR, 12), fill=(181, 169, 146, 225), anchor="ma")
    return canvas


def contact_sheet(cards: list[Image.Image], character: dict) -> Image.Image:
    cell_width, cell_height = 192, 288
    sheet = Image.new("RGB", (cell_width * 5, cell_height * 4), (18, 17, 16))
    for index, card in enumerate(cards):
        thumb = card.resize((cell_width, cell_height), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((index % 5) * cell_width, (index // 5) * cell_height))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.rectangle((0, 0, sheet.width, 64), fill=(8, 8, 9, 218))
    draw.text((24, 14), character["romanized"], font=font(FONT_SERIF, 28), fill=(239, 226, 197, 255))
    draw.text((sheet.width - 24, 18), "20 TIMELINE VARIATIONS", font=font(FONT_SERIF, 16), fill=(184, 164, 125, 255), anchor="ra")
    return sheet


def generate() -> None:
    data = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output_characters = []

    for character_index, character in enumerate(data["characters"], start=1):
        character_dir = OUTPUT_ROOT / character["id"]
        character_dir.mkdir(parents=True, exist_ok=True)
        expected_files = [character_dir / f"{index + 1:02d}-{stage[0]}.webp" for index, stage in enumerate(STAGES)]
        already_complete = all(path.exists() for path in expected_files) and (character_dir / "contact-sheet.webp").exists() and (character_dir / "thumb.webp").exists()
        if already_complete:
            variations = [{
                "id": slug,
                "index": stage_index + 1,
                "label": label,
                "description": description,
                "phase": phase,
                "spoilerLevel": spoiler,
                "image": f"/art/characters/{character['id']}/{stage_index + 1:02d}-{slug}.webp",
            } for stage_index, (slug, label, description, phase, spoiler) in enumerate(STAGES)]
            output_characters.append({
                "id": character["id"], "name": character["name"], "romanized": character["romanized"],
                "generation": character["generation"], "role": character["role"], "weapon": character["weapon"],
                "accent": character["accent"], "tags": character.get("tags", []),
                "thumbnail": f"/art/characters/{character['id']}/thumb.webp",
                "contactSheet": f"/art/characters/{character['id']}/contact-sheet.webp",
                "variations": variations,
            })
            print(f"[{character_index:02d}/{len(data['characters']):02d}] {character['name']}: existing set kept", flush=True)
            continue
        cards: list[Image.Image] = []
        variations = []
        for stage_index, (slug, label, description, phase, spoiler) in enumerate(STAGES):
            card = render_card(character, stage_index)
            filename = f"{stage_index + 1:02d}-{slug}.webp"
            card.save(character_dir / filename, "WEBP", quality=82, method=4)
            cards.append(card)
            variations.append({
                "id": slug,
                "index": stage_index + 1,
                "label": label,
                "description": description,
                "phase": phase,
                "spoilerLevel": spoiler,
                "image": f"/art/characters/{character['id']}/{filename}",
            })

        contact_sheet(cards, character).save(character_dir / "contact-sheet.webp", "WEBP", quality=86, method=4)
        cards[18].resize(THUMB_SIZE, Image.Resampling.LANCZOS).save(character_dir / "thumb.webp", "WEBP", quality=84, method=4)
        output_characters.append({
            "id": character["id"],
            "name": character["name"],
            "romanized": character["romanized"],
            "generation": character["generation"],
            "role": character["role"],
            "weapon": character["weapon"],
            "accent": character["accent"],
            "tags": character.get("tags", []),
            "thumbnail": f"/art/characters/{character['id']}/thumb.webp",
            "contactSheet": f"/art/characters/{character['id']}/contact-sheet.webp",
            "variations": variations,
        })
        print(f"[{character_index:02d}/{len(data['characters']):02d}] {character['name']}: {len(cards)} variations", flush=True)

    manifest = {
        "version": data["version"],
        "characterCount": len(output_characters),
        "variationCount": len(STAGES),
        "totalAssetCount": len(output_characters) * len(STAGES),
        "characters": output_characters,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Total: {manifest['totalAssetCount']} character variants")


if __name__ == "__main__":
    generate()
