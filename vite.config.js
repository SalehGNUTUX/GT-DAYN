import { defineConfig } from 'vite';
import { VitePWA   } from 'vite-plugin-pwa';

export default defineConfig({
  root:    '.',           // ← الجذر مباشرة (GitHub Pages)
  publicDir: 'public',

  resolve: {
    alias: {
      '@core': '/src/core',
      '@ui':   '/src/ui',
    },
  },

  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },

  // sql.js يحتاج header خاص لـ SharedArrayBuffer (WASM threading)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  optimizeDeps: {
    exclude: ['sql.js'],   // WASM لا يُحسَّن من Vite
  },

  plugins: [
    VitePWA({
      registerType:   'autoUpdate',
      injectRegister: 'auto',
      srcDir:         '.',      // sw.js في الجذر
      filename:       'sw.js',
      workbox: {
        globPatterns:    ['**/*.{js,css,html,wasm,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\//,
            handler:    'CacheFirst',
            options:    { cacheName: 'cdn-cache', expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
        ],
      },
      manifest: {
        name:             'GT-DAYN — سجل الديون',
        short_name:       'GT-DAYN',
        description:      'مدير الديون والمصاريف الذكي',
        theme_color:      '#1e1b4b',
        background_color: '#f0f4f8',
        display:          'standalone',
        orientation:      'portrait',
        lang:             'ar',
        dir:              'rtl',
        start_url:        './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
