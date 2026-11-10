// Enlaces para crear / cambiar contraseña, enviados por Resend (no por el SMTP de Supabase Auth).
//
// El enlace NO es el `action_link` de Supabase (se consume al abrirlo, y los antivirus/clientes de
// correo que "precargan" enlaces lo gastarían antes que la persona). Apunta al propio panel con el
// `token_hash` de un OTP de recuperación; el panel lo canjea con `verifyOtp` solo cuando la persona
// pulsa "Guardar contraseña". Ver apps/dashboard/src/pages/SetPassword.tsx.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendEmail } from "./email.ts";

export type SetupKind = "invite" | "reset";
export type SetupResult = "sent" | "no_account" | "not_configured" | "failed";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Busca un usuario de Auth por email recorriendo todas las páginas (listUsers pagina de 50 en 50). */
export async function findUserByEmail(admin: SupabaseClient, email: string): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users.length) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return { id: hit.id };
    if (data.users.length < 1000) return null;
  }
  return null;
}

export function buildPasswordSetupEmail(d: { link: string; kind: SetupKind; businessName?: string | null }) {
  const color = "#4f46e5";
  const biz = d.businessName?.trim();
  const subject = d.kind === "invite"
    ? `Te han dado acceso${biz ? ` a ${biz}` : ""} en Turnigo`
    : "Crea o cambia tu contraseña de Turnigo";
  const intro = d.kind === "invite"
    ? `Te han dado acceso${biz ? ` al panel de <strong>${escapeHtml(biz)}</strong>` : " al panel"} en Turnigo. Para entrar por primera vez, elige tu contraseña:`
    : "Hemos recibido una solicitud para crear o cambiar la contraseña de tu cuenta de Turnigo. Pulsa el botón para elegir una nueva:";
  const introText = d.kind === "invite"
    ? `Te han dado acceso${biz ? ` al panel de ${biz}` : " al panel"} en Turnigo. Para entrar por primera vez, elige tu contraseña:`
    : "Hemos recibido una solicitud para crear o cambiar la contraseña de tu cuenta de Turnigo. Abre este enlace para elegir una nueva:";
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${color};color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">Turnigo</h1>
      <p style="margin:4px 0 0;opacity:.9">${d.kind === "invite" ? "Tu acceso al panel" : "Contraseña de tu cuenta"}</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 16px">${intro}</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${escapeHtml(d.link)}" style="background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;display:inline-block">Elegir mi contraseña</a>
      </p>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px">El enlace caduca en 1 hora y solo sirve una vez. Si caduca, entra en el panel y pulsa «Primera vez o contraseña olvidada» para recibir otro.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px">Si no esperabas este correo, puedes ignorarlo: tu contraseña no cambia hasta que elijas una nueva.</p>
    </div>
  </div></body></html>`;
  const text = `${introText}\n${d.link}\n\nEl enlace caduca en 1 hora y solo sirve una vez. Si no esperabas este correo, ignóralo.`;
  return { subject, html, text };
}

/**
 * Genera el enlace de contraseña para `email` y lo envía. No revela nada al llamante público:
 * quien use esto desde un endpoint abierto debe responder igual para cualquier resultado.
 */
export async function sendPasswordSetupLink(
  admin: SupabaseClient,
  email: string,
  kind: SetupKind,
  businessName?: string | null,
): Promise<SetupResult> {
  const base = (Deno.env.get("DASHBOARD_URL") ?? "").replace(/\/+$/, "");
  if (!base) {
    console.error("[password-setup] Falta el secreto DASHBOARD_URL.");
    return "not_configured";
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: email.trim() });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return "no_account";

  const link = `${base}/?token_hash=${encodeURIComponent(hashed)}&type=recovery`;
  const { subject, html, text } = buildPasswordSetupEmail({ link, kind, businessName });
  try {
    const id = await sendEmail(email.trim(), subject, html, text);
    return id ? "sent" : "not_configured";
  } catch (e) {
    console.error("[password-setup] Fallo al enviar:", (e as Error).message);
    return "failed";
  }
}
