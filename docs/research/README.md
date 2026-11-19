# Research & Technical Blueprints

Notes and extracted technical specs that power `Pixel_powertrain_race` (updated 2026-11-19).

| Document | Contents |
|---|---|
| [sources.md](sources.md) | Investigation of `@SandroMaglione` (*Tabletop Grand Prix*) and `@thomasma_labs` (*Sand-racer* Study #3) demos, essays, and stacks |
| [similar-repos.md](similar-repos.md) | Ranked evaluation of 25+ open-source repositories (PixiJS 3D racing, Ritmo, Skidpad, Tread, Hello-Terrain, Three-Voxel-Destruction, Threejs-Punk) |
| [architecture.md](architecture.md) | System boundaries: `Engine_simulator` physics oracle -> `Pixel_powertrain_race` 3D host |
| [pes-drive-model-spec.md](pes-drive-model-spec.md) | Exact math, state vector, coordinate transform, and `u.road` 4-wheel surface/height hook of `Engine_simulator`'s 1 kHz `stepCar` |
| [pixi3d-racing-anatomy.md](pixi3d-racing-anatomy.md) | Rendering recipes from `pixijs/3d/examples/racing/` & `inkline-town`: streaming ring-buffer skid marks, `ParticleSystem3D` smoke/splash, ghosts, single-stage 2D HUD, procedural audio |
| [sand-and-destruction-blueprint.md](sand-and-destruction-blueprint.md) | Equations & GPU architecture for Bekker–Wong sinkage, Janosi/Mason traction, Pouliquen grainflow, nested ping-pong heightfields, and breakable AVBD constraints |
| [agent-prompts-and-playbooks.md](agent-prompts-and-playbooks.md) | Sandro Maglione / Ritmo agent-first workflow, repeatable style locks, headless verification layers, and copy-paste prompt templates |

Parent physics simulator: [ipaliog-a11y/Engine_simulator](https://github.com/ipaliog-a11y/Engine_simulator).
