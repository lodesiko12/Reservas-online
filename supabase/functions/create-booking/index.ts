// create-booking — Endpoint PÚBLICO (verify_jwt = false).
// Crea una reserva del widget: valida, llama al RPC transaccional
// create_public_booking (service_role) y envía el email de confirmación.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, handleOptions } from "../_shared/cors.ts";
import { buildConfirmationEmail, buildOwnerBookingNotice, sendEmail } from "../_shared/email.ts";
import { cleanOptionalText, cleanText, isEmail, isIsoDate, isPhone, isPositiveInt, isUuid } from "../_shared/validation.ts";
import { getClientIp, rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

type Body = {
  business_id?: string;
  // citas:
  service_id?: string;
  professional_id?: string;
  option_id?: string; // modo encargo: sabor elegido
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

  // Modo encargo: el email es opcional (el canal habitual es el teléfono/WhatsApp).
  const { data: bizRow } = await supabase.from("businesses").select("order_mode").eq("id", business_id).maybeSingle();
  const orderMode = !!bizRow?.order_mode;

  const name = cleanText(body.name, 100);
  const phone = body.phone && isPhone(body.phone, 30) ? body.phone.trim() : null;
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailRaw && isEmail(emailRaw, 254) ? emailRaw : null;
  if (!name || !phone || (!email && !(orderMode && !emailRaw))) {
    return json({
      error: orderMode
        ? "Faltan campos obligatorios o no son válidos (nombre, teléfono; el email, si lo indicas, debe ser válido)."
        : "Faltan campos obligatorios o no son válidos (nombre, teléfono, email).",
    }, 400);
  }
  const lastName = cleanOptionalText(body.last_name, 100);
  const notes = cleanOptionalText(body.notes, 1000) || undefined;

  if (isRestaurant) {
    if (!isUuid(dining_shift_id)) return json({ error: "Turno no válido." }, 400);
    if (!isPositiveInt(party_size, 50)) return json({ error: "Indica el número de comensales." }, 400);
  } else {
    if (!isUuid(service_id)) return json({ error: "Falta el servicio." }, 400);
    if (body.professional_id && !isUuid(body.professional_id)) return json({ error: "Profesional no válido." }, 400);
    if (orderMode && !isUuid(body.option_id)) return json({ error: "Elige un sabor." }, 400);
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
        p_option_id: orderMode ? body.option_id : undefined,
      });

  if (error) {
    console.error("create booking error:", error.message);
    return json({ error: error.message || "No se pudo crear la reserva." }, 409);
  }

  // 2) Datos para el email y la respuesta (incl. credenciales de email del negocio).
  const [{ data: biz }, { data: svc }, { data: integ }] = await Promise.all([
    supabase.from("businesses").select("name, type, timezone, primary_color, slug, confirmation_email_message").eq("id", business_id).single(),
    isRestaurant
      ? Promise.resolve({ data: null })
      : supabase.from("services").select("name, size_label").eq("id", service_id!).single(),
    supabase.from("business_integrations").select("email_from, resend_api_key").eq("business_id", business_id).maybeSingle(),
  ]);
  const serviceLabel = isRestaurant
    ? `Mesa · ${party_size} comensales`
    : (svc as { name: string } | null)?.name ?? null;

  const widgetUrl = Deno.env.get("WIDGET_URL");
  const manageUrl = widgetUrl && biz
    ? `${widgetUrl}/?slug=${encodeURIComponent(biz.slug)}&view=mi-reserva&locator=${encodeURIComponent(booking.locator)}`
    : undefined;

  // 3) Enviar email (no bloquea el éxito de la reserva si falla). Sin email (solo
  // posible en modo encargo) no hay nada que enviar.
  try {
    if (!email) throw new Error("sin email");
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
      orderMode,
      optionLabel: booking.option_label,
      sizeLabel: (svc as { size_label?: string | null } | null)?.size_label ?? null,
    });
    await sendEmail(email, mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
  } catch (e) {
    if (email) console.error("Email no enviado:", (e as Error).message);
  }

  // 3b) Negocios `autonomo` (sin Agenda de reservas): avisar por email a los miembros
  // del negocio de que ha entrado una reserva. No bloquea el éxito si falla.
  if (!isRestaurant && biz?.type === "autonomo") {
    try {
      const { data: members } = await supabase.from("business_users").select("user_id").eq("business_id", business_id);
      const emails = new Set<string>();
      for (const m of members ?? []) {
        const { data: u } = await supabase.auth.admin.getUserById(m.user_id);
        if (u.user?.email) emails.add(u.user.email);
      }
      if (emails.size > 0) {
        const notice = buildOwnerBookingNotice({
          businessName: biz.name,
          serviceName: serviceLabel,
          startsAt: booking.starts_at,
          timezone: biz.timezone ?? "Europe/Madrid",
          locator: booking.locator,
          customerName: [name, lastName].filter(Boolean).join(" "),
          customerPhone: phone,
          customerEmail: email,
          notes: notes ?? null,
          panelUrl: Deno.env.get("DASHBOARD_URL") || undefined,
        });
        for (const to of emails) {
          await sendEmail(to, notice.subject, notice.html, notice.text, integ?.resend_api_key, integ?.email_from);
        }
      }
    } catch (e) {
      console.error("Aviso al negocio no enviado:", (e as Error).message);
    }
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
    option_label: booking.option_label ?? null,
    size_label: (svc as { size_label?: string | null } | null)?.size_label ?? null,
    order_mode: orderMode,
  });
});
