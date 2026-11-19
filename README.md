# Pixel Powertrain Race

Companion **3D race host** for [Pixel Powertrain](https://github.com/ipaliog-a11y/Engine_simulator) (formerly Pixel Engine Sim).

Pixel Powertrain stays the derived engine / vehicle design tool (classic single-page HTML, no bundler).  
This repo is the **playable race**: PixiJS 3D + WebGPU, tabletop-diorama look, with a bridge that will take power/torque/RPM from PES physics.

## Why a companion

PES `AGENTS.md` forbids ES modules, bundlers, and runtime deps in `index.html`.  
A Sandro Maglione–style PixiJS 3D race needs those, so the race lives here and treats PES as the **physics oracle**.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL. **WASD / arrows** drive. Gamepad: left stick + triggers.

## Current prototype

- Orthographic / high tabletop camera over a wooden board
- Procedural low-poly car + figure-8 ribbon track (no glTF yet)
- Arcade vehicle step (placeholder) — **not** PES fidelity yet
- HUD: speed + intent readout
- Stubs for the PES → race bridge (`src/physics/`)

## Roadmap

See [docs/research/architecture.md](docs/research/architecture.md) and [PROTOTYPE.md](PROTOTYPE.md).

1. Style lock + fun (this prototype)
2. Port / call PES drive-model as the sim step; fingerprint against Engine_simulator
3. Kenney / glTF track pieces (from [pixijs/3d racing example](https://github.com/pixijs/3d/tree/main/examples/racing))
4. Ghosts, lap timer, smashables
5. Optional soft-sand mode (Bekker–Wong / Mason / Pouliquen — cite, don’t fit)

## Research sources

Investigation of the X demos that started this project lives under [`docs/research/`](docs/research/):

- [similar-repos.md](docs/research/similar-repos.md) — ranked OSS to clone
- [sources.md](docs/research/sources.md) — Sandro + thomasma posts, essays, stacks
- [architecture.md](docs/research/architecture.md) — how PES plugs into this host

## Agent workflow

Follow [AGENTS.md](AGENTS.md). Method copied from Sandro Maglione / Ritmo:

- You playtest and report symptoms in player language
- The agent implements; types + headless checks prove it
- Prefer agent-repeatable art (low-poly tabletop), not photoreal

Skills to install later:

```bash
npx skills add https://github.com/pixijs/pixijs-skills
# Ritmo (optional ECS host):
# follow https://raw.githubusercontent.com/typeonce-dev/ritmo/main/packages/core/SETUP.md
```

## License

MIT for code in this repository.  
Third-party assets (when added) keep their own licenses (Kenney CC0, etc.).
