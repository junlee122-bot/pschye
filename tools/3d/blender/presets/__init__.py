"""Character preset registry."""

from __future__ import annotations

from character_spec import CharacterPreset
from presets.hadori import PRESET as HADORI
from presets.kazrin import PRESET as KAZRIN
from presets.raon import PRESET as RAON

PRESETS: dict[str, CharacterPreset] = {
    preset.id: preset for preset in (RAON, HADORI, KAZRIN)
}


def get_preset(preset_id: str) -> CharacterPreset:
    try:
        return PRESETS[preset_id.lower()]
    except KeyError as error:
        available = ", ".join(sorted(PRESETS))
        raise KeyError(f"Unknown preset '{preset_id}'. Available: {available}") from error
