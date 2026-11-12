import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Spinner } from "./ui";

/**
 * Ajustes del buzón de WhatsApp de UN negocio (pestaña «Mensajes»): interruptor, App Secret de
 * Meta (secreto, nunca se lee de vuelta) y los datos que hay que pegar en el panel de Meta.
 * El Phone number ID y el token de acceso se guardan en el formulario de Integraciones.
 */
export function WhatsappInboxForm({ businessId, onToast }: { businessId: string; onToast?: (m: string) => void }) {
  const { refresh } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [localToast, setLocalToast] = useState<string | null>(null);
  const webhookUrl = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  function flash(m: string) {
    if (onToast) onToast(m);
    else { setLocalToast(m); setTimeout(() => setLocalToast(null), 2500); }
  }

  async function load() {
    const { data } = await supabase.rpc("get_whatsapp_inbox_config", { p_business_id: businessId });
    const row = (data as any[])?.[0];
    if (row) {
      setEnabled(row.enabled); setHasSecret(row.has_app_secret); setHasToken(row.has_token);
      setPhoneId(row.phone_number_id ?? ""); setVerifyToken(row.verify_token ?? "");
    }
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("set_whatsapp_inbox_config", {
      p_business_id: businessId, p_enabled: enabled, p_app_secret: secret.trim() || undefined,
    });
    setSaving(false);
    if (error) { flash("Error: " + error.message); return; }
    setSecret("");
    await load();
    await refresh(); // para que aparezca (o desaparezca) la pestaña «Mensajes»
    flash("Buzón de WhatsApp guardado");
  }

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); flash("Copiado"); } catch { /* sin portapapeles */ }
  }

  if (!loaded) return <Spinner />;

  return (
    <div>
      {localToast && <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{localToast}</div>}
      <label className="flex items-center gap-2 text-sm font-medium mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Activar la pestaña «Mensajes» (ver y contestar los WhatsApp que lleguen al número del negocio)
      </label>

      {enabled && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">App Secret de Meta {hasSecret && <span className="text-green-600 text-xs font-normal">· configurado ✓</span>}</label>
              <input className="input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={hasSecret ? "•••••• (dejar vacío para mantener)" : "Clave secreta de la app"} />
            </div>
            <div>
              <label className="label">Estado de las credenciales</label>
              <p className="text-sm pt-2">
                Phone number ID: {phoneId ? <span className="text-green-600">{phoneId} ✓</span> : <span className="text-amber-600">falta</span>}
                {" · "}Token: {hasToken ? <span className="text-green-600">configurado ✓</span> : <span className="text-amber-600">falta</span>}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Se guardan en «Integraciones», arriba.</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 text-sm space-y-2">
            <p className="font-semibold">Datos para pegar en Meta (WhatsApp → Configuración → Webhook)</p>
            <div>
              <div className="label">URL de devolución de llamada</div>
              <div className="flex gap-2 items-center"><code className="flex-1 break-all bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs">{webhookUrl}</code><button type="button" className="btn-ghost text-xs" onClick={() => copy(webhookUrl)}>Copiar</button></div>
            </div>
            <div>
              <div className="label">Token de verificación</div>
              {verifyToken ? (
                <div className="flex gap-2 items-center"><code className="flex-1 break-all bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs">{verifyToken}</code><button type="button" className="btn-ghost text-xs" onClick={() => copy(verifyToken)}>Copiar</button></div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Se genera al guardar.</p>
              )}
            </div>
            <ol className="list-decimal pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-1">
              <li>En developers.facebook.com → tu app → WhatsApp → Configuración, pega la URL y el token de verificación y pulsa «Verificar y guardar».</li>
              <li>En esa misma pantalla, suscríbete al campo <b>messages</b>.</li>
              <li>El App Secret está en Ajustes de la app → Básico → Clave secreta de la app.</li>
              <li>Guarda el Phone number ID y el token de acceso en «Integraciones».</li>
            </ol>
          </div>
        </>
      )}

      <button className="btn-primary mt-5" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar buzón"}</button>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Los mensajes se guardan en el servidor del negocio. WhatsApp solo permite responder con texto libre durante las 24 h siguientes al último mensaje de la persona.
      </p>
    </div>
  );
}
