import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBookings, useBookingsRealtime, type Booking } from "./hooks";
import { ymdInTz, zonedDayRange, formatTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../components/ui";

type Row = Booking & { services: { name: string } | null; professionals: { name: string; color: string } | null };

export function Seguimiento() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  useBookingsRealtime();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const todayYmd = ymdInTz(now, tz);
  const [from, to] = zonedDayRange(todayYmd, tz);
  const { data: bookings, isLoading } = useBookings(from, to);
  useEffect(() => { setNow(new Date()); }, [bookings]);

  const inProgress = useMemo(() => {
    const nowMs = now.getTime();
    return ((bookings ?? []) as Row[]).filter(
      (b) =>
        b.status === "confirmada" &&
        new Date(b.starts_at).getTime() <= nowMs &&
        nowMs < new Date(b.ends_at).getTime()
    );
  }, [bookings, now]);

  const next = useMemo(() => {
    const nowMs = now.getTime();
    const upcoming = ((bookings ?? []) as Row[])
      .filter((b) => b.status === "confirmada" && new Date(b.starts_at).getTime() > nowMs)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return upcoming[0] ?? null;
  }, [bookings, now]);

  const [active, setActive] = useState<Row | null>(null);

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle="La cita en curso y la siguiente" />
      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !inProgress.length && !next ? (
        <EmptyState title="No hay citas hoy" hint="Aquí aparecerán la cita en curso y la siguiente, mientras haya citas pendientes hoy." />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">En curso</h3>
            {!inProgress.length ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Ninguna cita en curso ahora mismo.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {inProgress.map((b) => (
                  <BookingCard key={b.id} booking={b} tz={tz} action={<button className="btn-primary text-xs mt-3" onClick={() => setActive(b)}>Empezar cita</button>} />
                ))}
              </div>
            )}
          </div>
          {next && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Siguiente</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <BookingCard booking={next} tz={tz} action={<button className="btn-ghost text-xs mt-3" onClick={() => setActive(next)}>Apuntar notas</button>} />
              </div>
            </div>
          )}
        </div>
      )}
      {active && <StartSessionModal booking={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function BookingCard({ booking: b, tz, action }: { booking: Row; tz: string; action?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="font-semibold">{b.customer_name} {b.customer_last_name ?? ""}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{b.services?.name ?? "—"} · {formatTime(b.starts_at, tz)}–{formatTime(b.ends_at, tz)}</div>
      {b.professionals?.name && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{b.professionals.name}</div>}
      {action}
    </div>
  );
}

function StartSessionModal({ booking, onClose }: { booking: Row; onClose: () => void }) {
  const [form, setForm] = useState({ objetivo: "", notas: "", seguimiento: "", tareas_pautas: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!booking.customer_id) return;
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_sessions").insert({
      business_id: booking.business_id, customer_id: booking.customer_id, booking_id: booking.id,
      author_user_id: user?.id ?? null, session_date: booking.starts_at,
      objetivo: form.objetivo.trim() || null, notas: form.notas.trim() || null,
      seguimiento: form.seguimiento.trim() || null, tareas_pautas: form.tareas_pautas.trim() || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onClose();
  }

  const hasContent = Object.values(form).some((v) => v.trim());

  return (
    <Modal open onClose={onClose} title={`Sesión · ${booking.customer_name}`} width="max-w-lg">
      {!booking.customer_id ? (
        <p className="text-sm text-amber-600">Esta reserva no tiene un cliente vinculado, no se puede guardar la sesión.</p>
      ) : (
        <>
          <div className="space-y-3">
            <div><label className="label">Objetivo</label><textarea className="input" rows={2} placeholder="Objetivo de la sesión…" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} autoFocus /></div>
            <div><label className="label">Notas de sesión</label><textarea className="input" rows={3} placeholder="Notas sobre la cita…" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <div><label className="label">Seguimiento</label><textarea className="input" rows={2} placeholder="Qué revisar en próximas sesiones…" value={form.seguimiento} onChange={(e) => setForm({ ...form, seguimiento: e.target.value })} /></div>
            <div><label className="label">Tareas/Pautas</label><textarea className="input" rows={2} placeholder="Ejercicios o pautas para el cliente…" value={form.tareas_pautas} onChange={(e) => setForm({ ...form, tareas_pautas: e.target.value })} /></div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!hasContent || saving} onClick={save}>{saving ? "Guardando…" : "Guardar sesión"}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
