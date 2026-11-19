# Pixel Powertrain (`Engine_simulator`) Drive Model Specification

Source in parent repo: `Engine_simulator/src/js/drive-model.js` (builds 263–384).

`Engine_simulator` already ships a standalone, zero-DOM, 1 kHz four-wheel time-stepping vehicle simulator (`stepCar`) designed specifically so a separate driving/racing game can load exported `driveCar()` JSON and step the exact derived powertrain and chassis in real time.

---

## 1. Two-Half Architecture

| Function | Where it runs | Dependencies | Output |
|---|---|---|---|
| `driveCar()` | Inside `Engine_simulator` (or headless export tool) | Full engine + vehicle designer (`powertrain()`, `quarterCar()`, `rollStiffness()`, `simulateAccelRun()`) | Plain JSON-serializable `PesCarData` (~3–8 KB per car; turbo cars include a 10×16×6 shaft power/boost lookup table; hybrids/EVs include pack OCV and motor loss grids) |
| `driveState(car)` / `driveLaunch(car)` | In `Pixel_powertrain_race` | None (pure math) | Mutable `PesCarState` at idle rest or brake-boosted launch RPM |
| `stepCar(car, s, u, dt)` | In `Pixel_powertrain_race` | None (`Math` only; sub-steps internally at `H = 0.001 s` = 1 kHz) | Advances `s` in-place and returns telemetry for rendering, audio, skid marks, and FFB |

---

## 2. What `stepCar` Simulates (All Derived, Cited in `drive-model.js`)

1. **Planar 3-DOF + Sprung 3-DOF + 4 Unsprung Quarter-Cars (10 DOF total):**
   - Planar chassis: longitudinal `vx`, lateral `vy`, yaw rate `yaw` ($I_{zz} = m a b$, Milliken & Milliken RCVD ch. 5).
   - Sprung body on springs, anti-roll bars, progressive polyurethane bump rubbers ($x_b = 25\text{ mm}$, Reimpell ch. 5), and asymmetric bound/rebound dampers (1:3 ratio, Dixon 2007): `heave`, `roll`, `pitch`.
   - Four independent unsprung wheel travels `zu[0..3]` with implicit damper integration so the 10–15 Hz wheel-hop mode is unconditionally stable at `h = 1 ms`.
   - Side-view swing-arm anti-dive / anti-squat / anti-lift jacking forces (`svF`, `svR`).
2. **Fiala Brush Tyre Model with Combined Slip & Relaxation Length:**
   - Parabolic pressure distribution (Fiala 1954; Pacejka ch. 3): $F = \mu F_z (3s - 3s^2 + s^3)$ up to $s = 1$, transitioning to the falling sliding curve past the peak.
   - Load-sensitive grip $\mu(F_z) = \mu_0 (F_z / F_{z,\text{ref}})^{-\text{loadSens}}$ and load-sensitive cornering stiffness $C_\alpha(F_z)$.
   - Lateral slip angle builds over rolling relaxation length $\sigma \approx r_{\text{tire}}$.
   - Camber thrust from static alignment + roll camber recovery + heave camber curve; roll steer and lateral-force compliance steer (`DRIVE_TOE`).
   - Self-aligning pneumatic trail + caster trail + scrub radius -> `s.steerTorque` and EPS-assisted `s.handTorque` (ready for WebHID force feedback).
3. **Full Powertrain & Transient Turbo / Hybrid Pack:**
   - WOT torque curve + closed-throttle overrun drag + idle governor + redline fuel cut + engine stall (`< 0.8 * fireRpm`) & bump-start / starter cranking.
   - Turbocharger shaft energy $E = \frac{1}{2} J \omega^2$ integrated over 3D `(rpm, shaftSpeed, throttle)` turbine/compressor balance table, plus intake charge-pipe emptying/filling lag (`tb.V`). Spark-cut gearboxes (`dct`, `sequential`, `auto`) hold throttle on flat shifts.
   - Karnopp stick-slip clutch (1.5× peak torque capacity) with automatic launch bite-point modulation (`launchRpm`) or manual clutch pedal.
   - Automatic rev-matched gearbox or manual `u.gear` selection with shift torque cut (`shiftTime`).
   - Axle differentials (open, 2-way friction plate LSD with preload + ramp lock, viscous coupling, spool) and AWD centre couplings (`lock` clutch, Torsen, viscous, open split) solved via Karnopp's stick torque.
   - Hybrid/EV battery SOC state, regenerative braking cut under ABS/ESP (Bosch MSR), and P2 automatic engine start/stop.
4. **Driver Aids (`car.aids`):**
   - **ABS:** Per-wheel pressure cycling around peak slip (`absSlip`). Handbrake (`u.handbrake`) acts on rear wheels outside ABS for drift initiation!
   - **TC:** Throttle trim when driven wheel longitudinal slip exceeds `tcSlip * slipOpt`.
   - **ESP:** Bosch VDC (van Zanten SAE 950759 / 2000-01-1633) single-wheel braking (outer front against oversteer once rear slip exceeds `espBeta`, inner rear against understeer) using single-track yaw-rate reference with Abe's equivalent lag.

---

## 3. Coordinate Frame Mapping (PES -> PixiJS 3D)

`Engine_simulator` uses standard SAE / ISO Z-up / XY-plane planar coordinates:
- `s.x` = forward at `psi = 0` (m)
- `s.y` = left at `psi = 0` (m) (since `s.psi` increases counter-clockwise, `steer > 0` steers **left**)
- `s.heave` = upward body displacement (m)
- `s.roll` = body lean to the right/outside in a left turn (rad)
- `s.pitch` = nose-down / squat pitch (rad)
- Wheel order `[0, 1, 2, 3]` = **`[FL, FR, RL, RR]`** (`xw = [+a, +a, -b, -b]`, `yw = [+tF/2, -tF/2, +tR/2, -tR/2]`).

PixiJS 3D uses right-handed **Y-up** coordinates (`+X` right, `+Y` up, `+Z` out of screen, camera faces `-Z`):
- `worldX = s.x`
- `worldY = baseHeight + s.heave`
- `worldZ = -s.y` (so `+Y_pes` left maps to `-Z_pixi`, preserving right-handedness!)
- `worldYaw = s.psi` around `+Y` (check: at `psi = 0`, forward is `+X`; turning left `psi > 0` rotates `+X` toward `-Z`, which is `rotation.y = +s.psi`!).
- Input steer: player pressing **left** (`A` / `ArrowLeft`, `intent.steer < 0` in screen convention) maps to `u.steer = -intent.steer` (`> 0` = left in PES).

---

## 4. The `u.road` Hook (Surfaces, Kerbs, Bridges, and Future Sand)

Every `stepCar(car, s, u, dt)` call accepts an optional `u.road` object:

```ts
road?: {
  sinT?: number;                  // longitudinal grade (+ uphill)
  kv?: number;                    // vertical curvature 1/m (- over crest -> airborne when g*cosT + vx^2*kv <= 0!)
  z?: [number, number, number, number];    // road elevation (m) under [FL, FR, RL, RR]
  grip?: [number, number, number, number]; // surface friction multiplier under [FL, FR, RL, RR]
}
```

Surface multipliers already derived in `Engine_simulator` (`DRIVE_SURFACE`, Noon 1994 & Cenek NZ):
- Dry asphalt: `1.00`
- Wet asphalt: `0.50 / 0.65 = 0.769`
- Dry grass: `0.37 / 0.65 = 0.569`
- Gravel / loose dirt: `0.35 / 0.65 = 0.538`
- Wet grass / puddle: `0.22 / 0.65 = 0.338`

This single hook lets our tabletop diorama feed **asphalt, dirt straightaway, grass runoff, water splash zone, kerbs, and bridge ramps** into the exact 4-wheel PES physics—and later lets a WebGPU heightfield sand simulation feed per-wheel sinkage `z[0..3]` and Mason traction `grip[0..3]` without touching `stepCar`!

---

## 5. Exporting Cars (`tools/export-pes-cars.mjs`)

Run `npm run export:cars` (when `../Engine_simulator/index.html` is present) to launch headless Chrome against `Engine_simulator`, call `loadVehiclePreset(P); driveCar()` plus benchmark manoeuvres (`driveSprint`, `driveStop100`), and write verified preset JSON + parity baselines into `src/physics/presets/`.

Players will also be able to paste a custom `driveCar()` JSON exported from their own engine build in `Engine_simulator`.
