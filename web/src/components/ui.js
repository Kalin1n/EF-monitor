import styled from '@emotion/styled';

/* ---------- Каркас ---------- */
export const Shell = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px;
`;

export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

export const Title = styled.h1`
  font-size: 20px;
  margin: 0;
`;

export const Cluster = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

export const Heading = styled.h2`
  font-size: 15px;
  margin: 0 0 8px;
  color: var(--ink-2);
  font-weight: 600;
`;

export const Muted = styled.div`
  color: var(--muted);
  font-size: 13px;
  margin-top: ${(p) => (p.$gap ? '6px' : 0)};
`;

/* ---------- Керування ---------- */
const control = `
  font: inherit;
  color: var(--ink-2);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
`;

const selected = `
  color: var(--ink);
  background: var(--surface);
  border-color: var(--axis);
  font-weight: 600;
`;

export const Tabs = styled.nav`
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

export const Tab = styled.button`
  ${control}
  &:hover { color: var(--ink); }
  &[aria-selected='true'] { ${selected} }
`;

export const Seg = styled.div`
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
`;

export const SegButton = styled.button`
  ${control}
  &:hover { color: var(--ink); }
  &[aria-pressed='true'] { ${selected} }
`;

export const Select = styled.select`
  ${control}
  background: var(--surface);
  color: var(--ink);
`;

export const Search = styled.input`
  font: inherit;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  width: 100%;
  margin-bottom: 8px;
`;

/* ---------- Картки ---------- */
export const Card = styled.div`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
`;

export const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: ${(p) => (p.$center ? 'center' : 'flex-start')};
  flex-wrap: wrap;
  gap: 8px;
  h2 { margin: ${(p) => (p.$center ? 0 : '0 0 8px')}; }
`;

export const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-bottom: 12px;
  && > * { margin-bottom: 0; }
`;

export const Hero = styled.div`
  font-size: 40px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin-top: ${(p) => (p.$gap ? '8px' : 0)};
`;

export const HeroUnit = styled.small`
  font-size: 16px;
  font-weight: 400;
  color: var(--ink-2);
  margin-left: 4px;
`;

export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 0;
  color: var(--ink-2);
  b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
`;

export const Meter = styled.div`
  height: 8px;
  background: var(--surface-sunken);
  border-radius: 4px;
  margin: 8px 0 10px;
  overflow: hidden;
`;

export const MeterFill = styled.i`
  display: block;
  height: 100%;
  background: var(--series-in);
  border-radius: 4px;
`;

export const Stack = styled.div`
  margin-top: 6px;
  display: grid;
  gap: 2px;
`;

/* ---------- Статуси ---------- */
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$crit ? 'var(--critical)' : 'var(--border)')};
  color: ${(p) => (p.$crit ? 'var(--critical)' : 'var(--ink-2)')};
  font-weight: ${(p) => (p.$crit ? 600 : 400)};
  margin-top: ${(p) => (p.$gap ? '8px' : 0)};
`;

export const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? 'var(--series-solar)' : 'var(--muted)')};
`;

export const Notice = styled.div`
  background: var(--warn-bg);
  color: var(--warn-text);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 8px 0;
  font-size: 13px;
`;

export const DeltaText = styled.span`
  font-size: 13px;
  color: ${(p) => (p.$muted ? 'var(--muted)' : 'var(--ink-2)')};
`;

/* ---------- Таблиці й дані ---------- */
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--grid); }
  th:first-of-type, td:first-of-type { text-align: left; }
  th { color: var(--ink-2); font-weight: 600; }
  td { font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: var(--surface-sunken); }
`;

export const EmptyCell = styled.td`
  color: var(--muted);
`;

export const Scroll = styled.div`
  max-height: 420px;
  overflow: auto;
`;

export const Pre = styled.pre`
  margin: 0;
  color: var(--ink-2);
`;

/* ---------- Підказка графіка ---------- */
export const Tip = styled.div`
  background: var(--surface);
  border: 1px solid var(--axis);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--ink);
`;

export const TipLabel = styled.div`
  color: var(--ink-2);
`;

export const TipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const Swatch = styled.i`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
  background: ${(p) => p.$color};
`;
