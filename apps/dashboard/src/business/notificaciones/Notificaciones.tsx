import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { formatDateTime } from "@reservas/shared";
import { PageHeader, Spinner, EmptyState } from "../../components/ui";
import { PushCard } from "../agencia/Avisos";
import { CalendarPlus } from "lucide-react";

/** Avisos propios del negocio (reservas online). Se refrescan cada 30 s. */
export function useBusinessNotifications(enabled = true) {
  const bid = useBusinessId();
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["business_notifications", bid],
    enabled: enabled && !!bid && !!uid,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("business_notifications").select("*")
        .eq("business_id", bid).eq("user_id", uid!).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

/** Nº de notificaciones sin leer (globo del menú). */
export function useNotificationsUnread(enabled: boolean): number {
  const { data } = useBusinessNotifications(enabled);
  return (data ?? []).filter((n) => !n.read_at).length;
}

export function Notificaciones() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data, isLoading } = useBusinessNotifications();
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    await supabase.from("business_notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["business_notifications", bid] });
  }

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        subtitle={unread ? `${unread} sin leer` : "Todo al día"}
        actions={unread > 0 && <button className="btn-ghost" onClick={() => markRead((data ?? []).filter((n) => !n.read_at).map((n) => n.id))}>Marcar todo como leído</button>}
      />
      <PushCard offText="Activa las notificaciones para enterarte al momento de cada reserva online, aunque tengas la app cerrada." />
      {isLoading ? <div className="grid place-items-center py-12"><Spinner /></div>
        : !data?.length ? <EmptyState title="No hay notificaciones" hint="Aquí aparecerá un aviso cada vez que alguien haga una reserva online." />
        : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((n) => (
              <button key={n.id} onClick={() => markRead(n.read_at ? [] : [n.id])} className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${n.read_at ? "" : "bg-brand-50/60 dark:bg-brand-500/10"}`}>
                <CalendarPlus size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm break-words ${n.read_at ? "font-semibold" : "font-extrabold"}`}>{n.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Recibida {formatDateTime(n.created_at, tz)}</div>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-coral-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
