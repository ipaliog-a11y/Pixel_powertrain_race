/**
 * Host bridge wrapping Engine_simulator's derived stepCar() for the 3D race game.
 *
 * Responsibilities:
 *   1. Load exported factory presets (and optional player-pasted driveCar() JSON)
 *   2. Sample 4-wheel surface/elevation from the tabletop track into u.road
 *   3. Handle automatic reverse gear when stopped & holding brake/reverse
 *   4. Project PesCarState (SAE Z-up XY) into PixiJS 3D Y-up VehicleViewState
 */
import presetsJson from './presets/factoryCars.json';
import { driveEngine, driveState, driveTyre, stepCar } from './pesDriveModel';
import type {
  DriveIntent,
  ExportedPreset,
  PesCarData,
  PesCarState,
  PesRoadSample,
  VehicleViewState,
} from './types';

export const FACTORY_PRESETS: ExportedPreset[] = presetsJson as unknown as ExportedPreset[];

export type RoadSampler = (
  car: PesCarData,
  s: PesCarState,
) => PesRoadSample;

export class PesVehicleHost {
  public preset: ExportedPreset;
  public car: PesCarData;
  public state: PesCarState;
  public reversing = false;
  private _stoppedHold = 0;

  constructor(preset: ExportedPreset = FACTORY_PRESETS[0]) {
    this.preset = preset;
    this.car = structuredClone(preset.car);
    this.state = driveState(this.car);
  }

  public setPreset(preset: ExportedPreset, spawnX = 0, spawnY = 0, spawnPsi = 0): void {
    this.preset = preset;
    this.car = structuredClone(preset.car);
    this.reset(spawnX, spawnY, spawnPsi);
  }

  public reset(x = 0, y = 0, psi = 0): void {
    this.state = driveState(this.car);
    this.state.x = x;
    this.state.y = y;
    this.state.psi = psi;
    this.reversing = false;
    this._stoppedHold = 0;
  }

  /** Compute wheel world positions in PES XY plane: [FL, FR, RL, RR] */
  public getWheelPositionsPes(): [[number, number], [number, number], [number, number], [number, number]] {
    const s = this.state;
    const c = Math.cos(s.psi);
    const sn = Math.sin(s.psi);
    const xw = [this.car.a, this.car.a, -this.car.b, -this.car.b];
    const yw = [this.car.tF / 2, -this.car.tF / 2, this.car.tR / 2, -this.car.tR / 2];
    return [0, 1, 2, 3].map((i) => [
      s.x + xw[i] * c - yw[i] * sn,
      s.y + xw[i] * sn + yw[i] * c,
    ]) as [[number, number], [number, number], [number, number], [number, number]];
  }

  public step(intent: DriveIntent, dt: number, sampleRoad?: RoadSampler): VehicleViewState {
    const s = this.state;
    const road = sampleRoad ? sampleRoad(this.car, s) : { surfaceTag: 'asphalt' as const };

    // Auto-reverse when stopped and holding S / brake trigger
    if (!this.reversing) {
      if (s.vx < 0.35 && intent.brake > 0.25 && intent.throttle < 0.05) {
        this._stoppedHold += dt;
        if (this._stoppedHold > 0.18) {
          this.reversing = true;
        }
      } else {
        this._stoppedHold = 0;
      }
    } else if (intent.throttle > 0.1 || (intent.brake < 0.05 && s.vx > -0.25)) {
      this.reversing = false;
      this._stoppedHold = 0;
    }

    // Screen steer (-1 left, +1 right) -> PES steer (+1 left, -1 right)
    // Add gentle speed-sensitive steering envelope above 60 km/h so keyboard taps
    // ask for realistic slip angles rather than instant full lock at 150 km/h.
    const speedFactor = 1 / (1 + Math.pow(Math.max(0, Math.abs(s.vx) - 8) / 22, 1.35));
    const pesSteer = -intent.steer * (0.28 + 0.72 * speedFactor);

    if (this.reversing) {
      // Step normal chassis/suspension with zero throttle, plus reverse crawl force capped at 28 km/h
      const revPedal = intent.brake;
      const forwardBraking = intent.throttle;
      stepCar(
        this.car,
        s,
        {
          steer: pesSteer,
          throttle: 0,
          brake: forwardBraking,
          handbrake: intent.handbrake,
          road,
        },
        dt,
      );
      if (revPedal > 0.05 && s.vx > -7.8) {
        const revAccel = Math.min(4.2, (driveEngine(this.car, revPedal * 0.65, 2200) * this.car.ratios[0] * this.car.fd * 0.45) / (this.car.r * this.car.m));
        s.vx -= revAccel * dt;
        const c = Math.cos(s.psi);
        const sn = Math.sin(s.psi);
        s.x += -revAccel * dt * dt * 0.5 * c;
        s.y += -revAccel * dt * dt * 0.5 * sn;
        s.rpm = 1200 + Math.abs(s.vx) * 280;
        for (let i = 0; i < 4; i++) s.w[i] = s.vx / this.car.r;
      }
    } else {
      stepCar(
        this.car,
        s,
        {
          steer: pesSteer,
          throttle: intent.throttle,
          brake: intent.brake,
          handbrake: intent.handbrake,
          starter: !s.firing && intent.throttle > 0.1,
          road,
        },
        dt,
      );
    }

    return this.toViewState(road, intent.throttle);
  }

  public toViewState(road?: PesRoadSample, throttle = 0): VehicleViewState {
    const s = this.state;
    const car = this.car;
    const wheelSlip: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const T = driveTyre(
        car,
        s.Fz[i],
        s.kappa[i],
        s.alpha[i],
        i < 2,
        s.cg[i],
        road?.grip ? road.grip[i] : 1,
      );
      wheelSlip[i] = T[2];
    }
    const baseZ = road?.z ? (road.z[0] + road.z[1] + road.z[2] + road.z[3]) * 0.25 : 0;
    return {
      x: s.x,
      y: baseZ + s.heave,
      z: -s.y,
      yaw: s.psi,
      roll: s.roll,
      pitch: s.pitch,
      speedMs: s.speed,
      vx: s.vx,
      vy: s.vy,
      rpm: s.rpm,
      redline: car.redline,
      gear: this.reversing ? -1 : s.gear,
      reversing: this.reversing,
      boostBar: s.boost,
      engineTorqueNm: driveEngine(car, throttle, s.rpm, s.boost, s.soc),
      frontSteerRad: s.delta,
      wheelOmega: [s.w[0], s.w[1], s.w[2], s.w[3]],
      wheelZu: [s.zu[0], s.zu[1], s.zu[2], s.zu[3]],
      wheelSlip,
      surface: road?.surfaceTag ?? 'asphalt',
      tcActive: s.tcF < 0.96,
      absActive: s.abs.some((a) => a < 0.92),
      espActive: s.esp.some((e) => e > 1),
    };
  }
}
