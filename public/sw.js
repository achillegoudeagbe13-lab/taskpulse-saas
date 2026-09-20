self.addEventListener('push', (event) => {
  let data = { title: 'Mar-ci Flow', body: 'Nouvelle notification', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch { /* payload non JSON */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url)) return client.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
