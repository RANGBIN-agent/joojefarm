// گله‌یار — service worker: پوستهٔ برنامه برای باز شدن سریع؛ داده‌ها هرگز کش نمی‌شوند.
const C = 'gelehyar-v10';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // supabase و CDN دست‌نخورده
  // صفحه: اول شبکه (همیشه آخرین نسخه)، بدون اینترنت از کش
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(x => { const y = x.clone(); caches.open(C).then(c => c.put('index.html', y)); return x; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(r).then(h => h || fetch(r).then(x => { const y = x.clone(); caches.open(C).then(c => c.put(r, y)); return x; })));
});
