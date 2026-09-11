# Raon Unity Compatibility Audit

- Status: **PASS**
- Actual Unity Editor validation: **not run**
- Target: Unity 6 URP humanoid import candidate

| LOD | Triangles | File | Skins | Max influences | Morphs | Animations | PBR |
|---|---:|---:|---:|---:|---:|---:|---|
| LOD0 | 42592 | 5.18 MB | 1 | 2 | 20 | 16 | pass |
| LOD1 | 23482 | 2.53 MB | 1 | 2 | 0 | 12 | pass |
| LOD2 | 10744 | 2.00 MB | 1 | 2 | 0 | 12 | pass |

## Failures

- None in static GLB audit.

## Remaining Manual Gate

- Import in Unity, configure Humanoid Avatar, and inspect shoulders, elbows, wrists, hips, knees, ankles, face, and hair under every clip.
- Automated quad remesh is not a substitute for final manual facial and joint edge-loop retopology.
