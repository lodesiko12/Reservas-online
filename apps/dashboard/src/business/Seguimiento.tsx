import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBookings, useBookingsRealtime, type Booking } from "./hooks";
import { ymdInTz, zonedDayRange, formatTime } from "@reservas/shared";
import { SessionFormModal, readLocalDraft } from "./ficha/SessionFormModal";
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
      <PageHeader title="Sesión de hoy" subtitle="La cita en curso y la siguiente" />
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
                  <BookingCard key={b.id} booking={b} tz={tz} action={<button className="btn-primary text-xs mt-3" onClick={() => setActive(b)}>{readLocalDraft(b.id) ? "Continuar notas" : "Empezar cita"}</button>} />
                ))}
              </div>
            )}
          </div>
          {next && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Siguiente</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <BookingCard booking={next} tz={tz} action={<button className="btn-ghost text-xs mt-3" onClick={() => setActive(next)}>{readLocalDraft(next.id) ? "Continuar notas" : "Apuntar notas"}</button>} />
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
  const customerId = booking.customer_id;
  if (!customerId) {
    return (
      <Modal open onClose={onClose} title={`Sesión · ${booking.customer_name}`} width="max-w-lg">
        <p className="text-sm text-amber-600">Esta reserva no tiene un cliente vinculado, no se puede guardar la sesión.</p>
      </Modal>
    );
  }
  return (
    <SessionFormModal
      title={`Sesión · ${booking.customer_name}`} width="max-w-lg"
      draft={{ bookingId: booking.id, businessId: booking.business_id }}
      onClose={onClose}
      onSubmit={async (v) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("client_sessions").insert({
          business_id: booking.business_id, customer_id: customerId, booking_id: booking.id,
          author_user_id: user?.id ?? null, session_date: booking.starts_at, ...v,
        });
        return error ? error.message : null;
      }}
    />
  );
}
