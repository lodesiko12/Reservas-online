// generate-client-ai-report — Endpoint AUTENTICADO (verify_jwt = true).
// Genera un informe con Gemini a partir de todas las sesiones (client_sessions)
// de un cliente, usando la clave de Gemini propia del negocio (nunca una
// compartida por la plataforma). Solo disponible para negocios tipo
// psicólogo — comprobado aquí también, no solo en el panel. Patrón
// dual-cliente igual que sync-google-event: `asCaller` (RLS) para
// confirmar que quien llama tiene acceso al cliente, `service` para leer
// el secreto de business_integrations.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";

const MODEL = "gemini-3.6-flash";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
  );
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { customer_id } = await req.json().catch(() => ({}));
  if (!customer_id) return json({ error: "Falta customer_id" }, 400);

  const { data: customer } = await asCaller
    .from("customers").select("id, business_id, full_name, last_name")
    .eq("id", customer_id).maybeSingle();
  if (!customer) return json({ error: "Cliente no encontrado o sin acceso" }, 404);

  const { data: business } = await asCaller
    .from("businesses").select("type").eq("id", customer.business_id).single();
  if (business?.type !== "psicologo") {
    return json({ error: "Esta función solo está disponible para negocios de tipo psicólogo" }, 400);
  }

  const { data: integ } = await service
    .from("business_integrations").select("gemini_api_key").eq("business_id", customer.business_id).maybeSingle();
  if (!integ?.gemini_api_key) {
    return json({ ok: false, error: "Este negocio no tiene configurada su clave de Gemini (Configuración → Informes con IA)." }, 200);
  }

  const { data: sessions } = await asCaller
    .from("client_sessions")
    .select("session_date, objetivo, notas, seguimiento, tareas_pautas")
    .eq("customer_id", customer_id)
    .order("session_date", { ascending: true })
    .limit(200);

  if (!sessions?.length) {
    return json({ ok: false, error: "No hay sesiones registradas en el Historial para generar un informe." }, 200);
  }

  const prompt = buildPrompt(customer, sessions);

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${integ.gemini_api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Gemini error:", resp.status, errBody);
      if (resp.status === 429) {
        return json({ ok: false, error: "Límite de peticiones de Gemini alcanzado (plan gratuito: ~10/min). Inténtalo de nuevo en un momento." }, 200);
      }
      if (resp.status === 400 || resp.status === 403) {
        return json({ ok: false, error: "Clave de Gemini inválida o sin permisos. Revísala en Configuración." }, 200);
      }
      if (resp.status === 503) {
        return json({ ok: false, error: "Gemini está saturado ahora mismo (alta demanda). Inténtalo de nuevo en un minuto." }, 200);
      }
      return json({ ok: false, error: "Error al contactar con Gemini." }, 200);
    }

    const data = await resp.json();
    const content = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    if (!content) return json({ ok: false, error: "Gemini no devolvió contenido." }, 200);

    const { data: report, error: insErr } = await service
      .from("client_ai_reports")
      .insert({
        business_id: customer.business_id, customer_id, content, model: MODEL,
        sessions_count: sessions.length,
      })
      .select("id, content, created_at, sessions_count")
      .single();
    if (insErr) return json({ ok: false, error: "Informe generado pero no se pudo guardar: " + insErr.message }, 200);

    return json({ ok: true, report });
  } catch (e) {
    console.error("generate-client-ai-report error:", (e as Error).message);
    return json({ ok: false, error: "Error inesperado al generar el informe." }, 200);
  }
});

type SessionRow = {
  session_date: string;
  objetivo: string | null;
  notas: string | null;
  seguimiento: string | null;
  tareas_pautas: string | null;
};

function buildPrompt(customer: { full_name: string; last_name: string | null }, sessions: SessionRow[]): string {
  const sessionsText = sessions.map((s, i) => {
    const parts = [
      s.objetivo && `Objetivo: ${s.objetivo}`,
      s.notas && `Notas: ${s.notas}`,
      s.seguimiento && `Seguimiento: ${s.seguimiento}`,
      s.tareas_pautas && `Tareas/Pautas: ${s.tareas_pautas}`,
    ].filter(Boolean).join("\n  ");
    return `Sesión ${i + 1} [${s.session_date.slice(0, 10)}]:\n  ${parts || "(sin contenido)"}`;
  }).join("\n\n");

  return `Eres un asistente que ayuda a un/a psicólogo/a a resumir el seguimiento de un/a paciente a partir del historial de sesiones registradas. Genera un informe breve, profesional y en español, en formato markdown, con estas secciones: "Resumen general", "Evolución observada", "Tareas y pautas asignadas", "Recomendaciones". Básate ÚNICAMENTE en los datos proporcionados, no inventes diagnósticos ni datos clínicos no mencionados.

Paciente: ${customer.full_name} ${customer.last_name ?? ""}

Historial de sesiones (orden cronológico):
${sessionsText}`;
}
