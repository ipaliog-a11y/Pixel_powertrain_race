/**
 * Pure 3D figure-8 tabletop circuit geometry, 4-wheel road sampler (u.road),
 * board wall containment, and checkpoint lap timing.
 *
 * Coordinate convention:
 *   - PES planar: (x, y_pes), heading psi (rad, CCW from +X).
 *   - PixiJS 3D:  worldX = x, worldY = elevation, worldZ = -y_pes.
 */
import { DRIVE_SURFACE } from '../physics/pesDriveModel';
import type { LinePoint } from '../physics/pesDriveModel';
import type { PesCarData, PesCarState, PesRoadSample } from '../physics/types';

export type SurfaceKind = 'asphalt' | 'dirt' | 'grass' | 'water' | 'bridge';

export type TrackNode = {
  /** Parameter 0..2pi */
  u: number;
  /** PES X (m) */
  x: number;
  /** PES Y (m) = -worldZ */
  y: number;
  /** Elevation (m, +up) */
  z: number;
  /** Unit tangent in PES XY */
  tx: number;
  ty: number;
  /** Unit left normal in PES XY */
  nx: number;
  ny: number;
  /** Heading in PES XY (rad) */
  psi: number;
  /** Cumulative 2D arc length (m) */
  s: number;
  /** Segment length to next node (m) */
  ds: number;
  /** Longitudinal grade sin(theta) */
  sinT: number;
  /** Vertical curvature d^2z/ds^2 (1/m, negative over bridge crest) */
  kv: number;
  /** Half-width of driveable surface (m) */
  halfWidth: number;
  surface: Exclude<SurfaceKind, 'grass'>;
  /** Target speed (m/s) for PES autonomous ghost driver */
  targetV: number;
};

export const BOARD_HALF_X = 48;
export const BOARD_HALF_Y = 32;
export const TRACK_SAMPLES = 240;
export const TRACK_HALF_WIDTH = 4.6;
export const KERB_WIDTH = 0.75;

/** Medal lap-time targets (seconds) on the Tabletop Grand Prix figure-8 */
export const MEDAL_TIMES = {
  gold: 21.5,
  silver: 24.5,
  bronze: 28.5,
} as const;

/**
 * Smooth figure-8 curve (Gerono/lemniscate blend) scaled to fit a 96m x 64m board:
 *   x(u) = A sin(u)
 *   y(u) = B sin(u) cos(u)
 * Crosses the origin twice:
 *   - At u = 0 (going +X, +Y): elevated overpass bridge (z = 2.5 m)!
 *   - At u = pi (going -X, +Y): ground-level underpass (z = 0.0 m)!
 */
function rawPoint(u: number): { x: number; y: number; z: number; surface: Exclude<SurfaceKind, 'grass'> } {
  const A = 37;
  const B = 50;
  const x = A * Math.sin(u);
  const y = B * Math.sin(u) * Math.cos(u);

  // Smooth raised bridge around u = 0 (wrapping 2*pi)
  let du = u;
  if (du > Math.PI) du -= Math.PI * 2;
  const bridgeSpan = 0.68; // rad (~26 m ramp-deck-ramp)
  let z = 0;
  if (Math.abs(du) < bridgeSpan) {
    const c = 0.5 * (1 + Math.cos((Math.PI * du) / bridgeSpan));
    z = 2.55 * c * c * (3 - 2 * c);
  }

  let surface: Exclude<SurfaceKind, 'grass'> = 'asphalt';
  if (Math.abs(du) < 0.36) {
    surface = 'bridge';
  } else if (u >= 0.75 && u <= 2.15) {
    surface = 'dirt';
  } else if (u >= 4.35 && u <= 4.95) {
    surface = 'water';
  }

  return { x, y, z, surface };
}

export function buildCircuit(): {
  nodes: TrackNode[];
  totalLength: number;
  aiLine: LinePoint[];
  spawn: { x: number; y: number; psi: number; nodeIndex: number };
} {
  const N = TRACK_SAMPLES;
  const pts = Array.from({ length: N }, (_, i) => {
    const u = (i / N) * Math.PI * 2;
    return { u, ...rawPoint(u) };
  });

  const nodes: TrackNode[] = [];
  let sAcc = 0;
  for (let i = 0; i < N; i++) {
    const prev = pts[(i - 1 + N) % N];
    const curr = pts[i];
    const next = pts[(i + 1) % N];
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const ds = Math.hypot(dx, dy) || 1;
    const tx = dx / ds;
    const ty = dy / ds;
    const nx = -ty;
    const ny = tx;
    const psi = Math.atan2(ty, tx);

    const dsPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y) || 1;
    const dzFwd = (next.z - curr.z) / ds;
    const dzBack = (curr.z - prev.z) / dsPrev;
    const sinT = Math.max(-0.25, Math.min(0.25, 0.5 * (dzFwd + dzBack)));
    const kv = Math.max(-0.06, Math.min(0.06, (dzFwd - dzBack) / (0.5 * (ds + dsPrev))));

    // Estimate horizontal curvature for AI target speed
    const dx0 = curr.x - prev.x;
    const dy0 = curr.y - prev.y;
    let dPsi = Math.atan2(dy, dx) - Math.atan2(dy0, dx0);
    while (dPsi > Math.PI) dPsi -= Math.PI * 2;
    while (dPsi < -Math.PI) dPsi += Math.PI * 2;
    const curv = Math.abs(dPsi) / (0.5 * (ds + dsPrev));
    const muSurf =
      curr.surface === 'dirt' ? 0.52 : curr.surface === 'water' ? 0.42 : 0.82;
    const vCorner = Math.sqrt((muSurf * 9.81) / Math.max(0.015, curv));
    const targetV = Math.max(10, Math.min(27, vCorner));

    nodes.push({
      u: curr.u,
      x: curr.x,
      y: curr.y,
      z: curr.z,
      tx,
      ty,
      nx,
      ny,
      psi,
      s: sAcc,
      ds,
      sinT,
      kv,
      halfWidth: TRACK_HALF_WIDTH,
      surface: curr.surface,
      targetV,
    });
    sAcc += ds;
  }

  // Forward/backward braking pass on targetV so AI ghosts brake before hairpins
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const next = nodes[(i + 1) % N];
      const vMaxBrake = Math.sqrt(next.targetV * next.targetV + 2 * 6.2 * nodes[i].ds);
      if (vMaxBrake < nodes[i].targetV) nodes[i].targetV = vMaxBrake;
    }
  }

  const aiLine: LinePoint[] = nodes.map((n) => ({
    x: n.x,
    y: n.y,
    v: n.targetV,
    grade: n.sinT,
    kv: n.kv,
  }));

  // Spawn on the flat asphalt south-east straight heading into the start/finish line (node ~206)
  const spawnIdx = 208;
  const sp = nodes[spawnIdx];
  return {
    nodes,
    totalLength: sAcc,
    aiLine,
    spawn: { x: sp.x, y: sp.y, psi: sp.psi, nodeIndex: spawnIdx },
  };
}

export class TrackTracker {
  public nodeIndex: number;

  constructor(initialIndex = 208) {
    this.nodeIndex = initialIndex;
  }

  /** Advance nearest centerline index locally so overpass vs underpass never teleports */
  public locate(nodes: TrackNode[], x: number, y: number): TrackNode {
    const N = nodes.length;
    let best = this.nodeIndex;
    let bestDist = Infinity;
    // Search +-28 nodes around current index first (covers ~55m window)
    for (let offset = -28; offset <= 28; offset++) {
      const idx = (this.nodeIndex + offset + N) % N;
      const nd = nodes[idx];
      const d2 = (x - nd.x) * (x - nd.x) + (y - nd.y) * (y - nd.y);
      if (d2 < bestDist) {
        bestDist = d2;
        best = idx;
      }
    }
    // If car wandered very far off-track (>22m), fall back to global nearest ground node
    if (bestDist > 22 * 22) {
      for (let i = 0; i < N; i++) {
        const nd = nodes[i];
        const d2 = (x - nd.x) * (x - nd.x) + (y - nd.y) * (y - nd.y);
        if (d2 < bestDist) {
          bestDist = d2;
          best = i;
        }
      }
    }
    this.nodeIndex = best;
    return nodes[best];
  }
}

function gripForSurface(surface: SurfaceKind): number {
  switch (surface) {
    case 'asphalt':
      return DRIVE_SURFACE.asphalt;
    case 'bridge':
      return 0.96;
    case 'dirt':
      return DRIVE_SURFACE.gravel;
    case 'grass':
      return DRIVE_SURFACE.grass;
    case 'water':
      return DRIVE_SURFACE.grassWet;
  }
}

/**
 * Sample 4-wheel elevation, kerb rumble, grade, crest curvature, and grip
 * for Engine_simulator's stepCar(car, s, u, dt).
 */
export function sampleCircuitRoad(
  nodes: TrackNode[],
  tracker: TrackTracker,
  car: PesCarData,
  s: PesCarState,
): PesRoadSample {
  const center = tracker.locate(nodes, s.x, s.y);
  const N = nodes.length;
  const c = Math.cos(s.psi);
  const sn = Math.sin(s.psi);
  const xw = [car.a, car.a, -car.b, -car.b];
  const yw = [car.tF / 2, -car.tF / 2, car.tR / 2, -car.tR / 2];

  const z: [number, number, number, number] = [0, 0, 0, 0];
  const grip: [number, number, number, number] = [1, 1, 1, 1];
  let dominantSurface: SurfaceKind = center.surface;
  let offCount = 0;

  for (let q = 0; q < 4; q++) {
    const wx = s.x + xw[q] * c - yw[q] * sn;
    const wy = s.y + xw[q] * sn + yw[q] * c;

    // Refine local node within +-4 around center.nodeIndex for this wheel
    let wi = tracker.nodeIndex;
    let bestD = Infinity;
    for (let k = -4; k <= 4; k++) {
      const idx = (tracker.nodeIndex + k + N) % N;
      const nd = nodes[idx];
      const d2 = (wx - nd.x) * (wx - nd.x) + (wy - nd.y) * (wy - nd.y);
      if (d2 < bestD) {
        bestD = d2;
        wi = idx;
      }
    }
    const nd = nodes[wi];
    const along = (wx - nd.x) * nd.tx + (wy - nd.y) * nd.ty;
    const lat = (wx - nd.x) * nd.nx + (wy - nd.y) * nd.ny;
    const absLat = Math.abs(lat);
    const nextNd = nodes[(wi + 1) % N];
    const frac = Math.max(0, Math.min(1, along / nd.ds));
    const baseElev = nd.z + (nextNd.z - nd.z) * frac;

    if (absLat <= nd.halfWidth) {
      // Micro surface texture (subtle dirt washboard vs smooth asphalt)
      const ripple =
        nd.surface === 'dirt' ? 0.008 * Math.sin((nd.s + along) * 3.4 + q * 1.1) : 0;
      z[q] = baseElev + ripple;
      grip[q] = gripForSurface(nd.surface);
    } else if (absLat <= nd.halfWidth + KERB_WIDTH && nd.surface !== 'bridge') {
      // FIA 4.5 cm serrated kerb
      const kerbRamp = Math.min(1, (absLat - nd.halfWidth) / 0.3);
      const serration = 0.009 * Math.sin((nd.s + along) * 7.5);
      z[q] = baseElev + 0.042 * kerbRamp + serration;
      grip[q] = 0.88;
    } else {
      // Off-road grass on tabletop board (or bridge edge rail)
      z[q] = nd.surface === 'bridge' ? baseElev : 0;
      grip[q] = gripForSurface('grass');
      offCount++;
    }
  }

  if (offCount >= 3) dominantSurface = 'grass';

  return {
    sinT: dominantSurface === 'grass' ? 0 : center.sinT,
    kv: offCount >= 3 ? 0 : center.kv,
    z,
    grip,
    surfaceTag: dominantSurface,
  };
}

/** Keep the car inside the wooden tabletop border with realistic wall bounce/scrape */
export function enforceBoardWalls(s: PesCarState): number {
  let impactSpeed = 0;
  const marginX = BOARD_HALF_X - 1.6;
  const marginY = BOARD_HALF_Y - 1.6;
  const c = Math.cos(s.psi);
  const sn = Math.sin(s.psi);
  let worldVx = s.vx * c - s.vy * sn;
  let worldVy = s.vx * sn + s.vy * c;
  let hit = false;

  if (s.x > marginX) {
    s.x = marginX;
    if (worldVx > 0) {
      impactSpeed = Math.max(impactSpeed, worldVx);
      worldVx = -worldVx * 0.32;
      worldVy *= 0.82;
      hit = true;
    }
  } else if (s.x < -marginX) {
    s.x = -marginX;
    if (worldVx < 0) {
      impactSpeed = Math.max(impactSpeed, -worldVx);
      worldVx = -worldVx * 0.32;
      worldVy *= 0.82;
      hit = true;
    }
  }

  if (s.y > marginY) {
    s.y = marginY;
    if (worldVy > 0) {
      impactSpeed = Math.max(impactSpeed, worldVy);
      worldVy = -worldVy * 0.32;
      worldVx *= 0.82;
      hit = true;
    }
  } else if (s.y < -marginY) {
    s.y = -marginY;
    if (worldVy < 0) {
      impactSpeed = Math.max(impactSpeed, -worldVy);
      worldVy = -worldVy * 0.32;
      worldVx *= 0.82;
      hit = true;
    }
  }

  if (hit) {
    s.vx = worldVx * c + worldVy * sn;
    s.vy = -worldVx * sn + worldVy * c;
    s.yaw *= 0.4;
  }
  return impactSpeed;
}

/** Bridge guardrail check so cars on the overpass stay on the bridge deck */
export function enforceBridgeRails(nodes: TrackNode[], tracker: TrackTracker, s: PesCarState): number {
  const nd = nodes[tracker.nodeIndex];
  if (nd.z < 0.65) return 0;
  const lat = (s.x - nd.x) * nd.nx + (s.y - nd.y) * nd.ny;
  const maxLat = nd.halfWidth + 0.25;
  if (Math.abs(lat) <= maxLat) return 0;

  const sign = Math.sign(lat);
  const push = Math.abs(lat) - maxLat;
  s.x -= nd.nx * sign * push;
  s.y -= nd.ny * sign * push;

  const c = Math.cos(s.psi);
  const sn = Math.sin(s.psi);
  let wvx = s.vx * c - s.vy * sn;
  let wvy = s.vx * sn + s.vy * c;
  const vn = wvx * nd.nx + wvy * nd.ny;
  let impact = 0;
  if (vn * sign > 0) {
    impact = Math.abs(vn);
    wvx -= 1.3 * vn * nd.nx;
    wvy -= 1.3 * vn * nd.ny;
    s.vx = wvx * c + wvy * sn;
    s.vy = -wvx * sn + wvy * c;
  }
  return impact;
}

export class LapRaceTimer {
  public lap = 1;
  public currentTime = 0;
  public lastLap: number | null = null;
  public bestLap: number | null = null;
  public lastDelta: number | null = null;
  public running = false;
  private readonly _sectorsHit = new Set<number>();
  private _prevNode: number;
  private readonly _finishNode = 220;

  constructor(storageKey: string, startNode = 208) {
    this._prevNode = startNode;
    this.bestLap = this._loadBest(storageKey);
  }

  public setStorageKey(storageKey: string, startNode = 208): void {
    this.lap = 1;
    this.currentTime = 0;
    this.lastLap = null;
    this.lastDelta = null;
    this.running = false;
    this._sectorsHit.clear();
    this._prevNode = startNode;
    this.bestLap = this._loadBest(storageKey);
  }

  public resetRun(startNode = 208): void {
    this.currentTime = 0;
    this.running = false;
    this._sectorsHit.clear();
    this._prevNode = startNode;
  }

  /** Returns completed lap time if finish line was just crossed validly, otherwise null */
  public update(dt: number, nodeIndex: number, hasInput: boolean, storageKey: string): number | null {
    if (!this.running && !hasInput) {
      this._prevNode = nodeIndex;
      return null;
    }
    this.running = true;
    this.currentTime += dt;

    // 4 sectors around the 240-node loop: [20..70], [80..130], [140..185], [190..215]
    if (nodeIndex >= 20 && nodeIndex <= 70) this._sectorsHit.add(0);
    else if (nodeIndex >= 80 && nodeIndex <= 130) this._sectorsHit.add(1);
    else if (nodeIndex >= 140 && nodeIndex <= 185) this._sectorsHit.add(2);
    else if (nodeIndex >= 190 && nodeIndex <= 218) this._sectorsHit.add(3);

    let completed: number | null = null;
    const crossed =
      this._prevNode < this._finishNode &&
      nodeIndex >= this._finishNode &&
      nodeIndex - this._prevNode < 30;

    if (crossed) {
      if (this._sectorsHit.size === 4 && this.currentTime > 8) {
        completed = this.currentTime;
        this.lastDelta = this.bestLap !== null ? completed - this.bestLap : null;
        this.lastLap = completed;
        if (this.bestLap === null || completed < this.bestLap) {
          this.bestLap = completed;
          this._saveBest(storageKey, completed);
        }
        this.lap += 1;
      }
      this.currentTime = 0;
      this._sectorsHit.clear();
    }

    this._prevNode = nodeIndex;
    return completed;
  }

  private _loadBest(key: string): number | null {
    try {
      const raw = localStorage.getItem(key);
      const val = raw !== null ? Number(raw) : NaN;
      return Number.isFinite(val) && val > 5 ? val : null;
    } catch {
      return null;
    }
  }

  private _saveBest(key: string, value: number): void {
    try {
      localStorage.setItem(key, value.toFixed(3));
    } catch {
      // Ignore blocked storage
    }
  }
}
