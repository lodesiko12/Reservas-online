// google-oauth-callback — Endpoint PÚBLICO (verify_jwt = false), redirect_uri
// de Google. Verifica el `state` firmado por google-oauth-start, intercambia
// el code por tokens con las credenciales del NEGOCIO (no globales) y
// guarda la conexión del profesional. Termina redirigiendo al panel.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions } from "../_shared/cors.ts";
import { verifyOAuthState, exchangeCodeForTokens, getGoogleUserEmail } from "../_shared/google.ts";

function redirect(path: string): Response {
  const base = (Deno.env.get("DASHBOARD_URL") ?? "").replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { Location: `${base}${path}` } });
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) return redirect(`/app/servicios?google_error=${encodeURIComponent(googleError)}`);
  if (!code || !state) return redirect("/app/servicios?google_error=missing_params");

  const stateSecret = Deno.env.get("GOOGLE_STATE_SECRET");
  if (!stateSecret) return redirect("/app/servicios?google_error=server_misconfigured");

  const verified = await verifyOAuthState(state, stateSecret);
  if (!verified) return redirect("/app/servicios?google_error=invalid_state");
  const { businessId, professionalId } = verified;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: integ } = await admin
    .from("business_integrations")
    .select("google_client_id, google_client_secret")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!integ?.google_client_id || !integ?.google_client_secret) {
    return redirect("/app/servicios?google_error=missing_credentials");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

  try {
    const tokens = await exchangeCodeForTokens(integ.google_client_id, integ.google_client_secret, code, redirectUri);
    const email = await getGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // El refresh_token solo viene la primera vez que se autoriza; si Google
    // no lo manda (reconexión sin revocar antes), conservamos el que ya había.
    const { data: existing } = await admin
      .from("professional_google_accounts")
      .select("refresh_token")
      .eq("professional_id", professionalId)
      .maybeSingle();

    await admin.from("professional_google_accounts").upsert({
      professional_id: professionalId,
      google_email: email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: expiresAt,
      sync_enabled: true,
    });

    return redirect("/app/servicios?google=connected");
  } catch (e) {
    console.error("google-oauth-callback error:", (e as Error).message);
    return redirect("/app/servicios?google_error=token_exchange_failed");
  }
});
