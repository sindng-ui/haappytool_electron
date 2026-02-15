import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
      proxy: {
        '/lm-studio': {
          target: 'http://localhost:1234/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/lm-studio/, ''),
        },
      },
    },
    base: './',
    plugins: [
      react(),
      wasm(),
      topLevelAwait()
    ],
    worker: {
      format: 'es',
      plugins: () => [
        wasm(),
        topLevelAwait()
      ]
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      css: true,
    }
  };
});
