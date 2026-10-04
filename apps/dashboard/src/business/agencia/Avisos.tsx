import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { formatDateTime } from "@reservas/shared";
import { PageHeader, Spinner, EmptyState } from "../../components/ui";
import { useAgencyNotifications, type AgencyNotification } from "./hooks";
import { disablePush, enablePush, getPushState, type PushState } from "./push";

const KIND_ICON: Record<string, string> = { asignada: "📌", mencion: "💬", vence_pronto: "⏰", vence_hoy: "🔔", atrasada: "⚠️" };

/** Número de avisos sin leer (para el badge de la navegación). */
export function useUnreadCount(): number {
  const { data } = useAgencyNotifications();
  return (data ?? []).filter((n) => !n.read_at).length;
}

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getPushState().then(setState); }, []);

  async function toggle() {
    setBusy(true); setError(null);
    if (state === "on") { await disablePush(); }
    else {
      const r = await enablePush();
      if (!r.ok) setError(r.error);
    }
    setState(await getPushState());
    setBusy(false);
  }

  if (!state) return null;
  const text: Record<PushState, string> = {
    on: "Recibirás las notificaciones en este dispositivo.",
    off: "Activa las notificaciones para enterarte al momento de tus tareas, aunque tengas la app cerrada.",
    denied: "Has bloqueado las notificaciones. Actívalas desde los ajustes del navegador o del móvil para esta app.",
    "needs-install": "En iPhone y iPad hay que añadir primero la app a la pantalla de inicio (Compartir → «Añadir a pantalla de inicio») y abrirla desde ahí para poder activar las notificaciones.",
    unsupported: "Este navegador no admite notificaciones push. Prueba con Chrome, Edge o Safari actualizado.",
  };
  return (
    <div className={`card p-4 mb-5 flex items-center gap-3 flex-wrap ${state === "on" ? "" : "border-coral-500/40"}`}>
      <span className="text-2xl">{state === "on" ? "✅" : "🔔"}</span>
      <div className="flex-1 min-w-[14rem] text-sm">
        <div className="font-bold">Notificaciones en el móvil {state === "on" && "activadas"}</div>
        <div className="text-slate-500 dark:text-slate-400">{text[state]}</div>
        {error && <div className="text-red-600 mt-1">{error}</div>}
      </div>
      {(state === "off" || state === "on") && (
        <button className={state === "on" ? "btn-ghost" : "btn-primary"} onClick={toggle} disabled={busy}>
          {busy ? "…" : state === "on" ? "Desactivar" : "Activar notificaciones"}
        </button>
      )}
    </div>
  );
}

export function Avisos() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data, isLoading } = useAgencyNotifications();
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from("agency_notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["agency_notifications", bid] });
  }

  async function open(n: AgencyNotification) {
    markRead(n.read_at ? [] : [n.id]);
    if (n.team_id && n.task_id) navigate(`/app/equipos/${n.team_id}?tarea=${n.task_id}`);
  }

  return (
    <div>
      <PageHeader
        title="Avisos"
        subtitle={unread ? `${unread} sin leer` : "Todo al día"}
        actions={unread > 0 && <button className="btn-ghost" onClick={() => markRead((data ?? []).filter((n) => !n.read_at).map((n) => n.id))}>Marcar todo como leído</button>}
      />
      <PushCard />
      {isLoading ? <div className="grid place-items-center py-12"><Spinner /></div>
        : !data?.length ? <EmptyState title="No tienes avisos" hint="Te avisaremos cuando te asignen una tarea, te mencionen o se acerque una fecha límite." />
        : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((n) => (
              <button key={n.id} onClick={() => open(n)} className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${n.read_at ? "" : "bg-brand-50/60 dark:bg-brand-500/10"}`}>
                <span className="text-xl">{KIND_ICON[n.kind] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${n.read_at ? "font-semibold" : "font-extrabold"}`}>{n.title}</div>
                  {n.body && <div className="text-sm text-slate-600 dark:text-slate-300 break-words">{n.body}</div>}
                  <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(n.created_at, tz)}</div>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-coral-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
