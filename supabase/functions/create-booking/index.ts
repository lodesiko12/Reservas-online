// create-booking — Endpoint PÚBLICO (verify_jwt = false).
// Crea una reserva del widget: valida, llama al RPC transaccional
// create_public_booking (service_role) y envía el email de confirmación.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, handleOptions } from "../_shared/cors.ts";
import { buildConfirmationEmail, sendEmail } from "../_shared/email.ts";

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

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const { business_id, service_id, dining_shift_id, party_size, starts_at, name, phone, email } = body;
  const isRestaurant = !!dining_shift_id;

  if (!business_id || !starts_at || !name || !phone || !email) {
    return json({ error: "Faltan campos obligatorios (fecha, nombre, teléfono, email)." }, 400);
  }
  if (isRestaurant) {
    if (!party_size || party_size < 1) return json({ error: "Indica el número de comensales." }, 400);
  } else if (!service_id) {
    return json({ error: "Falta el servicio." }, 400);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Email no válido." }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 1) Crear la reserva (re-valida disponibilidad/aforo bajo lock dentro del RPC).
  const { data: booking, error } = isRestaurant
    ? await supabase.rpc("create_public_dining_booking", {
        p_business_id: business_id,
        p_shift_id: dining_shift_id,
        p_starts_at: starts_at,
        p_party_size: party_size,
        p_name: name.trim(),
        p_last_name: (body.last_name ?? "").trim(),
        p_phone: phone.trim(),
        p_email: email.trim(),
        p_notes: body.notes?.trim() || undefined,
        p_channel: "web",
      })
    : await supabase.rpc("create_public_booking", {
        p_business_id: business_id,
        p_service_id: service_id,
        p_starts_at: starts_at,
        p_name: name.trim(),
        p_last_name: (body.last_name ?? "").trim(),
        p_phone: phone.trim(),
        p_email: email.trim(),
        p_notes: body.notes?.trim() || undefined,
        p_channel: "web",
        p_professional_id: body.professional_id || undefined,
      });

  if (error) {
    console.error("create booking error:", error.message);
    return json({ error: error.message || "No se pudo crear la reserva." }, 409);
  }

  // 2) Datos para el email y la respuesta (incl. credenciales de email del negocio).
  const [{ data: biz }, { data: svc }, { data: integ }] = await Promise.all([
    supabase.from("businesses").select("name, timezone, primary_color, slug").eq("id", business_id).single(),
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
      customerName: name.trim(),
      manageUrl,
      primaryColor: biz?.primary_color,
      isPending: booking.status === "pendiente",
    });
    await sendEmail(email.trim(), mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
  } catch (e) {
    console.error("Email no enviado:", (e as Error).message);
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
