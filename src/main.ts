import './style.css';
import { View3D } from '@pixi/3d';
import { Application } from 'pixi.js';
import { createHud } from './hud/lapHud';
import { stepPesBridge, toySnapshotFromSpeed } from './physics/pesBridge';
import { TOY_SPEC } from './physics/types';
import { createState, stepArcade } from './race/arcadeVehicle';
import { bindControls, sampleIntent } from './race/controls';
import { buildTabletop } from './race/tabletop';

async function main() {
  const app = new Application();
  await app.init({
    preference: 'webgpu',
    resizeTo: window,
    background: '#1a1510',
    antialias: true,
  });
  document.body.appendChild(app.canvas);

  const view = new View3D({
    autoResize: true,
    shadowQuality: 'medium',
    environment: { skyColor: 0xc9d6e8, groundColor: 0x4a3b2a, intensity: 0.75 },
  });
  app.stage.addChild(view);

  const { car } = buildTabletop(view);

  // High tabletop camera — orthographic for Sandro-like diorama read
  view.camera.mode = 'orthographic';
  view.camera.orthographicSize = 14;
  view.camera.near = 0.1;
  view.camera.far = 200;
  view.camera.position.set(14, 18, 14);
  view.camera.lookAt({ x: 0, y: 0, z: 0 });

  const hud = createHud();
  app.stage.addChild(hud.root);

  let state = createState(0, -6);
  car.setPose(state.x, state.z, state.yaw);
  bindControls();

  app.ticker.add((ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    const intent = sampleIntent();
    state = stepArcade(state, intent, TOY_SPEC, dt);
    const snap = toySnapshotFromSpeed(state.speedMs);
    state = stepPesBridge(state, intent, TOY_SPEC, snap, dt);
    car.setPose(state.x, state.z, state.yaw);
    hud.update(state, intent);
  });
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f88;padding:1rem;font:14px monospace">${String(err)}\n\nWebGPU may be unavailable — try Chrome/Edge, or check the console.</pre>`;
});
