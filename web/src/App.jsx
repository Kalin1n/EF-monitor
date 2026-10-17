import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { STATIC, useApi, useLive } from './api.js';
import {
  deltaPct, fmtDateTime, fmtDay, fmtDuration, fmtKwh, fmtTime, fmtW, fmtWh,
} from './format.js';

const C = { in: 'var(--series-in)', out: 'var(--series-out)', solar: 'var(--series-solar)' };
const axisProps = { stroke: 'var(--axis)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };

function Tip({ active, payload, label, labelFmt = (l) => l, valueFmt = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div style={{ color: 'var(--ink-2)' }}>{labelFmt(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <i style={{ background: p.color }} />
          {p.name}: <b>{valueFmt(p.value, p.dataKey)}</b>
        </div>
      ))}
    </div>
  );
}

function Delta({ cur, prev, label }) {
  const d = deltaPct(cur, prev);
  if (d === null) return <span className="delta muted">{label}: немає бази для порівняння</span>;
  // Нейтральний колір: більше/менше енергії саме по собі не «добре» і не «погано»
  return (
    <span className="delta">
      {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% {label}
    </span>
  );
}

/* ---------- Зараз ---------- */
function DeviceCard({ d }) {
  const m = d.metrics;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{d.name}</h2>
        <span className="badge">
          <span className={`dot ${d.online && !d.stale ? 'on' : ''}`} />
          {d.stale ? 'немає даних' : d.online ? 'онлайн' : 'офлайн'}
        </span>
      </div>
      {d.blackoutSince && (
        <div className="badge crit" style={{ marginTop: 8 }}>
          ⚠ Немає мережі з {fmtTime(d.blackoutSince)} ({fmtDuration(Date.now() / 1000 - d.blackoutSince)})
        </div>
      )}
      <div className="hero" style={{ marginTop: 8 }}>
        {m.soc != null ? Math.round(m.soc) : '—'}
        <small>% заряд</small>
      </div>
      <div className="bar" role="img" aria-label={`Заряд ${m.soc ?? 0}%`}>
        <i style={{ width: `${Math.min(100, m.soc ?? 0)}%` }} />
      </div>
      <div className="row"><span>Вхід (разом)</span><b>{fmtW(m.inW)}</b></div>
      <div className="row"><span>з мережі</span><b>{fmtW(m.acInW)}</b></div>
      <div className="row"><span>із сонця</span><b>{fmtW(m.solarW)}</b></div>
      <div className="row"><span>Навантаження</span><b>{fmtW(m.outW)}</b></div>
      {m.acInV != null && <div className="row"><span>Напруга мережі</span><b>{Math.round(m.acInV)} В</b></div>}
      <div className="muted" style={{ marginTop: 6 }}>
        {d.ageSec != null ? `оновлено ${d.ageSec} с тому` : 'даних ще не було'}
        {d.restError && ` · REST: ${d.restError}`}
      </div>
    </div>
  );
}

function LiveTab({ devices, sn }) {
  const [hours, setHours] = useState(24);
  const { data } = useApi(sn ? `/series?sn=${sn}&hours=${hours}` : null, [], 30000);
  return (
    <>
      <div className="grid" style={{ marginBottom: 12 }}>
        {devices.map((d) => <DeviceCard key={d.sn} d={d} />)}
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2>Потужність, Вт</h2>
          <div className="seg">
            {[6, 24, 72].map((h) => (
              <button key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} год</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="t" {...axisProps} tickFormatter={fmtTime} minTickGap={40} />
            <YAxis {...axisProps} width={44} />
            <Tooltip content={<Tip labelFmt={fmtDateTime} valueFmt={(v) => fmtW(v)} />} />
            <Legend />
            <Line dataKey="inW" name="Вхід" stroke={C.in} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="outW" name="Навантаження" stroke={C.out} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h2>Заряд батареї, %</h2>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="t" {...axisProps} tickFormatter={fmtTime} minTickGap={40} />
            <YAxis {...axisProps} width={44} domain={[0, 100]} />
            <Tooltip content={<Tip labelFmt={fmtDateTime} valueFmt={(v) => `${Math.round(v)}%`} />} />
            <Line dataKey="soc" name="Заряд" stroke={C.in} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ---------- Статистика ---------- */
function SummaryCard({ title, cur, prev, prevLabel, noDelta }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="row"><span>Надійшло</span><b>{fmtWh(cur.inWh)}</b></div>
      <div className="row"><span>Витрачено</span><b>{fmtWh(cur.outWh)}</b></div>
      {noDelta ? (
        // Неповний день не можна чесно порівнювати з повним — показуємо вчорашні цифри як орієнтир
        <div className="muted" style={{ marginTop: 6 }}>
          Вчора за весь день: {fmtWh(prev.inWh)} надійшло, {fmtWh(prev.outWh)} витрачено
        </div>
      ) : (
        <div style={{ marginTop: 6, display: 'grid', gap: 2 }}>
          <Delta cur={cur.inWh} prev={prev?.inWh} label={`надходження ${prevLabel}`} />
          <Delta cur={cur.outWh} prev={prev?.outWh} label={`витрати ${prevLabel}`} />
        </div>
      )}
    </div>
  );
}

function StatsTab({ sn }) {
  const [days, setDays] = useState(14);
  const [table, setTable] = useState(false);
  const { data: daily } = useApi(sn ? `/daily?sn=${sn}&days=${days}` : null, []);
  const { data: s } = useApi(sn ? `/summary?sn=${sn}` : null, [], 60000);
  const lowCoverage = (daily ?? []).filter((d) => d.coverage < 0.9 && d.day !== daily.at(-1).day).length;
  return (
    <>
      {s && (
        <div className="grid" style={{ marginBottom: 12 }}>
          <SummaryCard title="Сьогодні (неповний день)" cur={s.today} prev={s.yesterday} noDelta />
          <SummaryCard title="Останні 7 повних днів" cur={s.week.cur} prev={s.week.prev} prevLabel="до попередніх 7" />
          <SummaryCard title="Останні 30 повних днів" cur={s.month.cur} prev={s.month.prev} prevLabel="до попередніх 30" />
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2>Енергія по днях, кВт·год</h2>
          <div className="seg">
            {[7, 14, 30, 90].map((n) => (
              <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} дн</button>
            ))}
            <button aria-pressed={table} onClick={() => setTable(!table)}>Таблиця</button>
          </div>
        </div>
        {lowCoverage > 0 && (
          <div className="warn">
            У {lowCoverage} днях зафіксовано менше 90% часу — монітор не працював або станція мовчала,
            тому реальні значення там вищі за показані.
          </div>
        )}
        {!table ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(daily ?? []).map((d) => ({ ...d, inKwh: d.inWh / 1000, outKwh: d.outWh / 1000 }))} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="day" {...axisProps} tickFormatter={fmtDay} minTickGap={16} />
              <YAxis {...axisProps} width={44} />
              <Tooltip cursor={{ fill: 'var(--grid)', opacity: 0.4 }} content={<Tip labelFmt={fmtDay} valueFmt={(v) => `${v.toFixed(2)} кВт·год`} />} />
              <Legend />
              <Bar dataKey="inKwh" name="Надійшло" fill={C.in} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="outKwh" name="Витрачено" fill={C.out} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <table>
            <thead><tr><th>День</th><th>Надійшло, кВт·год</th><th>з мережі</th><th>із сонця</th><th>Витрачено, кВт·год</th><th>Покриття</th></tr></thead>
            <tbody>
              {[...(daily ?? [])].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{fmtDay(d.day)}</td><td>{fmtKwh(d.inWh)}</td><td>{fmtKwh(d.acInWh)}</td>
                  <td>{fmtKwh(d.solarWh)}</td><td>{fmtKwh(d.outWh)}</td><td>{Math.round(d.coverage * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------- Блекаути ---------- */
function BlackoutsTab({ sn }) {
  const [days, setDays] = useState(30);
  const { data } = useApi(sn ? `/blackouts?sn=${sn}&days=${days}` : null, [], 60000);
  const share = data ? (data.totalSec / data.periodSec) * 100 : 0;
  return (
    <>
      <div className="grid" style={{ marginBottom: 12 }}>
        <div className="card"><h2>Без мережі за період</h2><div className="hero">{data ? fmtDuration(data.totalSec) : '—'}</div><div className="muted">{share.toFixed(1)}% часу</div></div>
        <div className="card"><h2>Відключень</h2><div className="hero">{data?.count ?? '—'}</div><div className="muted">{data?.count ? `у середньому ${fmtDuration(data.totalSec / data.count)}` : ' '}</div></div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2>Журнал відключень</h2>
          <div className="seg">
            {[7, 30, 90].map((n) => (
              <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} дн</button>
            ))}
          </div>
        </div>
        <table>
          <thead><tr><th>Початок</th><th>Кінець</th><th>Тривалість</th><th>Заряд на початку → в кінці</th></tr></thead>
          <tbody>
            {(data?.events ?? []).map((e) => (
              <tr key={e.id}>
                <td>{fmtDateTime(e.startTs)}</td>
                <td>{e.ongoing ? <span className="badge crit">⚠ триває</span> : fmtDateTime(e.endTs)}</td>
                <td>{fmtDuration(e.durationSec)}</td>
                <td>{e.startSoc != null ? Math.round(e.startSoc) : '—'}% → {e.endSoc != null ? `${Math.round(e.endSoc)}%` : '—'}</td>
              </tr>
            ))}
            {data && data.events.length === 0 && <tr><td colSpan={4} className="muted">За цей період відключень не зафіксовано</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Дебаг ---------- */
function DebugTab({ sn }) {
  const [q, setQ] = useState('');
  const { data } = useApi(sn ? `/raw?sn=${sn}` : null, [], 5000);
  const rows = useMemo(
    () => Object.entries(data?.raw ?? {}).filter(([k]) => k.toLowerCase().includes(q.toLowerCase())).sort(([a], [b]) => a.localeCompare(b)),
    [data, q],
  );
  return (
    <>
      <div className="card">
        <h2>Розпізнані метрики</h2>
        <pre style={{ margin: 0, color: 'var(--ink-2)' }}>{JSON.stringify(data?.metrics ?? {}, null, 2)}</pre>
        <p className="muted">
          Якщо тут бракує потрібних метрик або значення відрізняються від застосунку EcoFlow, поправ мапінг
          у <code>server/src/metrics.js</code>, підібравши ключі зі списку нижче.
          {data?.restError && ` REST: ${data.restError}`}
        </p>
      </div>
      <div className="card">
        <h2>Сирі ключі від станції ({rows.length})</h2>
        <input type="search" placeholder="Фільтр за назвою ключа…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="raw">
          <table>
            <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- Каркас ---------- */
const TABS = [['live', 'Зараз'], ['stats', 'Статистика'], ['blackouts', 'Блекаути'], ['debug', 'Дебаг']];

export default function App() {
  const { devices, connected } = useLive();
  const [tab, setTab] = useState('live');
  const [sn, setSn] = useState(null);
  useEffect(() => {
    if (!sn && devices?.length) setSn(devices[0].sn);
  }, [devices, sn]);

  return (
    <div className="app">
      <header>
        <h1>⚡ EcoFlow Монітор</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {tab !== 'live' && devices?.length > 1 && (
            <select value={sn ?? ''} onChange={(e) => setSn(e.target.value)} aria-label="Станція">
              {devices.map((d) => <option key={d.sn} value={d.sn}>{d.name}</option>)}
            </select>
          )}
          {STATIC ? (
            <span className="badge">демо-знімок</span>
          ) : (
            <span className="badge"><span className={`dot ${connected ? 'on' : ''}`} />{connected ? 'підключено' : 'немає зв’язку з сервером'}</span>
          )}
        </div>
      </header>
      <nav className="tabs" role="tablist" style={{ marginBottom: 12 }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {STATIC && (
        <div className="warn">
          Це статичне демо на GitHub Pages: симульовані станції, дані зафіксовані на момент збірки.
          Щоб бачити свої станції, запусти сервер локально (див. README).
        </div>
      )}
      {!devices && <p className="muted">Завантаження…</p>}
      {devices?.length === 0 && <p className="muted">Станцій не знайдено в акаунті.</p>}
      {devices?.length > 0 && (
        <>
          {tab === 'live' && <LiveTab devices={devices} sn={sn ?? devices[0].sn} />}
          {tab === 'stats' && <StatsTab sn={sn} />}
          {tab === 'blackouts' && <BlackoutsTab sn={sn} />}
          {tab === 'debug' && <DebugTab sn={sn} />}
        </>
      )}
    </div>
  );
}
