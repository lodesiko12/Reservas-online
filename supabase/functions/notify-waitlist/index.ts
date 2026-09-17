// notify-waitlist — Endpoint del panel (verify_jwt = true). El staff pulsa
// "Avisar" en una entrada de la lista de espera y se envía una plantilla de
// WhatsApp al cliente diciéndole que ya hay mesa.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let waitlistId = "";
  try { waitlistId = (await req.json()).waitlist_id; } catch { /* noop */ }
  if (!waitlistId) return json({ error: "Falta 'waitlist_id'." }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";

  // Cliente "como el usuario": RLS asegura que solo vea la entrada si es
  // miembro del negocio al que pertenece.
  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: entry, error: entryErr } = await asUser
    .from("waitlist")
    .select("id, business_id, name, phone, status")
    .eq("id", waitlistId)
    .maybeSingle();
  if (entryErr || !entry) return json({ error: "Entrada no encontrada." }, 404);
  if (!entry.phone) return json({ error: "Esta entrada no tiene teléfono." }, 400);
  if (entry.status !== "esperando") return json({ error: "Esta entrada ya no está esperando." }, 409);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const [{ data: biz }, { data: integ }] = await Promise.all([
    service.from("businesses").select("name, waitlist_template_name, reminder_lang").eq("id", entry.business_id).single(),
    service.from("business_integrations").select("whatsapp_token, whatsapp_phone_number_id").eq("business_id", entry.business_id).maybeSingle(),
  ]);

  const token = integ?.whatsapp_token || Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = integ?.whatsapp_phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return json({ error: "El negocio no tiene WhatsApp configurado." }, 400);

  const templateName = biz?.waitlist_template_name || Deno.env.get("WHATSAPP_WAITLIST_TEMPLATE_NAME") || "lista_espera_mesa";
  const lang = biz?.reminder_lang || Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "es";

  try {
    const msgId = await sendWhatsApp(token, phoneId, entry.phone, templateName, lang, [entry.name, biz?.name ?? ""]);
    await asUser.from("waitlist").update({ status: "avisado", notified_at: new Date().toISOString() }).eq("id", waitlistId);
    return json({ ok: true, message_id: msgId });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
