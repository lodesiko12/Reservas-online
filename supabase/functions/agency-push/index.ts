// agency-push — Envía como notificación push (Web Push) los avisos pendientes de la agencia.
// Lo llama el cron `agency-push-minutely` (pg_cron + pg_net) con la cabecera x-cron-secret.
// Secretos de la función: CRON_SECRET (ya existente), VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { json, handleOptions } from "../_shared/cors.ts";

const VAPID_SUBJECT = "https://turnigo-panel.lodesiko12.workers.dev";
const BATCH = 100;
const MAX_AGE_MS = 24 * 3600 * 1000; // no se envían avisos de hace más de un día

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "No autorizado" }, 401);

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ ok: false, skipped: "Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY" });
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Reclama el lote de forma atómica (varias ejecuciones solapadas no duplican avisos).
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const { data: pending } = await admin
    .from("agency_notifications").select("id").is("push_sent_at", null).gte("created_at", since)
    .order("created_at").limit(BATCH);
  if (!pending?.length) return json({ ok: true, sent: 0 });
  const { data: claimed } = await admin
    .from("agency_notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .in("id", pending.map((p) => p.id)).is("push_sent_at", null)
    .select("id, user_id, title, body, team_id, task_id");
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
      const payload = JSON.stringify({
        title: n.title,
        body: n.body ?? "",
        tag: `agency-${n.id}`,
        url: n.task_id && n.team_id ? `/app/equipos/${n.team_id}?tarea=${n.task_id}` : "/app/avisos",
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // suscripción caducada
        else console.error("push error", code, (e as Error).message);
      }
    })
  ));
  if (dead.length) await admin.from("agency_push_subscriptions").delete().in("id", dead);
  return json({ ok: true, notifications: claimed.length, sent, removed: dead.length });
});
