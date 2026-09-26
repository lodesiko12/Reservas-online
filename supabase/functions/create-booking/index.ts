// create-booking — Endpoint PÚBLICO (verify_jwt = false).
// Crea una reserva del widget: valida, llama al RPC transaccional
// create_public_booking (service_role) y envía el email de confirmación.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, handleOptions } from "../_shared/cors.ts";
import { buildConfirmationEmail, sendEmail } from "../_shared/email.ts";
import { cleanOptionalText, cleanText, isEmail, isIsoDate, isPhone, isPositiveInt, isUuid } from "../_shared/validation.ts";
import { getClientIp, rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

type Body = {
  business_id?: string;
  // citas:
  service_id?: string;
  professional_id?: string;
  // restaurante:
  dining_shift_id?: string;
  party_size?: number;
  // comunes:
  starts_at?: string;
  name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Endpoint público (sin JWT): solo se limita por IP. 8 reservas cada
  // 10 min es holgado para un uso legítimo (familia reservando varias
  // mesas) pero corta un bot/script machacando el endpoint.
  const ip = getClientIp(req);
  if (!(await rateLimitHit(supabase, `create-booking:ip:${ip}`, 8, 600))) {
    return tooManyRequests(600);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const { business_id, service_id, dining_shift_id, party_size, starts_at } = body;
  const isRestaurant = !!dining_shift_id;

  if (!isUuid(business_id)) return json({ error: "Negocio no válido." }, 400);
  if (!isIsoDate(starts_at)) return json({ error: "Fecha/hora no válida." }, 400);

  const name = cleanText(body.name, 100);
  const phone = body.phone && isPhone(body.phone, 30) ? body.phone.trim() : null;
  const email = body.email && isEmail(body.email, 254) ? body.email.trim() : null;
  if (!name || !phone || !email) {
    return json({ error: "Faltan campos obligatorios o no son válidos (nombre, teléfono, email)." }, 400);
  }
  const lastName = cleanOptionalText(body.last_name, 100);
  const notes = cleanOptionalText(body.notes, 1000) || undefined;

  if (isRestaurant) {
    if (!isUuid(dining_shift_id)) return json({ error: "Turno no válido." }, 400);
    if (!isPositiveInt(party_size, 50)) return json({ error: "Indica el número de comensales." }, 400);
  } else {
    if (!isUuid(service_id)) return json({ error: "Falta el servicio." }, 400);
    if (body.professional_id && !isUuid(body.professional_id)) return json({ error: "Profesional no válido." }, 400);
  }

  // 1) Crear la reserva (re-valida disponibilidad/aforo bajo lock dentro del RPC).
  const { data: booking, error } = isRestaurant
    ? await supabase.rpc("create_public_dining_booking", {
        p_business_id: business_id,
        p_shift_id: dining_shift_id,
        p_starts_at: starts_at,
        p_party_size: party_size,
        p_name: name,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_notes: notes,
        p_channel: "web",
      })
    : await supabase.rpc("create_public_booking", {
        p_business_id: business_id,
        p_service_id: service_id,
        p_starts_at: starts_at,
        p_name: name,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_notes: notes,
        p_channel: "web",
        p_professional_id: body.professional_id || undefined,
      });

  if (error) {
    console.error("create booking error:", error.message);
    return json({ error: error.message || "No se pudo crear la reserva." }, 409);
  }

  // 2) Datos para el email y la respuesta (incl. credenciales de email del negocio).
  const [{ data: biz }, { data: svc }, { data: integ }] = await Promise.all([
    supabase.from("businesses").select("name, timezone, primary_color, slug, confirmation_email_message").eq("id", business_id).single(),
    isRestaurant
      ? Promise.resolve({ data: null })
      : supabase.from("services").select("name").eq("id", service_id!).single(),
    supabase.from("business_integrations").select("email_from, resend_api_key").eq("business_id", business_id).maybeSingle(),
  ]);
  const serviceLabel = isRestaurant
    ? `Mesa · ${party_size} comensales`
    : (svc as { name: string } | null)?.name ?? null;

  const widgetUrl = Deno.env.get("WIDGET_URL");
  const manageUrl = widgetUrl && biz
    ? `${widgetUrl}/?slug=${encodeURIComponent(biz.slug)}&view=mi-reserva&locator=${encodeURIComponent(booking.locator)}`
    : undefined;

  // 3) Enviar email (no bloquea el éxito de la reserva si falla).
  try {
    const mail = buildConfirmationEmail({
      businessName: biz?.name ?? "Reserva",
      serviceName: serviceLabel,
      startsAt: booking.starts_at,
      timezone: biz?.timezone ?? "Europe/Madrid",
      locator: booking.locator,
      customerName: name,
      manageUrl,
      primaryColor: biz?.primary_color,
      isPending: booking.status === "pendiente",
      customMessage: biz?.confirmation_email_message,
    });
    await sendEmail(email, mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
  } catch (e) {
    console.error("Email no enviado:", (e as Error).message);
  }

  // 4) Exportar a Google Calendar si el profesional lo tiene conectado
  // (no bloquea el éxito de la reserva si falla o no aplica).
  if (!isRestaurant) {
    try {
      await supabase.functions.invoke("sync-google-event", { body: { booking_id: booking.id, action: "upsert" } });
    } catch (e) {
      console.error("Sync Google Calendar no enviado:", (e as Error).message);
    }
  }

  return json({
    locator: booking.locator,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    service_name: serviceLabel,
    business_name: biz?.name ?? "",
    status: booking.status,
  });
});
