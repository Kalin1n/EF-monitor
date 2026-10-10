import './check-node.js';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { Ingest } from './ingest.js';
import { q } from './db.js';
import { getDaily, getSummary, getSeries, getBlackouts } from './stats.js';

const ingest = new Ingest();
const app = express();

const clampInt = (v, min, max, d) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || d));
const needSn = (req, res) => {
  const sn = String(req.query.sn ?? '');
  if (!ingest.devices.has(sn)) {
    res.status(404).json({ error: 'unknown sn' });
    return null;
  }
  return sn;
};

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, mock: config.mock, devices: ingest.devices.size, tz: config.tz }),
);
app.get('/api/devices', (_req, res) => res.json(ingest.snapshot()));

app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = () => res.write(`data: ${JSON.stringify(ingest.snapshot())}\n\n`);
  send();
  const t = setInterval(send, 3000);
  req.on('close', () => clearInterval(t));
});

app.get('/api/series', (req, res) => {
  const sn = needSn(req, res);
  if (sn) res.json(getSeries(sn, clampInt(req.query.hours, 1, 24 * 14, 24)));
});
app.get('/api/daily', (req, res) => {
  const sn = needSn(req, res);
  if (sn) res.json(getDaily(sn, clampInt(req.query.days, 1, 365, 30)));
});
app.get('/api/summary', (req, res) => {
  const sn = needSn(req, res);
  if (sn) res.json(getSummary(sn));
});
app.get('/api/blackouts', (req, res) => {
  const sn = needSn(req, res);
  if (sn) res.json(getBlackouts(sn, clampInt(req.query.days, 1, 365, 30)));
});
// Дебаг: сирі ключі, які реально прийшли, і що з них розпізналось
app.get('/api/raw', (req, res) => {
  const sn = needSn(req, res);
  if (!sn) return;
  const d = ingest.devices.get(sn);
  res.json({ raw: d.raw, metrics: d.metrics, updatedAt: d.updatedAt, restError: d.restError ?? null });
});

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '../../web/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

async function main() {
  if (config.mock) {
    const { startMock } = await import('./mock.js');
    await startMock(ingest);
    ingest.timers = [setInterval(() => ingest.tick(), config.sampleIntervalSec * 1000)];
    console.log('[mock] демо-режим: дані симульовані');
  } else {
    if (!config.accessKey || !config.secretKey) {
      console.error('Задай ECOFLOW_ACCESS_KEY і ECOFLOW_SECRET_KEY у .env (або запусти з MOCK=1)');
      process.exit(1);
    }
    await ingest.start();
  }
  setInterval(() => q.pruneSamples.run(Math.floor(Date.now() / 1000) - config.retentionDays * 86400), 3600_000);
  app.listen(config.port, config.host, () =>
    console.log(`http://${config.host}:${config.port}  (${config.mock ? 'demo' : 'live'})`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
