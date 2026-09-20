// request-reviews — Cron: pide reseña ~1-3h después de que termine una
// reserva. Protegido por cabecera x-cron-secret (verify_jwt = false).
//
// Solo se envía si el negocio tiene configurado un enlace de reseña
// (google_review_url) y la reserva no fue cancelada/no-show. Se registra en
// review_requests_log para no duplicar aunque el cron se ejecute varias
// veces sobre la misma ventana horaria.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { buildReviewRequestEmail, sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "No autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const from = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() - 1 * 3600 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, business_id, customer_name, customer_email, " +
            "businesses!inner(name, primary_color, google_review_url, review_email_message)")
    .in("status", ["confirmada", "completada", "sentada"])
    .gte("ends_at", from)
    .lte("ends_at", to);
  if (error) return json({ error: error.message }, 500);

  let sent = 0, skipped = 0, failed = 0;
  const results: unknown[] = [];

  for (const b of bookings ?? []) {
    const biz = (b as any).businesses;
    if (!biz?.google_review_url || !b.customer_email) { skipped++; continue; }

    const { data: existing } = await supabase
      .from("review_requests_log").select("id").eq("booking_id", b.id).maybeSingle();
    if (existing) { skipped++; continue; }

    const [{ data: integ }] = await Promise.all([
      supabase.from("business_integrations").select("email_from, resend_api_key").eq("business_id", b.business_id).maybeSingle(),
    ]);

    const mail = buildReviewRequestEmail({
      businessName: biz.name, customerName: b.customer_name,
      reviewUrl: biz.google_review_url, primaryColor: biz.primary_color,
      customMessage: biz.review_email_message,
    });

    try {
      const msgId = await sendEmail(b.customer_email, mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
      await supabase.from("review_requests_log").insert({
        booking_id: b.id, business_id: b.business_id, status: "sent", provider_message_id: msgId,
      });
      sent++; results.push({ booking: b.id, status: "sent" });
    } catch (e) {
      await supabase.from("review_requests_log").insert({
        booking_id: b.id, business_id: b.business_id, status: "failed", error: (e as Error).message,
      });
      failed++; results.push({ booking: b.id, status: "failed", error: (e as Error).message });
    }
  }

  return json({ processed: (bookings ?? []).length, sent, skipped, failed, results });
});
