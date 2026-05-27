const CACHE_NAME = 'my-life-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './api.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Có thể lỗi nếu file không tồn tại, nên ta bỏ qua lỗi từng file
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url))
        );
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Ưu tiên network, nếu rớt mạng thì xài cache
        return fetch(event.request).catch(() => response);
      })
  );
});
