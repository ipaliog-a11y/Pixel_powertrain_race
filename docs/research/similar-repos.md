# Similar repos for racing techniques (PES + Sandro / sand-style)

Research for Eduardo — companion 3D race host for Pixel Powertrain (Engine Simulator).
Date: 2026-11-19. Prefer MIT/Apache/CC0. Do not modify Engine_simulator for this note.

Fit scores: **S** = Sandro-like tabletop race graphics · **T** = thomasma-like sand/destruction · **P** = plugging PES-derived drive physics.

---

## Clone these first (playbook)

1. **pixijs/3d** — `examples/racing/` is the closest Sandro-stack race scaffold (PixiJS 3D + WebGPU, Kenney CC0, crashcat). MIT.
2. **SandroMaglione/inkline-town** + **typeonce-dev/ritmo** — agent-first ECS + PixiJS 3D patterns Sandro used for Tabletop Grand Prix–style work. Apache-2.0 / MIT.
3. **pixijs/pixijs-skills** — agent playbooks for Pixi 2D/3D (pair with Ritmo skills). MIT.
4. **CS-Software-LLC/skidpad** — browser vehicle dynamics (Rust→WASM + TS) designed to host external drive models; Apache-2.0/MIT dual. Best PES chassis bridge (chassis/tyres, not engine).
5. **sbobyn/three-voxel-destruction** (+ **sbobyn/three-avbd**) — WebGPU race-track scene with voxel destruction; MIT. Closest open stand-in for thomasma “destruction” until Sand-racer OSS.
6. **kenjinp/hello-terrain** — WebGPU/TSL deformable heightfields (tracks, holes, paint). MIT. Foundation for soft-soil visuals without reinventing LOD.
7. **bhouston/vibe-gp** — three.js WebGPU+TSL F1 race with explicit `physics.js` / `tyres.js` / `damage.js` modules to study (license unset — ask before shipping forks).
8. **aunyks/tread** — Pacejka 2002 tyre lib in JS (BSD-3). Thin module to validate tyre forces beside PES powertrain.

---

## Ranked table (top picks)

| Rank | Repo | License | Stars | Stack | Reusable code | S | T | P | Demo |
|------|------|---------|-------|-------|---------------|---|---|---|------|
| 1 | [pixijs/3d](https://github.com/pixijs/3d) (`examples/racing/`) | MIT (+ Kenney CC0 assets) | ~127 | PixiJS 3D, WebGPU/WebGL2, crashcat, TS | `Vehicle.ts`, `Track.ts`, `Physics.ts`, `Camera.ts`, `Controls.ts`, `DriftMarks.ts`, `Particles.ts`, `LapTimer.ts`, `Audio.ts` | **High** | Low | Med | [pixijs.com/3d/examples](https://pixijs.com/3d/examples) |
| 2 | [SandroMaglione/inkline-town](https://github.com/SandroMaglione/inkline-town) | Apache-2.0 | ~218 | Ritmo ECS, PixiJS 3D, TS | Agent-first game layout, procedural ink-line View3D, playtest-oriented structure | **High** | Low | Low | [inkline.typeonce.games](https://inkline.typeonce.games) |
| 3 | [typeonce-dev/ritmo](https://github.com/typeonce-dev/ritmo) | MIT | ~166 | TypeScript ECS, agent skills/devtools | ECS runtime, headless sims, Ritmo skills/playbooks (renderer-agnostic) | Med | Low | **High** (host for PES step) | [ritmo.typeonce.dev](https://ritmo.typeonce.dev) |
| 4 | [pixijs/pixijs-skills](https://github.com/pixijs/pixijs-skills) | MIT | ~386 | Agent skill markdown | Skills for agents building Pixi 2D/3D correctly | **High** | Low | Low | — |
| 5 | [mrdoob/Starter-Kit-Racing](https://github.com/mrdoob/Starter-Kit-Racing) | MIT (+ Kenney CC0) | ~347 | three.js, crashcat, JS | Original Kenney race port Pixi example came from; track editor patterns | Med | Low | Med | [mrdoob.github.io/…](https://mrdoob.github.io/Starter-Kit-Racing/) |
| 6 | [isaac-mason/crashcat](https://github.com/isaac-mason/crashcat) | MIT | ~473 | JS/TS physics | Lightweight game physics used by Pixi/mrdoob racing kits | Low | Low | Med | [crashcat.dev](https://crashcat.dev) |
| 7 | [CS-Software-LLC/skidpad](https://github.com/CS-Software-LLC/skidpad) | Apache-2.0 / MIT | ~0 (young) | Rust WASM + TS, Rapier/Jolt hosts | `@skidpad/core`, tyre/drivetrain crates, Three/R3F adapters — swap engine for PES | Low | Low | **High** | docs in repo |
| 8 | [aunyks/tread](https://github.com/aunyks/tread) | BSD-3-Clause | ~3 | JS Pacejka 2002 | `Pacejka2002`, `.tir` loader — tyre forces only | Low | Low | **High** | [jsr.io/@hivoltagexyz/tread](https://jsr.io/@hivoltagexyz/tread) |
| 9 | [sbobyn/three-voxel-destruction](https://github.com/sbobyn/three-voxel-destruction) | MIT | ~27 | three WebGPU, three-avbd | `?scene=track` race + voxel walls/tyres; vehicle damage | Med | **High** | Low–Med | [vercel demo](https://three-voxel-destruction.vercel.app) |
| 10 | [sbobyn/three-avbd](https://github.com/sbobyn/three-avbd) | MIT | ~162 | TS, Three.js, WebGPU | GPU rigid-body solver (AVBD) for destruction | Low | **High** | Low | [three-avbd.vercel.app](https://three-avbd.vercel.app) |
| 11 | [kenjinp/hello-terrain](https://github.com/kenjinp/hello-terrain) | MIT | ~43 | three + R3F, WebGPU, TSL | Elevation edit, holes, paint, compute plugins — tyre-track substrate | Low | **High** | Low | [hello-terrain.kenny.wtf](https://hello-terrain.kenny.wtf) |
| 12 | [bhouston/vibe-gp](https://github.com/bhouston/vibe-gp) | *none declared* | ~0 | three WebGPU + TSL, JS | `src/physics.js`, `tyres.js`, `damage.js`, `track.js`, procedural car/track | Med | Med | Med–High | [vibe-gp.ben3d.ca](https://vibe-gp.ben3d.ca) |

---

## By category

### A. PixiJS 3D / WebGPU racing

| Repo | Notes |
|------|-------|
| **pixijs/3d** | Official; racing example is the #1 clone target for a Sandro-like tabletop race host. |
| **pixijs/pixi-asset-storage** | Kenney `starter-kit-racing/` glTF + sounds (CC0). |
| **mrdoob/Starter-Kit-Racing** | three.js ancestor of the Pixi race example. |
| **KenneyNL/Starter-Kit-Racing** | Godot + CC0 assets (~460★). Assets reusable; Godot code less so for web host. |
| **ugshanyu/usion-racing** | Multiplayer fork of mrdoob kit (MIT). Niche. |

Good Stuff demos (Nightward, Mach 2): playable, **no separate OSS race source** beyond pixijs/3d examples.

### B. Ritmo / Sandro Maglione games

| Repo | License | Notes |
|------|---------|-------|
| **typeonce-dev/ritmo** | MIT | Agent-first ECS; skills live with the package. |
| **SandroMaglione/inkline-town** | Apache-2.0 | PixiJS 3D + Ritmo; closest public graphics sibling to Tabletop Grand Prix method. |
| **SandroMaglione/spirit-call** | *no LICENSE file* | Ritmo + three.js phone action game; patterns for mobile HUD / Capacitor. |
| **mastro993/gta-lunigiana** | *no LICENSE* | Isometric car-theft; Ritmo-adjacent; early; vehicle/camera on real DEM. |
| **giovannilondero/bug-killer** | MIT | Ritmo top-down shooter (tickets-as-enemies); agent scaffold reference, not racing. |

**Tabletop Grand Prix (Sandro trailer):** method documented; **game source not public** as of this research.

### C. Soft-soil / terramechanics / sand

| Repo | License | Notes |
|------|---------|-------|
| **thomasma Sand-racer** | — | Discourse showcase only; **not open-sourced**. Gap #1 for true Bekker–Wong / Pouliquen sand. |
| **kenjinp/hello-terrain** | MIT | Best open deformable terrain / heightfield substrate. |
| **baditaflorin/granular-physics-lab** | MIT | WASM granular + WebGPU visuals; teaching sandbox, not vehicle-coupled. |
| **silvernio/gpu-sand** | ? | Falling-sand compute; Low fit for race. |
| **erik2810/webgpu-spring-mesh** | MIT | TSL PBD springs — pattern for GPU soft bodies, not sand. |

### D. three.js WebGPU + TSL driving / destruction

| Repo | License | Notes |
|------|---------|-------|
| **sbobyn/three-voxel-destruction** | MIT | Race track + destruction. |
| **sbobyn/three-avbd** | MIT | Solver underneath. |
| **bhouston/vibe-gp** | unset | Full F1 WebGPU+TSL race; modular physics/tyres/damage. |
| **ektogamat/threejs-conference** (Threejs-Punk walk) | MIT | WebGPU+TSL rain/wet ground + **AGENTS.md**; walk, not race. |
| **Threejs-Punk Drive** | — | Live at threejspunkdrive.vercel.app; **full race source not public** (gap). |
| **drcollect/demolition-derby** | MIT | three r186 + Rapier damage derby (not WebGPU-first). |
| **ryanfitzpatrickio/san_verde** | unset | WebGPU open-world drive; Bounce physics. |

### E. Agent-first scaffolds

| Repo | License | Notes |
|------|---------|-------|
| **typeonce-dev/ritmo** | MIT | Primary: skills, headless checks, playtest loop. |
| **pixijs/pixijs-skills** | MIT | Pixi-specific agent skills. |
| **ektogamat/threejs-conference** | MIT | Excellent AGENTS.md / Do–Don't recipe for WebGPU+TSL. |

### F. Reusable physics (browser, bridge to PES)

| Repo | License | Notes |
|------|---------|-------|
| **CS-Software-LLC/skidpad** | Apache/MIT | Chassis/tyre/drivetrain WASM; host PES for power curve. |
| **aunyks/tread** | BSD-3 | Pacejka tyre forces only. |
| **KhazP/librecorsa** | **AGPL-3.0** | Full browser sim (500 Hz, Pacejka, thermal). Strong reference; **viral license** — study, don't fork into PES companion without legal OK. |
| **esc5221/drive-game** | Other/custom | 240 Hz custom + three.js; check LICENSE before reuse. |
| **isaac-mason/crashcat** | MIT | Arcade vehicle sphere (Pixi race style), not Pacejka. |

PES already owns derived engine/powertrain; bridge = **torque / wheel speed / load** into a chassis/tyre host (skidpad or custom), not replacing PES with librecorsa.

---

## Gaps (techniques with no public code yet)

1. **thomasma Sand-racer** — nested heightfields, Bekker–Wong / Mason / Pouliquen terramechanics, mass-conserving sand, WebGPU+TSL ping-pong — Discourse only.
2. **Sandro Tabletop Grand Prix** — PixiJS 3D race product; method (playtest reports, Ritmo) public; game repo private.
3. **Threejs-Punk Drive** (Anderson Mancini / Sunag) — full WebGPU race game live; walk alley OSS (`threejs-conference`); Drive source closed.
4. **True tyre–sand two-way coupling** in open repos — closest open pieces are hello-terrain (deform) + tread/skidpad (tyres), not coupled.

---

## Suggested companion-repo architecture

```
PES (classic HTML)  --power/torque/RPM-->  Race host (Vite + TS)
                                              ├─ Renderer: PixiJS 3D (Sandro path)
                                              │     or three WebGPU+TSL (sand/destruction path)
                                              ├─ Sim host: Ritmo ECS (optional) or plain loop
                                              ├─ Chassis: skidpad or custom; tyres: tread / PES loads
                                              └─ Terrain: hello-terrain heightfield (+ later sand)
```

**If Sandro-like first:** clone pixijs/3d racing + inkline-town + ritmo + pixijs-skills.  
**If sand/destruction first:** clone hello-terrain + three-voxel-destruction + three-avbd; watch Sand-racer for OSS.  
**If PES fidelity first:** skidpad + tread; keep PES as the engine oracle; fingerprint chassis separately.

---

## Sources checked

- GitHub (cursor-github): repo metadata, licenses, stars, racing example README.
- Web: PixiJS 3D docs/blog, Sandro essay, three.js Discourse Sand-racer, vibe-gp / Threejs-Punk pages.
- Videos on hand: `/tmp/x-research/sandro-race.mp4`, `thomas-sand.mp4` (not re-analyzed frame-by-frame).
