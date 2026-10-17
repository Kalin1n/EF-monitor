import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// У dev-режимі /api проксюється на бекенд. Порт можна змінити: API_PORT=5055 npm run dev
const target = `http://127.0.0.1:${process.env.API_PORT ?? 5000}`;

export default defineConfig({
  plugins: [react()],
  // Статична збірка (GitHub Pages) живе в підкаталозі /<repo>/, тому відносні шляхи
  base: process.env.VITE_STATIC === '1' ? './' : '/',
  server: { proxy: { '/api': target } },
});
