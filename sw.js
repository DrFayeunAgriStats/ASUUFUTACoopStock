const cacheName = 'asuu-stock-demo-2';
const files = ['./', './style.css', './app.js', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files))));
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('asuu-stock-demo-1'));
});
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
