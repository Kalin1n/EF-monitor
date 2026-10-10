import { db } from './db.js';
import { config } from './config.js';

export function dayKey(tsSec, tz = config.tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(tsSec * 1000));
}

/** Список днів "YYYY-MM-DD" від старого до сьогодні (календарна арифметика — без проблем з переходом на літній час). */
export function lastDays(n, nowSec = Math.floor(Date.now() / 1000), tz = config.tz) {
  const today = dayKey(nowSec, tz);
  const base = Date.parse(`${today}T00:00:00Z`);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(base - i * 86400_000).toISOString().slice(0, 10));
  return out;
}

const selHourly = db.prepare(
  'SELECT hour, in_wh, out_wh, ac_in_wh, solar_wh, covered_sec FROM energy_hourly WHERE sn = ? AND hour >= ? ORDER BY hour',
);

export function getDaily(sn, days, nowSec = Math.floor(Date.now() / 1000)) {
  const keys = lastDays(days, nowSec);
  const byDay = new Map(
    keys.map((k) => [k, { day: k, inWh: 0, outWh: 0, acInWh: 0, solarWh: 0, coveredSec: 0 }]),
  );
  const rows = selHourly.all(sn, nowSec - (days + 2) * 86400);
  for (const r of rows) {
    const rec = byDay.get(dayKey(r.hour));
    if (!rec) continue;
    rec.inWh += r.in_wh;
    rec.outWh += r.out_wh;
    rec.acInWh += r.ac_in_wh;
    rec.solarWh += r.solar_wh;
    rec.coveredSec += r.covered_sec;
  }
  return keys.map((k) => {
    const r = byDay.get(k);
    return { ...r, coverage: Math.min(1, r.coveredSec / 86400) };
  });
}

const sum = (arr) =>
  arr.reduce(
    (a, d) => ({
      inWh: a.inWh + d.inWh,
      outWh: a.outWh + d.outWh,
      acInWh: a.acInWh + d.acInWh,
      solarWh: a.solarWh + d.solarWh,
      coveredSec: a.coveredSec + d.coveredSec,
    }),
    { inWh: 0, outWh: 0, acInWh: 0, solarWh: 0, coveredSec: 0 },
  );

/** Порівняння по ПОВНИХ днях (сьогоднішній неповний день окремо), щоб дельти були чесні. */
export function getSummary(sn, nowSec = Math.floor(Date.now() / 1000)) {
  const days = getDaily(sn, 61, nowSec);
  const today = days[days.length - 1];
  const full = days.slice(0, -1); // 60 повних днів
  const window = (n) => ({
    cur: sum(full.slice(full.length - n)),
    prev: sum(full.slice(full.length - 2 * n, full.length - n)),
  });
  return {
    today,
    yesterday: full[full.length - 1],
    week: window(7),
    month: window(30),
  };
}

const selSeries = db.prepare(
  `SELECT CAST(ts / @b AS INTEGER) * CAST(@b AS INTEGER) AS t,
          AVG(soc) AS soc, AVG(in_w) AS inW, AVG(out_w) AS outW, AVG(ac_in_w) AS acInW, AVG(solar_w) AS solarW
   FROM samples WHERE sn = @sn AND ts >= @from GROUP BY t ORDER BY t`,
);

export function getSeries(sn, hours, nowSec = Math.floor(Date.now() / 1000)) {
  const bucket = Math.max(10, Math.ceil((hours * 3600) / 300));
  return selSeries.all({ sn, from: nowSec - hours * 3600, b: bucket });
}

const selBlackouts = db.prepare(
  'SELECT * FROM blackouts WHERE sn = ? AND (end_ts IS NULL OR end_ts >= ?) ORDER BY start_ts DESC',
);

export function getBlackouts(sn, days, nowSec = Math.floor(Date.now() / 1000)) {
  const from = nowSec - days * 86400;
  const rows = selBlackouts.all(sn, from).map((r) => {
    const end = r.end_ts ?? nowSec;
    return {
      id: r.id,
      startTs: r.start_ts,
      endTs: r.end_ts,
      ongoing: r.end_ts === null,
      durationSec: end - r.start_ts,
      startSoc: r.start_soc,
      endSoc: r.end_soc,
    };
  });
  const clipped = rows.reduce(
    (s, r) => s + Math.max(0, (r.endTs ?? nowSec) - Math.max(r.startTs, from)),
    0,
  );
  return { events: rows, count: rows.length, totalSec: clipped, periodSec: days * 86400 };
}
