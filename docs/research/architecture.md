# Architecture — PES physics into a PixiJS race host

```
Engine_simulator (classic HTML)
  engine-physics / drive-model / tyres
           │  power, torque, wheel loads, gear, RPM  (export later)
           ▼
Pixel_powertrain_race (this repo)
  src/physics/pesBridge.ts   ← intents in, plain VehicleState out
  src/race/*                 ← PixiJS View3D + arcade/PES step
  src/hud/*                  ← 2D overlays on the same stage
```

## Principles

1. **Simulation is the game.** UI and renderers never mutate world state.
2. **Intents:** `{ throttle: 0..1, brake: 0..1, steer: -1..1 }` — same for human, bot, replay.
3. **PES as oracle.** When the bridge is live, a headless lap here should match Engine_simulator’s fingerprint band for the same vehicle + controls. Do not retune PES constants here.
4. **Interim arcade step** (`src/race/arcadeVehicle.ts`) is disposable feel glue for PROTOTYPE.md only.

## Bridge contract (v0 stub)

See `src/physics/types.ts` and `src/physics/pesBridge.ts`.

| Field | Meaning | Source later |
|-------|---------|--------------|
| `engineTorqueNm` | Crank torque at current RPM / load | PES `drive-model` / engine |
| `wheelForceN` | Longitudinal force at contact patches | PES tyre + driveline |
| `gear` / `rpm` | Transmission state | PES |
| `massKg` / `Cd` / `frontalArea` | Vehicle body | PES presets |

## Clone-first map

| Goal | Clone |
|------|-------|
| Race scaffold + effects | `pixijs/3d` `examples/racing/` |
| Agent-first ECS | `typeonce-dev/ritmo` + `SandroMaglione/inkline-town` |
| Chassis host for PES power | `CS-Software-LLC/skidpad` |
| Tyre check | `aunyks/tread` (Pacejka) |
| Soft terrain visuals | `kenjinp/hello-terrain` |
| Destruction stand-in | `sbobyn/three-voxel-destruction` |

Full ranked list: [similar-repos.md](similar-repos.md).

## Graduation criteria (leave prototype)

- [ ] Core drive verb locked by human playtests  
- [ ] PES bridge drives the car; arcade step behind a flag or removed  
- [ ] Headless scripted lap vs PES within agreed tolerance  
- [ ] Delete `PROTOTYPE.md`
