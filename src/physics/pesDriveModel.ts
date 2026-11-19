/**
 * Verbatim TypeScript port of Engine_simulator/src/js/drive-model.js
 * (the runtime half: driveState, driveLaunch, driveRolling, stepCar,
 * driveSprint, driveStop100, driveDriver, DRIVE_SURFACE).
 *
 * Physics constants and equations are kept bit-for-bit identical to
 * Engine_simulator build 384 — derive, do not fit. Verified in
 * src/physics/pesDriveModel.test.ts against Engine_simulator benchmarks.
 */
import type { PesCarData, PesCarState, PesElectricData, PesStepInput, PesTurboData } from './types';

export const DRIVE_G = 9.81;
export const DRIVE_RHO = 1.20;
export const DRIVE_BUMP_RUBBER = 0.025;
export const DAMPER_RB = 3;
export const DRIVE_ASSIST = { T0: 1, K0: 8, Kv: 1.5, vK: 15, Amax: 60, Tf: 1.5 } as const;

/** Surface grip ratios vs dry asphalt (Noon 1994; Cenek NZ — cited in drive-model.js) */
export const DRIVE_SURFACE = {
  asphalt: 1,
  wet: 0.50 / 0.65,
  gravel: 0.35 / 0.65,
  grass: 0.37 / 0.65,
  grassWet: 0.22 / 0.65,
} as const;

function driveHandTorque(L: number, v: number, rate: number): number {
  const A = DRIVE_ASSIST;
  const K = A.Kv + (A.K0 - A.Kv) * Math.exp(-v / A.vK);
  const aL = Math.abs(L);
  let th = aL <= A.T0 ? aL : (aL + K * A.T0) / (1 + K);
  if (aL - th > A.Amax) th = aL - A.Amax;
  th *= Math.sign(L);
  if (Math.abs(rate) > 1e-4) return th + A.Tf * Math.sign(rate);
  return Math.sign(th) * Math.max(0, Math.abs(th) - A.Tf);
}

export function driveState(car: PesCarData): PesCarState {
  return {
    soc: car.el ? car.el.soc0 : 0,
    eng: true,
    engT: 0,
    Pm: 0,
    shE: 0,
    boost: 0,
    t: 0,
    x: 0,
    y: 0,
    psi: 0,
    vx: 0,
    vy: 0,
    yaw: 0,
    w: [0, 0, 0, 0],
    we: (car.idle * Math.PI) / 30,
    gear: 1,
    shiftT: 0,
    axF: 0,
    ayF: 0,
    roll: 0,
    rollV: 0,
    pitch: 0,
    pitchV: 0,
    zu: [0, 0, 0, 0],
    zuV: [0, 0, 0, 0],
    heave: 0,
    heaveV: 0,
    rr: [0, 0],
    al: [0, 0, 0, 0],
    abs: [1, 1, 1, 1],
    tcF: 1,
    esp: [0, 0, 0, 0],
    yawRef: 0,
    espOver: false,
    espF: 1,
    clF: 1,
    pull: false,
    firing: true,
    ax: 0,
    ay: 0,
    Fz: [0, 0, 0, 0],
    kappa: [0, 0, 0, 0],
    alpha: [0, 0, 0, 0],
    Fx: [0, 0, 0, 0],
    Fy: [0, 0, 0, 0],
    camber: [0, 0, 0, 0],
    cg: [0, 0, 0, 0],
    toe: [0, 0, 0, 0],
    Fyw: [0, 0, 0, 0],
    rpm: car.idle,
    speed: 0,
    delta: 0,
    steerTorque: 0,
    handTorque: 0,
  };
}

export function driveAt(xs: number[], x: number): [number, number] {
  const n = xs.length;
  if (x <= xs[0]) return [0, 0];
  if (x >= xs[n - 1]) return [n - 2, 1];
  let i = 1;
  while (xs[i] < x) i++;
  return [i - 1, (x - xs[i - 1]) / (xs[i] - xs[i - 1])];
}

export function driveLerp(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1;
  while (xs[i] < x) i++;
  return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
}

function driveShares(el: PesElectricData, soc: number): [number, number] {
  return [
    soc >= el.lo + el.dn ? 1 : soc > el.lo ? el.kLo + ((1 - el.kLo) * (soc - el.lo)) / el.dn : 0,
    el.up > 0 ? Math.max(0, Math.min(1, (el.hi - soc) / el.up)) : soc < el.hi ? 1 : 0,
  ];
}

function drivePackMax(el: PesElectricData, soc: number): number {
  const ocv = el.ocv!;
  const x = Math.max(0, Math.min(1, soc)) * 10;
  const i = Math.min(9, Math.floor(x));
  const V0 = ocv[i] + (ocv[i + 1] - ocv[i]) * (x - i);
  const I = Math.min(el.iMax!, (V0 - el.vMin!) / el.R);
  return Math.max(0, (V0 - I * el.R) * I);
}

function drivePack(el: PesElectricData, soc: number, Pm: number, loss: number, share: number): number {
  if (!el.ocv || !(Pm > 1)) return 1;
  const Pmax = drivePackMax(el, soc);
  return Math.max(0, Math.min(1, el.pRef ? Pmax / el.pRef : (Pmax * share - loss) / Pm));
}

const driveHelp = (el: PesElectricData, soc: number, rpm: number, mot: number): number =>
  el.ocv
    ? drivePack(el, soc, (mot * rpm * Math.PI) / 30, el.ml ? driveLerp(el.crpm, el.ml, rpm) : 0, el.share ?? 1)
    : 1;

function driveMotorLoss(el: PesElectricData, rpm: number, Tm: number): number {
  const NT = el.loss.length / el.mrpm.length;
  const [i, fi] = driveAt(el.mrpm, rpm);
  const tmx = el.tmax[i] + (el.tmax[i + 1] - el.tmax[i]) * fi;
  const x = Math.min(1, Math.abs(Tm) / Math.max(1e-6, tmx)) * (NT - 1);
  const j = Math.min(NT - 2, Math.floor(x));
  const fj = x - j;
  const at = (a: number, b: number) => el.loss[a * NT + b];
  return (rpm * Math.PI) / 30 > 1 || Tm !== 0
    ? (at(i, j) * (1 - fi) + at(i + 1, j) * fi) * (1 - fj) +
        (at(i, j + 1) * (1 - fi) + at(i + 1, j + 1) * fi) * fj
    : 0;
}

export function driveEngine(
  car: PesCarData,
  thr: number,
  rpm: number,
  boost?: number | null,
  soc?: number | null,
): number {
  let wot: number;
  if (car.turbo && boost != null) {
    const tb = car.turbo;
    const [i, fi] = driveAt(tb.rpm, rpm);
    const [j, fj] = driveAt(
      tb.boosts,
      Math.min(boost, tb.bAvail[i] + (tb.bAvail[i + 1] - tb.bAvail[i]) * fi),
    );
    const a = tb.tq[j][i] + (tb.tq[j][i + 1] - tb.tq[j][i]) * fi;
    const c = tb.tq[j + 1][i] + (tb.tq[j + 1][i + 1] - tb.tq[j + 1][i]) * fi;
    wot = a + (c - a) * fj;
  } else {
    wot = driveLerp(car.rpm, car.tq, rpm);
  }
  let ov =
    car.ev && !car.el
      ? 0
      : car.ov[Math.max(0, Math.min(car.ov.length - 1, Math.round((rpm - 500) / 250)))] || 0;
  if (car.el) {
    const el = car.el;
    const [k, r] = soc == null ? [1, 1] : driveShares(el, soc);
    const reg = el.regen[Math.max(0, Math.min(el.regen.length - 1, Math.round((rpm - 500) / 250)))] || 0;
    const mot = driveLerp(el.crpm, el.mot, rpm);
    wot -= (1 - k * (soc == null ? 1 : driveHelp(el, soc, rpm, mot))) * mot;
    ov = Math.max(0, ov - reg) + r * reg * Math.min(1, rpm / 500);
  }
  if (rpm >= car.redline) return -ov;
  let T = thr * wot - (1 - thr) * ov;
  if (!car.ev && rpm < car.idle) T += Math.min(0.4 * wot + ov, (car.idle - rpm) * 0.5);
  return T;
}

const driveAsk = (car: PesCarData, thr: number, rpm: number, soc: number) =>
  driveEngine(car, thr, Math.max(rpm, car.idle), null, soc);

function driveMotorOnly(car: PesCarData, thr: number, rpm: number, soc: number): number {
  const el = car.el!;
  const [k, r] = driveShares(el, soc);
  const full = driveLerp(el.crpm, el.full!, rpm);
  const cut = drivePack(el, soc, (full * rpm * Math.PI) / 30, driveMotorLoss(el, rpm, full), el.share ?? 1);
  const reg = el.regen[Math.max(0, Math.min(el.regen.length - 1, Math.round((rpm - 500) / 250)))] || 0;
  return Math.max(-r * reg * Math.min(1, rpm / 500), Math.min(k * cut * full, driveAsk(car, thr, rpm, soc)));
}

function driveStartStop(
  car: PesCarData,
  s: PesCarState,
  pedal: number,
  rpm: number,
  v: number,
  h: number,
): void {
  const el = car.el!;
  const E = el.stop!;
  const on = s.eng;
  const ns = Math.max(rpm, 1000);
  const mot = (driveLerp(el.crpm, el.full!, ns) * ns * Math.PI) / 30;
  const Pmax = drivePackMax(el, s.soc) * (el.share ?? 1);
  const deplete = E.plug && s.soc > el.tg + 0.02;
  const Pev = deplete ? Math.min(Pmax, mot) : E.kw > 0 ? E.kw : E.share * Math.min(Pmax, mot);
  const Pd = (Math.max(0, driveAsk(car, pedal, rpm, s.soc)) * Math.max(rpm, car.idle) * Math.PI) / 30;
  const want =
    (pedal > 0.01 &&
      (Pd > (on ? (deplete ? 0.9 : 0.7) : 1) * Pev ||
        s.soc < el.tg - 0.1 ||
        (E.kmh > 0 && v * 3.6 > E.kmh))) ||
    s.soc < el.lo;
  const next = want === on || s.soc < el.lo || s.engT >= E.dwell ? want : on;
  if (next !== on) {
    s.engT = 0;
    s.eng = next;
    if (next) {
      s.firing = true;
      s.we = Math.max(s.we, (car.idle * Math.PI) / 30);
    }
  } else {
    s.engT += h;
  }
}

function driveCharge(
  car: PesCarData,
  s: PesCarState,
  thr: number,
  rpm: number,
  Ff: number,
  vf: number,
  h: number,
  Toff?: number,
): void {
  const el = car.el!;
  const w = (Math.max(0, rpm) * Math.PI) / 30;
  const [k, r] = driveShares(el, s.soc);
  const motF = driveLerp(el.crpm, el.mot, rpm);
  const wotE = Math.max(0, driveEngine(car, 1, rpm, s.boost) - motF);
  const T = driveEngine(car, thr, rpm, s.boost, s.soc);
  const ix = Math.max(0, Math.min(el.regen.length - 1, Math.round((rpm - 500) / 250)));
  const regF = el.regen[ix] || 0;
  const reg = r * regF * Math.min(1, rpm / 500);
  const ovE = car.ev ? 0 : Math.max(0, (car.ov[ix] || 0) - regF);
  let Te = Math.max(-ovE, Math.min(wotE, T));
  if (el.lps && wotE > 0 && thr > 0 && w > 1) {
    Te = Math.max(
      0,
      Math.min(wotE, Te + (Math.max(-1, Math.min(1, (el.tg - s.soc) / el.lpsBand)) * el.lps) / w),
    );
  }
  const Tm =
    Toff != null
      ? Toff
      : Math.max(-reg, Math.min(k * driveHelp(el, s.soc, rpm, motF) * motF, T - Te));
  const NT = el.loss.length / el.mrpm.length;
  const ls = driveMotorLoss(el, rpm, Tm);
  let Pm = Tm * w;
  let P = Pm + ls;
  if (el.front && Ff > 0) {
    const q = Math.max(0, vf) / 0.5;
    const a = Math.min(el.front.F.length - 2, Math.floor(q));
    const full = el.front.F[a] + (el.front.F[a + 1] - el.front.F[a]) * (q - a);
    const fx = full > 0 ? Math.min(1, Ff / full) * (NT - 1) : 0;
    const fj2 = Math.min(NT - 2, Math.floor(fx));
    const lf = (b: number, d: number) => el.front!.loss[b * NT + d];
    const ln = (d: number) => lf(a, d) + (lf(a + 1, d) - lf(a, d)) * (q - a);
    Pm += Ff * vf;
    P += (Ff * vf) / el.front.eff + ln(fj2) + (ln(fj2 + 1) - ln(fj2)) * (fx - fj2);
  }
  const I = P / el.V;
  s.soc = Math.max(0, Math.min(1, s.soc - ((P + I * I * el.R) * h) / el.capJ));
  s.Pm = Pm;
}

export function driveShaft(tb: PesTurboData, s: PesCarState, rpm: number, thr: number, h: number): void {
  const th = Math.max(0.08, Math.min(1, thr));
  const Emax = 0.5 * tb.J * Math.pow((tb.nMax * Math.PI) / 30, 2);
  const n = (Math.sqrt((2 * s.shE) / tb.J) * 30) / Math.PI;
  const [i, fi] = driveAt(tb.rp, rpm);
  const [j, fj] = driveAt(tb.n, n);
  const [k, fk] = driveAt(tb.th, th);
  const NN = tb.n.length;
  const NT = tb.th.length;
  const at = (A: number[], a: number, b: number, c: number) => A[(a * NN + b) * NT + c];
  const tri = (A: number[]) => {
    let v = 0;
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        for (let c = 0; c < 2; c++) {
          v += (a ? fi : 1 - fi) * (b ? fj : 1 - fj) * (c ? fk : 1 - fk) * at(A, i + a, j + b, k + c);
        }
      }
    }
    return v;
  };
  const bSh = tri(tb.bS);
  const Tc = tb.Tch[i] + (tb.Tch[i + 1] - tb.Tch[i]) * fi;
  const air = tb.air[i] + (tb.air[i + 1] - tb.air[i]) * fi;
  const b = s.boost;
  const b2 =
    bSh >= b
      ? bSh
      : bSh + (b - bSh) * Math.exp((-h * air * th * 287 * Tc) / Math.max(1e-9, tb.V * 1e5));
  const pr = 1 + 0.5 * (b + b2);
  const fill =
    ((((tb.V * Math.max(0, b2 - b) * 1e5) / (287 * Tc)) *
      1005 *
      tb.T01 *
      (Math.pow(pr, 0.286) - 1)) /
      tri(tb.eta)) /
    tb.u[fi < 0.5 ? i : i + 1];
  s.shE = Math.max(0, Math.min(Emax, s.shE + tri(tb.P) * h - fill));
  s.boost = b2;
}

export function driveLaunch(car: PesCarData): PesCarState {
  const s = driveState(car);
  if (car.ev) return s;
  s.we = (car.launchRpm * Math.PI) / 30;
  s.rpm = car.launchRpm;
  if (car.turbo) {
    for (let i = 0; i < 1200; i++) driveShaft(car.turbo, s, car.launchRpm, 1, 0.001);
  }
  return s;
}

export function drivePatch(r: number, kt: number, Fz: number): number {
  if (!(kt > 0)) return 0;
  const d = Math.min(r, Math.max(0, Fz) / kt);
  return Math.sqrt(Math.max(0, 2 * r * d - d * d));
}

export function driveTyre(
  car: PesCarData,
  Fz: number,
  kappa: number,
  alpha: number,
  front: boolean,
  tg?: number,
  gq?: number,
): [number, number, number, number] {
  if (!(Fz > 1)) return [0, 0, 0, 0];
  const ref = front ? car.FzRefF : car.FzRef;
  const muY =
    (gq == null ? 1 : gq) *
    (front ? car.muF : car.mu) *
    Math.pow(Math.max(200, Fz) / ref, -car.loadSens);
  const muX = car.muX * muY;
  const xz = Fz / ref;
  const Ca = (car.cc * Fz * (car.ccP2 + 1)) / (car.ccP2 + xz * xz);
  const Ck = (3 * muX * Fz) / car.slipOpt;
  const ty = Math.tan(alpha) + (tg || 0);
  const sx = (Ck * kappa) / (3 * muX * Fz);
  const sy = (Ca * ty) / (3 * muY * Fz);
  const s = Math.hypot(sx, sy);
  if (s < 1e-9) return [0, 0, 0, Ck];
  let f: number;
  if (s <= 1) {
    f = 3 * s - 3 * s * s + s * s * s;
  } else {
    const B = Math.tan(Math.PI / (2 * car.slipC)) / car.slipOpt;
    f = Math.sin(car.slipC * Math.atan(B * car.slipOpt * Math.min(s, 30)));
  }
  return [
    (muX * Fz * f * sx) / s,
    (muY * Fz * f * sy) / s,
    s,
    Ck * Math.max(0.02, s < 1 ? (1 - s) * (1 - s) : 0.02),
  ];
}

export function driveRolling(car: PesCarData, vk: number): PesCarState {
  const v = vk / 3.6;
  const s = driveState(car);
  s.vx = v;
  s.w = [v / car.r, v / car.r, v / car.r, v / car.r];
  for (let g = car.ratios.length; g >= 1; g--) {
    s.gear = g;
    if ((((v / car.r) * car.ratios[g - 1] * car.fd * 30) / Math.PI) >= 2000) break;
  }
  s.we = (v / car.r) * car.ratios[s.gear - 1] * car.fd;
  return s;
}

export function driveStop100(car: PesCarData): { dist: number; lock: boolean } {
  const s = driveRolling(car, 100);
  let lock = false;
  while (s.vx > 0.3 && s.t < 15) {
    stepCar(car, s, { steer: 0, throttle: 0, brake: 1 }, 0.005);
    if (s.vx > 3 && s.w.some((w) => w * car.r < 0.2 * s.vx)) lock = true;
  }
  return { dist: s.x, lock };
}

export function driveSprint(car: PesCarData): { t: number | null; slip: number } {
  const s = driveLaunch(car);
  let slip = 0;
  while (s.vx < 100 / 3.6 && s.t < 30) {
    stepCar(car, s, { steer: 0, throttle: 1, brake: 0 }, 0.005);
    for (let i = 0; i < 4; i++) slip = Math.max(slip, s.kappa[i]);
  }
  return { t: s.vx >= 100 / 3.6 ? s.t : null, slip };
}

/**
 * Step car state s forward by dt seconds at 1 kHz internal substeps.
 * Bit-for-bit faithful to Engine_simulator/src/js/drive-model.js stepCar().
 */
export function stepCar(car: PesCarData, s: PesCarState, u: PesStepInput, dt: number): PesCarState {
  const H = 0.001;
  const n = Math.max(1, Math.ceil(dt / H));
  const h = dt / n;
  const g = DRIVE_G;
  const L = car.a + car.b;
  const xw = [car.a, car.a, -car.b, -car.b];
  const yw = [car.tF / 2, -car.tF / 2, car.tR / 2, -car.tR / 2];
  const drv =
    car.drive === 'awd' ? [1, 1, 1, 1] : car.drive === 'fwd' ? [1, 1, 0, 0] : [0, 0, 1, 1];
  const nd = drv[0] + drv[1] + drv[2] + drv[3];
  const CD = nd === 4 && car.centre && car.centre.type !== 'lock' ? car.centre : null;
  const fSplit = CD?.f ?? 0.5;
  const sg = CD ? [fSplit / 2, fSplit / 2, (1 - fSplit) / 2, (1 - fSplit) / 2] : null;
  const wMean = () => {
    let a = 0;
    if (sg) {
      for (let i = 0; i < 4; i++) a += sg[i] * s.w[i];
      return a;
    }
    for (let i = 0; i < 4; i++) if (drv[i]) a += s.w[i];
    return a / nd;
  };
  const steer = Math.max(-1, Math.min(1, u.steer || 0));
  const brake = Math.max(0, Math.min(1, u.brake || 0));
  const hb = Math.max(0, Math.min(1, u.handbrake || 0));
  let thr = Math.max(0, Math.min(1, u.throttle || 0));
  const rd = u.road || {};
  const sinT = rd.sinT || 0;
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const kv = rd.kv || 0;
  const zr = rd.z;
  const gr = rd.grip;
  const W0F = (car.m * g * car.b) / L / 2;
  const W0R = (car.m * g * car.a) / L / 2;
  const sRate = (steer * car.steerLock - (s.delta || 0)) / dt;

  for (let k = 0; k < n; k++) {
    const v = Math.hypot(s.vx, s.vy);
    const delta = steer * car.steerLock;
    const top = car.ratios.length;

    if (s.shiftT > 0) {
      s.shiftT -= h;
      if (s.shiftT <= 0 && u.clutch == null && !car.ev && s.gear > 0) {
        s.we = Math.max((car.idle * Math.PI) / 30, wMean() * car.ratios[s.gear - 1] * car.fd);
      }
    }
    if (u.gear != null) {
      const gq = Math.max(0, Math.min(top, u.gear | 0));
      if (gq !== s.gear) {
        s.gear = gq;
        s.shiftT = car.shiftTime;
      }
    } else if (!car.ev && s.shiftT <= 0 && s.gear > 0) {
      const rpmNow = (wMean() * car.ratios[s.gear - 1] * car.fd * 30) / Math.PI;
      if (rpmNow > 0.97 * car.redline && s.gear < top) {
        s.gear++;
        s.shiftT = car.shiftTime;
      } else if (
        s.gear > 1 &&
        rpmNow < 0.42 * car.redline &&
        (rpmNow * car.ratios[s.gear - 2]) / car.ratios[s.gear - 1] < 0.85 * car.redline &&
        thr < 0.99
      ) {
        s.gear--;
        s.shiftT = car.shiftTime;
      } else if (s.gear > 1 && rpmNow < Math.max(car.idle * 1.15, 0.22 * car.redline)) {
        s.gear--;
        s.shiftT = car.shiftTime;
      }
    }
    const ratio = s.gear > 0 ? car.ratios[Math.min(top, s.gear) - 1] * car.fd : 0;

    const gz = Math.max(0, g * cosT + s.vx * s.vx * kv);
    const down = 0.5 * DRIVE_RHO * car.clA * v * v;
    const Fz = s.Fz;
    for (let i = 0; i < 4; i++) {
      Fz[i] = Math.max(
        0,
        (i < 2 ? W0F : W0R) + (i < 2 ? car.ktF : car.ktR) * ((zr ? zr[i] || 0 : 0) - s.zu[i]),
      );
    }

    let FX = 0;
    let FY = 0;
    let MZ = 0;
    let MK = 0;
    const dF = [0, 0, 0, 0];
    const Fl = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const vxw = s.vx - s.yaw * yw[i];
      const vyw = s.vy + s.yaw * xw[i];
      const q0 = front ? 0 : 2;
      const ind = front ? car.indF !== false : car.indR !== false;
      const sd = i % 2 ? 1 : -1;
      const tw = front ? car.tF : car.tR;
      const cm = ind ? (s.zu[q0] + s.zu[q0 + 1]) / 2 - s.heave - s.pitch * xw[i] : 0;
      const tq =
        car.rsF == null
          ? 0
          : front
            ? -car.rsF * (s.rr[0] + (sd * 2 * cm) / tw) - car.csF * s.Fyw[i]
            : car.rsR * (s.rr[1] + (sd * 2 * cm) / tw) + car.csR * s.Fyw[i];
      s.toe[i] = tq;
      const dw = (front ? delta : 0) + tq;
      const cw = Math.cos(dw);
      const sw = Math.sin(dw);
      const vl = vxw * cw + vyw * sw;
      const vt = -vxw * sw + vyw * cw;
      const den = Math.max(Math.abs(vl), 3);
      const kap = (s.w[i] * car.r - vl) / den;
      const alp = -Math.atan2(vt, Math.max(Math.abs(vl), 0.5));
      s.al[i] += (alp - s.al[i]) * Math.min(1, (Math.abs(vl) * h) / car.relax);
      const ah = drivePatch(car.r, front ? car.ktF : car.ktR, Fz[i]);
      let tg = 0;
      if (car.camF != null) {
        const gam =
          (i % 2 ? -1 : 1) * (front ? car.camF : car.camR) -
          s.roll +
          (front ? car.recF : car.recR) * ((front ? s.rr[0] : s.rr[1]) + (sd * 2 * cm) / tw);
        s.camber[i] = gam;
        s.cg[i] +=
          ((ah / (3 * car.r)) * Math.sin(gam) - s.cg[i]) *
          Math.min(1, (Math.abs(vl) * h) / car.relax);
        tg = s.cg[i];
      }
      const T = driveTyre(car, Fz[i], kap, s.al[i], front, tg, gr ? gr[i] : 1);
      Fl[i] = T[0];
      dF[i] = (T[3] * car.r) / den;
      s.kappa[i] = kap;
      s.alpha[i] = s.al[i];
      s.Fyw[i] = T[1];
      const fx = T[0] * cw - T[1] * sw;
      const fy = T[0] * sw + T[1] * cw;
      s.Fx[i] = fx;
      s.Fy[i] = fy;
      FX += fx;
      FY += fy;
      MZ += xw[i] * fy - yw[i] * fx;
      if (front && car.ktF) {
        const q = T[2];
        MK +=
          -T[1] * ((q < 1 ? (ah * (1 - q) * (1 - q) * (1 - q)) / (3 - 3 * q + q * q) : 0) + car.casterTrail) +
          sd * T[0] * car.scrub;
      }
    }
    s.steerTorque = MK / car.steerRatio;
    s.handTorque = driveHandTorque(-s.steerTorque, v, sRate);

    const wd = wMean();
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      if (drv[i] || (i < 2 && car.el && car.el.front)) worst = Math.max(worst, s.kappa[i]);
    }
    const hold = Math.max(-30, Math.min(8, 12 * (1 - worst / car.slipOpt)));
    const A = car.aids;
    const holdTc = Math.max(-30, Math.min(8, A.tcGain * (1 - worst / (car.slipOpt * A.tcSlip))));
    const pulling =
      !car.ev &&
      u.clutch == null &&
      s.gear === 1 &&
      s.shiftT <= 0 &&
      s.we - wd * car.ratios[0] * car.fd > 1;
    if (car.tc && !pulling) {
      s.tcF = Math.max(0.05, Math.min(1, s.tcF + holdTc * h));
      thr *= s.tcF;
    } else {
      s.tcF = 1;
    }

    const eT = s.esp;
    eT[0] = eT[1] = eT[2] = eT[3] = 0;
    if (car.esp) {
      let M = 0;
      if (s.vx > A.espVmin) {
        const lim = Math.max(car.mu * gz, Math.abs(s.ayF)) / s.vx;
        const ref = Math.max(
          -lim,
          Math.min(lim, (s.vx * delta) / (L * Math.max(0.1, 1 + car.Kus * s.vx * s.vx))),
        );
        const sgSign = Math.sign(ref);
        const ex = (ref - s.yaw) * sgSign - A.espBand;
        if (ex > 0 && Math.abs(s.alpha[0] + s.alpha[1]) / 2 > car.pkF) {
          M += (sgSign * car.Izz * ex) / A.espTau;
        }
        const vxNow = s.vx;
        const Cf = car.CaF;
        const Cr = car.CaR;
        const B = car.m * (car.a * car.a * Cf + car.b * car.b * Cr) + car.Izz * (Cf + Cr);
        const C = ((Cf * Cr * L * L) / vxNow) * Math.max(0.1, 1 + car.Kus * vxNow * vxNow);
        const tau = Math.max(h, B / C - (car.m * vxNow * car.a) / (Cr * L));
        s.yawRef += (ref - s.yawRef) * Math.min(1, h / tau);
        const sy = Math.sign(s.yaw);
        const ox = (s.yaw - s.yawRef) * sy - A.espBand;
        s.espOver = ox > 0 && Math.abs(s.alpha[2] + s.alpha[3]) / 2 > A.espBeta;
        if (s.espOver) M -= (sy * car.Izz * ox) / A.espTau;
      } else {
        s.yawRef = s.yaw;
        s.espOver = false;
      }
      if (M !== 0) {
        const fr = M * s.yaw < 0;
        const q = (fr ? 0 : 2) + (M > 0 ? 0 : 1);
        eT[q] = (Math.abs(M) / ((fr ? car.tF : car.tR) / 2)) * car.r;
      }
      s.espF = Math.max(0, Math.min(1, s.espF + ((M !== 0 ? -1 : 1) * h) / A.espTau));
      if (A.espCut) thr *= s.espF;
    } else {
      s.espF = 1;
    }

    const p2 = car.el && car.el.stop && !car.ev;
    if (p2) {
      driveStartStop(
        car,
        s,
        Math.max(0, Math.min(1, u.throttle || 0)),
        (Math.max(0, wd) * ratio * 30) / Math.PI,
        v,
        h,
      );
    }
    const rpm = (s.we * 30) / Math.PI;
    if (!car.ev && s.eng) {
      if (s.firing && rpm < 0.8 * car.fireRpm) {
        s.firing = false;
      } else if (!s.firing) {
        s.turns = rpm >= car.fireRpm ? (s.turns || 0) + (rpm / 60) * h : 0;
        if (s.turns >= car.fireTurns) {
          s.firing = true;
          s.turns = 0;
        }
      }
    }
    if (car.turbo) {
      driveShaft(
        car.turbo,
        s,
        rpm,
        !s.firing || !s.eng ? 0 : s.shiftT > 0 && !car.turbo.flatShift ? Math.min(thr, 0.35) : thr,
        h,
      );
    }
    let Te =
      s.firing || car.ev
        ? driveEngine(car, s.shiftT > 0 ? 0 : thr, rpm, s.boost, s.soc)
        : -(car.ov[0] || 0) * Math.tanh(s.we / 5) +
          (u.starter ? car.starterT0 * Math.max(0, 1 - rpm / car.starterFree) : 0);
    let Tw = 0;
    let Ff = 0;
    let vf = 0;
    if (car.el && car.el.front) {
      const F = car.el.front.F;
      vf = Math.max(0, ((s.w[0] + s.w[1]) / 2) * car.r);
      const q = vf / 0.5;
      const a = Math.min(F.length - 2, Math.floor(q));
      const full = F[a] + (F[a + 1] - F[a]) * (q - a);
      const E = car.el.front;
      const NT = E.loss.length / F.length;
      Ff =
        thr *
        driveShares(car.el, s.soc)[0] *
        drivePack(car.el, s.soc, (full * vf) / E.eff, E.loss[a * NT + NT - 1], E.share) *
        full;
    }
    if (car.ev) {
      const rm = (Math.max(0, wd) * ratio * 30) / Math.PI;
      Tw = driveEngine(car, thr, rm, null, s.soc) * ratio * car.eff;
      s.we = Math.abs(wd) * ratio;
      if (car.el) driveCharge(car, s, thr, rm, Ff, vf, h);
    } else if (!s.eng) {
      const rm = (Math.max(0, wd) * ratio * 30) / Math.PI;
      const T = ratio === 0 || s.shiftT > 0 ? 0 : driveMotorOnly(car, thr, rm, s.soc);
      s.we = Math.abs(wd) * ratio;
      s.clF = 1;
      s.pull = false;
      Tw = T * ratio * car.eff;
      driveCharge(car, s, thr, rm, Ff, vf, h, T);
    } else {
      const auto = u.clutch == null;
      const slip = s.we - wd * ratio;
      const pedal = Math.max(0, Math.min(1, u.throttle || 0));
      let cap =
        ratio === 0 || s.shiftT > 0
          ? 0
          : car.clutchCap * (auto ? 1 : 1 - Math.max(0, Math.min(1, u.clutch!)));
      if (auto && cap > 0 && slip > 1 && (s.gear === 1 || wd * ratio < (car.idle * Math.PI) / 30)) {
        const wT = ((car.idle + (s.gear === 1 ? pedal * (car.launchRpm - car.idle) : 0)) * Math.PI) / 30;
        const avail = Math.max(0, driveEngine(car, thr, rpm, s.boost, s.soc));
        if (!s.pull) {
          s.pull = true;
          s.clF = 0.1;
        }
        s.clF = Math.max(0.05, Math.min(1, s.clF + hold * h));
        cap *= s.clF;
        if (s.we < wT) cap = Math.min(cap, Math.max(0, avail - 4 * (wT - s.we)));
        else Te = Math.min(Te, cap + 4 * (wT - s.we));
      } else {
        s.clF = 1;
        s.pull = false;
      }
      let Id = 0;
      let aW = 0;
      for (let i = 0; i < 4; i++) {
        if (drv[i]) {
          const Iq = car.Iw + h * car.r * dF[i];
          Id += Iq;
          aW -= (Fl[i] * car.r + car.crr * Fz[i] * car.r * Math.tanh((s.w[i] * car.r) / 0.5)) / Iq;
        }
      }
      aW /= nd;
      if (sg) {
        aW = 0;
        let iI = 0;
        for (let i = 0; i < 4; i++) {
          const Iq = car.Iw + h * car.r * dF[i];
          aW -=
            (sg[i] * (Fl[i] * car.r + car.crr * Fz[i] * car.r * Math.tanh((s.w[i] * car.r) / 0.5))) /
            Iq;
          iI += (sg[i] * sg[i]) / Iq;
        }
        Id = 1 / iI;
      }
      let Tcl = (slip / h + Te / car.Ie - ratio * aW) / (1 / car.Ie + (ratio * ratio * car.eff) / Id);
      Tcl = Math.max(-cap, Math.min(cap, Tcl));
      s.we = Math.max(0, s.we + (h * (Te - Tcl)) / car.Ie);
      Tw = Tcl * ratio * car.eff;
      if (car.el) driveCharge(car, s, s.firing && s.shiftT <= 0 ? thr : 0, rpm, Ff, vf, h);
    }
    if (car.el && car.abs && Tw < 0) {
      let m = 1;
      for (let i = 0; i < 4; i++) if (drv[i]) m = Math.min(m, s.abs[i]);
      Tw *= m;
    }
    if (car.el && car.esp && s.espOver && Tw < 0) Tw = 0;

    const Tbd = [0, 0, 0, 0];
    for (let ax = 0; ax < 2; ax++) {
      const i = ax * 2;
      const j = i + 1;
      const driven = drv[i];
      const Td = driven ? (sg ? Tw * sg[i] : Tw / nd) : 0;
      const Ti = Td + (ax === 0 ? (Ff * car.r) / 2 : 0);
      const Tj = Ti;
      if (!(ax === 0 ? car.liveF : car.liveR)) Tbd[i] = Tbd[j] = Td;
      const share = ax === 0 ? car.brakeFront : 1 - car.brakeFront;
      for (const [q, Tq] of [
        [i, Ti],
        [j, Tj],
      ] as const) {
        if (car.abs) {
          const vl = Math.abs(s.vx);
          s.abs[q] = Math.max(
            0.05,
            Math.min(
              1,
              s.abs[q] +
                (s.kappa[q] < -car.slipOpt * car.aids.absSlip[ax] && vl > 2
                  ? -car.aids.absRel
                  : car.aids.absApp) *
                  h,
            ),
          );
        }
        const cap = ((car.brakeF * share) / 2) * car.r;
        let Tb = Math.min(cap, brake * cap + s.esp[q]) * (car.abs ? s.abs[q] : 1);
        if (hb > 0 && ax === 1) Tb += ((hb * car.hbCap) / 2) * car.r;
        const roll = car.crr * Fz[q] * car.r * Math.tanh((s.w[q] * car.r) / 0.5);
        const Iq = car.Iw + h * car.r * dF[q];
        let wq = s.w[q] + (h * (Tq - Fl[q] * car.r - roll)) / Iq;
        if (ax === 0 ? car.inbF : car.inbR) Tbd[q] -= Math.sign(wq) * Tb;
        const db = (h * Tb) / Iq;
        if (Math.abs(wq) <= db) wq = 0;
        else wq -= Math.sign(wq) * db;
        s.w[q] = wq;
      }
    }

    if (car.diff.type !== 'open') {
      for (let ax = 0; ax < 2; ax++) {
        const i = ax * 2;
        const j = i + 1;
        if (!drv[i]) continue;
        const Ii = car.Iw + h * car.r * dF[i];
        const Ij = car.Iw + h * car.r * dF[j];
        const dw = s.w[i] - s.w[j];
        const kDiff = h * (1 / Ii + 1 / Ij);
        const D = car.diff;
        let Tc = dw / kDiff;
        if (D.type === 'fric') {
          const cap = (D.pre || 0) + (D.L || 0) * Math.abs(Tw) * (sg ? sg[i] + sg[j] : 2 / nd);
          Tc = Math.max(-cap, Math.min(cap, Tc));
        } else if (D.type === 'visc') {
          Tc = ((D.c || 0) * dw) / (1 + (D.c || 0) * kDiff);
        }
        s.w[i] -= (h * Tc) / Ii;
        s.w[j] += (h * Tc) / Ij;
      }
    }

    if (car.centre && nd === 4 && (CD || brake === 0) && (!CD || CD.type !== 'open')) {
      let inv = 0;
      for (let q = 0; q < 4; q++) inv += 1 / (car.Iw + h * car.r * dF[q]);
      let Tc = (2 * (s.w[0] + s.w[1] - (s.w[2] + s.w[3]))) / (h * inv);
      if (CD && CD.type === 'fric') {
        const cap = (CD.pre || 0) + (CD.L || 0) * Math.abs(Tw);
        Tc = Math.max(-cap, Math.min(cap, Tc));
      } else if (CD && CD.type === 'visc') {
        const kVis = (h * inv) / 4;
        Tc = ((CD.c || 0) * (Tc * kVis)) / (1 + (CD.c || 0) * kVis);
      }
      for (let q = 0; q < 4; q++) {
        s.w[q] += ((q < 2 ? -1 : 1) * h * Tc) / 2 / (car.Iw + h * car.r * dF[q]);
      }
    }

    const drag = 0.5 * DRIVE_RHO * car.cdA * v * s.vx;
    const ax = (FX - drag) / car.m - g * sinT;
    const ay = FY / car.m;
    s.vx += h * (ax + s.vy * s.yaw);
    s.vy += h * (ay - s.vx * s.yaw);
    s.yaw += (h * MZ) / car.Izz;
    if (brake > 0 && thr === 0 && Math.abs(s.vx) < 0.05 && Math.abs(s.vy) < 0.05) {
      s.vx = 0;
      s.vy = 0;
      s.yaw = 0;
    }
    s.psi += h * s.yaw;
    const c = Math.cos(s.psi);
    const sn = Math.sin(s.psi);
    s.x += h * (s.vx * c - s.vy * sn);
    s.y += h * (s.vx * sn + s.vy * c);
    const kL = Math.min(1, h / car.tauLoad);
    s.axF += (ax - s.axF) * kL;
    s.ayF += (ay - s.ayF) * kL;

    const dg = gz - g;
    let SS = 0;
    let MP = 0;
    let MR = 0;
    for (let q = 0; q < 2; q++) {
      const i = q * 2;
      const j = i + 1;
      const f = q === 0;
      const t = f ? car.tF : car.tR;
      const ks = f ? car.ksF : car.ksR;
      const cs = f ? car.cdF : car.cdR;
      const mu = f ? car.unsF : car.unsR;
      const W0 = f ? W0F : W0R;
      const zb = s.heave + s.pitch * xw[i];
      const zbV = s.heaveV + s.pitchV * xw[i];
      const rl = (s.roll * t) / 2;
      const rlV = (s.rollV * t) / 2;
      const cL = s.zu[i] - zb - rl;
      const cR = s.zu[j] - zb + rl;
      const e = (ks * (cL + cR)) / 2;
      const pr = (cR - cL) / t;
      const bar = ((f ? car.KaF : car.KaR) * pr) / t;
      const D = (car.m * ay * (f ? car.rcGF : car.rcGR)) / t;
      const up = f ? car.bumpF : car.bumpR;
      const dn = f ? car.droopF : car.droopR;
      const top = up + DRIVE_BUMP_RUBBER;
      const cb = (2 * cs) / (1 + DAMPER_RB);
      const cr = cb * DAMPER_RB;
      const wheel = (w: number, cc: number, vb: number, Fs: number, FlLink: number) => {
        const x = Math.min(cc - up, 0.95 * DRIVE_BUMP_RUBBER);
        const rub = x > 0 ? (ks * x) / (1 - x / DRIVE_BUMP_RUBBER) : 0;
        const A = s.zuV[w] + (h * (Fz[w] - W0 - Fs - rub + FlLink - mu * dg)) / mu - vb;
        let vr = A / (1 + (h * (A > 0 ? cb : cr)) / mu);
        const cn = cc + h * vr;
        if (cn > top) vr = (top - cc) / h;
        else if (cn < -dn) vr = (-dn - cc) / h;
        const vw = vb + vr;
        const S = Fz[w] - W0 + FlLink - mu * dg - (mu * (vw - s.zuV[w])) / h;
        s.zuV[w] = vw;
        s.zu[w] += h * vw;
        return S;
      };
      const sv = f ? car.svF : car.svR;
      const sx = f ? 1 : -1;
      const JL = (sx * (Fl[i] * sv[0] - Tbd[i])) / sv[1];
      const JR = (sx * (Fl[j] * sv[0] - Tbd[j])) / sv[1];
      const SL = wheel(i, cL, zbV + rlV, e - bar, D + JL) - JL;
      const SR = wheel(j, cR, zbV - rlV, e + bar, -D + JR) - JR;
      SS += SL + SR;
      MP += xw[i] * (SL + SR);
      MR += ((SR - SL) * t) / 2;
      s.rr[q] = pr;
    }
    s.heaveV += (h * (SS - car.mS * dg - down)) / car.mS;
    s.heave += h * s.heaveV;
    s.rollV += (h * (car.m * ay * car.rollArm - MR)) / car.rollI;
    s.roll += h * s.rollV;
    s.pitchV +=
      (h * (car.m * ax * car.h + MP - down * (car.aeroBal * car.a - (1 - car.aeroBal) * car.b))) /
      car.pitchI;
    s.pitch += h * s.pitchV;
    s.ax = ax;
    s.ay = ay;
    s.delta = delta;
    s.t += h;
  }
  s.rpm = (s.we * 30) / Math.PI;
  s.speed = Math.hypot(s.vx, s.vy);
  return s;
}

export type LinePoint = { x: number; y: number; v: number; grade: number; kv: number };

/** Autonomous Stanley + lookahead driver from Engine_simulator driveDriver() */
export function driveDriver(
  car: PesCarData,
  s: PesCarState,
  line: LinePoint[],
  d: { i?: number; e?: number; pull?: number },
): PesStepInput {
  const N = line.length;
  const g = DRIVE_G;
  const wrap = (x: number) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
  const PREVIEW = 0.15;
  const PULL = d.pull || 1.5;
  const PAST = 1.2;
  const SPEED = 1;
  const fx = s.x + car.a * Math.cos(s.psi);
  const fy = s.y + car.a * Math.sin(s.psi);
  let bi = d.i || 0;
  let bd = 1e18;
  for (let k = 0; k < 40; k++) {
    const j = ((d.i || 0) + k) % N;
    const q = line[j];
    const dd = (q.x - fx) * (q.x - fx) + (q.y - fy) * (q.y - fy);
    if (dd < bd) {
      bd = dd;
      bi = j;
    }
  }
  d.i = bi;
  const p0 = line[bi];
  const p1 = line[(bi + 1) % N];
  const hp = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const ds = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const e = -(fx - p0.x) * Math.sin(hp) + (fy - p0.y) * Math.cos(hp);
  d.e = e;
  const la = Math.max(1, Math.round((s.vx * PREVIEW) / ds));
  const c = line[(bi + la) % N];
  const c1 = line[(bi + la + 1) % N];
  const c0 = line[(bi + la - 1 + N) % N];
  const kap =
    wrap(Math.atan2(c1.y - c.y, c1.x - c.x) - Math.atan2(c.y - c0.y, c.x - c0.x)) /
    (Math.hypot(c.x - c0.x, c.y - c0.y) || 1);

  const vf = Math.atan2(s.vy + car.a * s.yaw, Math.max(1, s.vx));
  const pkF = Math.atan((3 * car.muF) / car.cc);
  const pkR = Math.atan((3 * car.mu) / car.cc);
  const need = (s.vx * s.vx * kap) / (g * car.cc);
  const aR = (s.alpha[2] + s.alpha[3]) / 2;
  const over = Math.sign(aR) * Math.max(0, Math.abs(aR) - pkR);
  const want = wrap(hp - s.psi - vf) + need - Math.atan2(PULL * e, 3 + s.vx) - over;
  const toeF = s.toe ? (s.toe[0] + s.toe[1]) / 2 : 0;
  const delta = vf - toeF + Math.max(-PAST * pkF, Math.min(PAST * pkF, want));

  const ease = Math.max(
    0,
    Math.min(1, 2 * (Math.max(Math.abs(s.alpha[2]), Math.abs(s.alpha[3])) / pkR - 1)),
  );
  const plan = (p1.v * p1.v - p0.v * p0.v) / (2 * ds) + SPEED * (p0.v - s.vx);
  const F =
    car.m * plan * (1 - ease) +
    0.5 * DRIVE_RHO * car.cdA * s.vx * s.vx +
    car.crr * car.m * g +
    car.m * g * p0.grade;
  const k = s.gear > 0 ? (car.ratios[s.gear - 1] * car.fd * car.eff) / car.r : 0;
  const wot = driveEngine(car, 1, s.rpm, s.boost, s.soc);
  const ov = -driveEngine(car, 0, s.rpm, s.boost, s.soc);
  let thr = k > 0 ? (F / k + ov) / Math.max(1, wot + ov) : 0;
  let brk = 0;
  if (thr < 0) {
    brk = Math.min(1, -(F + ov * k) / car.brakeF);
    thr = 0;
  }
  return {
    steer: delta / car.steerLock,
    throttle: Math.min(1, thr),
    brake: brk,
    road: { sinT: p0.grade, kv: p0.kv },
  };
}
