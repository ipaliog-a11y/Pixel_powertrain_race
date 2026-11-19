/**
 * Interactive tabletop props ("EVERYTHING MOVES / SMASH THROUGH").
 * Pure simulation state + momentum-conserving impulse coupling with PesCarState,
 * so light cars (MX-5, 955 kg) feel heavy crate stacks while the 2,100 kg Hilux
 * blasts right through them.
 */
import { BOARD_HALF_X, BOARD_HALF_Y } from './trackCircuit';
import type { PesCarData, PesCarState } from '../physics/types';

export type PropKind = 'crate' | 'barrel' | 'cone' | 'ball';

export type SmashProp = {
  id: number;
  kind: PropKind;
  /** PES X (m) */
  x: number;
  /** PES Y (m) = -worldZ */
  y: number;
  /** Elevation above ground (m) */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  roll: number;
  wx: number;
  wy: number;
  wz: number;
  radius: number;
  halfHeight: number;
  massKg: number;
  restitution: number;
  color: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
};

export function createDefaultProps(): SmashProp[] {
  const list: SmashProp[] = [];
  let id = 0;

  const push = (
    kind: PropKind,
    x: number,
    y: number,
    z: number,
    radius: number,
    halfHeight: number,
    massKg: number,
    restitution: number,
    color: number,
  ) => {
    list.push({
      id: id++,
      kind,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: (id * 0.7) % Math.PI,
      pitch: 0,
      roll: 0,
      wx: 0,
      wy: 0,
      wz: 0,
      radius,
      halfHeight,
      massKg,
      restitution,
      color,
      spawnX: x,
      spawnY: y,
      spawnZ: z,
    });
  };

  // Wooden crate pyramid on the dirt straightaway exit
  for (const [dx, dy] of [
    [-0.55, -0.55],
    [0.55, -0.55],
    [0, 0.55],
  ] as const) {
    push('crate', 29 + dx, 18 + dy, 0.42, 0.52, 0.42, 24, 0.35, 0xc89b54);
  }
  push('crate', 29, 18, 1.28, 0.52, 0.42, 20, 0.35, 0xd4a962);

  // Second crate cluster near the north-west hairpin
  for (const [dx, dy] of [
    [-0.5, 0],
    [0.5, 0],
    [0, 0.85],
  ] as const) {
    push('crate', -31 + dx, 16 + dy, 0.42, 0.52, 0.42, 22, 0.35, 0xc89b54);
  }

  // Blue barrel cluster along chicane shoulder
  for (const [bx, by] of [
    [16, -21],
    [17.1, -21.6],
    [16.5, -22.5],
    [-18, -19],
    [-19.1, -19.8],
  ] as const) {
    push('barrel', bx, by, 0.48, 0.42, 0.48, 32, 0.42, 0x2b7de9);
  }

  // Traffic cones lining apexes
  for (const [cx, cy] of [
    [35, 6],
    [36, 2],
    [35.5, -2],
    [-35, -4],
    [-36, 0],
    [-35.2, 4],
  ] as const) {
    push('cone', cx, cy, 0.32, 0.28, 0.32, 4, 0.5, 0xff6b1a);
  }

  // Giant bouncy beach balls on the infield / water edge (like Sandro's trailer!)
  push('ball', -10, -21, 0.85, 0.85, 0.85, 9, 0.82, 0xffbe0b);
  push('ball', 22, 8, 0.85, 0.85, 0.85, 9, 0.82, 0xff477e);

  return list;
}

export function resetProps(props: SmashProp[]): void {
  for (const p of props) {
    p.x = p.spawnX;
    p.y = p.spawnY;
    p.z = p.spawnZ;
    p.vx = p.vy = p.vz = 0;
    p.pitch = p.roll = 0;
    p.wx = p.wy = p.wz = 0;
  }
}

/** Step rigid-body props and resolve car <-> prop + prop <-> prop impulses. Returns max impact speed. */
export function stepProps(
  props: SmashProp[],
  car: PesCarData,
  s: PesCarState,
  carElev: number,
  dt: number,
): number {
  let maxImpact = 0;
  const carRadius = Math.max(1.15, (car.a + car.b) * 0.46);
  const c = Math.cos(s.psi);
  const sn = Math.sin(s.psi);
  let carVx = s.vx * c - s.vy * sn;
  let carVy = s.vx * sn + s.vy * c;
  let carChanged = false;

  for (const p of props) {
    // Car <-> prop collision (skip if car is high up on the overpass bridge above a ground prop)
    if (Math.abs(carElev - p.z) < 1.35) {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.hypot(dx, dy);
      const minDist = carRadius + p.radius;
      if (dist < minDist && dist > 1e-4) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        p.x += nx * overlap * 0.92;
        p.y += ny * overlap * 0.92;

        const rvx = p.vx - carVx;
        const rvy = p.vy - carVy;
        const relN = rvx * nx + rvy * ny;
        if (relN < 0) {
          const e = Math.max(0.45, p.restitution);
          const invCar = 1 / car.m;
          const invProp = 1 / p.massKg;
          const j = (-(1 + e) * relN) / (invCar + invProp);

          p.vx += j * invProp * nx;
          p.vy += j * invProp * ny;
          p.vz += Math.min(7.5, Math.abs(relN) * 0.36 + 1.2);
          p.wx += (ny * relN) * 0.9;
          p.wz -= (nx * relN) * 0.9;

          carVx -= j * invCar * nx;
          carVy -= j * invCar * ny;
          carChanged = true;
          maxImpact = Math.max(maxImpact, -relN);
        }
      }
    }

    // Integrate prop motion
    p.vz -= 9.81 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.pitch += p.wx * dt;
    p.yaw += p.wy * dt;
    p.roll += p.wz * dt;

    // Ground bounce & friction
    if (p.z <= p.halfHeight) {
      p.z = p.halfHeight;
      if (p.vz < -0.4) {
        p.vz = -p.vz * p.restitution;
      } else {
        p.vz = 0;
        p.pitch *= Math.max(0, 1 - 4 * dt);
        p.roll *= Math.max(0, 1 - 4 * dt);
      }
      const drag = p.kind === 'ball' ? 0.8 : 2.6;
      const damp = Math.max(0, 1 - drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.wx *= damp;
      p.wz *= damp;
    }

    // Keep props on tabletop
    const bx = BOARD_HALF_X - 1.2;
    const by = BOARD_HALF_Y - 1.2;
    if (p.x > bx) {
      p.x = bx;
      p.vx = -Math.abs(p.vx) * 0.5;
    } else if (p.x < -bx) {
      p.x = -bx;
      p.vx = Math.abs(p.vx) * 0.5;
    }
    if (p.y > by) {
      p.y = by;
      p.vy = -Math.abs(p.vy) * 0.5;
    } else if (p.y < -by) {
      p.y = -by;
      p.vy = Math.abs(p.vy) * 0.5;
    }
  }

  // Prop <-> prop separation
  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const a = props[i];
      const b = props[j];
      if (Math.abs(a.z - b.z) > a.halfHeight + b.halfHeight) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.radius + b.radius;
      if (d < minD && d > 1e-4) {
        const nx = dx / d;
        const ny = dy / d;
        const push = (minD - d) * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn < 0) {
          const imp = -0.7 * rvn;
          a.vx -= imp * 0.5 * nx;
          a.vy -= imp * 0.5 * ny;
          b.vx += imp * 0.5 * nx;
          b.vy += imp * 0.5 * ny;
        }
      }
    }
  }

  if (carChanged) {
    s.vx = carVx * c + carVy * sn;
    s.vy = -carVx * sn + carVy * c;
  }

  return maxImpact;
}
