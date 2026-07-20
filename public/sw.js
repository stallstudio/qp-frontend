/* Service worker Queue Park — UNIQUEMENT le push (pas de cache offline, pour ne
 * rien casser au fonctionnement normal de l'app). Enregistré à la demande par le
 * client au moment où l'utilisateur active une notification (voir lib/push-client.ts).
 */

// Active immédiatement le nouveau SW sans attendre la fermeture des onglets.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Réception d'un message push : on affiche la notification système. Le payload
// est le JSON envoyé par lib/web-push.ts ({ title, body, url, tag }).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }

  const title = data.title || "Queue Park";
  const options = {
    body: data.body || "",
    icon: "/web-app-manifest-192x192.png",
    badge: "/web-app-manifest-192x192.png",
    // `tag` : une notif par attraction remplace la précédente au lieu d'empiler.
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    // URL à ouvrir au clic, transportée jusqu'au handler notificationclick.
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification : on focalise un onglet déjà ouvert sur l'app si
// possible, sinon on en ouvre un sur l'URL cible.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(targetUrl);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
