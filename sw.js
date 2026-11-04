// offline support: serves files from the cache first and refreshes them in the background
importScripts('precache.js');
const CACHE = 'arcade-' + self.PRECACHE_VERSION;

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(async (c) => {
        // add files one by one so a single missing file doesn't break the install
        for (const url of self.PRECACHE) { try { await c.add(url); } catch (err) { } }
    }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('arcade-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const sameOrigin = url.origin === location.origin;
    const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
    if (!sameOrigin && !font) return;
    e.respondWith(caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req, { ignoreSearch: sameOrigin });
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        const res = await net;
        return res || (req.mode === 'navigate' ? c.match('GameIndex.html') : Response.error());
    }));
});
