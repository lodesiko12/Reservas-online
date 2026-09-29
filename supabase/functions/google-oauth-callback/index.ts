// google-oauth-callback — Endpoint PÚBLICO (verify_jwt = false), redirect_uri
// de Google. Verifica el `state` firmado por google-oauth-start (de
// profesional o de negocio, según cuál produjo el state), intercambia el
// code por tokens con las credenciales del NEGOCIO (no globales) y guarda
// la conexión. Termina redirigiendo al panel.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions } from "../_shared/cors.ts";
import { verifyOAuthState, verifyBusinessState, exchangeCodeForTokens, getGoogleUserEmail } from "../_shared/google.ts";

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

  // Primero probamos state de profesional (3 partes); si no cuadra, probamos
  // el de negocio (2 partes, mismo formato que Business Profile) — así este
  // único callback sirve para ambos orígenes sin ambigüedad.
  const proVerified = await verifyOAuthState(state, stateSecret);
  const bizVerified = proVerified ? null : await verifyBusinessState(state, stateSecret);
  if (!proVerified && !bizVerified) return redirect("/app/servicios?google_error=invalid_state");
  const businessId = (proVerified ?? bizVerified)!.businessId;
  const professionalId = proVerified?.professionalId ?? null;
  const redirectBase = professionalId ? "/app/servicios" : "/app/config";

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
    return redirect(`${redirectBase}?google_error=missing_credentials`);
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
  const ownerColumn = professionalId ? "professional_id" : "business_id";
  const ownerId = professionalId ?? businessId;

  try {
    const tokens = await exchangeCodeForTokens(integ.google_client_id, integ.google_client_secret, code, redirectUri);
    const email = await getGoogleUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // El refresh_token solo viene la primera vez que se autoriza; si Google
    // no lo manda (reconexión sin revocar antes), conservamos el que ya había.
    const { data: existing } = await admin
      .from("professional_google_accounts")
      .select("refresh_token")
      .eq(ownerColumn, ownerId)
      .maybeSingle();

    await admin.from("professional_google_accounts").upsert({
      professional_id: professionalId,
      business_id: professionalId ? null : businessId,
      google_email: email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: expiresAt,
      sync_enabled: true,
    }, { onConflict: ownerColumn });

    return redirect(`${redirectBase}?google=connected`);
  } catch (e) {
    console.error("google-oauth-callback error:", (e as Error).message);
    return redirect(`${redirectBase}?google_error=token_exchange_failed`);
  }
});
