/**
 * Zero-asset procedural Web Audio synthesizer driven by PES telemetry:
 *   - Engine firing fundamental + sub-harmonic + load-controlled lowpass filter
 *   - Turbocharger boost whistle
 *   - Bandpass noise tyre squeal / gravel scrub
 *   - Crate / wall impact thud
 */
import type { SurfaceKind } from './trackCircuit';

export class ProceduralRaceAudio {
  private _ctx: AudioContext | null = null;
  private _engOsc1: OscillatorNode | null = null;
  private _engOsc2: OscillatorNode | null = null;
  private _engFilter: BiquadFilterNode | null = null;
  private _engGain: GainNode | null = null;

  private _skidFilter: BiquadFilterNode | null = null;
  private _skidGain: GainNode | null = null;

  private _turboOsc: OscillatorNode | null = null;
  private _turboGain: GainNode | null = null;

  public muted = false;
  private _started = false;

  public unlock(): void {
    if (this._started) {
      if (this._ctx?.state === 'suspended') void this._ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    this._ctx = ctx;

    // Engine voice
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2.2;
    filter.frequency.value = 500;
    const engGain = ctx.createGain();
    engGain.gain.value = 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(engGain);
    engGain.connect(ctx.destination);
    osc1.start();
    osc2.start();

    this._engOsc1 = osc1;
    this._engOsc2 = osc2;
    this._engFilter = filter;
    this._engGain = engGain;

    // Turbocharger spool whistle
    const turboOsc = ctx.createOscillator();
    turboOsc.type = 'sine';
    turboOsc.frequency.value = 1800;
    const turboGain = ctx.createGain();
    turboGain.gain.value = 0;
    turboOsc.connect(turboGain);
    turboGain.connect(ctx.destination);
    turboOsc.start();
    this._turboOsc = turboOsc;
    this._turboGain = turboGain;

    // Noise buffer for tyre squeal / dirt scrub
    const len = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1150;
    skidFilter.Q.value = 4.5;
    const skidGain = ctx.createGain();
    skidGain.gain.value = 0;

    noiseSrc.connect(skidFilter);
    skidFilter.connect(skidGain);
    skidGain.connect(ctx.destination);
    noiseSrc.start();

    this._skidFilter = skidFilter;
    this._skidGain = skidGain;
    this._started = true;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public update(
    rpm: number,
    redline: number,
    throttle: number,
    boostBar: number,
    maxWheelSlip: number,
    speedMs: number,
    surface: SurfaceKind,
  ): void {
    const ctx = this._ctx;
    if (!ctx || !this._started) return;

    const now = ctx.currentTime;
    if (this.muted) {
      this._engGain?.gain.setTargetAtTime(0, now, 0.04);
      this._skidGain?.gain.setTargetAtTime(0, now, 0.04);
      this._turboGain?.gain.setTargetAtTime(0, now, 0.04);
      return;
    }

    // 4-cylinder / 6-cylinder firing fundamental ~ (rpm / 60) * 2
    const baseHz = Math.max(26, (rpm / 60) * 2);
    this._engOsc1?.frequency.setTargetAtTime(baseHz, now, 0.025);
    this._engOsc2?.frequency.setTargetAtTime(baseHz * 0.5, now, 0.025);

    const normRpm = Math.min(1.1, rpm / Math.max(3000, redline));
    const cutoff = 320 + throttle * 2600 + normRpm * 1900;
    this._engFilter?.frequency.setTargetAtTime(cutoff, now, 0.04);
    const vol = 0.035 + throttle * 0.055 + normRpm * 0.03;
    this._engGain?.gain.setTargetAtTime(vol, now, 0.04);

    // Turbo whistle
    const turboVol = boostBar > 0.08 ? Math.min(0.03, boostBar * 0.022) : 0;
    this._turboOsc?.frequency.setTargetAtTime(1600 + boostBar * 1900, now, 0.05);
    this._turboGain?.gain.setTargetAtTime(turboVol, now, 0.05);

    // Tyre squeal (high Q on asphalt, lower Q crunch on dirt/water)
    let skidVol = 0;
    if (speedMs > 2.2) {
      if (surface === 'water') {
        this._skidFilter?.frequency.setTargetAtTime(650, now, 0.05);
        this._skidFilter?.Q.setTargetAtTime(1.1, now, 0.05);
        skidVol = Math.min(0.09, speedMs * 0.005);
      } else if (surface === 'dirt') {
        this._skidFilter?.frequency.setTargetAtTime(480, now, 0.05);
        this._skidFilter?.Q.setTargetAtTime(1.4, now, 0.05);
        skidVol = maxWheelSlip > 0.45 ? Math.min(0.08, (maxWheelSlip - 0.4) * 0.07) : speedMs * 0.002;
      } else if (maxWheelSlip > 0.68) {
        this._skidFilter?.frequency.setTargetAtTime(1180 + Math.min(500, speedMs * 14), now, 0.04);
        this._skidFilter?.Q.setTargetAtTime(5.5, now, 0.04);
        skidVol = Math.min(0.11, (maxWheelSlip - 0.68) * 0.12);
      }
    }
    this._skidGain?.gain.setTargetAtTime(skidVol, now, 0.035);
  }

  public playImpact(speedMs: number): void {
    const ctx = this._ctx;
    if (!ctx || !this._started || this.muted || speedMs < 0.8) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    const amp = Math.min(0.24, 0.03 + speedMs * 0.018);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }
}
