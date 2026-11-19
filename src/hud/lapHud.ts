import { Container, Text } from 'pixi.js';
import type { DriveIntent, VehicleState } from '../physics/types';

export function createHud() {
  const root = new Container();
  const style = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 14,
    fill: 0xf4f0e6,
  } as const;

  const speed = new Text({ text: '0 km/h', style: { ...style, fontSize: 22 } });
  speed.x = 16;
  speed.y = 16;

  const meta = new Text({ text: '', style });
  meta.x = 16;
  meta.y = 48;

  const help = new Text({
    text: 'WASD / arrows · gamepad stick + triggers · Pixel Powertrain Race (prototype)',
    style: { ...style, fontSize: 12, fill: 0xb8b0a0 },
  });
  help.x = 16;
  help.y = 84;

  root.addChild(speed, meta, help);

  return {
    root,
    update(state: VehicleState, intent: DriveIntent) {
      const kmh = state.speedMs * 3.6;
      speed.text = `${kmh.toFixed(0)} km/h`;
      meta.text = `gear ${state.gear} · ${state.rpm.toFixed(0)} rpm · ${state.engineTorqueNm.toFixed(0)} N·m  |  T ${intent.throttle.toFixed(1)} B ${intent.brake.toFixed(1)} S ${intent.steer.toFixed(1)}`;
    },
  };
}
