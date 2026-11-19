/** Shared sim types. Renderers read these; only the physics step writes them. */

export type DriveIntent = {
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** -1..1, negative = left */
  steer: number;
};

export type VehicleState = {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  yawRate: number;
  speedMs: number;
  rpm: number;
  gear: number;
  engineTorqueNm: number;
};

export type VehicleSpec = {
  massKg: number;
  /** Placeholder until PES frontal area / Cd wire in */
  drag: number;
  wheelbase: number;
  maxSteerRad: number;
  /** Interim arcade peak accel (m/s²); PES bridge replaces this */
  arcadePeakAccel: number;
  arcadePeakBrake: number;
};

/** Default toy-car numbers — not a real preset. Marked unsure for PES. */
export const TOY_SPEC: VehicleSpec = {
  massKg: 1200,
  drag: 0.35,
  wheelbase: 2.5,
  maxSteerRad: 0.55,
  arcadePeakAccel: 6.5,
  arcadePeakBrake: 10,
};
