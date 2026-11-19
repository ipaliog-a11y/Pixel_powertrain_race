# Sand, Terramechanics & Destruction Blueprint

Technical synthesis of `@thomasma_labs` **Sand-racer** (Study #1–#3) and the closest MIT open-source building blocks:
- [`thomasma` on three.js Discourse](https://discourse.threejs.org/t/sand-racer-real-time-sand-simulation-terramechanics-in-webgpu-three-js-r187-tsl/96255)
- [`kenjinp/hello-terrain`](https://github.com/kenjinp/hello-terrain) (MIT — WebGPU/TSL clipmap/quadtree + elevation compute stages)
- [`sbobyn/three-voxel-destruction`](https://github.com/sbobyn/three-voxel-destruction) + [`sbobyn/three-avbd`](https://github.com/sbobyn/three-avbd) (MIT — GPU Augmented Vertex Block Descent rigid bodies & breakable constraints)
- [`CS-Software-LLC/skidpad`](https://github.com/CS-Software-LLC/skidpad) (MIT/Apache-2.0 — surface ploughing drag)
- [`ektogamat/threejs-conference`](https://github.com/ektogamat/threejs-conference) (MIT — WebGPU ortho `positionWorld` height-collision RT & TSL rules)

---

## 1. How `thomasma_labs` Sand-Racer Works Under the Hood

From the author's engineering breakdown and Study #3 footage:

### A. Nested Multi-Scale Heightfield (Ping-Pong Render Targets, 60 Hz)
- **Coarse world field:** `512 × 512 m` at `1.0 m` texel spacing (`512×512` float32 RT), holding base dune elevation $H(x,z)$ + loose sand depth $d(x,z)$.
- **Vehicle-local fine field:** `~128 × 128 m` (or `64 × 64 m`) at `0.25 m` texel spacing (`256×256` or `512×512` RGBA32F RT) toroidal/sliding window centered on the truck.
- **Mass conservation (~1 L over full sessions):** Every texel updates via conservative finite-volume fluxes across its 4/8 neighbours ($h_i^{n+1} = h_i^n - \frac{\Delta t}{\Delta x} \sum_{j} F_{ij}$). When a tyre footprint depresses texel $i$ by $\Delta z$, the exact displaced volume $V = A_{\text{cell}} \Delta z$ is distributed into perimeter ridge cells weighted by wheel slip velocity and lateral push, rather than simply subtracting height.

### B. Granular Flow: Two Angles of Repose + Pouliquen Rolling Layer
- **Hysteretic repose angles:** Static $\theta_s = 34^\circ$ ($\tan 34^\circ \approx 0.675$), dynamic $\theta_d = 31^\circ$ ($\tan 31^\circ \approx 0.601$).
- **Avalanche / Grainflow tongues:** A static slope stays at rest until $|\nabla h| > \tan \theta_s$; once triggered (mobile layer thickness $R > 0$), sand flows downslope until $|\nabla h| \le \tan \theta_d$.
- **Pouliquen (1999) rheology** (*Physics of Fluids* 11, 542–548): Depth-averaged velocity of a granular layer of thickness $R$ on slope $\theta$ scales with the Froude relation:
  $$\frac{\bar{u}}{\sqrt{g R}} = \beta \frac{R}{h_{\text{stop}}(\theta)} - \gamma, \qquad \tan \theta = \mu_1 + \frac{\mu_2 - \mu_1}{1 + R_0 / R}$$
  Stepped in fragment/compute ping-pong passes, this produces realistic slip-face grainflow tongues rolling down dune lee slopes after a truck cuts across the crest.

### C. Tyre–Sand Contact: Bekker–Wong Sinkage + Mason / Janosi–Hanamoto Traction
1. **Bekker (1956, 1969) & Wong–Reece (1967) Normal Pressure–Sinkage:**
   $$p(z) = \left(\frac{k_c}{b} + k_\phi\right) z^n$$
   where $b$ is the smaller contact patch dimension (tyre width), $k_c$ cohesive modulus, $k_\phi$ frictional modulus (for dry desert sand $k_c \approx 0$, $k_\phi \approx 1500\text{ kN/m}^{n+2}$, $n \approx 1.1$), giving equilibrium sinkage under wheel load $F_z$:
   $$z_0 = \left( \frac{3 F_z}{b (3 - n) (k_c / b + k_\phi) \sqrt{2 r z_0}} \right)^{\frac{2}{2n+1}} \implies \text{closed-form exponent } \frac{2}{2n+1}$$
   and **compaction / bulldozing motion resistance**:
   $$R_c = b \int_0^{z_0} p(z)\,dz = \frac{b}{n + 1}\left(\frac{k_c}{b} + k_\phi\right) z_0^{n+1}$$
2. **Janosi–Hanamoto (1961) / Mason Shear Traction:**
   Shear stress along the contact patch of length $L_c$ at shear displacement $j(\theta)$:
   $$\tau(j) = (c + p \tan \phi)\left(1 - e^{-j / K}\right)$$
   where dry sand has cohesion $c \approx 0$, internal friction $\phi \approx 31^\circ\text{–}34^\circ$, shear deformation modulus $K \approx 10\text{–}25\text{ mm}$. High wheelspin digs deeper (*slip-sinkage* $\Delta z_{\text{slip}} \propto \kappa \cdot v_w \Delta t$) rather than accelerating the truck!

### D. Procedural Zero-Texture Sand Shading & TSL Compile Tip
- Wind ripples: analytic asymmetric sine/trochoid phase modulated by local slope aspect relative to prevailing wind vector, attenuated where disturbance age/depth > 0 (fresh tyre ruts wipe out wind ripples!).
- Grain glints: high-frequency hash sparkle in world-space micro-facets under grazing sun.
- **Critical WebGPU/TSL lesson from `thomasma`:** Never unroll multi-tap stencil/flow loops in JS shader builders — use WGSL/TSL hardware `Loop(...)`, otherwise browser shader Dawn/Tint compilation stalls for multiple seconds.

---

## 2. How This Plugs Directly into Pixel Powertrain (`stepCar`)

Because `Engine_simulator`'s `stepCar(car, s, u, dt)` already steps 4 unsprung wheel masses `zu[0..3]` against `u.road.z[0..3]` and `u.road.grip[0..3]`:

```ts
// Coupling loop (60 Hz sand field <-> 1000 Hz PES stepCar):
// 1. Read local sand surface height h_sand[0..3] under [FL, FR, RL, RR] (GPU readback of 4x4 patch around car)
// 2. Compute Bekker sinkage z0[i] from s.Fz[i] and slip-sinkage from |s.kappa[i]|
// 3. Pass u.road.z[i] = h_dune[i] - z0[i] and u.road.grip[i] = tan(phi_sand) / car.mu
// 4. Add compaction drag R_c[i] as an equivalent grade or wheel drag force
// 5. Splat displaced volume dV[i] into the WebGPU sand ping-pong RT -> ridges pile up beside the ruts!
```

Try loading **`Toyota Hilux 2.8 D-4D (2016)`** or **`Ford F-150 Raptor (2017)`** from our exported PES presets to test off-road/sand modes with real torque curves and curb weights.

---

## 3. Constraint-Based Vehicle Destruction (Study #3 + `three-avbd`)

In Study #3, doors swing on hinges before snapping off and the pickup bed detaches and carves its own sand trail:
- Model detachable panels (hood, doors, bed, bumpers) as child rigid bodies attached to the chassis via **hinge + breakable weld constraints** with force/impulse thresholds ($\|\boldsymbol{\lambda}\| > F_{\text{yield}}$ unlocks the latch so the door swings; $\|\boldsymbol{\lambda}\| > F_{\text{snap}}$ deletes the hinge so the part becomes a free rigid body that also stamps into the sand heightfield).
- Open-source WebGPU reference: `sbobyn/three-avbd` (`GpuSolver3D`) + `sbobyn/three-voxel-destruction` (`?scene=track`).
