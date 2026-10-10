/** Енергія (Вт·год) за інтервал dtSec при поточній потужності (метод прямокутників). */
export function energyStep(m, dtSec) {
  const h = dtSec / 3600;
  return {
    inWh: (m.inW ?? 0) * h,
    outWh: (m.outW ?? 0) * h,
    acInWh: (m.acInW ?? 0) * h,
    solarWh: (m.solarW ?? 0) * h,
  };
}

export const hourBucket = (tsSec) => Math.floor(tsSec / 3600) * 3600;
