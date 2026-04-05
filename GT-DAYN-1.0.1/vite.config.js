import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      const items = [
        ['src',          'dist/src'],
        ['fonts',        'dist/fonts'],
        ['sw.js',        'dist/sw.js'],
        ['manifest.json','dist/manifest.json'],
      ];
      for (const [src, dst] of items) {
        if (!fs.existsSync(src)) continue;
        if (fs.statSync(src).isDirectory()) fs.cpSync(src, dst, { recursive: true });
        else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
      }
      if (fs.existsSync('public')) fs.cpSync('public', 'dist/public', { recursive: true });

      // نسخ sql.js للعمل أوفلاين في Capacitor
      const sqlSrc = 'node_modules/sql.js/dist';
      if (fs.existsSync(sqlSrc)) {
        fs.copyFileSync(path.join(sqlSrc, 'sql-wasm.js'),   'dist/sql-wasm.js');
        fs.copyFileSync(path.join(sqlSrc, 'sql-wasm.wasm'), 'dist/sql-wasm.wasm');
        console.log('[GT-DAYN] sql.js copied to dist/');
      }
      console.log('[GT-DAYN] dist/ ready ✓');
    }
  };
}

export default defineConfig({
  root:      '.',
  publicDir: false,
  build: {
    outDir:      'dist',
    emptyOutDir: true,
    minify:      false,
    rollupOptions: { input: resolve(__dirname, 'index.html') },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  plugins: [copyAssetsPlugin()],
});
