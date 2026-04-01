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
    // ✅ Vite dev 서버 및 빌드 시 핵심 deps를 미리 번들링하여 로딩 속도 및 호환성 향상 🐧⚡
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'react-markdown',
        'remark-gfm',
        'unified',
        'vfile',
        'vfile-message',
        'remark-parse',
        'remark-stringify',
        'mdast-util-from-markdown',
        'mdast-util-to-string',
        'micromark',
        'unist-util-stringify-position',
        'mdast-util-gfm',
        'micromark-extension-gfm'
      ],
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          // ✅ App과 LoadingSplash를 별도 청크로 분리하여 초기 로딩 속도 향상 🐧🚀
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // ✅ ESM 패키지 경로 명시적 해결을 위한 별칭 대폭 보강 🐧⚡
        // Windows/Linux 경로 호환성을 위해 path.join 사용
        'react-markdown': path.join(__dirname, 'node_modules/react-markdown/index.js'),
        'remark-gfm': path.join(__dirname, 'node_modules/remark-gfm/index.js'),
        'unified': path.join(__dirname, 'node_modules/unified/index.js'),
        'vfile': path.join(__dirname, 'node_modules/vfile/index.js'),
        'vfile-message': path.join(__dirname, 'node_modules/vfile-message/index.js'),
        'remark-parse': path.join(__dirname, 'node_modules/remark-parse/index.js'),
        'remark-stringify': path.join(__dirname, 'node_modules/remark-stringify/index.js'),
        'mdast-util-from-markdown': path.join(__dirname, 'node_modules/mdast-util-from-markdown/index.js'),
        'mdast-util-to-string': path.join(__dirname, 'node_modules/mdast-util-to-string/index.js'),
        'micromark': path.join(__dirname, 'node_modules/micromark/index.js'),
        'unist-util-stringify-position': path.join(__dirname, 'node_modules/unist-util-stringify-position/index.js'),
        'mdast-util-gfm': path.join(__dirname, 'node_modules/mdast-util-gfm/index.js'),
        'micromark-extension-gfm': path.join(__dirname, 'node_modules/micromark-extension-gfm/index.js'),
      },
      mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
      preserveSymlinks: true
    },
    // ✅ ESM 패키지를 외부 라이브러리로 취급하지 않고 반드시 번들에 포함하도록 강제 🐧📦
    ssr: {
      noExternal: [
        /^react-markdown/,
        /^remark-/,
        /^unified/,
        /^vfile/,
        /^mdast-util-/,
        /^micromark/,
        /^unist-util-/,
        /^hast-util-/,
        /^decode-named-character-reference/,
        /^character-entities/,
        /^property-information/,
        /^hast-util-whitespace/,
        /^space-separated-tokens/,
        /^comma-separated-tokens/
      ]
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      css: true,
    }
  };
});
