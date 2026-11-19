/**
 * Disposable arcade integrator for PROTOTYPE.md.
 * Replace with PES bridge + chassis when graduating.
 */
import type { DriveIntent, VehicleSpec, VehicleState } from '../physics/types';

export function createState(x = 0, z = 0): VehicleState {
  return {
    x,
    z,
    yaw: 0,
    vx: 0,
    vz: 0,
    yawRate: 0,
    speedMs: 0,
    rpm: 900,
    gear: 1,
    engineTorqueNm: 0,
  };
}

export function stepArcade(
  state: VehicleState,
  intent: DriveIntent,
  spec: VehicleSpec,
  dt: number,
): VehicleState {
  const speed = Math.hypot(state.vx, state.vz);
  const forwardX = Math.sin(state.yaw);
  const forwardZ = Math.cos(state.yaw);

  const accel =
    intent.throttle * spec.arcadePeakAccel - intent.brake * spec.arcadePeakBrake;
  const drag = spec.drag * speed * speed * Math.sign(speed || 1);
  const along = accel - drag / Math.max(1, spec.massKg / 1000);

  let vx = state.vx + forwardX * along * dt;
  let vz = state.vz + forwardZ * along * dt;

  // Bleed lateral velocity (arcade grip)
  const latX = Math.cos(state.yaw);
  const latZ = -Math.sin(state.yaw);
  const lat = vx * latX + vz * latZ;
  const grip = 1 - Math.min(0.92, 8 * dt);
  vx -= latX * lat * (1 - grip);
  vz -= latZ * lat * (1 - grip);

  const steer =
    intent.steer * spec.maxSteerRad * Math.min(1, Math.abs(speed) / 8 + 0.15);
  const yawRate = (speed / spec.wheelbase) * Math.tan(steer);
  const yaw = state.yaw + yawRate * dt;

  const x = state.x + vx * dt;
  const z = state.z + vz * dt;
  const speedMs = Math.hypot(vx, vz);

  // Soft walls of the board (±14 m)
  const limit = 14;
  const bounce = 0.35;
  if (x > limit) {
    vx = -Math.abs(vx) * bounce;
  }
  if (x < -limit) {
    vx = Math.abs(vx) * bounce;
  }
  if (z > limit) {
    vz = -Math.abs(vz) * bounce;
  }
  if (z < -limit) {
    vz = Math.abs(vz) * bounce;
  }

  return {
    x: clamp(x, -limit, limit),
    z: clamp(z, -limit, limit),
    yaw,
    vx,
    vz,
    yawRate,
    speedMs,
    rpm: state.rpm,
    gear: state.gear,
    engineTorqueNm: state.engineTorqueNm,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
