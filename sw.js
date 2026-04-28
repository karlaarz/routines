const CACHE = 'glow-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json'];

// ── INSTALL ────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH (cache-first) ────────────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── SCHEDULED NOTIFICATIONS ────────────────────────────────────
let scheduledTimers = [];

self.addEventListener('message', e => {
  if (e.data?.type !== 'SCHEDULE') return;
  // clear previous timers
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];

  const routines = e.data.routines || [];
  const now = new Date();

  routines.forEach(r => {
    if (!r.reminderTime) return;
    const [hh, mm] = r.reminderTime.split(':').map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);
    const delay = target - now;
    if (delay <= 0) return; // already passed today

    const t = setTimeout(() => {
      self.registration.showNotification(`Glow ✨ – ${r.name}`, {
        body: `Tu cuidado de ${r.zone.toLowerCase()} te espera 🌸`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: r.id,
        vibrate: [200, 100, 200],
        data: { url: '/' }
      });
    }, delay);

    scheduledTimers.push(t);
  });
});

// ── NOTIFICATION CLICK ─────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
