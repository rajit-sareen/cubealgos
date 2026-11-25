import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The worker holds the engine it started with, and hot updates never reach it, so an open
// tab would go on solving with the old one after `make wasm`
//
// The compiler writes the two files one after the other, hence the wait for both
const reloadEngine: Plugin = {
  name: 'reload-engine',
  configureServer(server) {
    let wait: ReturnType<typeof setTimeout> | undefined;
    const changed = (file: string) => {
      if (!/src\/engine\/engine\.(mjs|wasm)$/.test(file.replace(/\\/g, '/'))) return;
      clearTimeout(wait);
      wait = setTimeout(() => server.ws.send({ type: 'full-reload' }), 500);
    };
    server.watcher.on('change', changed).on('add', changed);
  },
};

// BASE_PATH serves the site from a subdirectory, /cubealgos/ on GitHub Pages
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), reloadEngine],
  worker: { format: 'es' },
  test: { environment: 'jsdom', setupFiles: 'test/setup.ts', testTimeout: 30000 },
});
