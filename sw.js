/**
 * GT-DAYN — sw.js
 * Service Worker: Cache-First للموارد الثابتة، Network-First للبيانات
 */

const CACHE_NAME = 'gt-dayn-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
];

// ── Install: cache static assets ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // نحاول cache كل asset، ونتجاهل الفشل الفردي
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('SW: could not cache', url))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache-First with Network Fallback ──────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // تجاهل الطلبات غير GET وطلبات Drive API
  if (request.method !== 'GET') return;
  if (request.url.includes('googleapis.com/drive')) return;
  if (request.url.includes('accounts.google.com')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // cache فقط الردود الصحيحة
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // إذا كان الطلب لـ HTML — أرجع الصفحة الرئيسية (SPA fallback)
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ── Background Sync (للمزامنة عند عودة الإنترنت) ──────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'drive-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'DRIVE_SYNC_REQUESTED' })
        );
      })
    );
  }
});

// ── Push Notifications (تنبيه الدفعات المستحقة) ───────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'GT-DAYN', {
      body:    data.body ?? 'لديك دفعة مستحقة اليوم',
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-192.png',
      dir:     'rtl',
      lang:    'ar',
      vibrate: [200, 100, 200],
      data:    { url: data.url ?? './' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url ?? './')
  );
});
