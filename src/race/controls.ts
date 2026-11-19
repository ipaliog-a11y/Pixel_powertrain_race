import type { DriveIntent } from '../physics/types';

const keys = new Set<string>();

function onKey(e: KeyboardEvent, down: boolean) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  const k = e.key.toLowerCase();
  if (down) keys.add(k);
  else keys.delete(k);
}

export function bindControls(target: Window = window) {
  const down = (e: KeyboardEvent) => onKey(e, true);
  const up = (e: KeyboardEvent) => onKey(e, false);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}

function gamepadAxes(): DriveIntent | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) {
    if (!pad) continue;
    const steer = clamp(pad.axes[0] ?? 0, -1, 1);
    const throttle = trigger(pad, 7) || (pad.buttons[0]?.pressed ? 1 : 0);
    const brake = trigger(pad, 6) || (pad.buttons[1]?.pressed ? 1 : 0);
    if (Math.abs(steer) > 0.05 || throttle > 0.02 || brake > 0.02) {
      return { throttle, brake, steer };
    }
  }
  return null;
}

function trigger(pad: Gamepad, i: number): number {
  const b = pad.buttons[i];
  if (!b) return 0;
  return typeof b.value === 'number' ? b.value : b.pressed ? 1 : 0;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Merge keyboard + gamepad into one intent (gamepad wins when active). */
export function sampleIntent(): DriveIntent {
  const gp = gamepadAxes();
  if (gp) return gp;

  let throttle = 0;
  let brake = 0;
  let steer = 0;
  if (keys.has('w') || keys.has('arrowup')) throttle = 1;
  if (keys.has('s') || keys.has('arrowdown')) brake = 1;
  if (keys.has('a') || keys.has('arrowleft')) steer -= 1;
  if (keys.has('d') || keys.has('arrowright')) steer += 1;
  return { throttle, brake, steer };
}
