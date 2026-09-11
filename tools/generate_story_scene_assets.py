from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STORY_SOURCE = ROOT / "src" / "data" / "grandStory.ts"
OUTPUT_ROOT = ROOT / "public" / "art" / "story" / "scenes"
SOURCE_ROOT = OUTPUT_ROOT / "sources"

EPISODE_PATTERN = re.compile(
    r"episode\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'"
)

EXISTING_SOURCES = {
    "village-bell": "public/art/village/frontier-village-dawn.webp",
    "windmill-rivalry": "public/art/village/frontier-village-morning.webp",
    "river-anomaly": "public/art/village/frontier-village-river-alert.webp",
    "selectors-arrive": "public/art/village/frontier-village-arrival.webp",
    "leave-home": "public/art/village/frontier-village-night.webp",
    "grey-bridge": "public/art/generated/mission-grey-bridge.webp",
    "bridge-debrief": "public/art/generated/mission-grey-bridge.webp",
    "citizen-cartridge": "public/art/generated/mission-citizen-cartridge.webp",
    "mending-generation": "public/art/generated/generation-05-mending.webp",
    "wingless-convoy": "public/art/generated/mission-wingless-convoy.webp",
    "sky-gunfire": "public/art/generated/mission-sky-gunfire-v2.webp",
    "violet-infiltration": "public/art/generated/mission-violet-night-v2.webp",
    "cursed-border": "public/art/generated/mission-cursed-border-v2.webp",
    "stopped-petal": "public/art/generated/mission-stopped-petal-v2.webp",
}

ATLAS_GROUPS = {
    "atlas-01-induction": [
        "capital-gate", "aptitude-hall", "field-exam", "suspended-candidate", "maru-door", "sixteen-petals",
    ],
    "atlas-02-trials": [
        "captain-trials", "kazrin-duel", "one-hit", "empty-generation-road", "third-generation-wall", "sixth-provocation",
    ],
    "atlas-03-hidden-records": [
        "cheshi-prisoner", "nia-audience", "garam-parley", "maru-contract", "denin-home", "execution-house",
    ],
    "atlas-04-first-recruits": [
        "lami-recruits-haechan", "rex-arena", "anne-vanishes", "nabi-injection", "maru-execution", "garam-cursed-land",
    ],
    "atlas-05-six-banners": [
        "six-captains-camp", "division-commanders", "first-joint-operation", "rebellion-prime", "capital-campaign", "surrendered-cheshi",
    ],
    "atlas-06-incomplete-light": [
        "denin-village", "light-plan", "rebellion-splits", "haechan-lami-duel", "incomplete-light", "postwar-montage",
    ],
    "atlas-07-returned-winter": [
        "return-from-memory", "truth-at-dawn", "lame-swordsman", "first-corps-survivors", "empire-schism", "sixth-betrayal",
    ],
    "atlas-08-inheritance": [
        "fifth-generation-defense", "adeline-resonance", "fourth-generation-line", "nia-nabi-crack", "luka-hadori", "raon-haechan-training",
    ],
    "atlas-09-three-fronts": [
        "kazrin-evan-duel", "garam-tribunal", "cheshi-offensive", "jinhwon-haechan-duel", "jinhwon-death", "nabi-rampage",
    ],
    "atlas-10-raonjena": [
        "leo-command", "hadori-inheritance", "chris-tena-defense", "kain-final-choice", "raon-style-final", "coexistence-ending",
    ],
    "atlas-11-lami-origin": [
        "unnamed-child", "cursed-land-born", "cheshi-cage", "denin-betrayal", "first-human", "nullification-awakens",
    ],
    "atlas-12-lami-legacy": [
        "mother-of-martial-arts", "achero-light", "first-band", "first-betrayal-loss", "salvation-becomes-extinction", "seeks-haechan",
    ],
}

SAGA_ACCENTS = {
    "petal-before-bloom": (205, 169, 102),
    "erased-names": (102, 141, 166),
    "six-banners": (159, 82, 71),
    "second-great-war": (116, 92, 158),
    "lami-origin": (122, 91, 148),
}


@dataclass(frozen=True)
class Episode:
    saga_id: str
    episode_id: str
    chapter: str
    title: str
    time: str
    location: str


def parse_episodes() -> list[Episode]:
    source = STORY_SOURCE.read_text(encoding="utf-8")
    return [Episode(*match) for match in EPISODE_PATTERN.findall(source)]


def atlas_source(atlas_id: str) -> Path:
    candidates = [
        SOURCE_ROOT / f"{atlas_id}.webp",
        SOURCE_ROOT / f"{atlas_id}.png",
        SOURCE_ROOT / f"{atlas_id}.jpg",
        SOURCE_ROOT / f"{atlas_id}.jpeg",
    ]
    return next((candidate for candidate in candidates if candidate.exists()), candidates[0])


def fit_scene(image: Image.Image, size: tuple[int, int] = (1600, 900)) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.48))


def split_atlas(image: Image.Image) -> list[Image.Image]:
    width, height = image.size
    cells: list[Image.Image] = []
    for row in range(2):
        for column in range(3):
            left = round(column * width / 3)
            right = round((column + 1) * width / 3)
            top = round(row * height / 2)
            bottom = round((row + 1) * height / 2)
            inset_x = max(3, round((right - left) * 0.018))
            inset_y = max(3, round((bottom - top) * 0.018))
            cells.append(image.crop((left + inset_x, top + inset_y, right - inset_x, bottom - inset_y)))
    return cells


@lru_cache(maxsize=16)
def radial_vignette(size: tuple[int, int], strength: int = 105) -> Image.Image:
    width, height = size
    preview_width = min(160, width)
    preview_height = min(90, height)
    mask = Image.new("L", (preview_width, preview_height), 0)
    pixels = mask.load()
    for y in range(preview_height):
        ny = (y - preview_height / 2) / (preview_height / 2)
        for x in range(preview_width):
            nx = (x - preview_width / 2) / (preview_width / 2)
            distance = min(1.0, (nx * nx + ny * ny) ** 0.5)
            pixels[x, y] = int((distance ** 1.75) * strength)
    return mask.resize(size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(radius=18))


def overlay_gradient(image: Image.Image, color: tuple[int, int, int], alpha: int, reverse: bool = False) -> Image.Image:
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (*color, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(height):
        ratio = y / max(1, height - 1)
        if reverse:
            ratio = 1 - ratio
        draw.line((0, y, width, y), fill=(*color, int(alpha * ratio)))
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def create_variant(base: Image.Image, variant: str, accent: tuple[int, int, int]) -> Image.Image:
    image = base.copy()
    if variant == "explore":
        image = ImageEnhance.Color(image).enhance(0.94)
        image = ImageEnhance.Contrast(image).enhance(1.06)
        image = overlay_gradient(image, (8, 10, 12), 72)
    elif variant == "dialogue":
        image = image.filter(ImageFilter.GaussianBlur(radius=0.7))
        image = ImageEnhance.Brightness(image).enhance(0.67)
        image = overlay_gradient(image, (5, 7, 10), 120)
    elif variant == "battle":
        image = ImageEnhance.Contrast(image).enhance(1.18)
        image = ImageEnhance.Color(image).enhance(0.86)
        image = overlay_gradient(image, accent, 58, reverse=True)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.8, percent=145, threshold=3))
    elif variant == "aftermath":
        monochrome = ImageOps.grayscale(image).convert("RGB")
        image = Image.blend(image, monochrome, 0.47)
        image = ImageEnhance.Brightness(image).enhance(0.76)
        image = overlay_gradient(image, (54, 67, 78), 74, reverse=True)
        fog = Image.new("RGBA", image.size, (202, 210, 214, 0))
        fog_draw = ImageDraw.Draw(fog)
        for y in range(image.height):
            fog_draw.line((0, y, image.width, y), fill=(202, 210, 214, int(34 * (y / image.height))))
        image = Image.alpha_composite(image.convert("RGBA"), fog.filter(ImageFilter.GaussianBlur(22))).convert("RGB")
    else:
        raise ValueError(f"Unknown variant: {variant}")

    vignette = radial_vignette(image.size, 88 if variant == "explore" else 116)
    shade = Image.new("RGB", image.size, (0, 0, 0))
    return Image.composite(shade, image, vignette)


def create_beat_image(base: Image.Image, order: int, accent: tuple[int, int, int]) -> Image.Image:
    width, height = base.size
    zooms = [1.0, 1.08, 1.13, 1.06, 1.16, 1.03]
    offsets = [(-0.08, 0.0), (0.08, -0.03), (-0.05, 0.04), (0.05, 0.02), (0.0, -0.05), (0.0, 0.04)]
    zoom = zooms[order - 1]
    crop_width = round(width / zoom)
    crop_height = round(height / zoom)
    offset_x, offset_y = offsets[order - 1]
    center_x = width / 2 + offset_x * width
    center_y = height / 2 + offset_y * height
    left = max(0, min(width - crop_width, round(center_x - crop_width / 2)))
    top = max(0, min(height - crop_height, round(center_y - crop_height / 2)))
    image = base.crop((left, top, left + crop_width, top + crop_height)).resize((960, 540), Image.Resampling.LANCZOS)

    if order in (3, 5):
        image = create_variant(image, "battle", accent)
    elif order == 4:
        image = create_variant(image, "dialogue", accent)
    elif order == 6:
        image = create_variant(image, "aftermath", accent)
    else:
        image = create_variant(image, "explore", accent)
    return image


def save_webp(image: Image.Image, path: Path, quality: int = 86) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            with Image.open(path) as existing:
                existing.verify()
            return
        except OSError:
            path.unlink(missing_ok=True)
    image.save(path, "WEBP", quality=quality, method=1)


def load_episode_bases(episodes: list[Episode]) -> dict[str, Image.Image]:
    bases: dict[str, Image.Image] = {}
    for episode_id, relative_path in EXISTING_SOURCES.items():
        source = ROOT / relative_path
        if not source.exists():
            raise FileNotFoundError(source)
        bases[episode_id] = fit_scene(Image.open(source))

    for atlas_id, episode_ids in ATLAS_GROUPS.items():
        source = atlas_source(atlas_id)
        if not source.exists():
            raise FileNotFoundError(f"Missing generated atlas: {source}")
        cells = split_atlas(Image.open(source).convert("RGB"))
        for episode_id, cell in zip(episode_ids, cells, strict=True):
            bases[episode_id] = fit_scene(cell)

    expected = {episode.episode_id for episode in episodes}
    missing = expected.difference(bases)
    extra = set(bases).difference(expected)
    if missing or extra:
        raise RuntimeError(f"Scene base mismatch. missing={sorted(missing)} extra={sorted(extra)}")
    return bases


def build_assets() -> dict[str, object]:
    episodes = parse_episodes()
    bases = load_episode_bases(episodes)
    manifest_entries = []

    for index, episode in enumerate(episodes, start=1):
        destination = OUTPUT_ROOT / episode.episode_id
        accent = SAGA_ACCENTS[episode.saga_id]
        base = bases[episode.episode_id]
        variants = {}

        for variant in ("explore", "dialogue", "battle", "aftermath"):
            path = destination / f"{variant}.webp"
            save_webp(create_variant(base, variant, accent), path)
            variants[variant] = f"/art/story/scenes/{episode.episode_id}/{variant}.webp"

        thumb_path = destination / "thumb.webp"
        save_webp(ImageOps.fit(create_variant(base, "explore", accent), (640, 360), Image.Resampling.LANCZOS), thumb_path, 82)

        beats = []
        for beat_order in range(1, 7):
            beat_path = destination / "beats" / f"{beat_order:02d}.webp"
            save_webp(create_beat_image(base, beat_order, accent), beat_path, 83)
            beats.append(f"/art/story/scenes/{episode.episode_id}/beats/{beat_order:02d}.webp")

        manifest_entries.append({
            "order": index,
            "id": episode.episode_id,
            "sagaId": episode.saga_id,
            "chapter": episode.chapter,
            "title": episode.title,
            "time": episode.time,
            "location": episode.location,
            "variants": variants,
            "thumbnail": f"/art/story/scenes/{episode.episode_id}/thumb.webp",
            "beats": beats,
            "source": "existing" if episode.episode_id in EXISTING_SOURCES else "generated-atlas",
        })

    manifest = {
        "version": 1,
        "episodeCount": len(episodes),
        "beatSceneCount": len(episodes) * 6,
        "variantsPerEpisode": 4,
        "totalAssetCount": len(episodes) * 11,
        "generatedAtlasCount": len(ATLAS_GROUPS),
        "episodes": manifest_entries,
    }
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def validate_assets() -> None:
    manifest_path = OUTPUT_ROOT / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    for entry in manifest["episodes"]:
        paths = list(entry["variants"].values()) + [entry["thumbnail"], *entry["beats"]]
        for asset in paths:
            path = ROOT / "public" / asset.removeprefix("/")
            if not path.exists():
                errors.append(f"missing {asset}")
                continue
            with Image.open(path) as image:
                expected = (640, 360) if path.name == "thumb.webp" else ((960, 540) if path.parent.name == "beats" else (1600, 900))
                if image.size != expected:
                    errors.append(f"wrong size {asset}: {image.size} != {expected}")
    if errors:
        raise RuntimeError("\n".join(errors[:50]))
    print(
        "STORY ASSET VALIDATION PASSED",
        f"episodes={manifest['episodeCount']}",
        f"beatScenes={manifest['beatSceneCount']}",
        f"assets={manifest['totalAssetCount']}",
        sep="\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if args.validate:
        validate_assets()
        return
    manifest = build_assets()
    print(json.dumps({key: manifest[key] for key in ("episodeCount", "beatSceneCount", "totalAssetCount")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
