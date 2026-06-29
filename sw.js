const CACHE_NAME = 'fizu-v19';

// Só cacheia assets que nunca mudam (fontes, libs externas)
// HTML NUNCA é cacheado — sempre busca do servidor
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(STATIC_ASSETS.map(url =>
        cache.add(url).catch(() => {}) // ignora erros de assets que não existem
      ));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deletando cache antigo:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // NUNCA intercepta: Supabase, APIs externas, analytics
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('pollinations.ai') ||
    url.hostname.includes('resend.com')
  ) {
    return; // deixa passar direto
  }

  // HTML (navegação) — SEMPRE busca da rede, nunca do cache
  if (
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .catch(() => caches.match('/feed.html')) // só usa cache offline
    );
    return;
  }

  // Assets estáticos (fontes, ícones, manifest) — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && (
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.json') ||
          url.pathname.endsWith('.ico') ||
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com')
        )) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'Fizu', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || '🌊 Fizu', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: data.vibrate || [200, 100, 200],
      tag: data.tag || 'fizu-notif',
      renotify: true,
      requireInteraction: !!data.requireInteraction,
      data: { url: data.url || '/feed' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const target = e.notification.data?.url || '/feed';
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
