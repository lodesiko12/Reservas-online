// Service worker mínimo: hace la app instalable y sirve una página de aviso sin conexión.
// No cachea datos ni código (todo va a Supabase y los bundles llevan hash), así que
// nunca muestra información desfasada.
const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Nunito,system-ui,sans-serif;background:#F3F7F6;color:#0F2A2A;text-align:center;padding:24px}button{margin-top:16px;padding:10px 20px;border:0;border-radius:12px;background:#0B6E6A;color:#fff;font-size:16px}</style></head><body><div><h1>Sin conexión</h1><p>Turnigo necesita internet para mostrar tus reservas.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});

// Notificaciones push de la agencia (Web Push). El servidor (agency-push) envía
// { title, body, tag, url }; al pulsar se abre/enfoca la app en esa ruta.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Turnigo", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Turnigo", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/app/avisos" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/avisos";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
