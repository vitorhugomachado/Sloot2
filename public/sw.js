/* Slooti — Service Worker para notificações push do staff */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Novo agendamento',
    body: 'Um cliente acabou de agendar online.',
    url: '/',
    tag: 'slooti-appointment',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    const text = event.data?.text?.();
    if (text) payload.body = text;
  }

  const options = {
    body: payload.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'slooti-appointment',
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, clientUrl.origin);
          if (clientUrl.pathname === target.pathname) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
