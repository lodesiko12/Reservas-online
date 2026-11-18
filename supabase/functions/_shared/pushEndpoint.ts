// Validación del endpoint de una suscripción Web Push antes de que el servidor lo llame.
// Cualquier usuario autenticado puede guardar un endpoint en agency_push_subscriptions
// (RPC agency_save_push_subscription), así que sin esta comprobación el Edge Function
// terminaría haciendo un POST a una URL elegida por el usuario.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => host === h || host.endsWith("." + h));
}
