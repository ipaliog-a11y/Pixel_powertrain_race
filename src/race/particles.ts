/**
 * World-space tyre smoke, dirt dust, and water splash emitters using
 * @pixi/3d/extras ParticleSystem3D with a procedural radial puff texture
 * (zero external image files).
 */
import type { Container3D } from '@pixi/3d';
import { Vector3 } from '@pixi/3d';
import { ConeShape, ParticleSystem3D } from '@pixi/3d/extras';
import { Texture, type Ticker } from 'pixi.js';
import type { SurfaceKind } from './trackCircuit';

function createSoftPuffTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  return Texture.from(canvas);
}

export class RaceParticles {
  private readonly _smoke: ParticleSystem3D;
  private readonly _splash: ParticleSystem3D;
  private readonly _pos = new Vector3();

  constructor(parent: Container3D) {
    const tex = createSoftPuffTexture();

    this._smoke = new ParticleSystem3D({
      texture: tex,
      capacity: 1400,
      autoUpdate: false,
      emitRate: 0,
      shape: new ConeShape({ angle: 28, radius: 0.14 }),
      life: [0.7, 1.5],
      speed: [0.7, 1.8],
      size: [0.22, 0.38],
      sizeEnd: [0.9, 1.65],
      alpha: 0.28,
      alphaEnd: 0,
      color: 0xd8dce3,
      drag: 1.4,
      parent,
    });

    this._splash = new ParticleSystem3D({
      texture: tex,
      capacity: 900,
      autoUpdate: false,
      emitRate: 0,
      shape: new ConeShape({ angle: 38, radius: 0.18 }),
      life: [0.35, 0.65],
      speed: [2.8, 5.4],
      size: [0.18, 0.3],
      sizeEnd: [0.45, 0.75],
      alpha: 0.55,
      alphaEnd: 0,
      color: 0xb8f2ff,
      gravity: 9.8,
      drag: 0.8,
      parent,
    });
  }

  public update(
    ticker: Ticker,
    wheelWorld: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]],
    wheelSlip: [number, number, number, number],
    speedMs: number,
    surface: SurfaceKind,
  ): void {
    if (surface === 'water' && speedMs > 2.2) {
      const count = Math.min(4, 1 + Math.floor(speedMs / 7));
      for (let i = 0; i < 4; i++) {
        const [wx, wy, wz] = wheelWorld[i];
        this._pos.set(wx, wy + 0.08, wz);
        this._splash.spawn(count, { position: this._pos, color: 0xc4f5ff });
      }
    } else if (speedMs > 2.5) {
      for (let i = 0; i < 4; i++) {
        const slip = wheelSlip[i];
        const dirtDust = surface === 'dirt' && speedMs > 8 && i >= 2;
        if (slip > 0.72 || dirtDust) {
          const [wx, wy, wz] = wheelWorld[i];
          this._pos.set(wx, wy + 0.08, wz);
          const color =
            surface === 'dirt' ? 0xc9a87c : surface === 'grass' ? 0x9ab07a : 0xdde2ea;
          const count = slip > 1.0 ? 2 : 1;
          this._smoke.spawn(count, { position: this._pos, color });
        }
      }
    }

    this._smoke.update(ticker);
    this._splash.update(ticker);
  }
}
