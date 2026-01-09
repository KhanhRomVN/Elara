import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
      },
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: [
          'electron',
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          ...Object.keys(require('./package.json').dependencies || {}),
        ],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
      },
    },
    build: {
      outDir: 'out/preload',
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/renderer/src/shared'),
        '@core': resolve('src/renderer/src/core'),
        '@features': resolve('src/renderer/src/features'),
      },
    },
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
    },
  },
});
