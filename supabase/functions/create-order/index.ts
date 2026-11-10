// create-order — Endpoint PÚBLICO (verify_jwt = false).
// Crea un pedido para llevar del widget: valida el formato, llama al RPC
// transaccional create_public_order (service_role; recalcula precios desde la
// carta y comprueba el hueco de recogida) y envía el email si hay dirección.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { buildOrderEmail, sendEmail } from "../_shared/email.ts";
import { cleanOptionalText, cleanText, isEmail, isIsoDate, isPhone, isPositiveInt, isUuid } from "../_shared/validation.ts";
import { getClientIp, rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

type ItemIn = { item_id?: unknown; quantity?: unknown; modifier_ids?: unknown; notes?: unknown };
type Body = {
  business_id?: string;
  pickup_at?: string;
  items?: ItemIn[];
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

  // Endpoint público (sin JWT): solo se limita por IP.
  const ip = getClientIp(req);
  if (!(await rateLimitHit(supabase, `create-order:ip:${ip}`, 8, 600))) {
    return tooManyRequests(600);
  }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const { business_id, pickup_at } = body;
  if (!isUuid(business_id)) return json({ error: "Negocio no válido." }, 400);
  if (!isIsoDate(pickup_at)) return json({ error: "Hora de recogida no válida." }, 400);

  const name = cleanText(body.name, 100);
  const phone = body.phone && isPhone(body.phone, 30) ? body.phone.trim() : null;
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailRaw && isEmail(emailRaw, 254) ? emailRaw : null;
  if (!name || !phone || (emailRaw && !email)) {
    return json({ error: "Faltan campos obligatorios o no son válidos (nombre, teléfono; el email, si lo indicas, debe ser válido)." }, 400);
  }
  const lastName = cleanOptionalText(body.last_name, 100);
  const notes = cleanOptionalText(body.notes, 500) || undefined;

  // Líneas del pedido: solo ids y cantidades; el precio lo calcula la base de datos.
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) {
    return json({ error: "Tu pedido está vacío." }, 400);
  }
  const items: { item_id: string; quantity: number; modifier_ids: string[]; notes?: string }[] = [];
  for (const it of body.items) {
    if (!isUuid(it?.item_id) || !isPositiveInt(it?.quantity, 50)) return json({ error: "Una línea del pedido no es válida." }, 400);
    const mods = Array.isArray(it.modifier_ids) ? it.modifier_ids : [];
    if (mods.length > 30 || !mods.every(isUuid)) return json({ error: "Una opción del pedido no es válida." }, 400);
    items.push({
      item_id: it.item_id,
      quantity: it.quantity,
      modifier_ids: mods as string[],
      notes: cleanOptionalText(it.notes, 200) || undefined,
    });
  }

  // 1) Crear el pedido (re-valida carta, extras, hueco y mínimo bajo lock dentro del RPC).
  const { data: order, error } = await supabase.rpc("create_public_order", {
    p_business_id: business_id,
    p_pickup_at: pickup_at,
    p_items: items,
    p_name: name,
    p_last_name: lastName,
    p_phone: phone,
    p_email: email,
    p_notes: notes,
  });
  if (error || !order) {
    console.error("create order error:", error?.message);
    return json({ error: error?.message || "No se pudo crear el pedido." }, 409);
  }

  // 2) Datos para el email y la respuesta.
  const [{ data: biz }, { data: lines }, { data: integ }] = await Promise.all([
    supabase.from("businesses").select("name, timezone, primary_color, slug").eq("id", business_id).single(),
    supabase.from("order_items").select("name, quantity, line_total, modifiers, notes").eq("order_id", order.id).order("sort_order"),
    supabase.from("business_integrations").select("email_from, resend_api_key").eq("business_id", business_id).maybeSingle(),
  ]);

  const widgetUrl = Deno.env.get("WIDGET_URL");
  const manageUrl = widgetUrl && biz
    ? `${widgetUrl}/?slug=${encodeURIComponent(biz.slug)}&view=mi-reserva&locator=${encodeURIComponent(order.locator)}`
    : undefined;

  // 3) Email (no bloquea el éxito del pedido si falla o si no hay email).
  if (email) {
    try {
      const mail = buildOrderEmail({
        businessName: biz?.name ?? "Pedido",
        customerName: name,
        pickupAt: order.pickup_at,
        timezone: biz?.timezone ?? "Europe/Madrid",
        locator: order.locator,
        total: Number(order.total),
        items: (lines ?? []).map((l) => ({
          name: l.name,
          quantity: l.quantity,
          line_total: Number(l.line_total),
          modifiers: (l.modifiers ?? []) as { name: string }[],
          notes: l.notes,
        })),
        manageUrl,
        primaryColor: biz?.primary_color,
      });
      await sendEmail(email, mail.subject, mail.html, mail.text, integ?.resend_api_key, integ?.email_from);
    } catch (e) {
      console.error("Email de pedido no enviado:", (e as Error).message);
    }
  }

  return json({
    locator: order.locator,
    status: order.status,
    pickup_at: order.pickup_at,
    total: Number(order.total),
    business_name: biz?.name ?? "",
  });
});
