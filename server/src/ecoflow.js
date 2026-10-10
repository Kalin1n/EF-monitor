import crypto from 'node:crypto';
import { config } from './config.js';

export class EcoflowError extends Error {
  constructor(code, message) {
    super(`EcoFlow API ${code}: ${message}`);
    this.code = String(code);
  }
}

/**
 * Підпис Developer API: відсортовані за ASCII параметри запиту,
 * далі accessKey, nonce, timestamp; HMAC-SHA256 (hex) секретним ключем.
 */
export function sign(params, { accessKey, secretKey, nonce, timestamp }) {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`);
  parts.push(`accessKey=${accessKey}`, `nonce=${nonce}`, `timestamp=${timestamp}`);
  return crypto.createHmac('sha256', secretKey).update(parts.join('&')).digest('hex');
}

// ЄДИНА функція, що ходить в API. Тільки GET — цей моніторинг нічого не змінює на станціях.
async function get(path, params = {}) {
  const nonce = String(crypto.randomInt(100000, 999999));
  const timestamp = String(Date.now());
  const signature = sign(params, {
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    nonce,
    timestamp,
  });
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${config.apiBase}${path}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { accessKey: config.accessKey, nonce, timestamp, sign: signature },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  const body = await res.json();
  if (String(body.code) !== '0') throw new EcoflowError(body.code, body.message);
  return body.data;
}

export const getDevices = () => get('/iot-open/sign/device/list');
export const getQuota = (sn) => get('/iot-open/sign/device/quota/all', { sn });
export const getCertification = () => get('/iot-open/sign/certification');
