"""Data-only character specifications for the Raonjena Blender generator.

This module deliberately has no Blender dependency. Presets can therefore be
validated in CI or on machines where Blender is not installed.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Color = tuple[float, float, float, float]
WeaponKind = Literal["sword", "spear", "gauntlets"]
HairStyle = Literal["tousled", "bob", "ponytail"]
BodyBuild = Literal["lean", "athletic", "powerful"]


@dataclass(frozen=True)
class Palette:
    skin: Color
    hair: Color
    eye: Color
    cloth_primary: Color
    cloth_secondary: Color
    leather: Color
    metal: Color
    accent: Color
    outline: Color = (0.015, 0.018, 0.022, 1.0)


@dataclass(frozen=True)
class Proportions:
    height_m: float
    head_ratio: float
    shoulder_width: float
    torso_length: float
    leg_length: float
    arm_length: float
    hand_scale: float
    build: BodyBuild


@dataclass(frozen=True)
class HairSpec:
    style: HairStyle
    length: float
    volume: float
    strand_count: int
    fringe_bias: float = 0.0
    ponytail_height: float = 0.0


@dataclass(frozen=True)
class OutfitSpec:
    sleeveless: bool
    high_collar: bool
    coat_tails: int
    coat_length: float
    shoulder_armor: Literal["none", "left", "right", "both"]
    chest_armor: float
    forearm_armor: float
    gauntlet_scale: float
    boot_height: float
    skirt_panels: int = 0
    asymmetry: float = 0.0


@dataclass(frozen=True)
class WeaponSpec:
    kind: WeaponKind
    length: float
    blade_length: float
    blade_width: float
    guard_width: float
    grip_length: float
    ornament: float = 0.0


@dataclass(frozen=True)
class CharacterPreset:
    id: str
    display_name: str
    english_name: str
    role: str
    silhouette_note: str
    source_art: tuple[str, ...]
    proportions: Proportions
    palette: Palette
    hair: HairSpec
    outfit: OutfitSpec
    weapon: WeaponSpec
    expression: Literal["bright", "stoic", "cold"]
    seed: int
    tags: tuple[str, ...] = field(default_factory=tuple)

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.id or self.id.lower() != self.id:
            errors.append("id must be a non-empty lowercase identifier")
        if not 1.45 <= self.proportions.height_m <= 2.15:
            errors.append("height_m must be between 1.45 and 2.15")
        if not 6.0 <= self.proportions.head_ratio <= 9.0:
            errors.append("head_ratio must be between 6.0 and 9.0")
        if self.hair.strand_count < 4:
            errors.append("hair.strand_count must be at least 4")
        if self.weapon.length <= 0.0:
            errors.append("weapon.length must be positive")
        if self.weapon.kind == "sword" and self.weapon.blade_length <= self.weapon.grip_length:
            errors.append("sword blade must be longer than its grip")
        if self.weapon.kind == "spear" and self.weapon.length < 1.5:
            errors.append("spear length must be at least 1.5 meters")
        if self.outfit.coat_tails < 0 or self.outfit.skirt_panels < 0:
            errors.append("panel counts cannot be negative")
        for palette_name, color in asdict(self.palette).items():
            if len(color) != 4 or any(channel < 0.0 or channel > 1.0 for channel in color):
                errors.append(f"palette.{palette_name} must be normalized RGBA")
        return errors

    def to_manifest(self) -> dict[str, Any]:
        return asdict(self)
