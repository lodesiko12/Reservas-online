// google-oauth-start — Endpoint AUTENTICADO (verify_jwt = true).
// El panel llama aquí para obtener la URL de consentimiento de Google para
// un profesional concreto (citas/psicologo/restaurante) O para el negocio
// entero (autonomo, que no tiene profesionales). Verifica que quien llama
// es miembro del negocio antes de firmar el `state` (evita que cualquiera
// pueda iniciar el flujo para un profesional/negocio ajeno).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { signOAuthState, signBusinessState } from "../_shared/google.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

const SCOPE = "https://www.googleapis.com/auth/calendar";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const uid = userData.user?.id;
  if (!uid) return json({ error: "No autenticado" }, 401);
  if (!(await rateLimitHit(admin, `google-oauth-start:user:${uid}`, 10, 3600))) {
    return tooManyRequests(3600);
  }

  const { professional_id, business_id } = await req.json().catch(() => ({}));
  if (!professional_id && !business_id) return json({ error: "Falta professional_id o business_id" }, 400);

  let bizId: string;
  if (professional_id) {
    const { data: pro } = await admin.from("professionals").select("id, business_id").eq("id", professional_id).maybeSingle();
    if (!pro) return json({ error: "Profesional no encontrado" }, 404);
    bizId = pro.business_id;
  } else {
    bizId = business_id;
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin.from("profiles").select("is_super_admin").eq("id", uid).maybeSingle(),
    admin.from("business_users").select("id").eq("business_id", bizId).eq("user_id", uid).maybeSingle(),
  ]);
  if (!profile?.is_super_admin && !membership) return json({ error: "No autorizado" }, 403);

  const { data: integ } = await admin.from("business_integrations").select("google_client_id").eq("business_id", bizId).maybeSingle();
  if (!integ?.google_client_id) {
    return json({ error: "Este negocio no tiene configuradas credenciales de Google (Configuración → Integraciones)." }, 400);
  }

  const stateSecret = Deno.env.get("GOOGLE_STATE_SECRET");
  if (!stateSecret) return json({ error: "GOOGLE_STATE_SECRET no configurado en el servidor." }, 500);

  const state = professional_id
    ? await signOAuthState(bizId, professional_id, stateSecret)
    : await signBusinessState(bizId, stateSecret);
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", integ.google_client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);

  return json({ url: url.toString() });
});
