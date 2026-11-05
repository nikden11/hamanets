// Офлайн-кеш оболонки застосунку. При зміні файлів — збільшити VERSION.
const VERSION = 'hamanets-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/db.js', './js/calc.js', './js/util.js', './js/monefy.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Спершу мережа (щоб оновлення приходили одразу), але не довше 2,5 с — далі кеш.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  // no-cache: перевіряти на сервері, а не брати з HTTP-кешу (GitHub Pages кешує на 10 хв)
  const network = (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache' }) : fetch(req, { cache: 'no-cache' })).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  });
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache().then(finish), 2500);
    network.then((r) => { clearTimeout(timer); finish(r); })
      .catch(() => { clearTimeout(timer); fromCache().then((r) => finish(r || Response.error())); });
  }));
});
