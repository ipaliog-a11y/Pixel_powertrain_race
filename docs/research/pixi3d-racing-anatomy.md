# PixiJS 3D Racing Anatomy (Extracted from `pixijs/3d` & `inkline-town`)

Concrete rendering, FX, HUD, and audio patterns extracted from:
- [`pixijs/3d/examples/racing/`](https://github.com/pixijs/3d/tree/main/examples/racing) (MIT + Kenney CC0)
- [`SandroMaglione/inkline-town`](https://github.com/SandroMaglione/inkline-town) PR #36/#37 (Apache-2.0)

---

## 1. Stage Layout: One Canvas, Zero DOM Sync

Both Sandro's PixiJS 3D games and the official racing example put `View3D` and the 2D HUD on a single `app.stage`:

```ts
const app = new Application();
await app.init({ preference: 'webgpu', resizeTo: window, antialias: true, resolution: devicePixelRatio, autoDensity: true });

const view3d = new View3D({
  autoResize: true,
  shadowQuality: 'high',
  toneMapping: 'aces',
  exposure: 1.0,
  environment: { skyColor: 0xc8d8e8, groundColor: 0x7a8a5a, intensity: 0.85 },
});
app.stage.addChild(view3d);

const hudLayer = new Container();
app.stage.addChild(hudLayer); // Pixi 2D Graphics + BitmapText / Text on top of 3D
```

**Why this matters:**
- No CSS/DOM layout pass over WebGPU frames.
- `view3d.worldToScreen(worldVec3, outPoint)` projects 3D car positions to 2D HUD tags (ghost names, split popups) in one line.
- On GPUs without WebGPU `indirect-first-instance`, check adapter features before `app.init` and fall back cleanly to `'webgl'`.

---

## 2. Streaming Drift Marks (`DriftMarks.ts` Pattern)

Instead of spawning thousands of decal meshes, allocate **one fixed ring buffer per tyre** (`MAX_SEGMENTS = 2048..4096`) in a `Geometry3D` with `BufferUsage.VERTEX | BufferUsage.COPY_DST`:

1. Pre-allocate `positions` (`Float32Array`, 6 verts × 3 floats per segment) and `colors` (`Float32Array`, 6 verts × 4 floats RGBA).
2. Unwritten segments remain all zeros -> degenerate zero-area triangles skipped by the GPU rasterizer with **zero `drawCount` bookkeeping**.
3. When a wheel's combined slip `s` exceeds threshold (e.g. `s > 0.55` from PES `driveTyre`), write two triangles `(pL, pR, cL)` and `(pR, cR, cL)` lifted `Y_OFFSET = 0.025 m` above the surface, set vertex alpha proportional to slip, and upload **only those 72 / 96 bytes**:
   ```ts
   positionsBuffer.update(POSITION_BYTES_PER_SEGMENT, positionOffset * 4);
   colorsBuffer.update(COLOR_BYTES_PER_SEGMENT, colorOffset * 4);
   ```
4. Use `FlatMaterial({ baseColor: [0.08, 0.08, 0.09, 1], alphaMode: 'blend', doubleSided: true })` + `material.state.polygonOffset = -4` (helps WebGL; `Y_OFFSET` handles WebGPU).

With PES 4-wheel physics, we run **four trails** (`FL, FR, RL, RR`), so front lockups under non-ABS braking leave front rubber while rear powerslides and handbrake turns paint twin rear stripes!

---

## 3. World-Space Tyre Smoke & Water Splash (`Particles.ts` Pattern)

Use `@pixi/3d/extras` `ParticleSystem3D` with `autoUpdate: false` and `emitRate: 0`:
- Generate a procedural soft radial puff texture once on an offscreen 2D canvas (`Texture.from(canvas)`) — zero external image files needed (the `Nightward` Good Stuff technique!).
- On each tick, inspect each wheel's slip and surface:
  - Dry asphalt/dirt slide -> spawn cool grey/tan smoke puffs (`color: 0xcfd4dc`, expanding `size` -> `sizeEnd`, `alpha: 0.28 -> 0`).
  - Water zone -> spawn bright cyan-white splash droplets (`speed: [2, 4.5]`, higher drag/gravity).
- Call `system.update(app.ticker)` once per frame: all 4 wheels share **one draw call**.

---

## 4. Articulated Vehicle Hierarchy (`Vehicle.ts` + PES State)

`Vehicle.ts` separates `container` (planar `x, z, yaw`) from `bodyNode` (`heave, pitch, roll`) and 4 `wheel` containers (`steer` × `spin`, plus vertical travel `zu`):

- In `pixijs/3d/examples/racing`, pitch and roll were faked with `lerpAngle` from speed deltas.
- In `Pixel_powertrain_race`, `stepCar` computes **real physical** `s.heave`, `s.roll`, `s.pitch`, per-wheel `s.zu[0..3]`, front steer `s.delta + s.toe[i]`, camber `s.camber[i]`, and wheel angular speed `s.w[0..3]` (rad/s)!
- Applying `s.roll` and `s.pitch` directly to `bodyNode` makes soft-sprung 1980s cars (MX-5 NA, AE86, Hilux) visibly lean onto their outside bump stops in corners and squat/dive on shifts and braking, while stiff track cars (911 GT3) stay flat.

---

## 5. Ghost Cars & "Race the Pack"

Sandro's trailer shows both **1v1 personal best ghost** and **pack ghosts**:
- Record compact quantized frames at 20 Hz (`t, x, y, psi, roll, pitch, steer` = 7 numbers/frame, ~4.2 KB for a 30 s lap in `localStorage`).
- Interpolate between frames on playback; render each ghost with the same `ToyCar` geometry sharing `Material3D({ alphaMode: 'blend', baseColor: neonTint, alpha: 0.42 })` — PixiJS 3D batches identical geometry/material automatically.

---

## 6. Interactive Props ("Everything Moves / Smash Through")

Two tiers from the research:
- **Lightweight tabletop smashables (no WASM):** `crashcat` (already installed, MIT, 473★, used by `pixijs/3d/examples/racing`) or compact impulse rigid-body boxes/spheres for wooden crates, cones, and beach balls knocked flying by the car's oriented bounding box, imparting an equal-and-opposite momentum impulse $\Delta \mathbf{v} = -\mathbf{J} / m_{\text{car}}$ back onto `s.vx, s.vy` so heavy cars (Hilux, 2100 kg) plow straight through while light cars (MX-5, 950 kg) feel the hit!
- **Full GPU fracture later:** `sbobyn/three-avbd` / `three-voxel-destruction` patterns.

---

## 7. Procedural Engine & Skid Web Audio (`Audio.ts` + PES `sound.js`)

Combine `pixijs/3d` `Audio.ts` biquad-filtered dual-layer synthesis with PES's real `s.rpm`, `car.redline`, cylinder firing frequency (`rpm / 60 * cylinders / 2`), turbo `s.boost` whistle, and real tyre slip `maxSlip`:
- Sawtooth + pulse oscillators at firing fundamental & 2nd harmonic -> lowpass filter whose cutoff opens from `450 Hz` (closed throttle) to `5200 Hz` (WOT) + subtle turbo wastegate hiss when `s.boost > 0.2` -> zero audio asset downloads.
