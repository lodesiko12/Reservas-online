import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "./ui";

/**
 * Formulario de credenciales de email (Resend) y WhatsApp (Meta) de UN negocio.
 * Reutilizado por el panel del negocio y por el super-admin.
 * Los secretos nunca se leen desde el navegador: se muestran como "configurada ✓"
 * y se guardan vía la RPC set_business_integration (SECURITY DEFINER).
 */
export function IntegrationsForm({ businessId, onToast }: { businessId: string; onToast?: (m: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailFrom, setEmailFrom] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waTemplate, setWaTemplate] = useState("");
  const [waLang, setWaLang] = useState("es");
  const [hasResendKey, setHasResendKey] = useState(false);
  const [hasWaToken, setHasWaToken] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [hasGoogleSecret, setHasGoogleSecret] = useState(false);
  const [localToast, setLocalToast] = useState<string | null>(null);

  function flash(m: string) {
    if (onToast) onToast(m);
    else { setLocalToast(m); setTimeout(() => setLocalToast(null), 2500); }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: biz }, { data: integ }, { data: googleStatus }] = await Promise.all([
        supabase.from("businesses").select("whatsapp_reminders_enabled, reminder_template_name, reminder_lang").eq("id", businessId).single(),
        supabase.rpc("get_business_integration", { p_business_id: businessId }),
        supabase.rpc("get_google_credentials_status", { p_business_id: businessId }),
      ]);
      if (!active) return;
      if (biz) { setWaEnabled(biz.whatsapp_reminders_enabled); setWaTemplate(biz.reminder_template_name ?? ""); setWaLang(biz.reminder_lang ?? "es"); }
      const row = (integ as any[])?.[0];
      if (row) { setEmailFrom(row.email_from ?? ""); setWaPhoneId(row.whatsapp_phone_number_id ?? ""); setHasResendKey(row.has_resend_key); setHasWaToken(row.has_whatsapp_token); }
      const gRow = (googleStatus as any[])?.[0];
      if (gRow) { setGoogleClientId(gRow.google_client_id ?? ""); setHasGoogleSecret(gRow.has_google_client_secret); }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [businessId]);

  async function save() {
    setSaving(true);
    await supabase.from("businesses").update({
      whatsapp_reminders_enabled: waEnabled,
      reminder_template_name: waTemplate || null,
      reminder_lang: waLang,
    }).eq("id", businessId);
    const { error } = await supabase.rpc("set_business_integration", {
      p_business_id: businessId,
      p_email_from: emailFrom.trim(),
      p_whatsapp_phone_number_id: waPhoneId.trim(),
      p_resend_api_key: resendKey.trim() || undefined,
      p_whatsapp_token: waToken.trim() || undefined,
    });
    const { error: googleError } = await supabase.rpc("set_google_credentials", {
      p_business_id: businessId,
      p_client_id: googleClientId.trim(),
      p_client_secret: googleClientSecret.trim() || undefined,
    });
    setSaving(false);
    if (error || googleError) { flash("Error: " + (error?.message ?? googleError?.message)); return; }
    if (resendKey.trim()) setHasResendKey(true);
    if (waToken.trim()) setHasWaToken(true);
    if (googleClientSecret.trim()) setHasGoogleSecret(true);
    setResendKey(""); setWaToken(""); setGoogleClientSecret("");
    flash("Integraciones guardadas");
  }

  if (!loaded) return <Spinner />;

  return (
    <div>
      {localToast && <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{localToast}</div>}

      <h3 className="text-sm font-semibold text-slate-700 mb-2">Email de confirmación (Resend)</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Remitente (From)</label>
          <input className="input" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="Mi Negocio <hola@midominio.com>" />
        </div>
        <div>
          <label className="label">Resend API key {hasResendKey && <span className="text-green-600 text-xs font-normal">· configurada ✓</span>}</label>
          <input className="input" type="password" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder={hasResendKey ? "•••••• (dejar vacío para mantener)" : "re_..."} />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Recordatorios por WhatsApp (Meta Cloud API)</h3>
      <label className="flex items-center gap-2 text-sm font-medium mb-3"><input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} /> Activar recordatorio 24h antes</label>
      {waEnabled && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Phone number ID</label><input className="input" value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} placeholder="1234567890" /></div>
          <div><label className="label">Token permanente {hasWaToken && <span className="text-green-600 text-xs font-normal">· configurado ✓</span>}</label><input className="input" type="password" value={waToken} onChange={(e) => setWaToken(e.target.value)} placeholder={hasWaToken ? "•••••• (dejar vacío para mantener)" : "EAAG..."} /></div>
          <div><label className="label">Plantilla aprobada</label><input className="input" value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} placeholder="recordatorio_cita" /></div>
          <div><label className="label">Idioma de la plantilla</label><input className="input" value={waLang} onChange={(e) => setWaLang(e.target.value)} placeholder="es" /></div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Google Calendar</h3>
      <p className="text-xs text-slate-500 mb-3">
        Crea un proyecto en Google Cloud Console con la API de Google Calendar habilitada y una credencial OAuth
        "Aplicación web" (URI de redirección autorizada: añade la que se muestra abajo). Pega aquí su Client ID y
        Client Secret; cada profesional podrá luego conectar su propia cuenta desde su ficha en "Servicios".
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label">Client ID</label><input className="input" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" /></div>
        <div>
          <label className="label">Client Secret {hasGoogleSecret && <span className="text-green-600 text-xs font-normal">· configurado ✓</span>}</label>
          <input className="input" type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder={hasGoogleSecret ? "•••••• (dejar vacío para mantener)" : "GOCSPX-..."} />
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        URI de redirección a autorizar en Google Cloud: <code className="bg-slate-100 px-1 rounded">{`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/google-oauth-callback`}</code>
      </p>

      <button className="btn-primary mt-5" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar integraciones"}</button>
      <p className="text-xs text-slate-400 mt-2">Si no configuras credenciales propias, se usan las globales de la plataforma (si existen).</p>
    </div>
  );
}
