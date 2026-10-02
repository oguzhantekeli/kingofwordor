import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // never ship original source (audit §3.10)
    target: 'es2022',
  },
});
