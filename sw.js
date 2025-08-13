const CACHE_NAME = 'seaguard-v2-1-pages-cache';
const ASSETS = [
  './','./index.html','./manifest.webmanifest',
  './js/main.js','./js/tracker.js','./js/ui.js','./js/utils.js','./js/pose.js','./js/flow.js','./js/demo.js',
  './assets/icon-192.png','./assets/icon-512.png'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k))))));
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
