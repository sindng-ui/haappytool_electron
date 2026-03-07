import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      strictPort: true, // 🐧⚡ 포트 3000 고정 (electron 실행 대기용)
      host: '127.0.0.1',
      watch: {
        usePolling: true,
      },
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
      react()
    ],
    worker: {
      format: 'iife',
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // ✅ App과 LoadingSplash를 별도 청크로 분리하여 초기 로딩 속도 향상 🐧🚀
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
          }
        }
      }
    },
    // ✅ Vite dev 서버 첫 접근 시 핵심 deps를 미리 번들링하여 로딩 속도 향상 🐧⚡
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
      ],
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
