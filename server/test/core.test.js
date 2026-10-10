import test from 'node:test';
import assert from 'node:assert/strict';
import { sign } from '../src/ecoflow.js';
import { extractMetrics, flatten } from '../src/metrics.js';
import { energyStep } from '../src/energy.js';
import { gridDown, BlackoutTracker } from '../src/blackout.js';
import { lastDays, dayKey } from '../src/stats.js';

test('sign: сортує параметри і додає accessKey/nonce/timestamp', () => {
  const a = sign({ sn: 'X', b: '1' }, { accessKey: 'AK', secretKey: 'SK', nonce: '123456', timestamp: '1' });
  const b = sign({ b: '1', sn: 'X' }, { accessKey: 'AK', secretKey: 'SK', nonce: '123456', timestamp: '1' });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('extractMetrics: мВ→В, десяті Вт сонця, похідний вхід', () => {
  const m = extractMetrics({
    'bms_bmsStatus.soc': 64,
    'inv.acInVol': 229500,
    'mppt.inWatts': 1200,
    'inv.inputWatts': 100,
    'pd.wattsOutSum': 80,
  });
  assert.equal(m.soc, 64);
  assert.equal(m.acInV, 229.5);
  assert.equal(m.solarW, 120);
  assert.equal(m.inW, 220); // 100 + 120, бо pd.wattsInSum відсутній
});

test('flatten: вкладені об’єкти → ключі через крапку', () => {
  assert.deepEqual(flatten({ pd: { soc: 5 }, a: 1 }), { 'pd.soc': 5, a: 1 });
});

test('energyStep: 360 Вт × 10 с = 1 Вт·год', () => {
  assert.equal(energyStep({ inW: 360 }, 10).inWh, 1);
});

test('gridDown: напруга і евристика', () => {
  assert.equal(gridDown({ acInV: 0 }), true);
  assert.equal(gridDown({ acInV: 230 }), false);
  assert.equal(gridDown({ acInW: 0, outW: 50 }), true);
  assert.equal(gridDown({ acInW: 60, outW: 50 }), false);
  assert.equal(gridDown({ acInW: 0, outW: 0 }), null);
  assert.equal(gridDown({}), null);
});

test('BlackoutTracker: дебаунс, старт з моменту першого падіння', () => {
  const t = new BlackoutTracker(30);
  assert.equal(t.update(true, 100), null);
  assert.equal(t.update(true, 120), null);
  assert.deepEqual(t.update(true, 135), { type: 'start', ts: 100 });
  assert.equal(t.update(false, 200), null);
  assert.equal(t.update(true, 210), null); // блимнуло — скинули кандидата на кінець
  assert.equal(t.update(false, 300), null);
  assert.deepEqual(t.update(false, 331), { type: 'end', ts: 300 });
  assert.equal(t.update(null, 400), null);
});

test('lastDays: послідовні дні, останній — сьогодні за київським часом', () => {
  const now = Date.parse('2026-10-11T22:30:00Z') / 1000; // у Києві вже 12 жовтня
  const days = lastDays(3, now, 'Europe/Kyiv');
  assert.deepEqual(days, ['2026-10-10', '2026-10-11', '2026-10-12']);
  assert.equal(dayKey(now, 'Europe/Kyiv'), '2026-10-12');
});
