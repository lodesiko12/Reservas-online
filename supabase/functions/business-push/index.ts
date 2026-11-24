// business-push — Envía como notificación push (Web Push) los avisos pendientes del negocio
// (reservas online). Lo llama el cron `business-push-minutely` con la cabecera x-cron-secret.
// Reutiliza las suscripciones de agency_push_subscriptions y los secretos CRON_SECRET,
// VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { json, handleOptions } from "../_shared/cors.ts";
import { isAllowedPushEndpoint } from "../_shared/pushEndpoint.ts";

const VAPID_SUBJECT = "https://app.turnigo.es";
const BATCH = 100;
const MAX_AGE_MS = 24 * 3600 * 1000; // no se envían avisos de hace más de un día

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "No autorizado" }, 401);

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ ok: false, skipped: "Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY" });
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const since = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const { data: pending } = await admin
    .from("business_notifications").select("id").is("push_sent_at", null).gte("created_at", since)
    .order("created_at").limit(BATCH);
  if (!pending?.length) return json({ ok: true, sent: 0 });
  // Reclama el lote de forma atómica (ejecuciones solapadas no duplican avisos).
  const { data: claimed } = await admin
    .from("business_notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .in("id", pending.map((p) => p.id)).is("push_sent_at", null)
    .select("id, user_id, title");
  if (!claimed?.length) return json({ ok: true, sent: 0 });

  const userIds = [...new Set(claimed.map((n) => n.user_id))];
  const { data: subs } = await admin
    .from("agency_push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(claimed.flatMap((n) =>
    (byUser.get(n.user_id) ?? []).map(async (s) => {
      if (!isAllowedPushEndpoint(s.endpoint)) { dead.push(s.id); return; }
      const payload = JSON.stringify({ title: n.title, body: "", tag: `biz-${n.id}`, url: "/app/notificaciones" });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error("push error", code, (e as Error).message);
      }
    })
  ));
  if (dead.length) await admin.from("agency_push_subscriptions").delete().in("id", dead);
  return json({ ok: true, notifications: claimed.length, sent, removed: dead.length });
});
