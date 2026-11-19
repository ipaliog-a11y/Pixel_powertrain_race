# Changelog

## [Unreleased]

### Real PES 1 kHz physics, 6 factory cars, tabletop figure-8 overpass, FX, ghosts & deep repo blueprints

- **Physics (`src/physics/`):** Ported `Engine_simulator`'s 1 kHz 10-DOF `stepCar`, `driveState`, `driveLaunch`, `driveSprint`, `driveStop100`, and `driveDriver` verbatim; exported 6 factory presets (`MX-5 NA`, `AE86`, `E30 M3`, `Delta Integrale`, `993 Turbo`, `Hilux 2.8D`) via `tools/export-pes-cars.mjs` with 10-decimal-place Vitest parity tests.
- **Tabletop Figure-8 Diorama (`src/race/`):** Continuous 3D vertex-colored track ribbon with 2.55 m bridge overpass, asphalt/dirt/water/grass surface zones wired into `u.road`, serrated kerbs, pine clusters, animated wind turbine, and WebGPU (`indirect-first-instance`) -> WebGL2 auto-detection.
- **FX, Ghosts, Smashables & Audio:** 4-wheel streaming `Geometry3D` skid/rut marks, `ParticleSystem3D` smoke/dust/water splashes, 20 Hz personal-best ghost + 3 live `driveDriver` pack ghosts, mass-coupled smashable crates/barrels/cones/beach balls, and zero-asset Web Audio engine/turbo/skid synthesis.
- **HUD (`src/hud/lapHud.ts`):** Lap/sector timer, best/last/delta, medal targets, clickable `[1-6]` PES Factory Garage, km/h + gear + RPM + boost + slip bars, and live `ABS / TC / ESP` intervention lamps.
- **Research (`docs/research/`):** Added `pes-drive-model-spec.md`, `pixi3d-racing-anatomy.md`, `sand-and-destruction-blueprint.md`, and `agent-prompts-and-playbooks.md`.

### Scaffold companion race host + research dump

- Initial Vite + TypeScript + PixiJS 3D (`@pixi/3d`) scaffold and ranked OSS repository survey (`similar-repos.md`, `sources.md`, `architecture.md`).
