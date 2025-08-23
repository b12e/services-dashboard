// service-worker.js
const CACHE_NAME = 'services-dashboard-v1';
const IMAGE_CACHE_NAME = 'services-images-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/base.js',
    '/services.json',
    '/manifest.json',
    '/configuration.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => {
                console.log('Error caching static assets:', err);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        return cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME;
                    })
                    .map(cacheName => {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Handle image requests from CDN
    if (url.hostname === 'cdn.jsdelivr.net' && 
        (url.pathname.includes('/dashboard-icons/svg/') || 
         url.pathname.includes('/dashboard-icons/png/'))) {
        
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        console.log('Serving image from cache:', url.pathname);
                        return response;
                    }
                    
                    // Fetch from network and cache
                    return fetch(event.request).then(networkResponse => {
                        // Only cache successful responses
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                            console.log('Cached new image:', url.pathname);
                        }
                        return networkResponse;
                    }).catch(err => {
                        console.log('Network request failed for image:', err);
                        // Return a fallback if both cache and network fail
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }
    
    // Handle services.json with network-first strategy for freshness
    if (url.pathname.endsWith('services.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache with fresh data
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            
            // Fallback to network
            return fetch(event.request).then(networkResponse => {
                // Optionally cache other successful responses
                if (networkResponse && networkResponse.status === 200 && 
                    event.request.method === 'GET') {
                    
                    // Cache HTML and other assets
                    if (url.origin === self.location.origin) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }
                return networkResponse;
            });
        })
    );
});

// Optional: Background sync for updating services.json
self.addEventListener('sync', event => {
    if (event.tag === 'update-services') {
        event.waitUntil(
            fetch('/services.json')
                .then(response => response.json())
                .then(data => {
                    console.log('Services updated in background');
                    // Could send a message to clients to refresh
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'services-updated',
                                data: data
                            });
                        });
                    });
                })
        );
    }
});