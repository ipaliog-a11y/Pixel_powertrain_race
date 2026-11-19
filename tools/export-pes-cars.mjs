#!/usr/bin/env node
/**
 * Export derived factory cars from ../Engine_simulator/index.html using its
 * built-in driveCar() serializer, together with reference 0-100 km/h sprint
 * and 100-0 km/h stop benchmarks from Engine_simulator's own stepCar() so
 * Vitest can prove bit-for-bit physics parity in Pixel_powertrain_race.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pesHtml = process.env.PES_HTML || path.resolve(rootDir, '../Engine_simulator/index.html');
const outDir = path.resolve(rootDir, 'src/physics/presets');

const SELECTED_PRESETS = [
  { id: 'mx5_na', match: 'Mazda MX-5 1.6 (NA, 1989)', color: 0xe85d04, shortName: 'MX-5 NA 1.6' },
  { id: 'ae86', match: 'Toyota Corolla Levin GT-APEX (AE86)', color: 0xf4f1ea, shortName: 'AE86 Levin' },
  { id: 'e30_m3', match: 'BMW M3 (E30, 1986)', color: 0xd62828, shortName: 'BMW E30 M3' },
  { id: 'delta_integrale', match: 'Lancia Delta HF Integrale Evoluzione (1992)', color: 0xf7b801, shortName: 'Delta Integrale' },
  { id: 'porsche_993_turbo', match: 'Porsche 911 Turbo (993, 1995)', color: 0x3a86ff, shortName: '911 Turbo (993)' },
  { id: 'hilux_28d', match: 'Toyota Hilux 2.8 D-4D (2016)', color: 0xc1121f, shortName: 'Hilux 2.8 D-4D' },
];

const chromePath = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const browser = await chromium.launch({ executablePath: chromePath });
const page = await browser.newPage();
await page.goto(pathToFileURL(pesHtml).href, { waitUntil: 'networkidle' });

const exported = await page.evaluate((targets) => {
  return targets.map((t) => {
    const preset = FACTORY_CARS.find((c) => c.name === t.match);
    if (!preset) throw new Error(`Preset not found in Engine_simulator: ${t.match}`);
    loadVehiclePreset(preset);
    const car = driveCar();
    const sprint = driveSprint(car);
    const stop = driveStop100(car);
    return {
      id: t.id,
      shortName: t.shortName,
      fullName: preset.name,
      color: t.color,
      published: preset.published || null,
      benchmarks: {
        sprint0to100s: sprint.t,
        sprintPeakSlip: sprint.slip,
        stop100to0m: stop.dist,
        stopLocked: stop.lock,
      },
      car,
    };
  });
}, SELECTED_PRESETS);

await browser.close();

mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'factoryCars.json'),
  JSON.stringify(exported, null, 2) + '\n',
  'utf8',
);

console.log(`Exported ${exported.length} PES factory cars to src/physics/presets/factoryCars.json:`);
for (const item of exported) {
  console.log(
    `  - ${item.fullName}: m=${item.car.m} kg, drive=${item.car.drive}, redline=${item.car.redline} rpm, 0-100=${item.benchmarks.sprint0to100s?.toFixed(2)}s, 100-0=${item.benchmarks.stop100to0m.toFixed(2)}m`,
  );
}
