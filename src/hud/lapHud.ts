/**
 * Single-stage PixiJS 2D HUD overlaid on View3D:
 *   - Top-left: Lap, Live Time, Best, Delta, Medal targets, Surface pill
 *   - Top-right: PES Factory Garage selector [1..6] + Camera / Ghost / Audio status
 *   - Bottom-right: Speed (km/h), Gear, RPM bar, Turbo Boost bar, Drift/Slip bar, ABS/TC/ESP lamps
 */
import { Container, Graphics, Text } from 'pixi.js';
import type { DriveIntent, ExportedPreset, VehicleViewState } from '../physics/types';
import { MEDAL_TIMES, type LapRaceTimer } from '../race/trackCircuit';

function fmtTime(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export type HudOptions = {
  presets: ExportedPreset[];
  onSelectPreset: (idx: number) => void;
};

export function createHud(opts: HudOptions) {
  const root = new Container();
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  // --- Top-left timing card ---
  const leftCard = new Container({ x: 16, y: 16 });
  const leftBg = new Graphics()
    .roundRect(0, 0, 268, 152, 10)
    .fill({ color: 0x0f1216, alpha: 0.78 })
    .stroke({ color: 0xffffff, alpha: 0.12, width: 1 });
  leftCard.addChild(leftBg);

  const titleTxt = new Text({
    text: 'TABLETOP GRAND PRIX · PES 1kHz',
    style: { fontFamily: mono, fontSize: 10, fontWeight: '700', fill: 0xf7b801, letterSpacing: 0.8 },
  });
  titleTxt.position.set(14, 10);

  const lapClockTxt = new Text({
    text: '0:00.00',
    style: { fontFamily: mono, fontSize: 28, fontWeight: '700', fill: 0xf8f9fa },
  });
  lapClockTxt.position.set(14, 28);

  const lapNumTxt = new Text({
    text: 'LAP 1',
    style: { fontFamily: mono, fontSize: 12, fontWeight: '700', fill: 0xadb5bd },
  });
  lapNumTxt.anchor.set(1, 0);
  lapNumTxt.position.set(254, 34);

  const bestTxt = new Text({
    text: 'BEST  --:--.--   LAST  --:--.--',
    style: { fontFamily: mono, fontSize: 11, fill: 0xced4da },
  });
  bestTxt.position.set(14, 68);

  const deltaTxt = new Text({
    text: '',
    style: { fontFamily: mono, fontSize: 12, fontWeight: '700', fill: 0x5af168 },
  });
  deltaTxt.position.set(14, 88);

  const medalsTxt = new Text({
    text: `MEDALS  Au ${MEDAL_TIMES.gold.toFixed(1)}s · Ag ${MEDAL_TIMES.silver.toFixed(1)}s · Cu ${MEDAL_TIMES.bronze.toFixed(1)}s`,
    style: { fontFamily: mono, fontSize: 10, fill: 0x8d99ae },
  });
  medalsTxt.position.set(14, 110);

  const surfaceTxt = new Text({
    text: 'SURFACE: ASPHALT',
    style: { fontFamily: mono, fontSize: 11, fontWeight: '700', fill: 0x90e0ef },
  });
  surfaceTxt.position.set(14, 129);

  leftCard.addChild(titleTxt, lapClockTxt, lapNumTxt, bestTxt, deltaTxt, medalsTxt, surfaceTxt);
  root.addChild(leftCard);

  // --- Top-right PES Factory Garage selector ---
  const rightCard = new Container();
  const rightBg = new Graphics()
    .roundRect(0, 0, 310, 174, 10)
    .fill({ color: 0x0f1216, alpha: 0.78 })
    .stroke({ color: 0xffffff, alpha: 0.12, width: 1 });
  rightCard.addChild(rightBg);

  const garageTitle = new Text({
    text: 'PES FACTORY GARAGE [1-6]',
    style: { fontFamily: mono, fontSize: 10, fontWeight: '700', fill: 0xf7b801, letterSpacing: 0.8 },
  });
  garageTitle.position.set(12, 10);
  rightCard.addChild(garageTitle);

  const pillRows: { bg: Graphics; label: Text }[] = [];
  opts.presets.forEach((p, idx) => {
    const row = new Container({ x: 10, y: 28 + idx * 19 });
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.on('pointerdown', () => opts.onSelectPreset(idx));

    const bg = new Graphics().roundRect(0, 0, 290, 17, 4).fill({ color: 0x1e242c, alpha: 0.6 });
    const hp = p.published?.powerHp ? `${p.published.powerHp}hp` : '';
    const label = new Text({
      text: `[${idx + 1}] ${p.shortName.padEnd(16, ' ')} ${p.car.drive.toUpperCase()} ${String(p.car.m).padStart(4, ' ')}kg ${hp}`,
      style: { fontFamily: mono, fontSize: 10.5, fill: 0xd8dee9 },
    });
    label.position.set(6, 2);
    row.addChild(bg, label);
    rightCard.addChild(row);
    pillRows.push({ bg, label });
  });

  const hotkeysTxt = new Text({
    text: '[C] Cam: ORTHO  [G] Pack: ON  [R] Car  [B] Props  [M] Sound',
    style: { fontFamily: mono, fontSize: 9.5, fill: 0x9aa5b1 },
  });
  hotkeysTxt.position.set(12, 150);
  rightCard.addChild(hotkeysTxt);
  root.addChild(rightCard);

  // --- Bottom-right Telemetry Cluster ---
  const teleCard = new Container();
  const teleBg = new Graphics()
    .roundRect(0, 0, 276, 128, 10)
    .fill({ color: 0x0f1216, alpha: 0.82 })
    .stroke({ color: 0xffffff, alpha: 0.14, width: 1 });
  teleCard.addChild(teleBg);

  const speedTxt = new Text({
    text: '0',
    style: { fontFamily: mono, fontSize: 34, fontWeight: '700', fill: 0xffffff },
  });
  speedTxt.position.set(16, 10);

  const unitTxt = new Text({
    text: 'km/h',
    style: { fontFamily: mono, fontSize: 11, fill: 0xadb5bd },
  });
  unitTxt.position.set(96, 28);

  const gearTxt = new Text({
    text: 'G1',
    style: { fontFamily: mono, fontSize: 24, fontWeight: '700', fill: 0xf7b801 },
  });
  gearTxt.anchor.set(1, 0);
  gearTxt.position.set(260, 14);

  const rpmTxt = new Text({
    text: '900 rpm · 0 Nm',
    style: { fontFamily: mono, fontSize: 11, fill: 0xced4da },
  });
  rpmTxt.position.set(16, 52);

  const barsGfx = new Graphics();
  teleCard.addChild(speedTxt, unitTxt, gearTxt, rpmTxt, barsGfx);

  const driftLabel = new Text({
    text: 'SLIP / DRIFT',
    style: { fontFamily: mono, fontSize: 9.5, fill: 0x9aa5b1 },
  });
  driftLabel.position.set(16, 86);

  const aidsTxt = new Text({
    text: 'ABS · TC · ESP',
    style: { fontFamily: mono, fontSize: 10.5, fontWeight: '700', fill: 0x5c677d },
  });
  aidsTxt.anchor.set(1, 0);
  aidsTxt.position.set(260, 105);

  const controlsHint = new Text({
    text: 'WASD/Arrows · Space Handbrake',
    style: { fontFamily: mono, fontSize: 9.5, fill: 0x8d99ae },
  });
  controlsHint.position.set(16, 106);

  teleCard.addChild(driftLabel, aidsTxt, controlsHint);
  root.addChild(teleCard);

  return {
    root,
    layout(screenW: number, screenH: number) {
      rightCard.position.set(Math.max(300, screenW - 326), 16);
      teleCard.position.set(Math.max(16, screenW - 292), Math.max(190, screenH - 144));
    },
    update(
      view: VehicleViewState,
      _intent: DriveIntent,
      timer: LapRaceTimer,
      activeIdx: number,
      cameraMode: 'ortho' | 'chase',
      packEnabled: boolean,
      muted: boolean,
    ) {
      lapClockTxt.text = fmtTime(timer.currentTime);
      lapNumTxt.text = `LAP ${timer.lap}`;
      bestTxt.text = `BEST ${fmtTime(timer.bestLap)}   LAST ${fmtTime(timer.lastLap)}`;

      if (timer.lastDelta !== null) {
        const sign = timer.lastDelta <= 0 ? '' : '+';
        deltaTxt.text = `LAST DELTA ${sign}${timer.lastDelta.toFixed(2)}s`;
        deltaTxt.style.fill = timer.lastDelta <= 0 ? 0x5af168 : 0xff6b6b;
      } else {
        deltaTxt.text = timer.running ? 'COMPLETE 4 SECTORS FOR VALID LAP' : 'PRESS GAS TO START TIMER';
        deltaTxt.style.fill = 0xadb5bd;
      }

      const surfColors: Record<VehicleViewState['surface'], number> = {
        asphalt: 0xadb5bd,
        bridge: 0xe9c46a,
        dirt: 0xdda15e,
        grass: 0x80ed99,
        water: 0x48cae4,
      };
      surfaceTxt.text = `SURFACE: ${view.surface.toUpperCase()}`;
      surfaceTxt.style.fill = surfColors[view.surface];

      pillRows.forEach((row, idx) => {
        row.bg.clear();
        const selected = idx === activeIdx;
        row.bg
          .roundRect(0, 0, 290, 17, 4)
          .fill({ color: selected ? 0x2b3a4a : 0x1a1f26, alpha: selected ? 0.95 : 0.55 });
        if (selected) {
          row.bg.stroke({ color: 0xf7b801, width: 1, alpha: 0.9 });
        }
        row.label.style.fill = selected ? 0xffffff : 0xb8c2cc;
      });

      hotkeysTxt.text = `[C] Cam:${cameraMode.toUpperCase()} [G] Pack:${packEnabled ? 'ON' : 'OFF'} [R] Reset [B] Props [M] ${muted ? 'MUTED' : 'SFX'}`;

      const kmh = Math.round(view.speedMs * 3.6);
      speedTxt.text = String(kmh);
      gearTxt.text = view.gear < 0 ? 'R' : view.gear === 0 ? 'N' : `G${view.gear}`;
      gearTxt.style.fill = view.gear < 0 ? 0xff6b6b : 0xf7b801;

      const boostStr = view.boostBar > 0.04 ? ` · +${view.boostBar.toFixed(2)} bar` : '';
      rpmTxt.text = `${Math.round(view.rpm)} / ${view.redline} rpm · ${Math.round(view.engineTorqueNm)} Nm${boostStr}`;

      const rpmFrac = Math.max(0, Math.min(1, view.rpm / Math.max(1000, view.redline)));
      const maxSlip = Math.max(...view.wheelSlip);
      const slipFrac = Math.max(0, Math.min(1, maxSlip / 1.6));

      barsGfx.clear();
      // RPM bar background + fill
      barsGfx.roundRect(16, 70, 244, 10, 4).fill({ color: 0x222831 });
      const rpmColor = rpmFrac > 0.92 ? 0xff3b3b : rpmFrac > 0.75 ? 0xf7b801 : 0x38b000;
      barsGfx.roundRect(16, 70, Math.max(4, 244 * rpmFrac), 10, 4).fill({ color: rpmColor });

      // Slip / Drift bar
      barsGfx.roundRect(102, 88, 158, 8, 4).fill({ color: 0x222831 });
      const slipColor = maxSlip > 0.95 ? 0xff6b35 : 0x4cc9f0;
      barsGfx.roundRect(102, 88, Math.max(3, 158 * slipFrac), 8, 4).fill({ color: slipColor });

      const activeAids: string[] = [];
      if (view.absActive) activeAids.push('ABS!');
      if (view.tcActive) activeAids.push('TC!');
      if (view.espActive) activeAids.push('ESP!');
      aidsTxt.text = activeAids.length > 0 ? activeAids.join(' ') : 'ABS · TC · ESP';
      aidsTxt.style.fill = activeAids.length > 0 ? 0xffbe0b : 0x495057;
    },
  };
}
