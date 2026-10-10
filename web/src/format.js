const nf = (d) => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: d, minimumFractionDigits: d });

export const fmtWh = (wh) => (wh >= 1000 ? `${nf(2).format(wh / 1000)} кВт·год` : `${nf(0).format(wh)} Вт·год`);
export const fmtKwh = (wh) => nf(2).format(wh / 1000);
export const fmtW = (w) => (w == null ? '—' : `${nf(0).format(w)} Вт`);

export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} хв`;
  return `${h} год ${String(m).padStart(2, '0')} хв`;
}

const tz = 'Europe/Kyiv';
export const fmtTime = (tsSec) =>
  new Intl.DateTimeFormat('uk-UA', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(tsSec * 1000);
export const fmtDateTime = (tsSec) =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(tsSec * 1000);
export const fmtDay = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
};

/** Зміна у % відносно попереднього періоду; null, якщо порівнювати нема з чим. */
export function deltaPct(cur, prev) {
  if (!prev || prev < 1) return null;
  return ((cur - prev) / prev) * 100;
}
