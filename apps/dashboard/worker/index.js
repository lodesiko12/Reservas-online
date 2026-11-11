// Worker del panel: sirve los archivos de dist/ y redirige la URL antigua de workers.dev a app.turnigo.es.
// Solo se redirige el host exacto antiguo (las URL de previsualización de Cloudflare siguen funcionando).
// Ruta y parámetros se conservan, así que los enlaces antiguos (p. ej. "elegir contraseña") siguen valiendo.
// /sw.js no se redirige: un service worker ya registrado no puede actualizarse a través de una redirección.
const OLD_HOST = "turnigo-panel.lodesiko12.workers.dev";
const NEW_ORIGIN = "https://app.turnigo.es";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === OLD_HOST && url.pathname !== "/sw.js") {
      return Response.redirect(NEW_ORIGIN + url.pathname + url.search, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
