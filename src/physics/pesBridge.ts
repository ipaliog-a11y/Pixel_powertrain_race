/**
 * Bridge from Pixel Powertrain (Engine_simulator) into this race host.
 *
 * Status: STUB. The arcade step in src/race/arcadeVehicle.ts still owns the
 * motion. When live, this module will:
 *   1. Accept a DriveIntent + VehicleState + a PES vehicle/engine snapshot
 *   2. Advance engine RPM / gear / wheel forces using ported drive-model math
 *   3. Return an updated VehicleState (plain data for the renderer)
 *
 * Rules (from Engine_simulator AGENTS.md): derive, do not fit; cite sources;
 * fingerprint against PES headless laps before claiming parity.
 *
 * Related OSS for the chassis half (not the engine):
 *   - CS-Software-LLC/skidpad — WASM chassis/tyres host
 *   - aunyks/tread — Pacejka 2002 tyre forces
 * See docs/research/similar-repos.md
 */

import type { DriveIntent, VehicleSpec, VehicleState } from './types';

export type PesSnapshot = {
  /** Crank torque available at current operating point (N·m) */
  torqueNm: number;
  rpm: number;
  gear: number;
  /** Optional note for UI / debug */
  presetId?: string;
};

export type BridgeMode = 'arcade' | 'pes';

/**
 * Placeholder: echoes arcade state and stamps PES-ish debug fields so the HUD
 * and future wiring have a stable API.
 */
export function stepPesBridge(
  state: VehicleState,
  _intent: DriveIntent,
  _spec: VehicleSpec,
  snapshot: PesSnapshot | null,
  _dt: number,
): VehicleState {
  if (!snapshot) return state;
  return {
    ...state,
    rpm: snapshot.rpm,
    gear: snapshot.gear,
    engineTorqueNm: snapshot.torqueNm,
  };
}

/** Fake dyno curve until PES export exists — linear toy, marked unsure. */
export function toySnapshotFromSpeed(speedMs: number): PesSnapshot {
  const rpm = Math.min(7500, 900 + speedMs * 180);
  const torqueNm = Math.max(80, 280 - Math.abs(rpm - 4200) * 0.04);
  const gear = speedMs < 8 ? 1 : speedMs < 16 ? 2 : speedMs < 26 ? 3 : 4;
  return { torqueNm, rpm, gear, presetId: 'toy-unsure' };
}
