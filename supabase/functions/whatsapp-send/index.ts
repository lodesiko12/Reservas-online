// whatsapp-send — Endpoint del panel (verify_jwt = true). El staff contesta desde la pestaña
// "Mensajes" a una conversación de WhatsApp. Texto libre: Meta solo lo permite dentro de las
// 24 h siguientes al último mensaje del cliente; fuera de la ventana se rechaza aquí.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { sendWhatsAppText } from "../_shared/whatsapp.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

const WINDOW_MS = 24 * 3600 * 1000;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let conversationId = "", text = "";
  try {
    const b = await req.json();
    conversationId = String(b.conversation_id ?? "");
    text = String(b.text ?? "").trim();
  } catch { /* noop */ }
  if (!conversationId) return json({ error: "Falta 'conversation_id'." }, 400);
  if (!text) return json({ error: "El mensaje está vacío." }, 400);
  if (text.length > 4000) return json({ error: "El mensaje es demasiado largo (máx. 4000 caracteres)." }, 400);

  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } }
  );
  const { data: authData } = await asUser.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return json({ error: "No autenticado" }, 401);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  if (!(await rateLimitHit(service, `whatsapp-send:user:${uid}`, 120, 3600))) return tooManyRequests(3600);

  // RLS: solo ve la conversación un miembro del negocio.
  const { data: conv } = await asUser
    .from("whatsapp_conversations")
    .select("id, business_id, wa_id, last_inbound_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return json({ error: "Conversación no encontrada." }, 404);

  if (!conv.last_inbound_at || Date.now() - new Date(conv.last_inbound_at).getTime() > WINDOW_MS) {
    return json({ error: "Han pasado más de 24 h desde el último mensaje del paciente: WhatsApp solo permite plantillas aprobadas fuera de esa ventana." }, 409);
  }

  const [{ data: biz }, { data: integ }] = await Promise.all([
    service.from("businesses").select("whatsapp_inbox_enabled").eq("id", conv.business_id).single(),
    service.from("business_integrations").select("whatsapp_token, whatsapp_phone_number_id").eq("business_id", conv.business_id).maybeSingle(),
  ]);
  if (!biz?.whatsapp_inbox_enabled) return json({ error: "El buzón de WhatsApp no está activado en este negocio." }, 400);
  if (!integ?.whatsapp_token || !integ?.whatsapp_phone_number_id) {
    return json({ error: "Faltan el token o el Phone number ID de WhatsApp en Configuración." }, 400);
  }

  const now = new Date().toISOString();
  try {
    const waId = await sendWhatsAppText(integ.whatsapp_token, integ.whatsapp_phone_number_id, conv.wa_id, text);
    const { data: msg } = await service.from("whatsapp_messages").insert({
      business_id: conv.business_id, conversation_id: conv.id, direction: "out",
      wa_message_id: waId, msg_type: "text", body: text, status: "sent", sent_by: uid,
    }).select("id").single();
    await service.from("whatsapp_conversations")
      .update({ last_message_at: now, last_preview: text.slice(0, 140) }).eq("id", conv.id);
    return json({ ok: true, message_id: msg?.id });
  } catch (e) {
    const err = (e as Error).message;
    await service.from("whatsapp_messages").insert({
      business_id: conv.business_id, conversation_id: conv.id, direction: "out",
      msg_type: "text", body: text, status: "failed", error: err.slice(0, 500), sent_by: uid,
    });
    return json({ error: err }, 502);
  }
});
