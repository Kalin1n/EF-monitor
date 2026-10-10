/**
 * Мапінг сирих ключів EcoFlow на наші метрики.
 * Назви ключів і одиниці відрізняються між моделями, тому для кожної метрики
 * є список кандидатів [ключ, множник]; береться перший, що є в даних.
 * ВАЖЛИВО: для Delta 3 і River 2 ключі треба звірити у вкладці «Дебаг» з реальними даними
 * і з застосунком EcoFlow — тут правиться мапінг.
 */
export const MAP = {
  soc: [
    ['bms_bmsStatus.soc', 1],
    ['bms_emsStatus.lcdShowSoc', 1],
    ['pd.soc', 1],
    ['cmsBattSoc', 1],
    ['bmsBattSoc', 1],
  ],
  inW: [
    ['pd.wattsInSum', 1],
    ['powInSumW', 1],
  ],
  outW: [
    ['pd.wattsOutSum', 1],
    ['powOutSumW', 1],
  ],
  acInW: [
    ['inv.inputWatts', 1],
    ['powGetAcIn', 1],
  ],
  solarW: [
    ['mppt.inWatts', 0.1], // у деяких моделей це десяті частки ват
    ['powGetPv', 1],
  ],
  acInV: [
    ['inv.acInVol', 1], // нормалізується нижче (мВ → В)
    ['acInVol', 1],
  ],
};

export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const pick = (raw, candidates) => {
  for (const [key, scale] of candidates) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v * scale;
  }
  return undefined;
};

/** Сирий (злитий) стан → нормалізовані метрики. */
export function extractMetrics(raw) {
  const m = {};
  for (const name of Object.keys(MAP)) {
    const v = pick(raw, MAP[name]);
    if (v !== undefined) m[name] = v;
  }
  if (m.acInV !== undefined && m.acInV > 1000) m.acInV /= 1000; // мВ → В
  // Якщо немає сумарного входу — рахуємо як мережа + сонце (позначено як похідне)
  if (m.inW === undefined && (m.acInW !== undefined || m.solarW !== undefined)) {
    m.inW = (m.acInW ?? 0) + (m.solarW ?? 0);
  }
  return m;
}
