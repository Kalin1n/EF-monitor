import { db, q, inTransaction } from './db.js';

// Демо-режим: дві вигадані станції, 30 днів історії та жива симуляція з блекаутами кожні 10 хв.
const DEMO = [
  { sn: 'MOCKD3000001', name: 'Delta 3 (демо)', capWh: 1024, baseLoad: 90 },
  { sn: 'MOCKR2000002', name: 'River 2 (демо)', capWh: 256, baseLoad: 30 },
];

let seed = 42;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

function seedHistory() {
  const nowSec = Math.floor(Date.now() / 1000);
  const startHour = Math.floor(nowSec / 3600) * 3600 - 30 * 86400;
  const hasEnergy = db.prepare('SELECT 1 FROM energy_hourly WHERE sn = ? LIMIT 1');
  const tx = (dev) => inTransaction(() => {
    // блекаути: 0–2 на добу, 1–4 години
    const outages = [];
    for (let d = 30; d >= 1; d--) {
      const n = Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const start = nowSec - d * 86400 + Math.floor(rnd() * 20 * 3600);
        const dur = Math.floor((1 + rnd() * 3) * 3600);
        outages.push([start, start + dur]);
      }
    }
    for (const [s, e] of outages) {
      q.openBlackout.run(dev.sn, s, 100 - Math.floor(rnd() * 20));
      q.closeBlackout.run(e, 40 + Math.floor(rnd() * 40), dev.sn);
    }
    for (let h = startHour; h < nowSec - 3600; h += 3600) {
      const hourOfDay = new Date(h * 1000).getUTCHours();
      const evening = hourOfDay >= 16 && hourOfDay <= 21 ? 1.8 : 1;
      const out = dev.baseLoad * evening * (0.7 + rnd() * 0.6);
      const down = outages.some(([s, e]) => h >= s && h < e);
      const solar = hourOfDay >= 7 && hourOfDay <= 15 ? 20 * rnd() : 0;
      const ac = down ? 0 : out * 1.1 + (rnd() < 0.15 ? dev.capWh * 0.3 : 0);
      q.addEnergy.run({
        sn: dev.sn,
        hour: h,
        inWh: ac + solar,
        outWh: out,
        acInWh: ac,
        solarWh: solar,
        coveredSec: down || rnd() > 0.03 ? 3600 : 3000,
      });
    }
  });
  for (const dev of DEMO) if (!hasEnergy.get(dev.sn)) tx(dev);
}

export async function startMock(ingest) {
  for (const d of DEMO) ingest.ensure(d.sn, d.name);
  seedHistory();
  const soc = Object.fromEntries(DEMO.map((d) => [d.sn, 80]));

  const step = () => {
    const minute = new Date().getMinutes();
    const grid = !(minute % 10 === 3 || minute % 10 === 4); // «блекаут» 2 хв кожні 10 хв
    for (const d of DEMO) {
      const load = d.baseLoad * (0.8 + 0.4 * Math.sin(Date.now() / 20000));
      const charge = grid && soc[d.sn] < 100 ? d.capWh * 0.25 : 0;
      soc[d.sn] = Math.min(100, Math.max(5, soc[d.sn] + ((charge * (grid ? 0.9 : 0) - load) * 3) / 3600 / d.capWh * 100));
      const acIn = grid ? load * 1.1 + charge : 0;
      ingest.feed(d.sn, {
        'bms_bmsStatus.soc': Math.round(soc[d.sn]),
        'pd.wattsInSum': acIn,
        'pd.wattsOutSum': load,
        'inv.inputWatts': acIn,
        'inv.acInVol': grid ? 230000 : 0, // мВ — як у реальних даних деяких моделей
        'mppt.inWatts': 0,
      });
    }
  };
  step();
  setInterval(step, 3000);
}
