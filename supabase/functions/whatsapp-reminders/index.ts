// whatsapp-reminders — Cron: envía recordatorios de WhatsApp ~24h antes.
// Protegido por cabecera x-cron-secret (verify_jwt = false).
//
// Cada mensaje se envía desde el número (phone_number_id) y con el token
// del PROPIO negocio (public.business_integrations). Si el negocio no tiene
// credenciales, cae a las globales (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)
// y, si tampoco existen, se omite.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(iso));
}
function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false }).format(new Date(iso));
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "No autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const from = new Date(Date.now() + 23 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 3600 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, business_id, starts_at, customer_name, customer_phone, " +
            "businesses!inner(name, timezone, whatsapp_reminders_enabled, reminder_template_name, reminder_lang)")
    .eq("status", "confirmada")
    .gte("starts_at", from)
    .lte("starts_at", to);
  if (error) return json({ error: error.message }, 500);

  // Credenciales de WhatsApp por negocio (secretos, vía service_role).
  const businessIds = [...new Set((bookings ?? []).map((b) => b.business_id))];
  const integMap = new Map<string, { whatsapp_token: string | null; whatsapp_phone_number_id: string | null }>();
  if (businessIds.length) {
    const { data: integs } = await supabase
      .from("business_integrations")
      .select("business_id, whatsapp_token, whatsapp_phone_number_id")
      .in("business_id", businessIds);
    for (const it of integs ?? []) integMap.set(it.business_id, it);
  }

  const envToken = Deno.env.get("WHATSAPP_TOKEN");
  const envPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  let sent = 0, skipped = 0, failed = 0;
  const results: unknown[] = [];

  for (const b of bookings ?? []) {
    const biz = (b as any).businesses;
    if (!biz?.whatsapp_reminders_enabled || !b.customer_phone) { skipped++; continue; }

    const integ = integMap.get(b.business_id);
    const token = integ?.whatsapp_token || envToken;
    const phoneId = integ?.whatsapp_phone_number_id || envPhoneId;
    if (!token || !phoneId) { skipped++; continue; } // negocio sin WhatsApp configurado

    // ¿Ya se envió?
    const { data: existing } = await supabase
      .from("whatsapp_reminders_log").select("id")
      .eq("booking_id", b.id).eq("reminder_kind", "24h").maybeSingle();
    if (existing) { skipped++; continue; }

    const templateName = biz.reminder_template_name || Deno.env.get("WHATSAPP_TEMPLATE_NAME") || "recordatorio_cita";
    const lang = biz.reminder_lang || Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "es";
    const params = [b.customer_name, biz.name, fmtDate(b.starts_at, biz.timezone), fmtTime(b.starts_at, biz.timezone)];

    try {
      const msgId = await sendWhatsApp(token, phoneId, b.customer_phone, templateName, lang, params);
      await supabase.from("whatsapp_reminders_log").insert({
        booking_id: b.id, business_id: b.business_id, reminder_kind: "24h", status: "sent", provider_message_id: msgId,
      });
      sent++; results.push({ booking: b.id, status: "sent", msgId });
    } catch (e) {
      await supabase.from("whatsapp_reminders_log").insert({
        booking_id: b.id, business_id: b.business_id, reminder_kind: "24h", status: "failed", error: (e as Error).message,
      });
      failed++; results.push({ booking: b.id, status: "failed", error: (e as Error).message });
    }
  }

  return json({ processed: (bookings ?? []).length, sent, skipped, failed, results });
});
