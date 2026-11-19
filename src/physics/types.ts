/**
 * Shared simulation types for Pixel Powertrain Race.
 * Renderers, HUD, and audio ONLY read these; only the physics step writes them.
 */

export type DriveIntent = {
  /** 0..1 accelerator pedal */
  throttle: number;
  /** 0..1 service brake / reverse request at rest */
  brake: number;
  /** -1..1 screen convention: negative = steer left, positive = steer right */
  steer: number;
  /** 0..1 rear mechanical handbrake (outside ABS, for tabletop hairpins/drifts) */
  handbrake: number;
};

export type PesAids = {
  abs: boolean;
  absSlip: [number, number];
  absRel: number;
  absApp: number;
  tc: boolean;
  tcSlip: number;
  tcGain: number;
  esp: boolean;
  espBand: number;
  espTau: number;
  espBeta: number;
  espCut: boolean;
  espVmin: number;
};

export type PesTurboData = {
  J: number;
  nMax: number;
  V: number;
  T01: number;
  rp: number[];
  u: number[];
  n: number[];
  th: number[];
  P: number[];
  bS: number[];
  eta: number[];
  air: number[];
  Tch: number[];
  rpm: number[];
  boosts: number[];
  tq: number[][];
  bAvail: number[];
  flatShift: boolean;
};

export type PesElectricData = {
  capJ: number;
  V: number;
  R: number;
  soc0: number;
  tg: number;
  lo: number;
  hi: number;
  dn: number;
  up: number;
  kLo: number;
  lps: number;
  lpsBand: number;
  mrpm: number[];
  tmax: number[];
  loss: number[];
  crpm: number[];
  mot: number[];
  regen: number[];
  ocv?: number[];
  vMin?: number;
  iMax?: number;
  share?: number;
  pRef?: number;
  ml?: number[];
  full?: number[];
  stop?: {
    share: number;
    kw: number;
    kmh: number;
    plug: boolean;
    dwell: number;
  };
  front: {
    F: number[];
    loss: number[];
    eff: number;
    share: number;
  } | null;
};

export type PesCoupling = {
  type: 'open' | 'fric' | 'visc' | 'spool' | 'lock';
  pre?: number;
  L?: number;
  c?: number;
  f?: number;
};

/** Exact JSON shape returned by Engine_simulator's driveCar() */
export type PesCarData = {
  name: string;
  aids: PesAids;
  esp: boolean;
  Kus: number;
  CaF: number;
  CaR: number;
  rsF: number;
  rsR: number;
  csF: number;
  csR: number;
  pkF: number;
  turbo: PesTurboData | null;
  el: PesElectricData | null;
  m: number;
  Izz: number;
  a: number;
  b: number;
  h: number;
  tF: number;
  tR: number;
  r: number;
  Iw: number;
  mu: number;
  muF: number;
  FzRef: number;
  FzRefF: number;
  loadSens: number;
  muX: number;
  cc: number;
  ccP2: number;
  slipOpt: number;
  slipC: number;
  relax: number;
  cdA: number;
  clA: number;
  aeroBal: number;
  crr: number;
  lltdF: number;
  tauLoad: number;
  rollI: number;
  rollArm: number;
  rollK: number;
  rollKF: number;
  KaF: number;
  KaR: number;
  rcGF: number;
  rcGR: number;
  ksF: number;
  ksR: number;
  cdF: number;
  cdR: number;
  bumpF: number;
  bumpR: number;
  droopF: number;
  droopR: number;
  svF: [number, number];
  svR: [number, number];
  liveF: boolean;
  liveR: boolean;
  inbF: boolean;
  inbR: boolean;
  unsF: number;
  unsR: number;
  mS: number;
  pitchI: number;
  pitchK: number;
  rollFull: number;
  rrAyF: number;
  rrAyR: number;
  indF: boolean;
  indR: boolean;
  drive: 'fwd' | 'rwd' | 'awd';
  centre: PesCoupling | null;
  diff: PesCoupling;
  ratios: number[];
  fd: number;
  eff: number;
  shiftTime: number;
  ev: boolean;
  tc: boolean;
  abs: boolean;
  rpm: number[];
  tq: number[];
  ov: number[];
  idle: number;
  redline: number;
  Ie: number;
  clutchCap: number;
  fireRpm: number;
  fireTurns: number;
  starterT0: number;
  starterFree: number;
  launchRpm: number;
  brakeF: number;
  brakeFront: number;
  hbCap: number;
  steerLock: number;
  steerRatio: number;
  ktF: number;
  ktR: number;
  casterTrail: number;
  scrub: number;
  camF: number;
  camR: number;
  recF: number;
  recR: number;
};

export type PesRoadSample = {
  sinT?: number;
  kv?: number;
  z?: [number, number, number, number];
  grip?: [number, number, number, number];
  surfaceTag?: 'asphalt' | 'dirt' | 'grass' | 'water' | 'bridge';
};

export type PesStepInput = {
  /** Left positive (-1..1), SAE convention */
  steer?: number;
  throttle?: number;
  brake?: number;
  handbrake?: number;
  clutch?: number | null;
  gear?: number | null;
  starter?: boolean;
  road?: PesRoadSample;
};

export type PesCarState = {
  soc: number;
  eng: boolean;
  engT: number;
  Pm: number;
  shE: number;
  boost: number;
  t: number;
  x: number;
  y: number;
  psi: number;
  vx: number;
  vy: number;
  yaw: number;
  w: [number, number, number, number];
  we: number;
  gear: number;
  shiftT: number;
  axF: number;
  ayF: number;
  roll: number;
  rollV: number;
  pitch: number;
  pitchV: number;
  zu: [number, number, number, number];
  zuV: [number, number, number, number];
  heave: number;
  heaveV: number;
  rr: [number, number];
  al: [number, number, number, number];
  abs: [number, number, number, number];
  tcF: number;
  esp: [number, number, number, number];
  yawRef: number;
  espOver: boolean;
  espF: number;
  clF: number;
  pull: boolean;
  firing: boolean;
  turns?: number;
  ax: number;
  ay: number;
  Fz: [number, number, number, number];
  kappa: [number, number, number, number];
  alpha: [number, number, number, number];
  Fx: [number, number, number, number];
  Fy: [number, number, number, number];
  camber: [number, number, number, number];
  cg: [number, number, number, number];
  toe: [number, number, number, number];
  Fyw: [number, number, number, number];
  rpm: number;
  speed: number;
  delta: number;
  steerTorque: number;
  handTorque: number;
};

/** PixiJS Y-up view state projected from PesCarState */
export type VehicleViewState = {
  /** World X (m) */
  x: number;
  /** World Y heave (m) */
  y: number;
  /** World Z (m) = -pes.y */
  z: number;
  /** Yaw around +Y (rad) */
  yaw: number;
  roll: number;
  pitch: number;
  speedMs: number;
  vx: number;
  vy: number;
  rpm: number;
  redline: number;
  gear: number;
  reversing: boolean;
  boostBar: number;
  engineTorqueNm: number;
  /** Front wheel steer angle (rad) */
  frontSteerRad: number;
  /** Wheel angular speeds (rad/s) [FL, FR, RL, RR] */
  wheelOmega: [number, number, number, number];
  /** Wheel vertical displacements (m) [FL, FR, RL, RR] */
  wheelZu: [number, number, number, number];
  /** Normalized combined tyre slip [FL, FR, RL, RR] (1.0 = peak saturation, >1 sliding) */
  wheelSlip: [number, number, number, number];
  surface: 'asphalt' | 'dirt' | 'grass' | 'water' | 'bridge';
  tcActive: boolean;
  absActive: boolean;
  espActive: boolean;
};

export type ExportedPreset = {
  id: string;
  shortName: string;
  fullName: string;
  color: number;
  published: {
    powerHp?: number;
    zeroTo100?: number;
    topKmh?: number;
  } | null;
  benchmarks: {
    sprint0to100s: number | null;
    sprintPeakSlip: number;
    stop100to0m: number;
    stopLocked: boolean;
  };
  car: PesCarData;
};
