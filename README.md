# Pixel Powertrain Race

Companion **3D race game & research testbed** for [Pixel Powertrain (`Engine_simulator`)](https://github.com/ipaliog-a11y/Engine_simulator).

`Engine_simulator` remains the single-file classic-script engine & vehicle designer (`derive, do not fit`).  
`Pixel_powertrain_race` hosts `Engine_simulator`'s real **1 kHz four-wheel `stepCar()` physics** inside a **PixiJS 3D (`@pixi/3d`) WebGPU/WebGL2 miniature tabletop diorama** inspired by `@SandroMaglione`'s *Tabletop Grand Prix* and `@thomasma_labs`' terramechanics research.

---

## Quick Start

```bash
npm install
npm run dev
```

Run headless physics parity + autonomous lap tests and production build:

```bash
npm test
npm run build
```

---

## Controls

| Input | Action |
|---|---|
| `W / S` or `Up / Down` | Throttle / Brake (hold `S` at rest for automatic Reverse) |
| `A / D` or `Left / Right` | Progressive steering |
| `Space` | Mechanical rear handbrake (outside ABS — initiate drifts!) |
| `1` – `6` (or click HUD) | Switch live between 6 exported **PES Factory Cars** |
| `C` | Toggle camera: **Tabletop Diorama Ortho** / **Follow Chase Cam** |
| `G` | Toggle **PES AI Pack Ghosts** (`driveDriver` autonomous racers) |
| `R` / `B` | Reset player car to grid / Reset smashed props |
| `M` | Mute / unmute procedural Web Audio synthesizer |
| **Gamepad** | Left stick steer · `RT`/`A` throttle · `LT`/`B` brake · `X`/`RB` handbrake |

---

## Exported PES Factory Garage (`src/physics/presets/factoryCars.json`)

All 6 presets are exported directly from `Engine_simulator` via `driveCar()` (`npm run export:cars`) and verified to **10 decimal places** against `Engine_simulator`'s own `driveSprint` (0–100 km/h) and `driveStop100` (100–0 km/h) in `src/physics/pesDriveModel.test.ts`:

1. **Mazda MX-5 1.6 (NA, 1989)** — 955 kg · RWD · 7,200 rpm NA
2. **Toyota Corolla Levin GT-APEX (AE86)** — 940 kg · RWD solid rear axle · 7,600 rpm
3. **BMW M3 (E30, 1986)** — 1,200 kg · RWD ITB · 7,250 rpm
4. **Lancia Delta HF Integrale Evoluzione (1992)** — 1,340 kg · Turbo AWD rally icon
5. **Porsche 911 Turbo (993, 1995)** — 1,500 kg · Twin-Turbo AWD (real turbo shaft lag)
6. **Toyota Hilux 2.8 D-4D (2016)** — 2,100 kg · RWD turbo-diesel pickup (plows through crate stacks; ready for Phase 5 sand mode)

---

## What's Inside

- **Derived 1 kHz 10-DOF Vehicle Physics (`src/physics/pesDriveModel.ts`):** Fiala brush tyres with combined slip & relaxation length, sprung roll/pitch/heave, 4 quarter-car unsprung wheels with bump rubbers & asymmetric dampers, turbocharger shaft spool & charge-pipe volume, Karnopp stick-slip clutch & differentials, and Bosch ABS / TC / ESP.
- **3D Figure-8 Overpass Diorama (`src/race/trackCircuit.ts`, `src/race/tabletop.ts`):** Paved asphalt, loose dirt/gravel backstretch, shallow water splash crossing, FIA serrated kerbs, and a 2.55 m elevated bridge overpass — all feeding per-wheel elevation `z[0..3]` and surface friction `grip[0..3]` into `u.road`.
- **Streaming Ring-Buffer Skid Marks & World-Space Particles (`src/race/driftMarks.ts`, `src/race/particles.ts`):** Partial GPU vertex buffer updates (`Buffer.update`) + `ParticleSystem3D` smoke, dirt dust, and water splashes.
- **Personal Best Ghost + Live PES AI Pack (`src/race/ghosts.ts`):** 20 Hz lap ghost persisted per car in `localStorage` alongside 3 autonomous PES `driveDriver` pack ghosts.
- **Momentum-Coupled Smashables (`src/race/smashables.ts`):** Crate pyramids, barrels, cones, and giant beach balls with mass-accurate impulse exchange.
- **Zero-Asset Web Audio (`src/race/audio.ts`):** Synthesizes engine firing harmonics, load-dependent intake lowpass, turbo whistle, tyre squeal, and impact thuds directly from PES telemetry.

---

## Research & Blueprints (`docs/research/`)

- [docs/research/README.md](docs/research/README.md) — Full index
- [docs/research/sources.md](docs/research/sources.md) — Investigation of `@SandroMaglione` & `@thomasma_labs` demos
- [docs/research/similar-repos.md](docs/research/similar-repos.md) — Ranked evaluation of 25+ OSS repos to reuse/study
- [docs/research/pes-drive-model-spec.md](docs/research/pes-drive-model-spec.md) — `driveCar()` / `stepCar()` spec & coordinate transform
- [docs/research/pixi3d-racing-anatomy.md](docs/research/pixi3d-racing-anatomy.md) — PixiJS 3D rendering, FX, HUD, and ghost patterns
- [docs/research/sand-and-destruction-blueprint.md](docs/research/sand-and-destruction-blueprint.md) — Bekker–Wong / Mason / Pouliquen GPU sand & AVBD destruction blueprint
- [docs/research/agent-prompts-and-playbooks.md](docs/research/agent-prompts-and-playbooks.md) — Sandro / Ritmo agent-first workflow & copy-paste prompts

## License

MIT (`LICENSE`).
