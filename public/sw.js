// Service Worker — Lumu PWA
const CACHE_VERSION = '2026-03-06a';
const CACHE_NAME = `lumu-${CACHE_VERSION}`;
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/images/icon-192.svg',
    '/images/icon-512.svg',
    '/images/og-cover.png'
];

// Install: Pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Cache-first for static assets, network-first for API calls
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip API calls, analytics, fonts, and external resources (let them go to network)
    if (url.pathname.startsWith('/api/') ||
        url.hostname.includes('googlesyndication') ||
        url.hostname.includes('googleads') ||
        url.hostname.includes('google-analytics') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('supabase')) {
        return;
    }

    // Cache-first for static assets (CSS, JS, images, fonts)
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|eot)(\?.*)?$/) ||
        url.pathname === '/' ||
        url.pathname === '/index.html') {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    // Return cached, but update in background (stale-while-revalidate)
                    const fetchPromise = fetch(request).then(response => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    }).catch(() => cached);

                    return cached;
                }
                // Not cached — fetch and cache
                return fetch(request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first for HTML pages (terminos, privacidad, etc.)
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached => {
                if (cached) return cached;
                // Offline fallback: return a friendly offline page
                return new Response(
                    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin Conexión - Lumu</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#334155;text-align:center;padding:2rem}.container{max-width:400px}h1{font-size:2rem;margin-bottom:.5rem}p{color:#64748b;margin-bottom:1.5rem;line-height:1.6}.icon{font-size:4rem;margin-bottom:1rem}button{background:#10b981;color:white;border:none;padding:.75rem 2rem;border-radius:1rem;font-weight:700;font-size:1rem;cursor:pointer}button:hover{background:#059669}</style></head><body><div class="container"><div class="icon">📡</div><h1>Sin Conexión</h1><p>Parece que no tienes internet. Verifica tu conexión e intenta de nuevo.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`,
                    { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
                );
            }))
    );
});

// Push Notifications — handle server-sent push events
self.addEventListener('push', (event) => {
    let data = { title: 'Lumu', body: '¡Tienes una actualización!', icon: '/images/icon-192.svg', url: '/' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/images/icon-192.svg',
            badge: '/images/icon-192.svg',
            data: { url: data.url || '/' },
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'Ver ahora' },
                { action: 'dismiss', title: 'Descartar' }
            ]
        })
    );
});

// Notification click — open the app or focus existing tab
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(c => c.navigate(targetUrl));
                }
            }
            return clients.openWindow(targetUrl);
        })
    );
});
