import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Spinner, Modal } from "../../components/ui";
import { formatDateTime, clientSessionSchema } from "@reservas/shared";
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
              <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">{formatDateTime(s.session_date, tz)}</div>
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
      {adding && <AddSessionModal customer={customer} onClose={() => setAdding(false)} onSaved={() => { invalidate(); setAdding(false); }} />}
    </div>
  );
}

function AddSessionModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const { business } = useAuth();
  const [form, setForm] = useState({ objetivo: "", notas: "", seguimiento: "", tareas_pautas: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!business?.id) return;
    setError(null);
    const result = clientSessionSchema.safeParse(form);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Revisa los datos."); return; }
    setSaving(true);
    const v = result.data;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_sessions").insert({
      business_id: business.id, customer_id: customer.id, author_user_id: user?.id ?? null,
      objetivo: v.objetivo ?? null, notas: v.notas ?? null,
      seguimiento: v.seguimiento ?? null, tareas_pautas: v.tareas_pautas ?? null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  const hasContent = Object.values(form).some((v) => v.trim());

  return (
    <Modal open onClose={onClose} title="Nueva sesión">
      <div className="space-y-3">
        <div><label className="label">Objetivo</label><textarea className="input" rows={2} value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} /></div>
        <div><label className="label">Notas (sobre la cita)</label><textarea className="input" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        <div><label className="label">Seguimiento (qué revisar en próximas sesiones)</label><textarea className="input" rows={2} value={form.seguimiento} onChange={(e) => setForm({ ...form, seguimiento: e.target.value })} /></div>
        <div><label className="label">Tareas/Pautas (ejercicios para el cliente)</label><textarea className="input" rows={2} value={form.tareas_pautas} onChange={(e) => setForm({ ...form, tareas_pautas: e.target.value })} /></div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={!hasContent || saving} onClick={save}>{saving ? "Guardando…" : "Guardar sesión"}</button>
      </div>
    </Modal>
  );
}
