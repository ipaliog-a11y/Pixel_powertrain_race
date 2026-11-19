import './style.css';
import { View3D } from '@pixi/3d';
import { Application } from 'pixi.js';
import { createHud } from './hud/lapHud';
import { FACTORY_PRESETS, PesVehicleHost } from './physics/pesBridge';
import { ProceduralRaceAudio } from './race/audio';
import { bindControls, sampleIntent } from './race/controls';
import { DriftMarks } from './race/driftMarks';
import { BestGhostRecorder, createPackRacers } from './race/ghosts';
import { RaceParticles } from './race/particles';
import { createDefaultProps, resetProps, stepProps } from './race/smashables';
import { buildTabletopScene } from './race/tabletop';
import {
  buildCircuit,
  enforceBoardWalls,
  enforceBridgeRails,
  LapRaceTimer,
  sampleCircuitRoad,
  TrackTracker,
} from './race/trackCircuit';

/**
 * Pick WebGPU only when the adapter exposes 'indirect-first-instance' (required
 * by @pixi/3d on WebGPU; see pixijs.com/3d/guides/concepts/webgl-and-webgpu),
 * falling back cleanly to WebGL2 everywhere else.
 */
async function detectRendererPreference(): Promise<'webgpu' | 'webgl'> {
  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter && adapter.features.has('indirect-first-instance')) {
        return 'webgpu';
      }
    }
  } catch {
    // Fall back to WebGL2
  }
  return 'webgl';
}

async function main() {
  const preference = await detectRendererPreference();
  const app = new Application();
  await app.init({
    preference,
    resizeTo: window,
    background: '#181410',
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  const view = new View3D({
    autoResize: true,
    shadowQuality: 'high',
    toneMapping: 'aces',
    exposure: 1.0,
    background: 0x2b231c,
    environment: { skyColor: 0xcfe0f5, groundColor: 0x5c4934, intensity: 0.85 },
  });
  app.stage.addChild(view);

  const circuit = buildCircuit();
  const props = createDefaultProps();
  const packRacers = createPackRacers(circuit.nodes);

  const scene = buildTabletopScene(
    view,
    circuit.nodes,
    props,
    packRacers.map((r) => r.color),
  );
  const driftMarks = new DriftMarks(view.root);
  const particles = new RaceParticles(view.root);
  const audio = new ProceduralRaceAudio();

  let activePresetIdx = 0;
  const vehicleHost = new PesVehicleHost(FACTORY_PRESETS[activePresetIdx]);
  const tracker = new TrackTracker(circuit.spawn.nodeIndex);
  const timer = new LapRaceTimer(
    `ppr.bestLap.v1.${FACTORY_PRESETS[activePresetIdx].id}`,
    circuit.spawn.nodeIndex,
  );
  const ghostRecorder = new BestGhostRecorder(FACTORY_PRESETS[activePresetIdx].id);

  let cameraMode: 'ortho' | 'chase' = 'ortho';
  let packEnabled = true;

  function applyCameraMode() {
    if (cameraMode === 'ortho') {
      view.camera.mode = 'orthographic';
      const aspect = Math.max(1, app.screen.width / Math.max(1, app.screen.height));
      // Frame the whole 96m x 64m wooden diorama board comfortably
      view.camera.orthographicSize = aspect < 1.35 ? 64 : 54;
      view.camera.near = 1;
      view.camera.far = 320;
      view.camera.position.set(0, 82, 68);
      view.camera.lookAt({ x: 0, y: 0, z: -2 });
    } else {
      view.camera.mode = 'perspective';
      view.camera.fov = 48;
      view.camera.near = 0.25;
      view.camera.far = 320;
      const vs = vehicleHost.toViewState();
      view.camera.position.set(
        vs.x - Math.cos(vs.yaw) * 10.5,
        vs.y + 5.4,
        vs.z + Math.sin(vs.yaw) * 10.5,
      );
      view.camera.lookAt({
        x: vs.x + Math.cos(vs.yaw) * 3.5,
        y: vs.y + 0.7,
        z: vs.z - Math.sin(vs.yaw) * 3.5,
      });
    }
  }

  function resetPlayerToSpawn() {
    vehicleHost.reset(circuit.spawn.x, circuit.spawn.y, circuit.spawn.psi);
    tracker.nodeIndex = circuit.spawn.nodeIndex;
    timer.resetRun(circuit.spawn.nodeIndex);
    ghostRecorder.resetLap();
  }

  function selectPreset(index: number) {
    if (index < 0 || index >= FACTORY_PRESETS.length) return;
    activePresetIdx = index;
    const preset = FACTORY_PRESETS[index];
    vehicleHost.setPreset(preset, circuit.spawn.x, circuit.spawn.y, circuit.spawn.psi);
    tracker.nodeIndex = circuit.spawn.nodeIndex;
    timer.setStorageKey(`ppr.bestLap.v1.${preset.id}`, circuit.spawn.nodeIndex);
    ghostRecorder.setPreset(preset.id);
    scene.playerCar.setColor(preset.color);
    scene.playerCar.setStyle(preset.id === 'hilux_28d');
  }

  selectPreset(0);
  applyCameraMode();

  const hud = createHud({
    presets: FACTORY_PRESETS,
    onSelectPreset: selectPreset,
  });
  app.stage.addChild(hud.root);
  hud.layout(app.screen.width, app.screen.height);

  window.addEventListener('resize', () => {
    hud.layout(app.screen.width, app.screen.height);
    if (cameraMode === 'ortho') applyCameraMode();
  });

  bindControls({
    onSelectPreset: selectPreset,
    onToggleCamera: () => {
      cameraMode = cameraMode === 'ortho' ? 'chase' : 'ortho';
      applyCameraMode();
    },
    onToggleGhosts: () => {
      packEnabled = !packEnabled;
      scene.packGhostRigs.forEach((rig) => {
        rig.root.visible = packEnabled;
      });
    },
    onResetCar: resetPlayerToSpawn,
    onResetProps: () => resetProps(props),
    onToggleMute: () => {
      audio.toggleMute();
    },
    onAnyInteraction: () => audio.unlock(),
  });

  // Expose lightweight read-only debug hook for automated browser smoke checks
  (window as unknown as Record<string, unknown>).__PPR_DEBUG__ = {
    get renderer() {
      return preference;
    },
    get preset() {
      return FACTORY_PRESETS[activePresetIdx].shortName;
    },
    get state() {
      return vehicleHost.state;
    },
    selectPreset,
  };

  app.ticker.add((ticker) => {
    const dt = Math.min(1 / 25, ticker.deltaMS / 1000);
    const intent = sampleIntent(dt);

    const viewState = vehicleHost.step(intent, dt, (car, s) =>
      sampleCircuitRoad(circuit.nodes, tracker, car, s),
    );

    const wallHit = enforceBoardWalls(vehicleHost.state);
    const railHit = enforceBridgeRails(circuit.nodes, tracker, vehicleHost.state);
    const propHit = stepProps(props, vehicleHost.car, vehicleHost.state, viewState.y, dt);
    const maxImpact = Math.max(wallHit, railHit, propHit);
    if (maxImpact > 1.2) audio.playImpact(maxImpact);

    const hasInput =
      intent.throttle > 0.05 ||
      intent.brake > 0.05 ||
      Math.abs(intent.steer) > 0.05 ||
      intent.handbrake > 0;

    const prevBest = timer.bestLap;
    const completedLap = timer.update(
      dt,
      tracker.nodeIndex,
      hasInput,
      `ppr.bestLap.v1.${FACTORY_PRESETS[activePresetIdx].id}`,
    );

    if (timer.running) {
      ghostRecorder.recordStep(dt, timer.currentTime, viewState);
    }
    if (completedLap !== null) {
      const isNewBest = prevBest === null || completedLap <= prevBest;
      ghostRecorder.commitIfBest(isNewBest);
    }

    // Update personal-best ghost
    scene.bestGhostRig.syncFromGhost(
      timer.running ? ghostRecorder.sampleAt(timer.currentTime) : { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, visible: false },
    );

    // Step autonomous PES pack ghosts
    if (packEnabled) {
      for (let i = 0; i < packRacers.length; i++) {
        const pose = packRacers[i].step(dt, circuit.nodes, circuit.aiLine);
        scene.packGhostRigs[i].syncFromGhost(pose);
      }
    }

    const braking = intent.brake > 0.1 && !viewState.reversing;
    scene.playerCar.syncFromPes(viewState, vehicleHost.car, braking, dt);
    scene.syncEnvironment(dt, props);

    // Update chase camera when in chase mode
    if (cameraMode === 'chase') {
      const dist = 10.5;
      const height = 5.4;
      const targetCamX = viewState.x - Math.cos(viewState.yaw) * dist;
      const targetCamZ = viewState.z + Math.sin(viewState.yaw) * dist;
      const targetCamY = viewState.y + height;
      const k = 1 - Math.exp(-7 * dt);
      view.camera.position.set(
        view.camera.position.x + (targetCamX - view.camera.position.x) * k,
        view.camera.position.y + (targetCamY - view.camera.position.y) * k,
        view.camera.position.z + (targetCamZ - view.camera.position.z) * k,
      );
      view.camera.lookAt({
        x: viewState.x + Math.cos(viewState.yaw) * 3.5,
        y: viewState.y + 0.7,
        z: viewState.z - Math.sin(viewState.yaw) * 3.5,
      });
    }

    const wheelWorld = scene.playerCar.getWheelWorldPositions();
    driftMarks.update(wheelWorld, viewState.wheelSlip, viewState.speedMs, viewState.surface);
    particles.update(ticker, wheelWorld, viewState.wheelSlip, viewState.speedMs, viewState.surface);

    const maxSlip = Math.max(...viewState.wheelSlip);
    audio.update(
      viewState.rpm,
      viewState.redline,
      intent.throttle,
      viewState.boostBar,
      maxSlip,
      viewState.speedMs,
      viewState.surface,
    );

    hud.update(
      viewState,
      intent,
      timer,
      activePresetIdx,
      cameraMode,
      packEnabled,
      audio.muted,
    );
  });
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f88;padding:1rem;font:14px monospace">${String(err)}</pre>`;
});
