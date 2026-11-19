/**
 * Personal-best lap ghost recorder/player + live PES autonomous pack ghosts
 * ("RACE YOUR GHOST / RACE THE PACK" from Sandro's trailer).
 *
 * All localStorage accesses are wrapped in try/catch.
 */
import { FACTORY_PRESETS } from '../physics/pesBridge';
import { driveDriver, driveState, stepCar, type LinePoint } from '../physics/pesDriveModel';
import type { ExportedPreset, PesCarData, PesCarState, VehicleViewState } from '../physics/types';
import { sampleCircuitRoad, TrackTracker, type TrackNode } from './trackCircuit';

export type GhostSample = [
  t: number,
  x: number,
  y: number,
  z: number,
  yaw: number,
  roll: number,
  pitch: number,
];

export type GhostPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
  pitch: number;
  visible: boolean;
};

const STORAGE_PREFIX = 'ppr.ghost.v1.';
const RECORD_INTERVAL = 0.05; // 20 Hz

export class BestGhostRecorder {
  private _current: GhostSample[] = [];
  private _best: GhostSample[] | null = null;
  private _accum = 0;
  private _presetId: string;

  constructor(presetId: string) {
    this._presetId = presetId;
    this._best = this._load(presetId);
  }

  public setPreset(presetId: string): void {
    this._presetId = presetId;
    this._current = [];
    this._accum = 0;
    this._best = this._load(presetId);
  }

  public resetLap(): void {
    this._current = [];
    this._accum = 0;
  }

  public recordStep(dt: number, lapTime: number, view: VehicleViewState): void {
    this._accum += dt;
    if (this._current.length === 0 || this._accum >= RECORD_INTERVAL) {
      this._accum = 0;
      this._current.push([
        Number(lapTime.toFixed(3)),
        Number(view.x.toFixed(2)),
        Number(view.y.toFixed(3)),
        Number(view.z.toFixed(2)),
        Number(view.yaw.toFixed(3)),
        Number(view.roll.toFixed(3)),
        Number(view.pitch.toFixed(3)),
      ]);
    }
  }

  public commitIfBest(isNewBest: boolean): void {
    if (isNewBest && this._current.length > 10) {
      this._best = this._current.slice();
      this._save(this._presetId, this._best);
    }
    this._current = [];
    this._accum = 0;
  }

  public hasBest(): boolean {
    return this._best !== null && this._best.length > 2;
  }

  public sampleAt(lapTime: number): GhostPose {
    const b = this._best;
    if (!b || b.length < 2) {
      return { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, visible: false };
    }
    const last = b[b.length - 1];
    if (lapTime >= last[0]) {
      return {
        x: last[1],
        y: last[2],
        z: last[3],
        yaw: last[4],
        roll: last[5],
        pitch: last[6],
        visible: true,
      };
    }
    let hi = 1;
    while (hi < b.length - 1 && b[hi][0] < lapTime) hi++;
    const a = b[hi - 1];
    const c = b[hi];
    const span = Math.max(1e-4, c[0] - a[0]);
    const f = Math.max(0, Math.min(1, (lapTime - a[0]) / span));
    let dyaw = c[4] - a[4];
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    return {
      x: a[1] + (c[1] - a[1]) * f,
      y: a[2] + (c[2] - a[2]) * f,
      z: a[3] + (c[3] - a[3]) * f,
      yaw: a[4] + dyaw * f,
      roll: a[5] + (c[5] - a[5]) * f,
      pitch: a[6] + (c[6] - a[6]) * f,
      visible: true,
    };
  }

  private _load(id: string): GhostSample[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GhostSample[];
      return Array.isArray(parsed) && parsed.length > 2 ? parsed : null;
    } catch {
      return null;
    }
  }

  private _save(id: string, data: GhostSample[]): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
    } catch {
      // Ignore storage quota / privacy block
    }
  }
}

/**
 * Autonomous PES AI pack racer using Engine_simulator's Stanley + speed-plan
 * driveDriver() on real 1 kHz stepCar physics!
 */
export class AiPackRacer {
  public readonly car: PesCarData;
  public readonly state: PesCarState;
  public readonly color: number;
  public readonly label: string;
  private readonly _tracker: TrackTracker;
  private readonly _driverMem: { i?: number; e?: number; pull?: number };
  private readonly _paceScale: number;

  constructor(
    preset: ExportedPreset,
    nodes: TrackNode[],
    startNodeIndex: number,
    color: number,
    paceScale = 0.94,
  ) {
    this.car = structuredClone(preset.car);
    this.state = driveState(this.car);
    this.color = color;
    this.label = preset.shortName;
    this._paceScale = paceScale;

    const nd = nodes[startNodeIndex % nodes.length];
    this.state.x = nd.x;
    this.state.y = nd.y;
    this.state.psi = nd.psi;
    this.state.vx = 10;
    this.state.w = [10 / this.car.r, 10 / this.car.r, 10 / this.car.r, 10 / this.car.r];
    this._tracker = new TrackTracker(startNodeIndex % nodes.length);
    this._driverMem = { i: startNodeIndex % nodes.length, pull: 1.65 };
  }

  public step(dt: number, nodes: TrackNode[], baseLine: LinePoint[]): GhostPose {
    const scaledLine = baseLine.map((p) => ({ ...p, v: p.v * this._paceScale }));
    const cmd = driveDriver(this.car, this.state, scaledLine, this._driverMem);
    const road = sampleCircuitRoad(nodes, this._tracker, this.car, this.state);
    stepCar(
      this.car,
      this.state,
      {
        steer: cmd.steer,
        throttle: cmd.throttle,
        brake: cmd.brake,
        road,
      },
      dt,
    );
    const baseElev = road.z ? (road.z[0] + road.z[1] + road.z[2] + road.z[3]) * 0.25 : 0;
    return {
      x: this.state.x,
      y: baseElev + this.state.heave,
      z: -this.state.y,
      yaw: this.state.psi,
      roll: this.state.roll,
      pitch: this.state.pitch,
      visible: true,
    };
  }
}

export function createPackRacers(nodes: TrackNode[]): AiPackRacer[] {
  const ae86 = FACTORY_PRESETS.find((p) => p.id === 'ae86') ?? FACTORY_PRESETS[0];
  const e30 = FACTORY_PRESETS.find((p) => p.id === 'e30_m3') ?? FACTORY_PRESETS[0];
  const delta = FACTORY_PRESETS.find((p) => p.id === 'delta_integrale') ?? FACTORY_PRESETS[0];
  return [
    new AiPackRacer(ae86, nodes, 40, 0x00f5d4, 0.92),
    new AiPackRacer(e30, nodes, 110, 0x9ef01a, 0.96),
    new AiPackRacer(delta, nodes, 165, 0xff70a6, 0.90),
  ];
}
