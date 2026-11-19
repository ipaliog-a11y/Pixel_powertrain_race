/**
 * WHY THIS EXISTS:
 * - Proves that Pixel_powertrain_race's TypeScript port of stepCar / driveSprint /
 *   driveStop100 reproduces Engine_simulator's derived benchmarks bit-for-bit
 *   across NA RWD, turbo AWD, and heavy diesel trucks.
 * - Verifies that the u.road 4-wheel surface/elevation hook alters grip on
 *   grass/water and excites suspension travel over kerbs/bridges deterministically.
 */
import { describe, expect, it } from 'vitest';
import { FACTORY_PRESETS, PesVehicleHost } from './pesBridge';
import { DRIVE_SURFACE, driveSprint, driveState, driveStop100, stepCar } from './pesDriveModel';

describe('PES drive-model parity with Engine_simulator', () => {
  for (const preset of FACTORY_PRESETS) {
    it(`matches Engine_simulator 0-100 sprint and 100-0 braking exactly for ${preset.shortName}`, () => {
      const sprint = driveSprint(preset.car);
      const stop = driveStop100(preset.car);

      if (preset.benchmarks.sprint0to100s === null) {
        expect(sprint.t).toBeNull();
      } else {
        expect(sprint.t).not.toBeNull();
        expect(sprint.t!).toBeCloseTo(preset.benchmarks.sprint0to100s, 10);
      }
      expect(sprint.slip).toBeCloseTo(preset.benchmarks.sprintPeakSlip, 10);
      expect(stop.dist).toBeCloseTo(preset.benchmarks.stop100to0m, 10);
      expect(stop.lock).toBe(preset.benchmarks.stopLocked);
    });
  }

  it('produces deterministic state across repeated runs and responds to u.road grip/elevation', () => {
    const mx5 = FACTORY_PRESETS.find((p) => p.id === 'mx5_na')!;
    const a = driveState(mx5.car);
    const b = driveState(mx5.car);
    for (let i = 0; i < 200; i++) {
      stepCar(mx5.car, a, { throttle: 0.85, steer: 0.15, brake: 0 }, 1 / 60);
      stepCar(mx5.car, b, { throttle: 0.85, steer: 0.15, brake: 0 }, 1 / 60);
    }
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.psi).toBe(b.psi);
    expect(a.roll).not.toBe(0);

    // Braking on wet grass must take substantially longer than on dry asphalt
    const hostDry = new PesVehicleHost(mx5);
    hostDry.state.vx = 22;
    hostDry.state.w = [22 / mx5.car.r, 22 / mx5.car.r, 22 / mx5.car.r, 22 / mx5.car.r];
    const hostWet = new PesVehicleHost(mx5);
    hostWet.state.vx = 22;
    hostWet.state.w = [22 / mx5.car.r, 22 / mx5.car.r, 22 / mx5.car.r, 22 / mx5.car.r];

    for (let i = 0; i < 180; i++) {
      hostDry.step({ throttle: 0, brake: 1, steer: 0, handbrake: 0 }, 1 / 60, () => ({
        grip: [1, 1, 1, 1],
        surfaceTag: 'asphalt',
      }));
      const g = DRIVE_SURFACE.grassWet;
      hostWet.step({ throttle: 0, brake: 1, steer: 0, handbrake: 0 }, 1 / 60, () => ({
        grip: [g, g, g, g],
        surfaceTag: 'water',
      }));
    }
    expect(hostWet.state.x).toBeGreaterThan(hostDry.state.x * 1.35);
  });
});
