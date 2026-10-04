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
