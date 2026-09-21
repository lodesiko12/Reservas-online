import { useEffect, useMemo, useState } from "react";
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

  const [active, setActive] = useState<Row | null>(null);

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle="Citas de hoy en curso ahora mismo" />
      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : !inProgress.length ? (
        <EmptyState title="No hay citas en curso" hint="Aquí aparecerán las citas de hoy mientras están teniendo lugar." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {inProgress.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="font-semibold">{b.customer_name} {b.customer_last_name ?? ""}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{b.services?.name ?? "—"} · {formatTime(b.starts_at, tz)}–{formatTime(b.ends_at, tz)}</div>
              {b.professionals?.name && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{b.professionals.name}</div>}
              <button className="btn-primary text-xs mt-3" onClick={() => setActive(b)}>Empezar cita</button>
            </div>
          ))}
        </div>
      )}
      {active && <StartSessionModal booking={active} onClose={() => setActive(null)} />}
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
