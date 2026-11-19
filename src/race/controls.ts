/**
 * Keyboard + Gamepad input sampler and discrete race hotkeys.
 */
import type { DriveIntent } from '../physics/types';

export type HotkeyCallbacks = {
  onSelectPreset?: (index: number) => void;
  onToggleCamera?: () => void;
  onToggleGhosts?: () => void;
  onResetCar?: () => void;
  onResetProps?: () => void;
  onToggleMute?: () => void;
  onAnyInteraction?: () => void;
};

const keys = new Set<string>();
let smoothSteer = 0;

export function bindControls(callbacks: HotkeyCallbacks = {}, target: Window = window): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    callbacks.onAnyInteraction?.();
    const k = e.key.toLowerCase();
    if (!e.repeat) {
      if (k >= '1' && k <= '6') callbacks.onSelectPreset?.(Number(k) - 1);
      else if (k === 'c') callbacks.onToggleCamera?.();
      else if (k === 'g') callbacks.onToggleGhosts?.();
      else if (k === 'r') callbacks.onResetCar?.();
      else if (k === 'b') callbacks.onResetProps?.();
      else if (k === 'm') callbacks.onToggleMute?.();
    }
    keys.add(k);
  };

  const onUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };

  const onPointer = () => callbacks.onAnyInteraction?.();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('pointerdown', onPointer);

  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('pointerdown', onPointer);
  };
}

function triggerValue(pad: Gamepad, idx: number): number {
  const b = pad.buttons[idx];
  if (!b) return 0;
  return typeof b.value === 'number' ? b.value : b.pressed ? 1 : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function sampleIntent(dt = 1 / 60): DriveIntent {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) {
    if (!pad) continue;
    const rawSteer = pad.axes[0] ?? 0;
    const steer = Math.abs(rawSteer) > 0.06 ? clamp(rawSteer, -1, 1) : 0;
    const throttle = triggerValue(pad, 7) || (pad.buttons[0]?.pressed ? 1 : 0);
    const brake = triggerValue(pad, 6) || (pad.buttons[1]?.pressed ? 1 : 0);
    const handbrake = pad.buttons[2]?.pressed || pad.buttons[5]?.pressed ? 1 : 0;
    if (steer !== 0 || throttle > 0.02 || brake > 0.02 || handbrake > 0) {
      smoothSteer = steer;
      return { throttle, brake, steer, handbrake };
    }
  }

  let throttle = 0;
  let brake = 0;
  let targetSteer = 0;
  let handbrake = 0;

  if (keys.has('w') || keys.has('arrowup')) throttle = 1;
  if (keys.has('s') || keys.has('arrowdown')) brake = 1;
  if (keys.has('a') || keys.has('arrowleft')) targetSteer -= 1;
  if (keys.has('d') || keys.has('arrowright')) targetSteer += 1;
  if (keys.has(' ')) handbrake = 1;

  // Progressive steering ramp so keyboard driving feels planted yet responsive
  const rate = targetSteer === 0 ? 10 : Math.sign(targetSteer) !== Math.sign(smoothSteer) ? 11 : 6.2;
  smoothSteer += (targetSteer - smoothSteer) * Math.min(1, rate * dt);
  if (Math.abs(smoothSteer) < 0.01 && targetSteer === 0) smoothSteer = 0;

  return { throttle, brake, steer: smoothSteer, handbrake };
}
