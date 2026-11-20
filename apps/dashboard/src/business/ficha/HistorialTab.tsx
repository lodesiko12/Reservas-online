import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner, ConfirmDialog } from "../../components/ui";
import { formatDateTime } from "@reservas/shared";
import { Pencil, Trash2 } from "lucide-react";
import { SessionFormModal, type SessionFields } from "./SessionFormModal";
import type { Customer } from "../hooks";

const FIELDS = [
  ["objetivo", "Objetivo"],
  ["notas", "Notas"],
  ["seguimiento", "Seguimiento"],
  ["tareas_pautas", "Tareas/Pautas"],
] as const;

/** Historial de sesiones del cliente: cada sesión es un registro con 4
 * campos (Objetivo, Notas, Seguimiento, Tareas/Pautas), ordenadas de la
 * más reciente a la más antigua. Se pueden crear desde aquí (sesión suelta,
 * sin reserva) o desde "Seguimiento" al empezar una cita (con booking_id). */
export function HistorialTab({ customer }: { customer: Customer }) {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["customer-sessions", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_sessions")
        .select("*").eq("customer_id", customer.id)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ["customer-sessions", customer.id] }); }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Historial de sesiones</h3>
        <button className="btn-ghost text-xs" onClick={() => setAdding(true)}>+ Añadir sesión</button>
      </div>
      {isLoading ? <Spinner /> : !sessions?.length ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin sesiones registradas todavía.</p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id} className="card p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2">
                <span>{formatDateTime(s.session_date, tz)}</span>
                {new Date(s.updated_at).getTime() - new Date(s.created_at).getTime() > 60_000 && <span className="italic">· editada</span>}
                <span className="ml-auto flex gap-1">
                  <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setEditing(s)}>
                    <Pencil size={14} strokeWidth={1.75} /><span className="sr-only">Editar sesión</span>
                  </button>
                  <button className="h-7 w-7 grid place-items-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-slate-800" onClick={() => { setDeleteError(null); setToDelete(s); }}>
                    <Trash2 size={14} strokeWidth={1.75} /><span className="sr-only">Borrar sesión</span>
                  </button>
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                {FIELDS.map(([key, label]) => {
                  const value = (s as any)[key] as string | null;
                  if (!value) return null;
                  return (
                    <div key={key}>
                      <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
                      <dd className="whitespace-pre-wrap">{value}</dd>
                    </div>
                  );
                })}
                {FIELDS.every(([key]) => !(s as any)[key]) && <p className="text-slate-400 dark:text-slate-500">Sesión sin contenido.</p>}
              </dl>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <SessionFormModal
          title="Nueva sesión" compact
          onClose={() => setAdding(false)}
          onSubmit={async (v) => {
            if (!business?.id) return "Negocio no disponible.";
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from("client_sessions").insert({
              business_id: business.id, customer_id: customer.id, author_user_id: user?.id ?? null, ...v,
            });
            if (error) return error.message;
            invalidate();
            return null;
          }}
        />
      )}
      {editing && (
        <SessionFormModal
          title="Editar sesión" compact submitLabel="Guardar cambios"
          initial={{ objetivo: editing.objetivo ?? "", notas: editing.notas ?? "", seguimiento: editing.seguimiento ?? "", tareas_pautas: editing.tareas_pautas ?? "" } satisfies SessionFields}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const { error } = await supabase.from("client_sessions").update(v).eq("id", editing.id);
            if (error) return error.message;
            invalidate();
            return null;
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete} title="Borrar sesión" confirmLabel="Borrar"
        message={`Se borrará la sesión del ${toDelete ? formatDateTime(toDelete.session_date, tz) : ""} con todas sus notas. No se puede deshacer.${deleteError ? " Error: " + deleteError : ""}`}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const { error } = await supabase.from("client_sessions").delete().eq("id", toDelete.id);
          if (error) { setDeleteError(error.message); return; }
          setToDelete(null);
          invalidate();
        }}
      />
    </div>
  );
}
