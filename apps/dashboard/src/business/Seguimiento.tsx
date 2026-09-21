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
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!body.trim() || !booking.customer_id) return;
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_notes").insert({
      business_id: booking.business_id, customer_id: booking.customer_id,
      booking_id: booking.id, author_user_id: user?.id ?? null, body: body.trim(),
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Nota de sesión · ${booking.customer_name}`}>
      {!booking.customer_id ? (
        <p className="text-sm text-amber-600">Esta reserva no tiene un cliente vinculado, no se puede guardar una nota.</p>
      ) : (
        <>
          <textarea className="input" rows={6} placeholder="Notas de la sesión…" value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!body.trim() || saving} onClick={save}>{saving ? "Guardando…" : "Guardar nota"}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
