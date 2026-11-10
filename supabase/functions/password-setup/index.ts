// password-setup — "Primera vez o contraseña olvidada" del login (endpoint público, verify_jwt=false).
// Recibe { email }. Solo envía el enlace si el email está dado de alta (es super-admin o pertenece a
// algún negocio); si no, responde error y no envía nada. El correo sale por la cuenta de Resend del
// negocio al que pertenece (business_integrations) y, si no hay o falla, por la global.
// Limitado por IP y por email.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { getClientIp, rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { findUserByEmail, resendCandidates, sendPasswordSetupLink } from "../_shared/passwordSetup.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Escribe un email válido." }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (!(await rateLimitHit(admin, `password-setup:ip:${getClientIp(req)}`, 10, 3600))) return tooManyRequests(3600);
  if (!(await rateLimitHit(admin, `password-setup:email:${email}`, 3, 3600))) return tooManyRequests(3600);

  // ¿Está dado de alta? (cuenta existente + super-admin o miembro de algún negocio)
  const notRegistered = () => json({ error: "Ese email no está dado de alta en ningún negocio de Turnigo. Pide acceso a tu administrador." }, 404);
  const user = await findUserByEmail(admin, email);
  if (!user) return notRegistered();
  const [{ data: prof }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle(),
    admin.from("business_users").select("business_id").eq("user_id", user.id),
  ]);
  const businessIds = (memberships ?? []).map((m) => m.business_id as string);
  if (!prof?.is_super_admin && !businessIds.length) return notRegistered();

  const result = await sendPasswordSetupLink(admin, email, "reset", null, await resendCandidates(admin, businessIds));
  if (result === "sent") return json({ ok: true });
  if (result === "not_configured") {
    return json({ error: "Tu negocio no tiene configurado el envío de correos. Pídele a tu administrador que te fije una contraseña." }, 503);
  }
  return json({ error: "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos o pídele a tu administrador que te fije una contraseña." }, 502);
});
