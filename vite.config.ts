import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // never ship original source (audit §3.10)
    rollupOptions: {
      // the game, plus the account-deletion page Google Play requires on the web
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        deleteAccount: resolve(import.meta.dirname, 'delete-account.html'),
      },
    },
    target: 'es2022',
  },
});
