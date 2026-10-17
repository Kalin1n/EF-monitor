import { useEffect, useState } from 'react';

// Статична збірка для GitHub Pages: замість бекенду читає знімок demo-API з JSON-файлів
// (їх генерує web/scripts/snapshot.mjs). /series?sn=X&hours=24 → api/series/sn-X/hours-24.json
export const STATIC = import.meta.env.VITE_STATIC === '1';

export const staticPath = (path) =>
  `api${path.replace('?', '/').replaceAll('&', '/').replaceAll('=', '-')}.json`;

export async function api(path) {
  const url = STATIC ? `${import.meta.env.BASE_URL}${staticPath(path)}` : `/api${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

/** Хук: завантажує дані з API і перезавантажує при зміні залежностей. */
export function useApi(path, deps = [], refreshMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    const load = () =>
      api(path)
        .then((data) => alive && setState({ data, error: null, loading: false }))
        .catch((error) => alive && setState((s) => ({ ...s, error, loading: false })));
    setState((s) => ({ ...s, loading: true }));
    load();
    const t = refreshMs ? setInterval(load, refreshMs) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return state;
}

/** Живі дані по SSE (/api/stream). */
export function useLive() {
  const [devices, setDevices] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (STATIC) {
      api('/devices').then(setDevices).catch(() => setDevices([]));
      return undefined;
    }
    const es = new EventSource('/api/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => setDevices(JSON.parse(e.data));
    return () => es.close();
  }, []);
  return { devices, connected };
}
