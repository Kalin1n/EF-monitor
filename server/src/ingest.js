import mqtt from 'mqtt';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { config } from './config.js';
import * as api from './ecoflow.js';
import { flatten, extractMetrics } from './metrics.js';
import { energyStep, hourBucket } from './energy.js';
import { gridDown, BlackoutTracker } from './blackout.js';
import { q } from './db.js';

const now = () => Math.floor(Date.now() / 1000);

/**
 * Тримає стан усіх станцій, раз на sampleIntervalSec пише знімок у БД,
 * інтегрує енергію по годинах і відстежує блекаути.
 * Джерела даних (MQTT, REST, мок) викликають feed(sn, плоскі_параметри).
 */
export class Ingest extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.client = null;
    this.account = null;
  }

  ensure(sn, name) {
    let d = this.devices.get(sn);
    if (!d) {
      d = {
        sn,
        name: name || sn,
        online: null,
        raw: {},
        metrics: {},
        updatedAt: 0,
        mqttAt: 0,
        lastTickTs: null,
        tracker: new BlackoutTracker(config.blackoutDebounceSec),
      };
      const open = q.currentBlackout.get(sn);
      if (open) d.tracker.resume(open.start_ts);
      this.devices.set(sn, d);
      q.upsertDevice.run({ sn, name: d.name });
    } else if (name && name !== d.name) {
      d.name = name;
      q.upsertDevice.run({ sn, name });
    }
    return d;
  }

  /** Злити частковий пакет у стан пристрою. */
  feed(sn, flatParams, source = 'mqtt') {
    const d = this.ensure(sn);
    Object.assign(d.raw, flatParams);
    d.metrics = extractMetrics(d.raw);
    d.updatedAt = Date.now();
    if (source === 'mqtt') d.mqttAt = Date.now();
    if (d.online === null) d.online = true;
  }

  async start() {
    await this.refreshDevices();
    await this.connectMqtt();
    this.timers = [
      setInterval(() => this.tick(), config.sampleIntervalSec * 1000),
      setInterval(() => this.pollRest().catch(() => {}), config.restPollSec * 1000),
      setInterval(() => this.refreshDevices().catch(() => {}), 10 * 60 * 1000),
    ];
    this.pollRest().catch(() => {});
  }

  async refreshDevices() {
    const list = await api.getDevices();
    for (const dev of list) {
      const d = this.ensure(dev.sn, dev.deviceName);
      if (typeof dev.online === 'number') d.online = dev.online === 1;
    }
    if (this.client?.connected) this.subscribeAll();
  }

  subscribeAll() {
    for (const sn of this.devices.keys()) {
      this.client.subscribe([`/open/${this.account}/${sn}/quota`, `/open/${this.account}/${sn}/status`]);
    }
  }

  async connectMqtt() {
    const cert = await api.getCertification();
    this.account = cert.certificateAccount;
    const url = `${cert.protocol ?? 'mqtts'}://${cert.url}:${cert.port}`;
    this.client = mqtt.connect(url, {
      username: cert.certificateAccount,
      password: cert.certificatePassword,
      clientId: `ecoflow-monitor_${randomUUID()}`,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => {
      console.log('[mqtt] connected');
      this.subscribeAll();
    });
    this.client.on('error', (e) => {
      console.error('[mqtt] error:', e.message);
      // Облікові дані MQTT можуть протухнути — беремо нові
      if (/not authorized|bad user/i.test(e.message)) this.recycle();
    });
    this.client.on('message', (topic, payload) => this.onMessage(topic, payload));
  }

  recycle() {
    if (this.recycling) return;
    this.recycling = true;
    this.client?.end(true);
    setTimeout(async () => {
      try {
        await this.connectMqtt();
      } catch (e) {
        console.error('[mqtt] reconnect failed:', e.message);
      } finally {
        this.recycling = false;
      }
    }, 10_000);
  }

  onMessage(topic, payload) {
    // /open/{account}/{sn}/quota | /status
    const parts = topic.split('/');
    const sn = parts[3];
    const kind = parts[4];
    let msg;
    try {
      msg = JSON.parse(payload.toString());
    } catch {
      return; // не JSON (наприклад protobuf) — пропускаємо, в дебазі видно, що даних нема
    }
    if (kind === 'quota') {
      this.feed(sn, flatten(msg.params ?? msg.data ?? msg), 'mqtt');
    } else if (kind === 'status') {
      const d = this.ensure(sn);
      const st = msg.params?.status ?? msg.status;
      if (st !== undefined) d.online = Number(st) === 1;
    }
  }

  /** REST як запасний варіант, коли MQTT мовчить (на Delta 3 може віддавати код 1006 — це нормально). */
  async pollRest() {
    for (const d of this.devices.values()) {
      if (Date.now() - d.mqttAt < 45_000) continue;
      try {
        const data = await api.getQuota(d.sn);
        this.feed(d.sn, flatten(data), 'rest');
        d.restError = null;
      } catch (e) {
        if (d.restError !== e.message) console.warn(`[rest] ${d.sn}: ${e.message}`);
        d.restError = e.message;
      }
    }
  }

  tick() {
    const ts = now();
    for (const d of this.devices.values()) {
      const fresh = Date.now() - d.updatedAt <= config.freshSec * 1000;
      if (!fresh) {
        d.lastTickTs = null;
        continue;
      }
      const m = d.metrics;
      q.insertSample.run({
        sn: d.sn,
        ts,
        soc: m.soc ?? null,
        inW: m.inW ?? null,
        outW: m.outW ?? null,
        acInW: m.acInW ?? null,
        solarW: m.solarW ?? null,
        acInV: m.acInV ?? null,
      });
      if (d.lastTickTs !== null) {
        const dt = ts - d.lastTickTs;
        if (dt > 0 && dt <= config.maxGapSec) {
          q.addEnergy.run({ sn: d.sn, hour: hourBucket(ts), ...energyStep(m, dt), coveredSec: dt });
        }
      }
      d.lastTickTs = ts;

      const ev = d.tracker.update(gridDown(m), ts);
      if (ev?.type === 'start') {
        q.openBlackout.run(d.sn, ev.ts, m.soc ?? null);
        console.log(`[blackout] ${d.sn} start`);
      } else if (ev?.type === 'end') {
        q.closeBlackout.run(ev.ts, m.soc ?? null, d.sn);
        console.log(`[blackout] ${d.sn} end`);
      }
    }
  }

  snapshot() {
    return [...this.devices.values()].map((d) => ({
      sn: d.sn,
      name: d.name,
      online: d.online,
      metrics: d.metrics,
      updatedAt: d.updatedAt || null,
      ageSec: d.updatedAt ? Math.round((Date.now() - d.updatedAt) / 1000) : null,
      stale: Date.now() - d.updatedAt > config.freshSec * 1000,
      blackoutSince: d.tracker.open ? d.tracker.startedAt : null,
      restError: d.restError ?? null,
    }));
  }
}
