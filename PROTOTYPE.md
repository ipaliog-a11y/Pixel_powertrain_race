# Prototype mode

**Question now:** How does `Engine_simulator`'s real 1 kHz 4-wheel physics feel across 6 diverse cars (MX-5 NA -> 993 Turbo -> Hilux) on a miniature multi-surface tabletop figure-8 with overpass, drift smoke, smashables, and pack ghosts?

## Style lock

- Framed wooden tabletop diorama (`96 m x 64 m`), orthographic whole-board camera (`[C]` toggles chase cam)
- Crisp matte/flat PBR materials, cascaded directional sunlight, ACES tone mapping
- Mixed surfaces wired into PES `u.road`: asphalt, loose dirt/gravel, shallow water splash, serrated kerbs, and 2.55 m bridge overpass

## Rounds

| Round | Verdict (human words) |
|---|---|
| 0 | Initial Vite + PixiJS 3D tabletop scaffold. |
| 1 | Wired verbatim PES 1 kHz `stepCar` + 6 factory cars, 3D figure-8 overpass, 4-wheel skid ribbons, smoke/water particles, smashables, procedural audio, and live PES AI pack ghosts. Ready for human playtest. |

## Next after human playtest

- Custom paste/URL import of any player-designed car from `Engine_simulator`
- Kenney CC0 glTF kit dressing option
- Experimental WebGPU deformable sand board (`docs/research/sand-and-destruction-blueprint.md`)
