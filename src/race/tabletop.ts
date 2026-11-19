/**
 * Sandro-style miniature tabletop diorama builder in PixiJS 3D (@pixi/3d):
 *   - Bevelled oak baseboard + raised timber walls
 *   - Single-draw vertex-colored 3D figure-8 track ribbon (asphalt, dirt, water, overpass bridge)
 *   - Red/white apex kerbs, bridge support piers + guardrails, checkered start/finish gantry
 *   - Decorative pine clusters & animated wind turbine
 *   - Articulated CarRig (body roll/pitch/heave from PES springs, steering & spinning 4 wheels, brake lamps)
 *   - Translucent ghost cars & rigid-body smashable props
 */
import {
  ConeGeometry,
  Container3D,
  CubeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Geometry3D,
  Material3D,
  Mesh3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type View3D,
} from '@pixi/3d';
import type { PesCarData, VehicleViewState } from '../physics/types';
import type { GhostPose } from './ghosts';
import type { SmashProp } from './smashables';
import {
  BOARD_HALF_X,
  BOARD_HALF_Y,
  KERB_WIDTH,
  type TrackNode,
} from './trackCircuit';

const _up = new Vector3(0, 1, 0);
const _xAxis = new Vector3(1, 0, 0);
const _zAxis = new Vector3(0, 0, 1);
const _qYaw = new Quaternion();
const _qPitch = new Quaternion();
const _qRoll = new Quaternion();
const _qTmp = new Quaternion();
const _qSteer = new Quaternion();
const _qSpin = new Quaternion();

export type CarRig = {
  root: Container3D;
  bodyNode: Container3D;
  setColor: (hex: number) => void;
  setStyle: (isPickup: boolean) => void;
  syncFromPes: (view: VehicleViewState, car: PesCarData, braking: boolean, dt: number) => void;
  syncFromGhost: (pose: GhostPose) => void;
  getWheelWorldPositions: () => [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
};

function rgb01(hex: number): [number, number, number] {
  const srgbToLin = (c: number) => Math.pow(c / 255, 2.2);
  return [srgbToLin((hex >> 16) & 255), srgbToLin((hex >> 8) & 255), srgbToLin(hex & 255)];
}

/** Build continuous 3D road + serrated kerb mesh in one Geometry3D */
function buildTrackRibbonMesh(nodes: TrackNode[]): Mesh3D {
  const N = nodes.length;
  // Cross-section across track at each node:
  // [-hw-kw, -hw, +hw, +hw+kw] -> 3 quads per segment = 18 indices per segment
  const COLS = 4;
  const vertCount = (N + 1) * COLS;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 4);
  const indices = new Uint32Array(N * 3 * 6);

  for (let i = 0; i <= N; i++) {
    const nd = nodes[i % N];
    const hw = nd.halfWidth;
    const kw = nd.surface === 'bridge' ? 0.32 : KERB_WIDTH;
    const offsets = [-(hw + kw), -hw, hw, hw + kw];
    const elevOffsets = [
      nd.surface === 'bridge' ? 0.22 : 0.05,
      0.03,
      0.03,
      nd.surface === 'bridge' ? 0.22 : 0.05,
    ];

    const roadHex =
      nd.surface === 'dirt'
        ? 0xa4784c
        : nd.surface === 'water'
          ? 0x2e8ca8
          : nd.surface === 'bridge'
            ? 0x62656c
            : 0x2d3138;
    const stripe = Math.floor(i / 2) % 2 === 0;
    const kerbHex =
      nd.surface === 'bridge'
        ? 0xd8dce2
        : nd.surface === 'dirt'
          ? stripe
            ? 0xc9b18c
            : 0x7c5a38
          : stripe
            ? 0xe63946
            : 0xf1faee;

    for (let c = 0; c < COLS; c++) {
      const v = i * COLS + c;
      const lat = offsets[c];
      const px = nd.x + nd.nx * lat;
      const py = nd.y + nd.ny * lat;
      // Convert PES (px, py, z) -> Pixi (px, z, -py)
      positions[v * 3 + 0] = px;
      positions[v * 3 + 1] = nd.z + elevOffsets[c];
      positions[v * 3 + 2] = -py;

      normals[v * 3 + 0] = 0;
      normals[v * 3 + 1] = 1;
      normals[v * 3 + 2] = 0;

      const isKerb = c === 0 || c === 3;
      const [r, g, b] = rgb01(isKerb ? kerbHex : roadHex);
      colors[v * 4 + 0] = r;
      colors[v * 4 + 1] = g;
      colors[v * 4 + 2] = b;
      colors[v * 4 + 3] = 1;
    }
  }

  let idx = 0;
  for (let i = 0; i < N; i++) {
    for (let q = 0; q < 3; q++) {
      const a = i * COLS + q;
      const b = a + 1;
      const c = (i + 1) * COLS + q;
      const d = c + 1;
      // Double-safe CCW in Y-up
      indices[idx++] = a;
      indices[idx++] = c;
      indices[idx++] = b;
      indices[idx++] = b;
      indices[idx++] = c;
      indices[idx++] = d;
    }
  }

  const geometry = new Geometry3D({
    positions,
    normals,
    colors,
    indices,
  });

  return new Mesh3D({
    geometry,
    material: new Material3D({
      baseColor: 0xffffff,
      vertexColors: true,
      roughness: 0.85,
      metallic: 0.02,
      doubleSided: true,
    }),
    castShadow: true,
    receiveShadow: true,
  });
}

export function createCarRig(colorHex: number, alpha = 1): CarRig {
  const root = new Container3D();
  const bodyNode = new Container3D();
  root.addChild(bodyNode);

  const transparent = alpha < 0.99;
  const paintMat = new Material3D({
    baseColor: colorHex,
    roughness: 0.38,
    metallic: 0.08,
    alphaMode: transparent ? 'blend' : 'opaque',
  });
  paintMat.alpha = alpha;

  const cabinMat = new Material3D({
    baseColor: transparent ? colorHex : 0x9ad1ea,
    roughness: 0.2,
    metallic: 0.15,
    alphaMode: transparent ? 'blend' : 'opaque',
  });
  cabinMat.alpha = transparent ? alpha * 0.75 : 1;

  const trimMat = new Material3D({
    baseColor: 0x1f2226,
    roughness: 0.85,
    metallic: 0,
    alphaMode: transparent ? 'blend' : 'opaque',
  });
  trimMat.alpha = alpha;

  const brakeMat = new Material3D({
    baseColor: 0x661111,
    roughness: 0.4,
    metallic: 0,
    alphaMode: transparent ? 'blend' : 'opaque',
  });
  brakeMat.alpha = alpha;

  // Forward in PES is +X at psi=0! So car length runs along X, width along Z.
  const chassis = new Mesh3D({
    geometry: new CubeGeometry({ width: 3.9, height: 0.52, depth: 1.72 }),
    material: paintMat,
    position: { x: 0, y: 0.46, z: 0 },
    castShadow: !transparent,
    receiveShadow: !transparent,
  });

  const cabin = new Mesh3D({
    geometry: new CubeGeometry({ width: 1.85, height: 0.44, depth: 1.46 }),
    material: cabinMat,
    position: { x: -0.2, y: 0.92, z: 0 },
    castShadow: !transparent,
  });

  const bedBox = new Mesh3D({
    geometry: new CubeGeometry({ width: 1.55, height: 0.18, depth: 1.56 }),
    material: trimMat,
    position: { x: -1.18, y: 0.78, z: 0 },
    castShadow: !transparent,
  });
  bedBox.visible = false;

  const tailLights = new Mesh3D({
    geometry: new CubeGeometry({ width: 0.08, height: 0.16, depth: 1.44 }),
    material: brakeMat,
    position: { x: -1.96, y: 0.52, z: 0 },
  });

  const headLights = new Mesh3D({
    geometry: new CubeGeometry({ width: 0.08, height: 0.15, depth: 1.38 }),
    material: new Material3D({
      baseColor: 0xfff3b0,
      roughness: 0.2,
      alphaMode: transparent ? 'blend' : 'opaque',
    }),
    position: { x: 1.96, y: 0.5, z: 0 },
  });

  bodyNode.addChild(chassis, cabin, bedBox, tailLights, headLights);

  // 4 wheels [FL, FR, RL, RR]
  // At psi=0: +X is forward, -Z is left (+y_pes), +Z is right (-y_pes)
  const wheelCoords: [number, number][] = [
    [1.25, -0.84],
    [1.25, 0.84],
    [-1.25, -0.84],
    [-1.25, 0.84],
  ];
  const wheelPivots: Container3D[] = [];
  const wheelSpinAngles = [0, 0, 0, 0];

  const wheelGeo = new CylinderGeometry({ radiusTop: 0.33, radiusBottom: 0.33, height: 0.26 });
  const hubGeo = new CylinderGeometry({ radiusTop: 0.19, radiusBottom: 0.19, height: 0.27 });
  const hubMat = new Material3D({
    baseColor: 0xd8dde6,
    roughness: 0.4,
    metallic: 0.35,
    alphaMode: transparent ? 'blend' : 'opaque',
  });
  hubMat.alpha = alpha;

  for (const [wx, wz] of wheelCoords) {
    const pivot = new Container3D({ position: { x: wx, y: 0.33, z: wz } });
    // Cylinder axis is +Y; rotate 90deg around X so axle aligns with Z!
    const tyre = new Mesh3D({
      geometry: wheelGeo,
      material: trimMat,
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      castShadow: !transparent,
    });
    const hub = new Mesh3D({
      geometry: hubGeo,
      material: hubMat,
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
    });
    pivot.addChild(tyre, hub);
    root.addChild(pivot);
    wheelPivots.push(pivot);
  }

  return {
    root,
    bodyNode,
    setColor(hex: number) {
      paintMat.baseColor = hex;
    },
    setStyle(isPickup: boolean) {
      if (isPickup) {
        chassis.scale.set(1.18, 1.16, 1.08);
        cabin.position.set(0.32, 1.02, 0);
        cabin.scale.set(0.88, 1.15, 1.04);
        bedBox.visible = true;
      } else {
        chassis.scale.set(1, 1, 1);
        cabin.position.set(-0.2, 0.92, 0);
        cabin.scale.set(1, 1, 1);
        bedBox.visible = false;
      }
    },
    syncFromPes(view: VehicleViewState, car: PesCarData, braking: boolean, dt: number) {
      root.position.set(view.x, view.y - view.wheelZu[0] * 0.15, view.z);
      _qYaw.setFromAxisAngle(_up, view.yaw);
      root.quaternion.copyFrom(_qYaw);

      // PES pitch (+nose down under braking -> rotate around -Z when facing +X)
      // PES roll (+lean right in left turn -> rotate around +X when facing +X)
      _qRoll.setFromAxisAngle(_xAxis, view.roll * 1.35);
      _qPitch.setFromAxisAngle(_zAxis, view.pitch * 1.35);
      _qTmp.copyFrom(_qRoll).multiply(_qPitch);
      bodyNode.quaternion.copyFrom(_qTmp);

      brakeMat.baseColor = braking ? 0xff2a2a : 0x5c1010;

      const aVis = Math.min(1.55, Math.max(1.1, car.a));
      const bVis = Math.min(1.55, Math.max(1.1, car.b));
      const tVis = Math.min(0.95, Math.max(0.76, car.tF * 0.52));
      const posList: [number, number][] = [
        [aVis, -tVis],
        [aVis, tVis],
        [-bVis, -tVis],
        [-bVis, tVis],
      ];

      for (let i = 0; i < 4; i++) {
        const pivot = wheelPivots[i];
        pivot.position.set(posList[i][0], 0.33 + view.wheelZu[i], posList[i][1]);
        wheelSpinAngles[i] -= view.wheelOmega[i] * dt;
        const steer = i < 2 ? view.frontSteerRad : 0;
        _qSteer.setFromAxisAngle(_up, steer);
        _qSpin.setFromAxisAngle(_zAxis, wheelSpinAngles[i]);
        _qSteer.multiply(_qSpin);
        pivot.quaternion.copyFrom(_qSteer);
      }
    },
    syncFromGhost(pose: GhostPose) {
      root.visible = pose.visible;
      if (!pose.visible) return;
      root.position.set(pose.x, pose.y, pose.z);
      _qYaw.setFromAxisAngle(_up, pose.yaw);
      root.quaternion.copyFrom(_qYaw);
      _qRoll.setFromAxisAngle(_xAxis, pose.roll * 1.2);
      _qPitch.setFromAxisAngle(_zAxis, pose.pitch * 1.2);
      _qTmp.copyFrom(_qRoll).multiply(_qPitch);
      bodyNode.quaternion.copyFrom(_qTmp);
    },
    getWheelWorldPositions() {
      const c = Math.cos(root.rotation.y);
      const sn = Math.sin(root.rotation.y);
      // Note: root.quaternion has Y-axis rotation; extract directly from wheelPivots in root frame
      return wheelPivots.map((p) => {
        const lx = p.position.x;
        const lz = p.position.z;
        // Y-axis rotation in right-handed coords: x' = x cos + z sin, z' = -x sin + z cos
        const q = root.quaternion;
        const yaw = 2 * Math.atan2(q.y, q.w);
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        void c;
        void sn;
        return [
          root.position.x + lx * cy + lz * sy,
          root.position.y,
          root.position.z - lx * sy + lz * cy,
        ] as [number, number, number];
      }) as [
        [number, number, number],
        [number, number, number],
        [number, number, number],
        [number, number, number],
      ];
    },
  };
}

export function buildTabletopScene(
  view: View3D,
  nodes: TrackNode[],
  props: SmashProp[],
  packColors: number[],
) {
  const sun = new DirectionalLight({
    color: 0xfff3dc,
    intensity: 2.5,
    castShadow: true,
    shadow: {
      cascades: 3,
      maxDistance: 140,
      bias: 0.0008,
      normalBias: 0.04,
    },
  });
  sun.position.set(34, 58, 28);
  sun.lookAt({ x: 0, y: 0, z: 0 });
  view.root.addChild(sun);

  // Wooden tabletop baseboard + raised border rails
  const woodMat = new Material3D({ baseColor: 0x8b5a2b, roughness: 0.82, metallic: 0 });
  const darkWoodMat = new Material3D({ baseColor: 0x663f1b, roughness: 0.85, metallic: 0 });
  const boardW = BOARD_HALF_X * 2 + 4;
  const boardD = BOARD_HALF_Y * 2 + 4;

  const baseBoard = new Mesh3D({
    geometry: new CubeGeometry({ width: boardW, height: 1.6, depth: boardD }),
    material: woodMat,
    position: { x: 0, y: -0.82, z: 0 },
    castShadow: false,
    receiveShadow: true,
  });
  view.root.addChild(baseBoard);

  // 4 timber rim walls
  const rails: [number, number, number, number][] = [
    [0, -(BOARD_HALF_Y + 0.6), boardW, 1.2],
    [0, BOARD_HALF_Y + 0.6, boardW, 1.2],
    [-(BOARD_HALF_X + 0.6), 0, 1.2, boardD],
    [BOARD_HALF_X + 0.6, 0, 1.2, boardD],
  ];
  for (const [rx, rz, rw, rd] of rails) {
    view.root.addChild(
      new Mesh3D({
        geometry: new CubeGeometry({ width: rw, height: 0.9, depth: rd }),
        material: darkWoodMat,
        position: { x: rx, y: 0.35, z: rz },
        castShadow: true,
        receiveShadow: true,
      }),
    );
  }

  // Lush matte grass top surface
  const grass = new Mesh3D({
    geometry: new PlaneGeometry({ width: BOARD_HALF_X * 2, height: BOARD_HALF_Y * 2 }),
    material: new Material3D({ baseColor: 0x4f7a42, roughness: 0.96, metallic: 0 }),
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    castShadow: false,
    receiveShadow: true,
  });
  view.root.addChild(grass);

  // Decorative shallow water pond around the water splash zone (u ~ 4.65)
  const waterNode = nodes[Math.floor((4.65 / (Math.PI * 2)) * nodes.length)];
  const pondMat = new Material3D({
    baseColor: 0x3ba8c9,
    roughness: 0.18,
    metallic: 0.08,
    alphaMode: 'blend',
  });
  pondMat.alpha = 0.78;
  const pond = new Mesh3D({
    geometry: new CylinderGeometry({ radiusTop: 11.5, radiusBottom: 11.5, height: 0.08 }),
    material: pondMat,
    position: { x: waterNode.x, y: 0.035, z: -waterNode.y },
    receiveShadow: true,
  });
  view.root.addChild(pond);

  // Continuous 3D figure-8 ribbon
  const trackMesh = buildTrackRibbonMesh(nodes);
  view.root.addChild(trackMesh);

  // Bridge piers under the elevated overpass
  const pierMat = new Material3D({ baseColor: 0x8e9299, roughness: 0.85, metallic: 0 });
  for (const idx of [232, 236, 4, 8]) {
    const nd = nodes[idx % nodes.length];
    if (nd.z > 0.7) {
      for (const side of [-1, 1]) {
        const px = nd.x + nd.nx * (nd.halfWidth - 0.6) * side;
        const py = nd.y + nd.ny * (nd.halfWidth - 0.6) * side;
        view.root.addChild(
          new Mesh3D({
            geometry: new CylinderGeometry({ radiusTop: 0.32, radiusBottom: 0.38, height: nd.z }),
            material: pierMat,
            position: { x: px, y: nd.z * 0.5, z: -py },
            castShadow: true,
            receiveShadow: true,
          }),
        );
      }
    }
  }

  // Start / Finish Gantry at node 220
  const fin = nodes[220];
  const gantryRoot = new Container3D({
    position: { x: fin.x, y: fin.z, z: -fin.y },
    rotation: { x: 0, y: fin.psi, z: 0 },
  });
  const gantryMat = new Material3D({ baseColor: 0xf4f1ea, roughness: 0.6 });
  const bannerMat = new Material3D({ baseColor: 0xffbe0b, roughness: 0.5 });
  const spanZ = fin.halfWidth + 1.1;
  gantryRoot.addChild(
    new Mesh3D({
      geometry: new CubeGeometry({ width: 0.35, height: 4.2, depth: 0.35 }),
      material: gantryMat,
      position: { x: 0, y: 2.1, z: -spanZ },
      castShadow: true,
    }),
    new Mesh3D({
      geometry: new CubeGeometry({ width: 0.35, height: 4.2, depth: 0.35 }),
      material: gantryMat,
      position: { x: 0, y: 2.1, z: spanZ },
      castShadow: true,
    }),
    new Mesh3D({
      geometry: new CubeGeometry({ width: 0.5, height: 0.85, depth: spanZ * 2 + 0.5 }),
      material: bannerMat,
      position: { x: 0, y: 4.1, z: 0 },
      castShadow: true,
    }),
    new Mesh3D({
      geometry: new CubeGeometry({ width: 0.7, height: 0.02, depth: fin.halfWidth * 2 }),
      material: gantryMat,
      position: { x: 0, y: 0.045, z: 0 },
    }),
  );
  view.root.addChild(gantryRoot);

  // Miniature diorama pine trees around empty board corners & infields
  const trunkGeo = new CylinderGeometry({ radiusTop: 0.22, radiusBottom: 0.28, height: 1.2 });
  const foliageGeo1 = new ConeGeometry({ radius: 1.35, height: 2.5 });
  const foliageGeo2 = new ConeGeometry({ radius: 1.0, height: 2.0 });
  const trunkMat = new Material3D({ baseColor: 0x6b4423, roughness: 0.9 });
  const leafMatA = new Material3D({ baseColor: 0x2d6a4f, roughness: 0.88 });
  const leafMatB = new Material3D({ baseColor: 0x40916c, roughness: 0.88 });

  const treeSpots: [number, number, number][] = [
    [-42, -25, 1.15],
    [-39, -27, 0.9],
    [-43, 24, 1.1],
    [-38, 27, 0.85],
    [42, 25, 1.2],
    [39, 27, 0.95],
    [42, -24, 1.05],
    [38, -26, 0.85],
    [0, 26, 1.1],
    [4, 27, 0.85],
    [19, 0, 0.95],
    [-19, 1, 1.0],
  ];
  for (let i = 0; i < treeSpots.length; i++) {
    const [tx, tz, sc] = treeSpots[i];
    const t = new Container3D({ position: { x: tx, y: 0, z: tz }, scale: { x: sc, y: sc, z: sc } });
    t.addChild(
      new Mesh3D({ geometry: trunkGeo, material: trunkMat, position: { x: 0, y: 0.6, z: 0 }, castShadow: true }),
      new Mesh3D({
        geometry: foliageGeo1,
        material: i % 2 === 0 ? leafMatA : leafMatB,
        position: { x: 0, y: 2.1, z: 0 },
        castShadow: true,
      }),
      new Mesh3D({
        geometry: foliageGeo2,
        material: i % 2 === 0 ? leafMatB : leafMatA,
        position: { x: 0, y: 3.3, z: 0 },
        castShadow: true,
      }),
    );
    view.root.addChild(t);
  }

  // Animated miniature wind turbine (direct nod to Sandro's tabletop diorama!)
  const turbineRoot = new Container3D({ position: { x: -21, y: 0, z: 18 } });
  const towerMat = new Material3D({ baseColor: 0xedf2f4, roughness: 0.5 });
  turbineRoot.addChild(
    new Mesh3D({
      geometry: new CylinderGeometry({ radiusTop: 0.22, radiusBottom: 0.42, height: 7.5 }),
      material: towerMat,
      position: { x: 0, y: 3.75, z: 0 },
      castShadow: true,
    }),
  );
  const rotor = new Container3D({ position: { x: 0.3, y: 7.4, z: 0 } });
  for (let b = 0; b < 3; b++) {
    const arm = new Container3D({ rotation: { x: (b * Math.PI * 2) / 3, y: 0, z: 0 } });
    arm.addChild(
      new Mesh3D({
        geometry: new CubeGeometry({ width: 0.1, height: 2.9, depth: 0.32 }),
        material: towerMat,
        position: { x: 0.08, y: 1.45, z: 0 },
        castShadow: true,
      }),
    );
    rotor.addChild(arm);
  }
  turbineRoot.addChild(rotor);
  view.root.addChild(turbineRoot);

  // Smashable prop meshes
  const crateGeo = new CubeGeometry({ width: 0.84, height: 0.84, depth: 0.84 });
  const barrelGeo = new CylinderGeometry({ radiusTop: 0.4, radiusBottom: 0.4, height: 0.96 });
  const coneGeo = new ConeGeometry({ radius: 0.28, height: 0.64 });
  const ballGeo = new SphereGeometry({ radius: 0.85, widthSegments: 20, heightSegments: 14 });

  const propMeshes = props.map((p) => {
    const geo =
      p.kind === 'crate'
        ? crateGeo
        : p.kind === 'barrel'
          ? barrelGeo
          : p.kind === 'cone'
            ? coneGeo
            : ballGeo;
    const mesh = new Mesh3D({
      geometry: geo,
      material: new Material3D({
        baseColor: p.color,
        roughness: p.kind === 'ball' ? 0.3 : 0.72,
        metallic: p.kind === 'barrel' ? 0.15 : 0,
      }),
      castShadow: true,
      receiveShadow: true,
    });
    view.root.addChild(mesh);
    return mesh;
  });

  // Personal-best ghost car + pack ghost cars
  const bestGhostRig = createCarRig(0xffffff, 0.36);
  bestGhostRig.root.visible = false;
  view.root.addChild(bestGhostRig.root);

  const packGhostRigs = packColors.map((col) => {
    const rig = createCarRig(col, 0.44);
    view.root.addChild(rig.root);
    return rig;
  });

  // Player car
  const playerCar = createCarRig(0xe85d04, 1);
  view.root.addChild(playerCar.root);

  return {
    sun,
    playerCar,
    bestGhostRig,
    packGhostRigs,
    syncEnvironment(dt: number, propsNow: SmashProp[]) {
      rotor.rotation.x += dt * 1.9;
      for (let i = 0; i < propsNow.length; i++) {
        const p = propsNow[i];
        const m = propMeshes[i];
        m.position.set(p.x, p.z, -p.y);
        m.rotation.set(p.pitch, p.yaw, p.roll);
      }
    },
  };
}
