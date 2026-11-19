# Development instructions for coding agents

Companion race host for **Pixel Powertrain** (`ipaliog-a11y/Engine_simulator`).  
Read this before changing the race loop or the PES bridge.

## 0. Relationship to Engine_simulator

| Repo | Role |
|------|------|
| `Engine_simulator` | Derived engine/vehicle physics, designer UI, 8-bit canvas race *solver*. Classic script, no bundler. |
| **This repo** | Playable 3D race host (Vite + PixiJS 3D). Consumes PES numbers; does not fork PES into a bundler. |

- **Never** copy PES into a place that retunes constants to “feel” better. Derive or cite; gaps stay named.
- Bridge code lives in `src/physics/`. Render / HUD / audio never write sim state.
- When PES `main` moves physics, re-check the bridge fingerprint notes in `docs/research/architecture.md`.

## 1. Stack

- Vite + TypeScript
- `pixi.js` + `@pixi/3d` (WebGPU preferred, WebGL2 fallback)
- Interim arcade step until PES drive-model is ported
- Optional later: `@typeonce/ritmo` ECS, crashcat (Pixi racing kit), Kenney CC0 glTF

## 2. Method (Sandro / Ritmo-inspired)

1. Prefer **playtest reports** over reading every line: symptoms, not patch recipes.
2. **Intents in, plain data out** — keyboard/gamepad → `{ throttle, brake, steer }`; renderers read pose only.
3. **Prove headless** when a rule exists: scripted inputs → assert speed / lap / gear.
4. Style lock: tabletop diorama, flat PBR, soft light — agent-repeatable. No photoreal anime chase.

## 3. Prototype mode

If `PROTOTYPE.md` exists, find the fun first: compile + load is enough until graduation.  
Delete `PROTOTYPE.md` only when the core verb is locked and checks take over.

## 4. Checks before push

```bash
npm run build
```

Add tests under `src/**/*.test.ts` as rules harden (PES fingerprint parity is the bar for the bridge).

## 5. Do not

- Fit tyre or power constants to pass a feel test
- Put PES classic-script files behind a bundler “for convenience” inside Engine_simulator
- Add Greek / i18n unless the owner asks (PES Greek is paused; this host is English-first for now)
