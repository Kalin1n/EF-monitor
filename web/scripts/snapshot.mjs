// Знімає відповіді demo-бекенду в JSON-файли для статичної збірки (GitHub Pages).
// Сервер має вже працювати: cd server && npm run demo
// Використання: node scripts/snapshot.mjs [outDir=dist] [apiBase=http://127.0.0.1:5000]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
const base = process.argv[3] ?? 'http://127.0.0.1:5000';

// Та сама схема імен, що й staticPath у src/api.js
const staticPath = (path) =>
  `api${path.replace('?', '/').replaceAll('&', '/').replaceAll('=', '-')}.json`;

// Значення перемикачів з App.jsx
const paths = (sn) => [
  ...[6, 24, 72].map((h) => `/series?sn=${sn}&hours=${h}`),
  ...[7, 14, 30, 90].map((d) => `/daily?sn=${sn}&days=${d}`),
  `/summary?sn=${sn}`,
  ...[7, 30, 90].map((d) => `/blackouts?sn=${sn}&days=${d}`),
  `/raw?sn=${sn}`,
];

async function save(path) {
  const res = await fetch(`${base}/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const data = await res.json();
  const file = join(outDir, staticPath(path));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}

const devices = await save('/devices');
for (const { sn } of devices) for (const p of paths(sn)) await save(p);
console.log(`snapshot: ${devices.length} станцій → ${join(outDir, 'api')}`);
