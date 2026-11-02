/* MEKX service worker: يخزّن الواجهة ليعمل البرنامج دون اتصال.
   عند تحديث الملف غيّر رقم النسخة في CACHE ليصل التحديث للأجهزة. */
const CACHE = 'mekx-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(u => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('mekx-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // لا نعترض مزامنة Supabase إطلاقاً
  if (u.pathname.includes('/rest/v1/') || u.pathname.includes('/auth/v1/')) return;

  // فتح الصفحة: الشبكة أولاً (لتصل التحديثات)، وإلا النسخة المخزنة
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const n = await fetch(r);
        if (n && n.ok) { const c = await caches.open(CACHE); c.put(r, n.clone()); }
        return n;
      } catch (_) {
        return (await caches.match(r, { ignoreSearch: true })) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  // الملفات الثابتة والخطوط: من المخزن فوراً مع تحديثها في الخلفية
  if (u.origin === location.origin || u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(r);
      const net = fetch(r).then(n => { if (n && (n.ok || n.type === 'opaque')) c.put(r, n.clone()); return n; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
