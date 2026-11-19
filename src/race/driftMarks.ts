/**
 * Streaming 4-wheel skid / rut ribbons using PixiJS 3D dynamic Geometry3D
 * partial buffer uploads (adapted from pixijs/3d/examples/racing/DriftMarks.ts, MIT).
 *
 * Driven by PES stepCar's real combined tyre slip s (wheelSlip[0..3]).
 */
import type { Container3D } from '@pixi/3d';
import { FlatMaterial, Geometry3D, Mesh3D, Vector3 } from '@pixi/3d';
import type { Buffer } from 'pixi.js';
import { Buffer as PixiBuffer, BufferUsage } from 'pixi.js';
import type { SurfaceKind } from './trackCircuit';

const MAX_SEGMENTS = 2048;
const VERTS_PER_SEGMENT = 6;
const FLOATS_PER_POSITION = 3;
const FLOATS_PER_COLOR = 4;
const POSITION_FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * FLOATS_PER_POSITION;
const COLOR_FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * FLOATS_PER_COLOR;
const POSITION_BYTES_PER_SEGMENT = POSITION_FLOATS_PER_SEGMENT * 4;
const COLOR_BYTES_PER_SEGMENT = COLOR_FLOATS_PER_SEGMENT * 4;

const HALF_WIDTH = 0.11;
const Y_OFFSET = 0.03;
const MIN_SEGMENT_LEN = 0.05;

class WheelTrail {
  public readonly mesh: Mesh3D;
  private readonly _positions: Float32Array;
  private readonly _colors: Float32Array;
  private readonly _posBuf: Buffer;
  private readonly _colBuf: Buffer;
  private readonly _prev = new Vector3();
  private _segIdx = 0;
  private _active = false;

  constructor(parent: Container3D, material: FlatMaterial) {
    this._positions = new Float32Array(MAX_SEGMENTS * POSITION_FLOATS_PER_SEGMENT);
    this._colors = new Float32Array(MAX_SEGMENTS * COLOR_FLOATS_PER_SEGMENT);

    this._posBuf = new PixiBuffer({
      data: this._positions,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      label: 'skid-positions',
      shrinkToFit: false,
    });
    this._colBuf = new PixiBuffer({
      data: this._colors,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
      label: 'skid-colors',
      shrinkToFit: false,
    });

    const geometry = new Geometry3D({
      attributes: {
        aPosition: {
          buffer: this._posBuf,
          format: 'float32x3',
          stride: FLOATS_PER_POSITION * 4,
          offset: 0,
        },
        aColor: {
          buffer: this._colBuf,
          format: 'float32x4',
          stride: FLOATS_PER_COLOR * 4,
          offset: 0,
        },
      },
      topology: 'triangle-list',
      dynamic: true,
    });

    this.mesh = new Mesh3D({
      geometry,
      material,
      castShadow: false,
      receiveShadow: false,
    });
    parent.addChild(this.mesh);
  }

  public sample(
    wx: number,
    wy: number,
    wz: number,
    slip: number,
    surface: SurfaceKind,
    emit: boolean,
  ): void {
    if (!emit || surface === 'water') {
      this._active = false;
      return;
    }
    if (this._active) {
      const dx = wx - this._prev.x;
      const dz = wz - this._prev.z;
      const len = Math.hypot(dx, dz);
      if (len > 3.0) {
        // Teleported / reset car
        this._prev.set(wx, wy, wz);
        return;
      }
      if (len >= MIN_SEGMENT_LEN) {
        const alpha = Math.min(0.75, Math.max(0.12, (slip - 0.55) * 0.55));
        const rgb: [number, number, number] =
          surface === 'dirt'
            ? [0.36, 0.24, 0.13]
            : surface === 'grass'
              ? [0.22, 0.28, 0.14]
              : [0.08, 0.08, 0.09];
        this._write(wx, wy, wz, dx / len, dz / len, rgb, alpha);
        this._prev.set(wx, wy, wz);
      }
    } else {
      this._prev.set(wx, wy, wz);
      this._active = true;
    }
  }

  private _write(
    cx: number,
    cy: number,
    cz: number,
    dirX: number,
    dirZ: number,
    rgb: [number, number, number],
    alpha: number,
  ): void {
    const sideX = dirZ * HALF_WIDTH;
    const sideZ = -dirX * HALF_WIDTH;
    const px = this._prev.x;
    const py = this._prev.y;
    const pz = this._prev.z;

    const pLx = px + sideX;
    const pLz = pz + sideZ;
    const pRx = px - sideX;
    const pRz = pz - sideZ;
    const cLx = cx + sideX;
    const cLz = cz + sideZ;
    const cRx = cx - sideX;
    const cRz = cz - sideZ;

    const po = this._segIdx * POSITION_FLOATS_PER_SEGMENT;
    const P = this._positions;
    P[po + 0] = pLx; P[po + 1] = py; P[po + 2] = pLz;
    P[po + 3] = pRx; P[po + 4] = py; P[po + 5] = pRz;
    P[po + 6] = cLx; P[po + 7] = cy; P[po + 8] = cLz;
    P[po + 9] = pRx; P[po + 10] = py; P[po + 11] = pRz;
    P[po + 12] = cRx; P[po + 13] = cy; P[po + 14] = cRz;
    P[po + 15] = cLx; P[po + 16] = cy; P[po + 17] = cLz;

    const co = this._segIdx * COLOR_FLOATS_PER_SEGMENT;
    const C = this._colors;
    for (let i = 0; i < VERTS_PER_SEGMENT; i++) {
      const o = co + i * 4;
      C[o + 0] = rgb[0];
      C[o + 1] = rgb[1];
      C[o + 2] = rgb[2];
      C[o + 3] = alpha;
    }

    this._posBuf.update(POSITION_BYTES_PER_SEGMENT, po * 4);
    this._colBuf.update(COLOR_BYTES_PER_SEGMENT, co * 4);
    this._segIdx = (this._segIdx + 1) % MAX_SEGMENTS;
  }
}

export class DriftMarks {
  private readonly _trails: [WheelTrail, WheelTrail, WheelTrail, WheelTrail];

  constructor(parent: Container3D) {
    const mat = new FlatMaterial({
      baseColor: [1, 1, 1, 1],
      vertexColors: true,
      alphaMode: 'blend',
      doubleSided: true,
    });
    mat.state.polygonOffset = -4;
    this._trails = [
      new WheelTrail(parent, mat),
      new WheelTrail(parent, mat),
      new WheelTrail(parent, mat),
      new WheelTrail(parent, mat),
    ];
  }

  public update(
    wheelWorld: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]],
    wheelSlip: [number, number, number, number],
    speedMs: number,
    surface: SurfaceKind,
  ): void {
    for (let i = 0; i < 4; i++) {
      const [wx, wy, wz] = wheelWorld[i];
      const threshold = surface === 'dirt' ? 0.42 : 0.62;
      const emit = speedMs > 1.8 && wheelSlip[i] > threshold;
      this._trails[i].sample(wx, wy + Y_OFFSET, wz, wheelSlip[i], surface, emit);
    }
  }
}
