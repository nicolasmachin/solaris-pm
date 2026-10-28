// Service worker de Voltia PM. Hace dos cosas y nada más:
//   1. Permite instalarla como aplicación en el celular o la computadora.
//   2. Recibe los avisos push y los muestra; al tocarlos abre la pantalla.
// No guarda páginas ni datos en caché a propósito: una caché vieja deja a la
// gente mirando una versión anterior después de cada deploy.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Chrome pide un manejador de fetch para ofrecer "Instalar". Deja pasar todo.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Voltia";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-maskable-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si Voltia ya está abierta, se usa esa ventana en vez de abrir otra.
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin)) {
          await v.focus();
          if ("navigate" in v) return v.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
