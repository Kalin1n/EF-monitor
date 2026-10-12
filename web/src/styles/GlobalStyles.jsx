import React from 'react';
import { Global } from '@emotion/react';

// Колірні токени (EF-5) як CSS-змінні: тема перемикається через prefers-color-scheme
// або примусово через [data-theme] на <html>, без перерендеру компонентів.
const light = `
  color-scheme: light;
  --page: #f7f7f4;
  --surface: #fdfdfb;
  --surface-sunken: #efeee9;
  --ink: #111110;
  --ink-2: #4f4e4a;
  --muted: #6a6863; /* ≥4.5:1 на page/surface */
  --grid: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(17, 17, 16, 0.12);
  --accent: #2a6fc9; /* фокус */
  --series-in: #2a78d6; /* надійшло (слот 1) */
  --series-out: #dc5a24; /* витрачено (слот 2) */
  --series-solar: #13926a; /* сонце (слот 3) */
  --critical: #c42f2f;
  --good-text: #1d6b1d;
  --bad-text: #b02a2a;
  --warn-text: #8a5300;
  --warn-bg: #fbf1de;
`;

const dark = `
  color-scheme: dark;
  --page: #0e0e0d;
  --surface: #1a1a19;
  --surface-sunken: #141413;
  --ink: #f0efec;
  --ink-2: #c3c2b7;
  --muted: #8f8d86;
  --grid: #2c2c2a;
  --axis: #45443f;
  --border: rgba(255, 255, 255, 0.12);
  --accent: #5a9cf0;
  --series-in: #3987e5;
  --series-out: #e0682f;
  --series-solar: #22ad7d;
  --critical: #ef6b6b;
  --good-text: #3fbf5a;
  --bad-text: #ef7b7b;
  --warn-text: #e8b25c;
  --warn-bg: #2a2214;
`;

const styles = `
  :root { ${light} }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme='light'])) { ${dark} }
  }
  :root[data-theme='dark'] { ${dark} }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--page);
    color: var(--ink);
    font: 15px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .recharts-legend-item-text { color: var(--ink-2) !important; }
`;

export default function GlobalStyles() {
  return <Global styles={styles} />;
}
