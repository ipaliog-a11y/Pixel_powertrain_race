# Source demos and writeups

Research date: 2026-11-19 (Europe/Amsterdam). Seed for this companion repo.

## Sandro Maglione — Tabletop Grand Prix (trailer)

- **Post:** https://x.com/SandroMaglione/status/2122359043977032025 (16 Nov 2026)
- **Claimed stack:** PixiJS 3D + WebGPU; world leaderboard, ghosts, gamepad; free in browser
- **Look (from video):** isometric tabletop diorama, orange toy car, skid marks, smashables, water splash, ghosts
- **Method essay:** https://www.sandromaglione.com/articles/indie-game-development-with-ai  
  Agent writes all code; human playtests ~45 min and reports as a player. ECS + types + headless sims + recorded playtests.
- **Ritmo:** https://github.com/typeonce-dev/ritmo · setup prompt: follow `packages/core/SETUP.md`
- **Public sibling game:** https://github.com/SandroMaglione/inkline-town (Apache-2.0, PixiJS 3D + Ritmo)
- **Gap:** Tabletop Grand Prix game source not public as of research

### Copy-paste agent prompts used in planning

```text
Set up Ritmo in this project by following
https://raw.githubusercontent.com/typeonce-dev/ritmo/main/packages/core/SETUP.md

Also: npx skills add https://github.com/pixijs/pixijs-skills
```

```text
Create a PROTOTYPE.md and build the smallest playable tabletop race:
isometric View3D on a wooden board, one low-poly car, figure-8, keyboard + gamepad.
Question: does drifting around the board feel fun in 60 seconds?
```

## thomasma_labs — Sand-racer Study #3

- **Post:** https://x.com/thomasma_labs/status/2123139134134829114 (18 Nov 2026)
- **Stack:** three.js r187 WebGPURenderer + TSL; custom sand + vehicle (no game/physics engine)
- **Physics (Discourse):** https://discourse.threejs.org/t/sand-racer-real-time-sand-simulation-terramechanics-in-webgpu-three-js-r187-tsl/96255  
  - 512×512 m @ 1 m + nested 25 cm field @ 60 Hz  
  - Pouliquen grain flow (34°/31° repose)  
  - Bekker–Wong sinkage + Mason traction  
  - 240 Hz multibody; mass-conserving sand  
  - Zero sand textures — state-driven shading  
  - Tip: TSL `Loop` instead of JS loops (compile time)
- **Nov 1 post** tagged `@claudeai` and called an “AI slop experiment” for the visual pipeline; driving physics claimed as derived
- **Gap:** Sand-racer not open-sourced; no public tyre↔sand coupling repo found

## PixiJS 3D (official)

- Blog: https://pixijs.com/blog/pixi-3d-open-beta  
- Racing example: https://github.com/pixijs/3d/tree/main/examples/racing (Kenney CC0 via crashcat)  
- Skills: https://github.com/pixijs/pixijs-skills  
- Install: `npm install pixi.js @pixi/3d` then `npx skills add https://github.com/pixijs/pixijs-skills`

## Pixel Powertrain (this companion’s physics parent)

- Repo: https://github.com/ipaliog-a11y/Engine_simulator  
- Live: https://ipaliog-a11y.github.io/Engine_simulator/  
- Already has race solver + 2D `track-scene.js` chase; not a player 3D host  
- Rules: derive don’t fit; classic script only — hence this companion
