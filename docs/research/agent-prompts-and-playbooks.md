# Agent Prompts, Skills & Verification Playbooks

Distilled from:
- Sandro Maglione — [*Indie game development with AI*](https://www.sandromaglione.com/articles/indie-game-development-with-ai) (1,387 prompts analyzed across 4 games; only 16 were bug prompts because types/lints/headless runs caught the rest)
- [`typeonce-dev/ritmo`](https://github.com/typeonce-dev/ritmo) (`skills/ritmo/SKILL.md`, `skills/ritmo-prototype/SKILL.md`)
- [`pixijs/pixijs-skills`](https://github.com/pixijs/pixijs-skills) (linked locally at `.agents/skills/pixijs-3d`)
- [`ektogamat/threejs-conference/AGENTS.md`](https://github.com/ektogamat/threejs-conference/blob/main/AGENTS.md)

---

## 1. Sandro's Core Law: "Choosing Your Game Is Choosing Your Bottleneck"

1. **Pick a style the agent can repeat 100% of the time.**
   - Detailed organic/anime characters fail and make *you* the 3D asset bottleneck.
   - **Low-poly tabletop diorama** (flat/matte PBR, crisp silhouettes, procedural geometry or Kenney CC0 kits) and **procedural ink-line** (`inkline-town`) can be generated, varied, and debugged by coding agents in minutes.
2. **Separate Simulation from Host.**
   - Simulation = pure data + deterministic step (`src/physics/pesDriveModel.ts`). Zero imports from PixiJS, DOM, Web Audio, or `localStorage`.
   - Host = input sampling (`src/race/controls.ts`), 3D rendering (`src/race/tabletop.ts`), FX (`driftMarks.ts`, `particles.ts`), audio (`audio.ts`), HUD (`lapHud.ts`).
3. **Layers of Automatic Verification (run between prompt and playtest):**
   - **Layer 1 — Strict TypeScript (`npm run check`):** Impossible states unrepresentable; exact schemas.
   - **Layer 2 — Headless Simulation & Physics Parity (`npm test`):** Node/Vitest scripts 1,000+ frames of `stepCar` in milliseconds — verifying 0–100 km/h sprint times, 100–0 braking distances with ABS, surface grip drops on grass/water, lap completion, and determinism without opening a browser.
   - **Layer 3 — Recorded Playtests / Ghosts:** Every human session records compact input/pose frames so when something feels off, the agent can inspect the exact run.
4. **Playtest as a Player, Report as a Player.**
   - Never tell the agent *which constant to tweak* (especially with PES physics, where constants are derived, never fitted!).
   - Report **symptoms**: what felt confusing, weightless, unreadable, or dominant.

---

## 2. Ready-to-Use Prompt Templates for This Repo

### Prompt 1 — Symptom-Based Playtest Iteration
```text
I played 15 minutes on the tabletop circuit switching between the MX-5 NA and the 993 Turbo.
Player observations (symptoms only):
1. Entering the hairpin after the dirt straight, it is hard to judge braking point before the barrier.
2. Smashing through the crate stack feels satisfying, but once scattered it's hard to reset them without reloading.
3. I couldn't tell when my current lap was ahead or behind my best ghost until crossing the finish line.

Follow AGENTS.md:
- Keep PES physics constants untouched (derive, do not fit).
- Add a headless test for any new race/checkpoint/split logic first.
- Run `npm test && npm run build` before reporting back.
```

### Prompt 2 — Importing More Cars from `Engine_simulator`
```text
Export [Car Name] from ../Engine_simulator using tools/export-pes-cars.mjs, add its visual silhouette tint/proportions to the tabletop garage selector, and add a Vitest parity check asserting its standing 0-100 km/h and 100-0 km/h match Engine_simulator's driveSprint / driveStop100.
```

### Prompt 3 — Adding a New Track Diorama Board (Repeatable Style Lock)
```text
Add a second selectable diorama board ("Alpine Hairpins" or "Desert Baja"):
Style lock:
- Framed wooden tabletop baseboard (matte timber border, visible thickness, soft directional sunlight + cascaded shadows, ACES tone mapping)
- Distinct surface zones wired into `u.road` (`asphalt`, `gravel`/`dirt`, `grass`, `water` or `crest` jump `kv`)
- Interactive props with momentum transfer
- Closed centerline with checkpoints + sector splits
Prove in Vitest that an AI driver (`driveDriver`) completes a full valid lap on the new board without leaving bounds.
```

### Prompt 4 — Graduating to Deformable Sand Board (Phase 5)
```text
Read docs/research/sand-and-destruction-blueprint.md and docs/research/pes-drive-model-spec.md.
Add an experimental "Dune Testbed" board with a 256x256 ping-pong heightfield stepped at 60 Hz (Bekker–Wong sinkage + Pouliquen repose avalanche) coupled into PES `stepCar` via `u.road.z` and `u.road.grip`, defaulting to the Toyota Hilux 2.8 D-4D preset.
Verify headless that mass conservation holds within 1% over 600 steps and that wheelspin increases sinkage.
```
