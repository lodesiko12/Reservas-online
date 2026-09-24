import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ConfirmDialog } from "./ui";

type Status = {
  connected: boolean;
  google_email: string | null;
  location_title: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) return "nunca";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/**
 * Conexión OAuth de la ficha de Google Business Profile del NEGOCIO (no de
 * un profesional): permite activar la sincronización automática y horaria
 * del horario de apertura desde Google. Mismo patrón connect/disconnect/
 * toggle que GoogleCalendarSection (Servicios.tsx), pero a nivel de negocio.
 */
export function GoogleBusinessProfileSection({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("get_business_google_profile_status", { p_business_id: businessId });
    const row = (data as any[])?.[0];
    setStatus(
      row ?? {
        connected: false, google_email: null, location_title: null, sync_enabled: true,
        last_synced_at: null, last_sync_status: null, last_sync_error: null,
      }
    );
  }

  useEffect(() => { load(); }, [businessId]);

  async function connect() {
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke("google-business-oauth-start", { body: { business_id: businessId } });
    setBusy(false);
    if (error || (data as any)?.error) { setError((data as any)?.error ?? error!.message); return; }
    window.location.href = (data as any).url;
  }

  async function disconnect() {
    setConfirmingDisconnect(false);
    setBusy(true);
    await supabase.rpc("disconnect_business_google_profile", { p_business_id: businessId });
    setBusy(false);
    load();
  }

  async function toggleSync(enabled: boolean) {
    setBusy(true);
    await supabase.rpc("set_business_google_profile_sync", { p_business_id: businessId, p_enabled: enabled });
    setBusy(false);
    load();
  }

  if (!status) return null;

  if (!status.connected) {
    return (
      <div>
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={connect}>
          Conectar con Google Business Profile
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  const disconnectDialog = (
    <ConfirmDialog
      open={confirmingDisconnect}
      title="Desconectar Google Business Profile"
      message="¿Desconectar Google Business Profile de este negocio? El horario ya sincronizado se mantiene, pero dejará de actualizarse solo."
      confirmLabel="Desconectar"
      onConfirm={disconnect}
      onCancel={() => setConfirmingDisconnect(false)}
    />
  );

  if (status.last_sync_status === "multiple_locations") {
    return (
      <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        Tu cuenta de Google gestiona varias fichas de empresa; de momento solo admitimos negocios con
        una sola ficha en esa cuenta. Contacta con soporte si necesitas este caso.
        <div className="mt-2"><button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Desconectar</button></div>
        {disconnectDialog}
      </div>
    );
  }

  if (status.last_sync_status === "no_locations") {
    return (
      <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        No encontramos ninguna ficha de Google Business Profile en la cuenta de Google conectada
        {status.google_email ? ` (${status.google_email})` : ""}.
        <div className="mt-2"><button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Desconectar</button></div>
        {disconnectDialog}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
      <div className="text-sm">
        <div className="font-medium text-green-700">
          Conectado{status.location_title ? ` · ${status.location_title}` : ""}
          {status.google_email ? ` (${status.google_email})` : ""}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <input type="checkbox" checked={status.sync_enabled} onChange={(e) => toggleSync(e.target.checked)} disabled={busy} />
          Sincronizar automáticamente (cada hora, sobrescribe el horario de arriba)
        </label>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {status.last_sync_status === "pending" && "Esperando la primera sincronización…"}
          {status.last_sync_status === "ok" && `Última sincronización: ${relativeTime(status.last_synced_at)}`}
          {status.last_sync_status === "ok_with_warnings" && `Última sincronización: ${relativeTime(status.last_synced_at)} (con avisos)`}
          {status.last_sync_status === "error" && "Error en la última sincronización"}
        </p>
        {status.last_sync_error && (status.last_sync_status === "ok_with_warnings" || status.last_sync_status === "error") && (
          <p className={`text-xs mt-1 ${status.last_sync_status === "error" ? "text-red-600" : "text-amber-600"}`}>{status.last_sync_error}</p>
        )}
      </div>
      <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => setConfirmingDisconnect(true)}>Desconectar</button>
      {disconnectDialog}
    </div>
  );
}
