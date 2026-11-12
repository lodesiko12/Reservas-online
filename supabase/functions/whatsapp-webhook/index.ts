// whatsapp-webhook — Webhook de Meta (WhatsApp Cloud API). verify_jwt = false: lo llama Meta.
//   GET  : verificación del webhook (hub.verify_token = el que genera el panel para el negocio).
//   POST : mensajes entrantes y estados de entrega. Se valida X-Hub-Signature-256 con el
//          App Secret del negocio (enrutado por metadata.phone_number_id).
// Cada mensaje nuevo se guarda con whatsapp_ingest_message() y se avisa por push al staff
// del negocio (sin el texto del mensaje: son datos sensibles).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_SUBJECT = "https://app.turnigo.es";

const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function validSignature(secret: string, raw: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return safeEqual(mac, header.slice(7).toLowerCase());
}

// deno-lint-ignore no-explicit-any
function extractBody(m: any): { type: string; body: string | null } {
  const type = String(m.type ?? "other");
  switch (type) {
    case "text": return { type, body: m.text?.body ?? null };
    case "image": case "video": case "document": return { type, body: m[type]?.caption ?? null };
    case "audio": case "sticker": return { type, body: null };
    case "button": return { type: "text", body: m.button?.text ?? null };
    case "interactive": return { type: "text", body: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null };
    case "location": return { type, body: m.location?.name ?? m.location?.address ?? null };
    default: return { type: "other", body: null };
  }
}

async function pushToStaff(businessId: string, conversationId: string, contactName: string | null) {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return;
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
  const { data: members } = await service.from("business_users").select("user_id").eq("business_id", businessId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return;
  const { data: subs } = await service
    .from("agency_push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  const payload = JSON.stringify({
    title: "WhatsApp",
    body: contactName ? `Tienes un mensaje nuevo de ${contactName}` : "Tienes un mensaje nuevo",
    tag: `wa-${conversationId}`,
    url: `/app/mensajes?c=${conversationId}`,
  });
  const dead: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
      else console.error("push error", code, (e as Error).message);
    }
  }));
  if (dead.length) await service.from("agency_push_subscriptions").delete().in("id", dead);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // --- Verificación de Meta ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !token || !challenge) return text("Bad request", 400);
    const { data } = await service.from("business_integrations").select("business_id").eq("whatsapp_verify_token", token).maybeSingle();
    return data ? text(challenge) : text("Forbidden", 403);
  }
  if (req.method !== "POST") return text("Method not allowed", 405);

  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return text("Bad request", 400); }
  const sig = req.headers.get("x-hub-signature-256");

  // Cache por phone_number_id dentro de la petición.
  const bizCache = new Map<string, { business_id: string; secret: string | null; enabled: boolean } | null>();
  async function resolve(phoneId: string) {
    if (bizCache.has(phoneId)) return bizCache.get(phoneId)!;
    const { data: integ } = await service.from("business_integrations")
      .select("business_id, whatsapp_app_secret").eq("whatsapp_phone_number_id", phoneId).maybeSingle();
    let res = null;
    if (integ) {
      const { data: b } = await service.from("businesses").select("whatsapp_inbox_enabled").eq("id", integ.business_id).single();
      res = { business_id: integ.business_id, secret: integ.whatsapp_app_secret as string | null, enabled: !!b?.whatsapp_inbox_enabled };
    }
    bizCache.set(phoneId, res);
    return res;
  }

  let processed = 0;
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneId = value?.metadata?.phone_number_id;
      if (!phoneId) continue;
      const biz = await resolve(String(phoneId));
      // Sin negocio o sin App Secret no se puede autenticar: se rechaza.
      if (!biz?.secret || !(await validSignature(biz.secret, raw, sig))) return text("Invalid signature", 401);
      if (!biz.enabled) continue;

      try {
        const names = new Map<string, string>();
        for (const c of value?.contacts ?? []) if (c?.wa_id) names.set(String(c.wa_id), c?.profile?.name ?? "");

        for (const m of value?.messages ?? []) {
          const waId = String(m.from ?? "").replace(/\D/g, "");
          if (!waId || !m.id) continue;
          const { type, body } = extractBody(m);
          const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
          const { data, error } = await service.rpc("whatsapp_ingest_message", {
            p_business_id: biz.business_id, p_wa_id: waId, p_contact_name: names.get(waId) ?? null,
            p_wa_message_id: String(m.id), p_msg_type: type, p_body: body, p_wa_timestamp: ts,
          });
          if (error) { console.error("ingest error", error.message); continue; }
          const row = Array.isArray(data) ? data[0] : data;
          processed++;
          if (row?.inserted) {
            try { await pushToStaff(biz.business_id, row.conversation_id, names.get(waId) || null); }
            catch (e) { console.error("push failed", (e as Error).message); }
          }
        }

        for (const s of value?.statuses ?? []) {
          if (!s?.id || !s?.status) continue;
          const err = s.errors?.[0] ? `${s.errors[0].code ?? ""} ${s.errors[0].title ?? ""}`.trim() : null;
          await service.rpc("whatsapp_update_message_status", { p_wa_message_id: String(s.id), p_status: String(s.status), p_error: err });
        }
      } catch (e) {
        console.error("webhook change error", (e as Error).message);
      }
    }
  }
  // Siempre 200 una vez autenticado: si no, Meta reintenta durante días.
  return text(`ok ${processed}`);
});
