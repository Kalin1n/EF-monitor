/**
 * Чи є мережа: true = світла немає, false = є, null = невідомо.
 * Краще за все працює напруга на вході. Якщо її нема — евристика:
 * вхід з мережі ≈ 0 при ненульовому навантаженні (при живій мережі й повній батареї
 * станція віддає навантаження в обхід інвертора, тож вхід ≈ навантаженню).
 */
export function gridDown(m) {
  if (m.acInV != null) return m.acInV < 90;
  if (m.acInW != null && m.outW != null) {
    if (m.acInW >= 5) return false;
    return m.outW > 5 ? true : null;
  }
  return null;
}

/** Автомат з дебаунсом: подія зараховується, коли стан тримається debounceSec секунд. */
export class BlackoutTracker {
  constructor(debounceSec) {
    this.debounce = debounceSec;
    this.open = false;
    this.startedAt = null;
    this.candidateSince = null;
  }

  resume(startedAt) {
    this.open = true;
    this.startedAt = startedAt;
    this.candidateSince = null;
  }

  /** @returns {{type:'start'|'end', ts:number}|null} */
  update(down, ts) {
    if (down === null) return null;
    if (!this.open) {
      if (down) {
        this.candidateSince ??= ts;
        if (ts - this.candidateSince >= this.debounce) {
          this.open = true;
          this.startedAt = this.candidateSince;
          this.candidateSince = null;
          return { type: 'start', ts: this.startedAt };
        }
      } else this.candidateSince = null;
    } else if (!down) {
      this.candidateSince ??= ts;
      if (ts - this.candidateSince >= this.debounce) {
        const endTs = this.candidateSince;
        this.open = false;
        this.startedAt = null;
        this.candidateSince = null;
        return { type: 'end', ts: endTs };
      }
    } else this.candidateSince = null;
    return null;
  }
}
