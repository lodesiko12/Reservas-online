// password-setup — "Primera vez o contraseña olvidada" del login (endpoint público, verify_jwt=false).
// Recibe { email } y, si existe una cuenta con ese email, le envía por Resend un enlace para elegir
// contraseña. Responde SIEMPRE lo mismo (también si el email no existe o no se pudo enviar) para no
// revelar qué emails tienen cuenta. Limitado por IP y por email.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { getClientIp, rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { sendPasswordSetupLink } from "../_shared/passwordSetup.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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

  // El trabajo se hace en segundo plano para que el tiempo de respuesta sea igual exista o no la cuenta.
  const work = sendPasswordSetupLink(admin, email, "reset").catch((e) => console.error("[password-setup]", e));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return json({ ok: true });
});
