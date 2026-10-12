import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApi, useLive } from './api.js';
import {
  deltaPct, fmtDateTime, fmtDay, fmtDuration, fmtKwh, fmtTime, fmtW, fmtWh,
} from './format.js';
import {
  Badge, Card, CardHead, Cluster, DeltaText, Dot, EmptyCell, Grid, Header, Heading, Hero, HeroUnit, Meter, MeterFill,
  Muted, Notice, Pre, Row, Scroll, Search, Seg, SegButton, Select, Shell, Stack, Swatch, Tab, Table, Tabs, Tip as TipBox,
  TipLabel, TipRow, Title,
} from './components/ui.js';

const C = { in: 'var(--series-in)', out: 'var(--series-out)', solar: 'var(--series-solar)' };
const axisProps = { stroke: 'var(--axis)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };

function Tip({ active, payload, label, labelFmt = (l) => l, valueFmt = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <TipBox>
      <TipLabel>{labelFmt(label)}</TipLabel>
      {payload.map((p) => (
        <TipRow key={p.dataKey}>
          <Swatch $color={p.color} />
          {p.name}: <b>{valueFmt(p.value, p.dataKey)}</b>
        </TipRow>
      ))}
    </TipBox>
  );
}

function Delta({ cur, prev, label }) {
  const d = deltaPct(cur, prev);
  if (d === null) return <DeltaText $muted>{label}: немає бази для порівняння</DeltaText>;
  // Нейтральний колір: більше/менше енергії саме по собі не «добре» і не «погано»
  return (
    <DeltaText>
      {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% {label}
    </DeltaText>
  );
}

/* ---------- Зараз ---------- */
function DeviceCard({ d }) {
  const m = d.metrics;
  return (
    <Card>
      <CardHead $center>
        <Heading>{d.name}</Heading>
        <Badge>
          <Dot $on={d.online && !d.stale} />
          {d.stale ? 'немає даних' : d.online ? 'онлайн' : 'офлайн'}
        </Badge>
      </CardHead>
      {d.blackoutSince && (
        <Badge as="div" $crit $gap>
          ⚠ Немає мережі з {fmtTime(d.blackoutSince)} ({fmtDuration(Date.now() / 1000 - d.blackoutSince)})
        </Badge>
      )}
      <Hero $gap>
        {m.soc != null ? Math.round(m.soc) : '—'}
        <HeroUnit>% заряд</HeroUnit>
      </Hero>
      <Meter role="img" aria-label={`Заряд ${m.soc ?? 0}%`}>
        <MeterFill style={{ width: `${Math.min(100, m.soc ?? 0)}%` }} />
      </Meter>
      <Row><span>Вхід (разом)</span><b>{fmtW(m.inW)}</b></Row>
      <Row><span>з мережі</span><b>{fmtW(m.acInW)}</b></Row>
      <Row><span>із сонця</span><b>{fmtW(m.solarW)}</b></Row>
      <Row><span>Навантаження</span><b>{fmtW(m.outW)}</b></Row>
      {m.acInV != null && <Row><span>Напруга мережі</span><b>{Math.round(m.acInV)} В</b></Row>}
      <Muted $gap>
        {d.ageSec != null ? `оновлено ${d.ageSec} с тому` : 'даних ще не було'}
        {d.restError && ` · REST: ${d.restError}`}
      </Muted>
    </Card>
  );
}

function LiveTab({ devices, sn }) {
  const [hours, setHours] = useState(24);
  const { data } = useApi(sn ? `/series?sn=${sn}&hours=${hours}` : null, [], 30000);
  return (
    <>
      <Grid>
        {devices.map((d) => <DeviceCard key={d.sn} d={d} />)}
      </Grid>
      <Card>
        <CardHead>
          <Heading>Потужність, Вт</Heading>
          <Seg>
            {[6, 24, 72].map((h) => (
              <SegButton key={h} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} год</SegButton>
            ))}
          </Seg>
        </CardHead>
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
      </Card>
      <Card>
        <Heading>Заряд батареї, %</Heading>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="t" {...axisProps} tickFormatter={fmtTime} minTickGap={40} />
            <YAxis {...axisProps} width={44} domain={[0, 100]} />
            <Tooltip content={<Tip labelFmt={fmtDateTime} valueFmt={(v) => `${Math.round(v)}%`} />} />
            <Line dataKey="soc" name="Заряд" stroke={C.in} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

/* ---------- Статистика ---------- */
function SummaryCard({ title, cur, prev, prevLabel, noDelta }) {
  return (
    <Card>
      <Heading>{title}</Heading>
      <Row><span>Надійшло</span><b>{fmtWh(cur.inWh)}</b></Row>
      <Row><span>Витрачено</span><b>{fmtWh(cur.outWh)}</b></Row>
      {noDelta ? (
        // Неповний день не можна чесно порівнювати з повним — показуємо вчорашні цифри як орієнтир
        <Muted $gap>
          Вчора за весь день: {fmtWh(prev.inWh)} надійшло, {fmtWh(prev.outWh)} витрачено
        </Muted>
      ) : (
        <Stack>
          <Delta cur={cur.inWh} prev={prev?.inWh} label={`надходження ${prevLabel}`} />
          <Delta cur={cur.outWh} prev={prev?.outWh} label={`витрати ${prevLabel}`} />
        </Stack>
      )}
    </Card>
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
        <Grid>
          <SummaryCard title="Сьогодні (неповний день)" cur={s.today} prev={s.yesterday} noDelta />
          <SummaryCard title="Останні 7 повних днів" cur={s.week.cur} prev={s.week.prev} prevLabel="до попередніх 7" />
          <SummaryCard title="Останні 30 повних днів" cur={s.month.cur} prev={s.month.prev} prevLabel="до попередніх 30" />
        </Grid>
      )}
      <Card>
        <CardHead>
          <Heading>Енергія по днях, кВт·год</Heading>
          <Seg>
            {[7, 14, 30, 90].map((n) => (
              <SegButton key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} дн</SegButton>
            ))}
            <SegButton aria-pressed={table} onClick={() => setTable(!table)}>Таблиця</SegButton>
          </Seg>
        </CardHead>
        {lowCoverage > 0 && (
          <Notice>
            У {lowCoverage} днях зафіксовано менше 90% часу — монітор не працював або станція мовчала,
            тому реальні значення там вищі за показані.
          </Notice>
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
          <Table>
            <thead><tr><th>День</th><th>Надійшло, кВт·год</th><th>з мережі</th><th>із сонця</th><th>Витрачено, кВт·год</th><th>Покриття</th></tr></thead>
            <tbody>
              {[...(daily ?? [])].reverse().map((d) => (
                <tr key={d.day}>
                  <td>{fmtDay(d.day)}</td><td>{fmtKwh(d.inWh)}</td><td>{fmtKwh(d.acInWh)}</td>
                  <td>{fmtKwh(d.solarWh)}</td><td>{fmtKwh(d.outWh)}</td><td>{Math.round(d.coverage * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
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
      <Grid>
        <Card><Heading>Без мережі за період</Heading><Hero>{data ? fmtDuration(data.totalSec) : '—'}</Hero><Muted>{share.toFixed(1)}% часу</Muted></Card>
        <Card><Heading>Відключень</Heading><Hero>{data?.count ?? '—'}</Hero><Muted>{data?.count ? `у середньому ${fmtDuration(data.totalSec / data.count)}` : ' '}</Muted></Card>
      </Grid>
      <Card>
        <CardHead>
          <Heading>Журнал відключень</Heading>
          <Seg>
            {[7, 30, 90].map((n) => (
              <SegButton key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} дн</SegButton>
            ))}
          </Seg>
        </CardHead>
        <Table>
          <thead><tr><th>Початок</th><th>Кінець</th><th>Тривалість</th><th>Заряд на початку → в кінці</th></tr></thead>
          <tbody>
            {(data?.events ?? []).map((e) => (
              <tr key={e.id}>
                <td>{fmtDateTime(e.startTs)}</td>
                <td>{e.ongoing ? <Badge $crit>⚠ триває</Badge> : fmtDateTime(e.endTs)}</td>
                <td>{fmtDuration(e.durationSec)}</td>
                <td>{e.startSoc != null ? Math.round(e.startSoc) : '—'}% → {e.endSoc != null ? `${Math.round(e.endSoc)}%` : '—'}</td>
              </tr>
            ))}
            {data && data.events.length === 0 && <tr><EmptyCell colSpan={4}>За цей період відключень не зафіксовано</EmptyCell></tr>}
          </tbody>
        </Table>
      </Card>
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
      <Card>
        <Heading>Розпізнані метрики</Heading>
        <Pre>{JSON.stringify(data?.metrics ?? {}, null, 2)}</Pre>
        <Muted as="p">
          Якщо тут бракує потрібних метрик або значення відрізняються від застосунку EcoFlow, поправ мапінг
          у <code>server/src/metrics.js</code>, підібравши ключі зі списку нижче.
          {data?.restError && ` REST: ${data.restError}`}
        </Muted>
      </Card>
      <Card>
        <Heading>Сирі ключі від станції ({rows.length})</Heading>
        <Search type="search" placeholder="Фільтр за назвою ключа…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Scroll>
          <Table>
            <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>)}</tbody>
          </Table>
        </Scroll>
      </Card>
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
    <Shell>
      <Header>
        <Title>⚡ EcoFlow Монітор</Title>
        <Cluster>
          {tab !== 'live' && devices?.length > 1 && (
            <Select value={sn ?? ''} onChange={(e) => setSn(e.target.value)} aria-label="Станція">
              {devices.map((d) => <option key={d.sn} value={d.sn}>{d.name}</option>)}
            </Select>
          )}
          <Badge><Dot $on={connected} />{connected ? 'підключено' : 'немає зв’язку з сервером'}</Badge>
        </Cluster>
      </Header>
      <Tabs role="tablist">
        {TABS.map(([id, label]) => (
          <Tab key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</Tab>
        ))}
      </Tabs>
      {!devices && <Muted as="p">Завантаження…</Muted>}
      {devices?.length === 0 && <Muted as="p">Станцій не знайдено в акаунті.</Muted>}
      {devices?.length > 0 && (
        <>
          {tab === 'live' && <LiveTab devices={devices} sn={sn ?? devices[0].sn} />}
          {tab === 'stats' && <StatsTab sn={sn} />}
          {tab === 'blackouts' && <BlackoutsTab sn={sn} />}
          {tab === 'debug' && <DebugTab sn={sn} />}
        </>
      )}
    </Shell>
  );
}
