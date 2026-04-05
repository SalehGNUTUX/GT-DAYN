/**
 * GT-DAYN — sw.js  v1.0.0
 * Cache-First + Stale-While-Revalidate
 * بعد أول تحميل ناجح يعمل كاملاً بدون إنترنت
 */

const APP_VERSION  = '1.0.0';
const CACHE_STATIC = `gt-dayn-static-${APP_VERSION}`;
const CACHE_CDN    = `gt-dayn-cdn-${APP_VERSION}`;

const LOCAL_ASSETS = [
  './', './index.html', './manifest.json',
  './src/core/App.js',
  './src/core/db/schema.sql', './src/core/db/WebSQLiteAdapter.js',
  './src/core/db/DbAdapter.js', './src/core/db/migrate.js',
  './src/core/services/DebtService.js', './src/core/services/BudgetService.js',
  './src/core/services/DriveService.js', './src/core/services/NotificationService.js',
  './src/ui/components/ui.js', './src/ui/components/shareCard.js',
  './src/ui/styles/tokens.css',
  './fonts/Ubuntu Arabic Regular.otf',
];

const CDN_URLS = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const s = await caches.open(CACHE_STATIC);
    await Promise.allSettled(LOCAL_ASSETS.map(u => s.add(u).catch(() => {})));
    const c = await caches.open(CACHE_CDN);
    await Promise.allSettled(CDN_URLS.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const valid = [CACHE_STATIC, CACHE_CDN];
    const keys  = await caches.keys();
    await Promise.all(keys.filter(k => !valid.includes(k)).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
  if (request.method !== 'GET') return;
  if (url.includes('googleapis.com/drive') || url.includes('accounts.google.com') || url.includes('oauth2')) return;

  if (url.includes('cdnjs.') || url.includes('fonts.google') || url.includes('fonts.gstatic') || url.includes('cdn.jsdelivr')) {
    event.respondWith(swr(request, CACHE_CDN));
    return;
  }
  event.respondWith((async () => {
    const c = await caches.open(CACHE_STATIC);
    const cached = await c.match(request);
    if (cached) return cached;
    try {
      const r = await fetch(request);
      if (r.ok) c.put(request, r.clone()).catch(() => {});
      return r;
    } catch {
      if (request.headers.get('accept')?.includes('text/html')) return caches.match('./index.html');
    }
  })());
});

async function swr(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const net = fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()).catch(() => {}); return r; }).catch(() => null);
  return cached || net;
}

self.addEventListener('push', event => {
  const d = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(d.title ?? 'GT-DAYN', {
    body: d.body ?? 'لديك دفعة مستحقة', icon: './icons/all/192x192/GT-DAYN-icon.png',
    dir: 'rtl', lang: 'ar', vibrate: [200,100,200], data: { url: d.url ?? './' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? './'));
});
