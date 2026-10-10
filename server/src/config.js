import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
// --mock працює і в Windows (cmd/PowerShell), де `MOCK=1 node ...` не діє
const mock = process.env.MOCK === '1' || process.argv.includes('--mock');

export const config = {
  accessKey: process.env.ECOFLOW_ACCESS_KEY ?? '',
  secretKey: process.env.ECOFLOW_SECRET_KEY ?? '',
  // EU-акаунти: api-e.ecoflow.com, Global/US: api.ecoflow.com
  apiBase: process.env.ECOFLOW_API_BASE ?? 'https://api-e.ecoflow.com',
  host: process.env.HOST ?? '127.0.0.1', // немає авторизації — не відкривай назовні без проксі з паролем
  port: num(process.env.PORT, 5000),
  dbPath: process.env.DB_PATH ?? (mock ? 'data/mock.sqlite' : 'data/ecoflow.sqlite'),
  tz: process.env.TZ_NAME ?? 'Europe/Kyiv',
  mock,
  sampleIntervalSec: 10, // як часто пишемо знімок стану
  maxGapSec: 45, // більша дірка між знімками — енергія не інтегрується
  freshSec: 120, // дані старші за це вважаємо застарілими
  retentionDays: num(process.env.RETENTION_DAYS, 14), // скільки зберігати сирі знімки
  blackoutDebounceSec: 30, // скільки секунд стан має триматись, щоб зарахувати блекаут
  restPollSec: 60,
};
