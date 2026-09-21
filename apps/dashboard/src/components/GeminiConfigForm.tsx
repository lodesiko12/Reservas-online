import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "./ui";

/**
 * Clave de API de Google Gemini para el informe de IA de la ficha de
 * cliente (negocios tipo psicólogo). Clave propia por negocio (no
 * compartida por la plataforma): el tier gratuito de Gemini es de solo
 * ~10 peticiones/min y ~500-1500/día por clave, insuficiente para
 * compartir entre varios negocios. Nunca se lee desde el navegador: se
 * muestra como "configurada ✓" y se guarda vía la RPC set_gemini_key.
 */
export function GeminiConfigForm({ businessId, onToast }: { businessId: string; onToast?: (m: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_gemini_status", { p_business_id: businessId }).then(({ data }) => {
      if (!active) return;
      setHasKey((data as any[])?.[0]?.has_gemini_key ?? false);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [businessId]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("set_gemini_key", { p_business_id: businessId, p_api_key: apiKey.trim() || undefined });
    setSaving(false);
    if (error) { onToast?.("Error: " + error.message); return; }
    if (apiKey.trim()) setHasKey(true);
    setApiKey("");
    onToast?.("Clave de Gemini guardada");
  }

  if (!loaded) return <Spinner />;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Informes con IA (Gemini)</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Cada negocio usa su propia clave de Google Gemini (gratuita) para generar los informes de
        cliente desde la ficha. Consíguela en{" "}
        <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
        El plan gratuito tiene un límite de ~10 peticiones/min, suficiente para el uso normal de un solo negocio.
      </p>
      <label className="label">Clave de API {hasKey && <span className="text-green-600 text-xs font-normal">· configurada ✓</span>}</label>
      <input className="input max-w-md" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
        placeholder={hasKey ? "•••••• (dejar vacío para mantener)" : "AIza..."} />
      <button className="btn-primary mt-3" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar clave"}</button>
    </div>
  );
}
