import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base './' permite publicar em subpasta (ex.: GitHub Pages: usuario.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: true },
});
