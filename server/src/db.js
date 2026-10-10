import { DatabaseSync } from 'node:sqlite'; // вбудований у Node 22.13+, нічого компілювати не треба
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  sn TEXT PRIMARY KEY,
  name TEXT
);
CREATE TABLE IF NOT EXISTS samples (
  sn TEXT NOT NULL,
  ts INTEGER NOT NULL,
  soc REAL, in_w REAL, out_w REAL, ac_in_w REAL, solar_w REAL, ac_in_v REAL,
  PRIMARY KEY (sn, ts)
);
CREATE TABLE IF NOT EXISTS energy_hourly (
  sn TEXT NOT NULL,
  hour INTEGER NOT NULL,
  in_wh REAL NOT NULL DEFAULT 0,
  out_wh REAL NOT NULL DEFAULT 0,
  ac_in_wh REAL NOT NULL DEFAULT 0,
  solar_wh REAL NOT NULL DEFAULT 0,
  covered_sec INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sn, hour)
);
CREATE TABLE IF NOT EXISTS blackouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sn TEXT NOT NULL,
  start_ts INTEGER NOT NULL,
  end_ts INTEGER,
  start_soc REAL,
  end_soc REAL
);
CREATE INDEX IF NOT EXISTS blackouts_sn_start ON blackouts (sn, start_ts);
`);

/** Транзакція: node:sqlite не має db.transaction(), тож робимо вручну. */
export function inTransaction(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const q = {
  upsertDevice: db.prepare(
    'INSERT INTO devices (sn, name) VALUES (@sn, @name) ON CONFLICT(sn) DO UPDATE SET name = excluded.name',
  ),
  insertSample: db.prepare(
    `INSERT OR REPLACE INTO samples (sn, ts, soc, in_w, out_w, ac_in_w, solar_w, ac_in_v)
     VALUES (@sn, @ts, @soc, @inW, @outW, @acInW, @solarW, @acInV)`,
  ),
  addEnergy: db.prepare(
    `INSERT INTO energy_hourly (sn, hour, in_wh, out_wh, ac_in_wh, solar_wh, covered_sec)
     VALUES (@sn, @hour, @inWh, @outWh, @acInWh, @solarWh, @coveredSec)
     ON CONFLICT(sn, hour) DO UPDATE SET
       in_wh = in_wh + excluded.in_wh,
       out_wh = out_wh + excluded.out_wh,
       ac_in_wh = ac_in_wh + excluded.ac_in_wh,
       solar_wh = solar_wh + excluded.solar_wh,
       covered_sec = covered_sec + excluded.covered_sec`,
  ),
  openBlackout: db.prepare('INSERT INTO blackouts (sn, start_ts, start_soc) VALUES (?, ?, ?)'),
  closeBlackout: db.prepare(
    'UPDATE blackouts SET end_ts = ?, end_soc = ? WHERE sn = ? AND end_ts IS NULL',
  ),
  currentBlackout: db.prepare('SELECT * FROM blackouts WHERE sn = ? AND end_ts IS NULL'),
  pruneSamples: db.prepare('DELETE FROM samples WHERE ts < ?'),
};
