import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBookings, type Booking } from "./hooks";
import {
  ymdInTz, addDaysYmd, zonedDayRange, formatTime, formatDate,
  minutesOfDayInTz, WEEKDAYS_SHORT_ES,
} from "@reservas/shared";
import { PageHeader, Spinner, StatusBadge, Modal, EmptyState } from "../components/ui";

const STATUSES: Booking["status"][] = ["confirmada", "completada", "no_show", "cancelada"];

// Color de fondo/borde del bloque de reserva según estado.
const BLOCK_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  confirmada: { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a8a" },
  completada: { bg: "#f0fdf4", border: "#22c55e", text: "#14532d" },
  no_show: { bg: "#fef2f2", border: "#ef4444", text: "#7f1d1d" },
  cancelada: { bg: "#f8fafc", border: "#94a3b8", text: "#475569" },
};

function detail(b: any): string {
  return b.type === "restaurante"
    ? `Mesa · ${b.party_size} pers.`
    : `${b.services?.name ?? ""}${b.professionals?.name ? ` · ${b.professionals.name}` : ""}`;
}

export function Agenda() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(ymdInTz(new Date(), tz));
  const [selected, setSelected] = useState<any | null>(null);

  // Días (lunes→domingo) de la semana que contiene `anchor`.
  const weekDays = useMemo(() => {
    const dow = new Date(anchor + "T00:00:00Z").getUTCDay(); // 0=Dom
    const monday = addDaysYmd(anchor, -((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [anchor]);

  const [from, to] = view === "day"
    ? zonedDayRange(anchor, tz)
    : [zonedDayRange(weekDays[0], tz)[0], zonedDayRange(weekDays[6], tz)[1]];

  const { data: bookings, isLoading, refetch } = useBookings(from, to);

  const step = view === "day" ? 1 : 7;
  const title = view === "day"
    ? formatDate(zonedDayRange(anchor, tz)[0], tz)
    : `${fmtShort(weekDays[0], tz)} – ${fmtShort(weekDays[6], tz)}`;

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={title}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              <button className={`px-3 py-1.5 text-sm font-medium ${view === "day" ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`} onClick={() => setView("day")}>Día</button>
              <button className={`px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`} onClick={() => setView("week")}>Semana</button>
            </div>
            <button className="btn-ghost" onClick={() => setAnchor(addDaysYmd(anchor, -step))}>←</button>
            <button className="btn-ghost" onClick={() => setAnchor(ymdInTz(new Date(), tz))}>Hoy</button>
            <button className="btn-ghost" onClick={() => setAnchor(addDaysYmd(anchor, step))}>→</button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : view === "week" ? (
        <WeekGrid weekDays={weekDays} tz={tz} bookings={bookings ?? []} today={ymdInTz(new Date(), tz)} onSelect={setSelected} />
      ) : !bookings?.length ? (
        <EmptyState title="Sin reservas este día" hint="Prueba otra fecha o crea una reserva manual." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {bookings.map((b) => (
            <button key={b.id} onClick={() => setSelected(b)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 text-left">
              <div className="w-16 shrink-0">
                <div className="font-bold text-brand-600">{formatTime(b.starts_at, tz)}</div>
                <div className="text-xs text-slate-400">{formatTime(b.ends_at, tz)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.customer_name} {b.customer_last_name ?? ""}</div>
                <div className="text-xs text-slate-500 truncate">{detail(b)}{" · "}{b.customer_phone}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`badge ${b.channel === "web" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{b.channel}</span>
                <StatusBadge status={b.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <BookingModal booking={selected} tz={tz} onClose={() => setSelected(null)} onChanged={() => { refetch(); setSelected(null); }} />}
    </div>
  );
}

/* ------------------------------ Rejilla semanal ------------------------------ */
function WeekGrid({ weekDays, tz, bookings, today, onSelect }: {
  weekDays: string[]; tz: string; bookings: any[]; today: string; onSelect: (b: any) => void;
}) {
  const HOUR = 46; // px por hora

  // Rango horario visible: derivado de las reservas, con margen 8–22 por defecto.
  const { startH, endH } = useMemo(() => {
    let minM = 8 * 60, maxM = 22 * 60;
    for (const b of bookings) {
      const s = minutesOfDayInTz(b.starts_at, tz);
      let e = minutesOfDayInTz(b.ends_at, tz);
      if (e <= s) e = 24 * 60; // cruza medianoche → cap a fin de día
      minM = Math.min(minM, s);
      maxM = Math.max(maxM, e);
    }
    return { startH: Math.max(0, Math.floor(minM / 60)), endH: Math.min(24, Math.ceil(maxM / 60)) };
  }, [bookings, tz]);

  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridHeight = (endH - startH) * HOUR;

  // Agrupa reservas por día (ymd en tz).
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of weekDays) map[d] = [];
    for (const b of bookings) {
      const ymd = ymdInTz(new Date(b.starts_at), tz);
      if (map[ymd]) map[ymd].push(b);
    }
    return map;
  }, [bookings, weekDays, tz]);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Cabecera de días */}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          <div className="border-b border-slate-200" />
          {weekDays.map((d) => {
            const dow = new Date(d + "T00:00:00Z").getUTCDay();
            const isToday = d === today;
            return (
              <div key={d} className={`border-b border-l border-slate-200 py-2 text-center ${isToday ? "bg-brand-50" : ""}`}>
                <div className="text-[11px] uppercase text-slate-400">{WEEKDAYS_SHORT_ES[dow]}</div>
                <div className={`text-sm font-bold ${isToday ? "text-brand-600" : "text-slate-700"}`}>{d.slice(8)}</div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo con eje horario + columnas */}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          {/* Eje de horas */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-1 text-[10px] text-slate-400" style={{ top: i * HOUR - 6 }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {weekDays.map((d) => (
            <div key={d} className="relative border-l border-slate-200" style={{ height: gridHeight }}>
              {/* Líneas de hora */}
              {hours.map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-b border-slate-100" style={{ top: i * HOUR }} />
              ))}
              {/* Bloques de reserva */}
              {byDay[d].map((b) => {
                const s = minutesOfDayInTz(b.starts_at, tz);
                let e = minutesOfDayInTz(b.ends_at, tz);
                if (e <= s) e = 24 * 60;
                const top = ((s - startH * 60) / 60) * HOUR;
                const height = Math.max(20, ((e - s) / 60) * HOUR - 2);
                const st = BLOCK_STYLE[b.status] ?? BLOCK_STYLE.confirmada;
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    title={`${b.customer_name} · ${detail(b)}`}
                    className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-left overflow-hidden hover:z-10 hover:shadow-md transition"
                    style={{ top, height, background: st.bg, borderLeft: `3px solid ${st.border}`, color: st.text }}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{formatTime(b.starts_at, tz)}</div>
                    <div className="text-[11px] font-medium leading-tight truncate">{b.customer_name}</div>
                    {height > 44 && <div className="text-[10px] opacity-80 leading-tight truncate">{detail(b)}</div>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Modal de reserva ------------------------------ */
function BookingModal({ booking, tz, onClose, onChanged }: {
  booking: any; tz: string; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [newStart, setNewStart] = useState(toLocalInput(booking.starts_at, tz));
  const durationMin = (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000;

  async function setStatus(status: Booking["status"]) {
    setBusy(true);
    await supabase.from("bookings").update({ status }).eq("id", booking.id);
    qc.invalidateQueries(); setBusy(false); onChanged();
  }
  async function remove() {
    if (!confirm("¿Eliminar esta reserva definitivamente?")) return;
    setBusy(true);
    await supabase.from("bookings").delete().eq("id", booking.id);
    qc.invalidateQueries(); setBusy(false); onChanged();
  }
  async function saveReschedule() {
    setBusy(true);
    const start = fromLocalInput(newStart, tz);
    const end = new Date(new Date(start).getTime() + durationMin * 60000).toISOString();
    await supabase.from("bookings").update({ starts_at: start, ends_at: end }).eq("id", booking.id);
    qc.invalidateQueries(); setBusy(false); onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`${booking.customer_name} ${booking.customer_last_name ?? ""}`}>
      <div className="space-y-2 text-sm">
        {booking.type === "restaurante"
          ? <Row k="Mesa" v={`${booking.party_size} comensales`} />
          : <Row k="Servicio" v={booking.services?.name ?? "—"} />}
        {booking.professionals?.name && <Row k="Profesional" v={booking.professionals.name} />}
        <Row k="Fecha" v={formatDate(booking.starts_at, tz)} />
        <Row k="Hora" v={`${formatTime(booking.starts_at, tz)} – ${formatTime(booking.ends_at, tz)}`} />
        <Row k="Teléfono" v={booking.customer_phone ?? "—"} />
        <Row k="Email" v={booking.customer_email ?? "—"} />
        <Row k="Localizador" v={booking.locator} />
        <Row k="Estado" v={<StatusBadge status={booking.status} />} />
        {booking.notes && <Row k="Notas" v={booking.notes} />}
      </div>

      {reschedule ? (
        <div className="mt-4 border-t pt-4">
          <label className="label">Nueva fecha y hora</label>
          <input type="datetime-local" className="input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" disabled={busy} onClick={saveReschedule}>Guardar</button>
            <button className="btn-ghost" onClick={() => setReschedule(false)}>Cancelar</button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Reprogramación manual (sin re-verificar disponibilidad).</p>
        </div>
      ) : (
        <div className="mt-5 border-t pt-4 flex flex-wrap gap-2">
          {STATUSES.filter((s) => s !== booking.status).map((s) => (
            <button key={s} className="btn-ghost" disabled={busy} onClick={() => setStatus(s)}>Marcar {label(s)}</button>
          ))}
          <button className="btn-ghost" onClick={() => setReschedule(true)}>Reprogramar</button>
          <button className="btn-danger ml-auto" disabled={busy} onClick={remove}>Eliminar</button>
        </div>
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
function label(s: string) {
  return ({ confirmada: "confirmada", completada: "completada", no_show: "no-show", cancelada: "cancelada" } as any)[s];
}
function fmtShort(ymd: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: tz }).format(new Date(zonedDayRange(ymd, tz)[0]));
}

// datetime-local <-> ISO respetando la timezone del negocio.
function toLocalInput(iso: string, tz: string): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function fromLocalInput(local: string, tz: string): string {
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const pp: Record<string, string> = {};
  for (const part of dtf.formatToParts(guess)) pp[part.type] = part.value;
  const asUTC = Date.UTC(+pp.year, +pp.month - 1, +pp.day, +pp.hour, +pp.minute, +pp.second);
  return new Date(guess.getTime() - (asUTC - guess.getTime())).toISOString();
}
