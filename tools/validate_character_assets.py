from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MANIFEST = PUBLIC / "art" / "characters" / "manifest.json"
CARD_SIZE = (480, 720)


def public_path(url: str) -> Path:
    return PUBLIC / url.lstrip("/")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    errors: list[str] = []
    total_bytes = 0

    characters = manifest.get("characters", [])
    if len(characters) != manifest.get("characterCount"):
        errors.append("characterCount does not match manifest records")

    for character in characters:
        variations = character.get("variations", [])
        if len(variations) < 20:
            errors.append(f"{character['id']}: only {len(variations)} variations")

        hashes: set[str] = set()
        for variation in variations:
            path = public_path(variation["image"])
            if not path.exists():
                errors.append(f"{character['id']}: missing {path.name}")
                continue
            total_bytes += path.stat().st_size
            with Image.open(path) as image:
                if image.size != CARD_SIZE:
                    errors.append(f"{character['id']}/{path.name}: {image.size} != {CARD_SIZE}")
            hashes.add(digest(path))

        if len(hashes) != len(variations):
            errors.append(f"{character['id']}: exact duplicate variation files detected")

        for field in ("thumbnail", "contactSheet"):
            path = public_path(character[field])
            if not path.exists():
                errors.append(f"{character['id']}: missing {field}")
            else:
                total_bytes += path.stat().st_size

        source_atlas = character.get("sourceAtlas")
        if character.get("aiEnhanced") and (not source_atlas or not public_path(source_atlas).exists()):
            errors.append(f"{character['id']}: missing AI source atlas")

    expected_total = len(characters) * manifest.get("variationCount", 0)
    actual_total = sum(len(character.get("variations", [])) for character in characters)
    if actual_total != expected_total or actual_total != manifest.get("totalAssetCount"):
        errors.append(f"asset total mismatch: expected={expected_total}, actual={actual_total}")

    if errors:
        print("VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("VALIDATION PASSED")
    print(f"characters={len(characters)}")
    print(f"variations={actual_total}")
    print(f"ai_enhanced={manifest.get('aiEnhancedCharacterCount', 0)}")
    print(f"runtime_assets_mb={total_bytes / 1024 / 1024:.1f}")


if __name__ == "__main__":
    main()
