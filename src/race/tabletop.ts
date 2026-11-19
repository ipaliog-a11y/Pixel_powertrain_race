import {
  CubeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Material3D,
  Mesh3D,
  PlaneGeometry,
  View3D,
} from '@pixi/3d';
import { Container3D } from '@pixi/3d';

/** Build the tabletop diorama: wood board, figure-8 ribbon, toy car meshes. */
export function buildTabletop(view: View3D) {
  const sun = new DirectionalLight({
    color: 0xfff0d8,
    intensity: 2.6,
    castShadow: true,
    shadow: { cascades: 2 },
  });
  sun.position.set(10, 18, 8);
  sun.lookAt({ x: 0, y: 0, z: 0 });
  view.root.addChild(sun);

  const board = new Mesh3D({
    geometry: new CubeGeometry({ width: 30, height: 0.35, depth: 30 }),
    material: new Material3D({ baseColor: 0x8b5a2b, roughness: 0.85, metallic: 0 }),
    position: { x: 0, y: -0.18, z: 0 },
    castShadow: false,
    receiveShadow: true,
  });
  view.root.addChild(board);

  const felt = new Mesh3D({
    geometry: new PlaneGeometry({ width: 28, height: 28 }),
    material: new Material3D({ baseColor: 0x3d5c3a, roughness: 0.95, metallic: 0 }),
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    position: { x: 0, y: 0.01, z: 0 },
    castShadow: false,
    receiveShadow: true,
  });
  view.root.addChild(felt);

  // Figure-8 track ribbon (flat boxes along a lemniscate)
  const trackMat = new Material3D({ baseColor: 0x2a2a2e, roughness: 0.7, metallic: 0 });
  const curbMat = new Material3D({ baseColor: 0xe8e4d8, roughness: 0.8, metallic: 0 });
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const { x, z, yaw } = figureEight(t);
    const seg = new Mesh3D({
      geometry: new CubeGeometry({ width: 2.2, height: 0.06, depth: 0.9 }),
      material: trackMat,
      position: { x, y: 0.05, z },
      rotation: { x: 0, y: yaw, z: 0 },
      castShadow: false,
      receiveShadow: true,
    });
    view.root.addChild(seg);
    if (i % 4 === 0) {
      const curb = new Mesh3D({
        geometry: new CubeGeometry({ width: 0.15, height: 0.12, depth: 0.85 }),
        material: curbMat,
        position: {
          x: x + Math.cos(yaw) * 1.15,
          y: 0.08,
          z: z - Math.sin(yaw) * 1.15,
        },
        rotation: { x: 0, y: yaw, z: 0 },
      });
      view.root.addChild(curb);
    }
  }

  // Smashable-looking crates (visual only for now)
  const crateMat = new Material3D({ baseColor: 0xc4a35a, roughness: 0.75, metallic: 0 });
  for (const [cx, cz] of [
    [6, 4],
    [-7, 5],
    [5, -6],
    [-4, -7],
  ] as const) {
    const crate = new Mesh3D({
      geometry: new CubeGeometry({ width: 0.7, height: 0.7, depth: 0.7 }),
      material: crateMat,
      position: { x: cx, y: 0.4, z: cz },
      castShadow: true,
      receiveShadow: true,
    });
    view.root.addChild(crate);
  }

  const car = buildToyCar();
  view.root.addChild(car.root);
  return { car };
}

function figureEight(t: number) {
  // Lemniscate of Bernoulli, scaled
  const scale = 8;
  const s = Math.sin(t);
  const c = Math.cos(t);
  const d = 1 + s * s;
  const x = (scale * c) / d;
  const z = (scale * s * c) / d;
  const t2 = t + 0.02;
  const s2 = Math.sin(t2);
  const c2 = Math.cos(t2);
  const d2 = 1 + s2 * s2;
  const x2 = (scale * c2) / d2;
  const z2 = (scale * s2 * c2) / d2;
  const yaw = Math.atan2(x2 - x, z2 - z);
  return { x, z, yaw };
}

export type ToyCar = {
  root: Container3D;
  body: Mesh3D;
  setPose: (x: number, z: number, yaw: number) => void;
};

function buildToyCar(): ToyCar {
  const root = new Container3D();
  const bodyMat = new Material3D({ baseColor: 0xe85d04, roughness: 0.45, metallic: 0.05 });
  const glassMat = new Material3D({ baseColor: 0x9ec9e8, roughness: 0.2, metallic: 0.1 });
  const tyreMat = new Material3D({ baseColor: 0x1a1a1a, roughness: 0.9, metallic: 0 });

  const body = new Mesh3D({
    geometry: new CubeGeometry({ width: 1.1, height: 0.35, depth: 2.0 }),
    material: bodyMat,
    position: { x: 0, y: 0.35, z: 0 },
    castShadow: true,
  });
  const cabin = new Mesh3D({
    geometry: new CubeGeometry({ width: 0.95, height: 0.32, depth: 0.9 }),
    material: glassMat,
    position: { x: 0, y: 0.65, z: -0.15 },
    castShadow: true,
  });
  root.addChild(body, cabin);

  for (const [wx, wz] of [
    [-0.55, 0.65],
    [0.55, 0.65],
    [-0.55, -0.65],
    [0.55, -0.65],
  ] as const) {
    const wheel = new Mesh3D({
      geometry: new CylinderGeometry({ radiusTop: 0.22, radiusBottom: 0.22, height: 0.18 }),
      material: tyreMat,
      position: { x: wx, y: 0.22, z: wz },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      castShadow: true,
    });
    root.addChild(wheel);
  }

  return {
    root,
    body,
    setPose(x, z, yaw) {
      root.position.set(x, 0, z);
      root.rotation.set(0, yaw, 0);
    },
  };
}
