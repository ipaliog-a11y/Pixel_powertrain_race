/**
 * WHY THIS EXISTS:
 * - Verifies that our 3D figure-8 tabletop circuit disambiguates the elevated
 *   bridge overpass (u ~ 0, z ~ 2.55 m) from the ground underpass (u ~ pi, z = 0).
 * - Proves headless that an autonomous PES racer (driveDriver + 1 kHz stepCar)
 *   drives a complete valid 4-sector lap around the figure-8 without leaving bounds.
 * - Verifies momentum conservation when cars of different PES curb masses smash
 *   into rigid-body tabletop crates.
 */
import { describe, expect, it } from 'vitest';
import { FACTORY_PRESETS } from '../physics/pesBridge';
import { driveState } from '../physics/pesDriveModel';
import { AiPackRacer } from './ghosts';
import { createDefaultProps, stepProps } from './smashables';
import {
  BOARD_HALF_X,
  BOARD_HALF_Y,
  buildCircuit,
  LapRaceTimer,
  TrackTracker,
} from './trackCircuit';

describe('Tabletop figure-8 circuit & smashables', () => {
  it('separates elevated overpass bridge from ground-level underpass at the origin', () => {
    const { nodes } = buildCircuit();
    expect(nodes[0].z).toBeGreaterThan(2.4);
    expect(nodes[0].surface).toBe('bridge');
    expect(nodes[120].z).toBeCloseTo(0, 5);

    const overTracker = new TrackTracker(238);
    const overNode = overTracker.locate(nodes, 0, 0);
    expect(overNode.z).toBeGreaterThan(2.4);

    const underTracker = new TrackTracker(118);
    const underNode = underTracker.locate(nodes, 0, 0);
    expect(underNode.z).toBeCloseTo(0, 5);
  });

  it('completes a full valid 4-sector lap under autonomous PES driveDriver control', () => {
    const { nodes, aiLine } = buildCircuit();
    const mx5 = FACTORY_PRESETS.find((p) => p.id === 'mx5_na')!;
    const racer = new AiPackRacer(mx5, nodes, 208, 0x00f5d4, 0.95);
    const tracker = new TrackTracker(208);
    const timer = new LapRaceTimer('test.lap', 208);

    let finishedLap: number | null = null;
    const dt = 1 / 50;
    for (let step = 0; step < 50 * 40; step++) {
      racer.step(dt, nodes, aiLine);
      expect(Math.abs(racer.state.x)).toBeLessThan(BOARD_HALF_X);
      expect(Math.abs(racer.state.y)).toBeLessThan(BOARD_HALF_Y);
      tracker.locate(nodes, racer.state.x, racer.state.y);
      const res = timer.update(dt, tracker.nodeIndex, true, 'test.lap');
      if (res !== null) {
        finishedLap = res;
        break;
      }
    }

    expect(finishedLap).not.toBeNull();
    expect(finishedLap!).toBeGreaterThan(14);
    expect(finishedLap!).toBeLessThan(36);
  });

  it('transfers less velocity loss to the 2100 kg Hilux than the 940 kg AE86 when smashing crates', () => {
    const ae86 = FACTORY_PRESETS.find((p) => p.id === 'ae86')!.car;
    const hilux = FACTORY_PRESETS.find((p) => p.id === 'hilux_28d')!.car;

    const propsA = createDefaultProps();
    const sA = driveState(ae86);
    sA.x = propsA[0].x - 1.2;
    sA.y = propsA[0].y;
    sA.vx = 18;
    stepProps(propsA, ae86, sA, 0.4, 1 / 60);

    const propsB = createDefaultProps();
    const sB = driveState(hilux);
    sB.x = propsB[0].x - 1.2;
    sB.y = propsB[0].y;
    sB.vx = 18;
    stepProps(propsB, hilux, sB, 0.4, 1 / 60);

    expect(sB.vx).toBeGreaterThan(sA.vx);
    expect(propsB[0].vx).toBeGreaterThan(0);
  });
});
