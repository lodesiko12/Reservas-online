import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ConfirmDialog } from "./ui";

type Status = { connected: boolean; google_email: string | null; sync_enabled: boolean };

/**
 * Conexión OAuth de Google Calendar del NEGOCIO (no de un profesional):
 * exporta los eventos de la Agenda interna. Para negocios tipo "autonomo",
 * que no tienen profesionales — la versión por profesional vive en
 * Servicios.tsx (GoogleCalendarSection). Mismo patrón connect/disconnect/
 * toggle que GoogleBusinessProfileSection.
 */
export function GoogleCalendarBusinessSection({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("get_business_google_status", { p_business_id: businessId });
    const row = (data as any[])?.[0];
    setStatus(row ?? { connected: false, google_email: null, sync_enabled: true });
  }

  useEffect(() => { load(); }, [businessId]);

  async function connect() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { business_id: businessId } });
    setBusy(false);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    window.location.href = (data as any).url;
  }

  async function disconnect() {
    setConfirmingDisconnect(false);
    setBusy(true);
    await supabase.rpc("disconnect_business_google", { p_business_id: businessId });
    setBusy(false);
    load();
  }

  async function toggleSync(enabled: boolean) {
    setBusy(true);
    await supabase.rpc("set_business_google_sync", { p_business_id: businessId, p_enabled: enabled });
    setBusy(false);
    load();
  }

  if (!status) return null;

  return (
    <div>
      {status.connected ? (
        <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <div className="text-sm">
            <div className="font-medium text-green-700">Conectado{status.google_email ? ` · ${status.google_email}` : ""}</div>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <input type="checkbox" checked={status.sync_enabled} onChange={(e) => toggleSync(e.target.checked)} disabled={busy} />
              Sincronizar (exportar los eventos de la Agenda a Google Calendar)
            </label>
          </div>
          <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Desconectar</button>
        </div>
      ) : (
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={connect}>
          Conectar con Google Calendar
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <ConfirmDialog
        open={confirmingDisconnect}
        title="Desconectar Google Calendar"
        message="¿Desconectar Google Calendar de este negocio? Los eventos ya exportados se mantienen en tu Google Calendar, pero dejarán de actualizarse solos."
        confirmLabel="Desconectar"
        onConfirm={disconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}
