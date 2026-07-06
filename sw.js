// Service Worker — Tanika Olfactothèque
// Gère la réception des notifications push et le clic dessus

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let donnees = { titre: 'Tanika', corps: 'Ton affirmation du jour t\'attend ✦', url: '/' };
  try {
    if (event.data) donnees = event.data.json();
  } catch (e) {
    if (event.data) donnees.corps = event.data.text();
  }

  const options = {
    body: donnees.corps,
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    data: { url: donnees.url || '/' },
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(donnees.titre || 'Tanika ✦', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
