// send-confirmation-email — Reenvía el email de confirmación de una reserva.
// Pensado para el panel (verify_jwt = true). Recibe { locator }.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { buildConfirmationEmail, sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let locator = "";
  try { locator = (await req.json()).locator; } catch { /* noop */ }
  if (!locator) return json({ error: "Falta 'locator'." }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: b, error } = await supabase
    .from("bookings")
    .select("locator, starts_at, customer_name, customer_email, business_id, service_id")
    .ilike("locator", locator)
    .maybeSingle();
  if (error || !b) return json({ error: "Reserva no encontrada." }, 404);
  if (!b.customer_email) return json({ error: "La reserva no tiene email." }, 400);

  const [{ data: biz }, { data: svc }, { data: integ }] = await Promise.all([
    supabase.from("businesses").select("name, timezone, primary_color, slug").eq("id", b.business_id).single(),
    b.service_id
      ? supabase.from("services").select("name").eq("id", b.service_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("business_integrations").select("email_from, resend_api_key").eq("business_id", b.business_id).maybeSingle(),
  ]);

  const widgetUrl = Deno.env.get("WIDGET_URL");
  const manageUrl = widgetUrl && biz
    ? `${widgetUrl}/?slug=${encodeURIComponent(biz.slug)}&view=mi-reserva&locator=${encodeURIComponent(b.locator)}`
    : undefined;

  const mail = buildConfirmationEmail({
    businessName: biz?.name ?? "Reserva",
    serviceName: (svc as any)?.name ?? null,
    startsAt: b.starts_at,
    timezone: biz?.timezone ?? "Europe/Madrid",
    locator: b.locator,
    customerName: b.customer_name,
    manageUrl,
    primaryColor: biz?.primary_color,
  });

  try {
    const id = await sendEmail(b.customer_email, mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
    return json({ ok: true, message_id: id });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
