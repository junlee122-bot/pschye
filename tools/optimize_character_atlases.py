from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHARACTERS = ROOT / "public" / "art" / "characters"
MANIFEST = CHARACTERS / "manifest.json"


def main() -> None:
    converted = 0
    for source in sorted(CHARACTERS.glob("*/ai-source-atlas.png")):
        target = source.with_suffix(".webp")
        Image.open(source).convert("RGB").save(target, "WEBP", lossless=True, method=6)
        source.unlink()
        converted += 1
        print(f"optimized {source.parent.name}", flush=True)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for character in manifest["characters"]:
        if character.get("aiEnhanced"):
            character["sourceAtlas"] = f"/art/characters/{character['id']}/ai-source-atlas.webp"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"converted={converted}")


if __name__ == "__main__":
    main()
