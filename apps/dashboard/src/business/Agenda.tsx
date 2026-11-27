import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBookings, useProfessionals, type Booking } from "./hooks";
import { fetchScheduleWarnings } from "./bookingWarnings";
import { useMeetings, attendeesLabel, MeetingModal, type Meeting } from "./meetings";
import {
  ymdInTz, addDaysYmd, zonedDayRange, formatTime, formatDate,
  minutesOfDayInTz, WEEKDAYS_SHORT_ES,
} from "@reservas/shared";
import { PageHeader, Spinner, StatusBadge, Modal, EmptyState, ConfirmDialog, PaymentMethodDialog, PAYMENT_METHOD_LABEL, type PaymentMethod } from "../components/ui";

// Restaurante usa el ciclo completo (sentada, confirmada...); citas solo
// necesita marcar el desenlace de la cita: completada, cancelada o ausente.
const STATUSES_RESTAURANTE: Booking["status"][] = ["confirmada", "sentada", "completada", "no_show", "cancelada"];
const STATUSES_CITAS: Booking["status"][] = ["completada", "cancelada", "no_show"];
// Modo encargo: pendiente de confirmar → confirmado → listo → recogido / no recogido / cancelado.
const STATUSES_ENCARGO: Booking["status"][] = ["pendiente", "confirmada", "listo", "completada", "no_show", "cancelada"];
const ENCARGO_ACTION: Record<string, string> = {
  pendiente: "Volver a pendiente", confirmada: "Confirmar", listo: "Marcar listo",
  completada: "Marcar recogido", no_show: "Marcar no recogido", cancelada: "Cancelar encargo",
};

// Color de fondo/borde del bloque de reserva según estado.
const BLOCK_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  pendiente: { bg: "light-dark(#FBF3E3, rgba(183, 121, 31, .22))", border: "light-dark(#B7791F, #CC9232)", text: "light-dark(#4A310D, #F6E5BF)" },
  confirmada: { bg: "light-dark(#E1F0EE, rgba(63, 154, 147, .22))", border: "light-dark(#0B6E6A, #3F9A93)", text: "light-dark(#07403E, #CFE6E3)" },
  sentada: { bg: "light-dark(#EAF1F9, rgba(47, 112, 181, .26))", border: "light-dark(#2563A8, #4783C3)", text: "light-dark(#0F2744, #D2E2F3)" },
  listo: { bg: "light-dark(#F3EAFB, rgba(126, 63, 181, .28))", border: "light-dark(#7E3FB5, #A66FDB)", text: "light-dark(#2E1747, #E5D2F6)" },
  completada: { bg: "light-dark(#EAF6EF, rgba(42, 154, 91, .24))", border: "light-dark(#1F8A4C, #3FA66D)", text: "light-dark(#0D3A20, #D3EDDF)" },
  no_show: { bg: "light-dark(#FBEDEB, rgba(201, 74, 59, .26))", border: "light-dark(#C0392B, #D4584A)", text: "light-dark(#4F1812, #F6D6D2)" },
  cancelada: { bg: "light-dark(#E7F2F0, rgba(255, 255, 255, .06))", border: "light-dark(#6A8884, #6A8884)", text: "light-dark(#4A6764, #A7C5C0)" },
};

// Las reuniones se distinguen de las citas por el rayado y el borde discontinuo.
const MEETING_STYLE: React.CSSProperties = {
  background: "repeating-linear-gradient(135deg, light-dark(#EEF0F3, #2A3338) 0 6px, light-dark(#E2E6EA, #333E44) 6px 12px)",
  borderLeft: "4px dashed light-dark(#475569, #94A3B8)",
};

// Convierte "#rrggbb" a rgba con la opacidad dada (para teñir el fondo del bloque).
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

// Color de profesional de una cita (null para restaurante o sin profesional).
function proColor(b: any): string | null {
  return b.type === "citas" && b.professionals?.color ? b.professionals.color : null;
}

// Estilo del bloque en Semana/Mes: en citas el color lo marca el profesional (fondo teñido +
// borde grueso), y el estado se expresa con opacidad/tachado; en restaurante, por estado.
function blockStyle(b: any): { style: React.CSSProperties; className: string } {
  const color = proColor(b);
  const st = BLOCK_STYLE[b.status] ?? BLOCK_STYLE.confirmada;
  if (!color) return { style: { background: st.bg, borderLeft: `3px solid ${st.border}`, color: st.text }, className: "" };
  const muted = b.status === "cancelada" || b.status === "no_show";
  return {
    style: { background: hexAlpha(color, muted ? 0.12 : 0.28), borderLeft: `4px solid ${color}` },
    className: `text-slate-900 dark:text-slate-50 ${muted ? "opacity-60" : ""} ${b.status === "cancelada" ? "line-through" : ""}`,
  };
}

function tableLabel(b: any): string {
  if (b.table_combo_id) return b.dining_table_combos?.name ?? "Combinación";
  return b.dining_tables?.name ?? "Sin mesa";
}
function detail(b: any): string {
  if (b.option_label) return `${b.option_label}${b.services?.size_label ? ` · ${b.services.size_label}` : ""}`;
  return b.type === "restaurante"
    ? `${tableLabel(b)} · ${b.party_size} pers.`
    : `${b.services?.name ?? ""}${b.professionals?.name ? ` · ${b.professionals.name}` : ""}`;
}

export function Agenda() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(ymdInTz(new Date(), tz));
  const [selected, setSelected] = useState<any | null>(null);
  const trackPayments = business?.type === "psicologo";
  const orderMode = !!business?.order_mode;
  // Reuniones (negocios de citas): null = cerrado, "new" = creando.
  const meetingsEnabled = !!business && business.type !== "restaurante" && !orderMode;
  const [meetingOpen, setMeetingOpen] = useState<Meeting | "new" | null>(null);
  // Filtro por profesional (clic en la leyenda). Vacío = todas.
  const [proFilter, setProFilter] = useState<Set<string>>(new Set());

  // Días (lunes→domingo) de la semana que contiene `anchor`.
  const weekDays = useMemo(() => {
    const dow = new Date(anchor + "T00:00:00Z").getUTCDay(); // 0=Dom
    const monday = addDaysYmd(anchor, -((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [anchor]);

  // Rejilla del mes que contiene `anchor`: del lunes de la semana del día 1
  // al domingo de la semana del último día, para completar semanas enteras.
  const monthDays = useMemo(() => {
    const [y, m] = anchor.split("-").map(Number);
    const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lastOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const firstDow = new Date(firstOfMonth + "T00:00:00Z").getUTCDay();
    const gridStart = addDaysYmd(firstOfMonth, -((firstDow + 6) % 7));
    const lastDow = new Date(lastOfMonth + "T00:00:00Z").getUTCDay();
    const gridEnd = addDaysYmd(lastOfMonth, (7 - lastDow) % 7);
    const days: string[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDaysYmd(d, 1)) days.push(d);
    return days;
  }, [anchor]);

  const [from, to] = view === "day"
    ? zonedDayRange(anchor, tz)
    : view === "week"
    ? [zonedDayRange(weekDays[0], tz)[0], zonedDayRange(weekDays[6], tz)[1]]
    : [zonedDayRange(monthDays[0], tz)[0], zonedDayRange(monthDays[monthDays.length - 1], tz)[1]];

  const { data: allBookings, isLoading, refetch } = useBookings(from, to);
  const { data: professionals } = useProfessionals();
  const activePros = (professionals ?? []).filter((p) => p.is_active);

  const bookings = useMemo(() => {
    if (!allBookings) return allBookings;
    if (proFilter.size === 0) return allBookings;
    return allBookings.filter((b) => b.professional_id && proFilter.has(b.professional_id));
  }, [allBookings, proFilter]);

  const { data: allMeetings, isError: meetingsFailed } = useMeetings(from, to, meetingsEnabled);
  const meetings = useMemo(
    () => (allMeetings ?? []).filter((m) => proFilter.size === 0 || m.allTeam || m.professionalIds.some((id) => proFilter.has(id))),
    [allMeetings, proFilter]
  );

  function toggleProFilter(id: string) {
    setProFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function goBack() {
    if (view === "day") setAnchor(addDaysYmd(anchor, -1));
    else if (view === "week") setAnchor(addDaysYmd(anchor, -7));
    else setAnchor(addMonthsYmd(anchor, -1));
  }
  function goForward() {
    if (view === "day") setAnchor(addDaysYmd(anchor, 1));
    else if (view === "week") setAnchor(addDaysYmd(anchor, 7));
    else setAnchor(addMonthsYmd(anchor, 1));
  }

  const title = view === "day"
    ? formatDate(zonedDayRange(anchor, tz)[0], tz)
    : view === "week"
    ? `${fmtShort(weekDays[0], tz)} – ${fmtShort(weekDays[6], tz)}`
    : fmtMonthYear(anchor);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={title}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button className={`rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${view === "day" ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`} onClick={() => setView("day")}>Día</button>
              <button className={`rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${view === "week" ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`} onClick={() => setView("week")}>Semana</button>
              <button className={`rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${view === "month" ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`} onClick={() => setView("month")}>Mes</button>
            </div>
            <button className="btn-ghost !px-2.5" onClick={goBack} aria-label="Anterior"><ChevronLeft size={18} strokeWidth={1.75} /></button>
            <button className="btn-ghost" onClick={() => setAnchor(ymdInTz(new Date(), tz))}>Hoy</button>
            <button className="btn-ghost !px-2.5" onClick={goForward} aria-label="Siguiente"><ChevronRight size={18} strokeWidth={1.75} /></button>
            {meetingsEnabled && <button className="btn-primary" onClick={() => setMeetingOpen("new")}>+ Nueva reunión</button>}
          </div>
        }
      />

      {business?.type !== "restaurante" && activePros.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <button
            type="button"
            onClick={() => setProFilter(new Set())}
            className={`rounded-full px-2.5 py-1 font-medium border transition ${proFilter.size === 0
              ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"}`}
          >
            Todas
          </button>
          {activePros.map((p) => {
            const active = proFilter.size === 0 || proFilter.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProFilter(p.id)}
                title={proFilter.has(p.id) ? "Quitar del filtro" : `Ver solo las citas de ${p.name}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition text-slate-800 dark:text-slate-100 ${active ? "" : "opacity-40 grayscale"} ${proFilter.has(p.id) ? "ring-2 ring-offset-1 ring-slate-800 dark:ring-slate-100 dark:ring-offset-slate-900" : ""}`}
                style={{ background: hexAlpha(p.color, 0.28), borderLeft: `4px solid ${p.color}` }}
              >
                {p.name}
              </button>
            );
          })}
          {proFilter.size > 0 && (
            <span className="text-slate-400 dark:text-slate-500">
              {bookings?.length ?? 0} cita{(bookings?.length ?? 0) === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {meetingsFailed && <p className="text-sm text-amber-600 mb-3">No se han podido cargar las reuniones. Recarga la página.</p>}

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : view === "week" && orderMode ? (
        <OrderWeek weekDays={weekDays} tz={tz} bookings={bookings ?? []} today={ymdInTz(new Date(), tz)} onSelect={setSelected} />
      ) : view === "week" ? (
        <WeekGrid weekDays={weekDays} tz={tz} bookings={bookings ?? []} today={ymdInTz(new Date(), tz)} onSelect={setSelected} trackPayments={trackPayments} meetings={meetings} onMeeting={setMeetingOpen} />
      ) : view === "month" ? (
        <MonthGrid
          monthDays={monthDays} tz={tz} bookings={bookings ?? []} today={ymdInTz(new Date(), tz)} anchorMonth={anchor}
          onSelect={setSelected} meetings={meetings} onMeeting={setMeetingOpen}
          onDayClick={(d) => { setAnchor(d); setView("day"); }}
        />
      ) : !bookings?.length && !meetings.length ? (
        <EmptyState title={orderMode ? "Sin encargos este día" : "Sin reservas este día"} hint={orderMode ? "Prueba otra fecha o crea un encargo manual." : "Prueba otra fecha o crea una reserva manual."} />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {[...(bookings ?? []), ...meetings.map((m) => ({ meeting: m, starts_at: m.starts_at }) as any)]
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            .map((b) => {
            if (b.meeting) {
              const m: Meeting = b.meeting;
              return (
                <button key={m.id} onClick={() => setMeetingOpen(m)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800" style={MEETING_STYLE}>
                  <div className="w-16 shrink-0">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{formatTime(m.starts_at, tz)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatTime(m.ends_at, tz)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{attendeesLabel(m, professionals)}</div>
                  </div>
                  <span className="badge bg-slate-700 text-white shrink-0">Reunión</span>
                </button>
              );
            }
            const color = proColor(b);
            return (
            <button
              key={b.id}
              onClick={() => setSelected(b)}
              className={`w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left ${b.status === "cancelada" ? "opacity-60" : ""}`}
              style={color ? { borderLeft: `5px solid ${color}`, background: hexAlpha(color, 0.10) } : undefined}
            >
              <div className="w-16 shrink-0">
                <div className="font-bold text-brand-600">{formatTime(b.starts_at, tz)}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">{formatTime(b.ends_at, tz)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.customer_name} {b.customer_last_name ?? ""}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {b.type === "citas" && !b.option_label ? (b.services?.name ?? "") : detail(b)}{" · "}{b.customer_phone}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {color && b.professionals?.name && (
                  <span className="badge font-semibold text-slate-900 dark:text-slate-50" style={{ background: hexAlpha(color, 0.35) }}>
                    {b.professionals.name}
                  </span>
                )}
                <span className={`badge ${b.channel === "web" ? "bg-brand-50 text-brand-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{b.channel}</span>
                {trackPayments && <PayBadge b={b} />}
                <StatusBadge status={b.status} order={orderMode} />
              </div>
            </button>
            );
          })}
        </div>
      )}

      {meetingOpen && (
        <MeetingModal meeting={meetingOpen === "new" ? null : meetingOpen} tz={tz}
          defaultDay={view === "day" ? anchor : ymdInTz(new Date(), tz)} onClose={() => setMeetingOpen(null)} />
      )}
      {selected && <BookingModal booking={selected} tz={tz} trackPayments={trackPayments} onClose={() => setSelected(null)} onChanged={() => { refetch(); setSelected(null); }} />}
    </div>
  );
}

/* ------------------------- Semana en modo encargo ------------------------- */
/** Una columna por día con la lista de encargos por hora de recogida (sin eje horario:
 * varias recogidas pueden coincidir en la misma hora y se solaparían en la rejilla). */
function OrderWeek({ weekDays, tz, bookings, today, onSelect }: {
  weekDays: string[]; tz: string; bookings: any[]; today: string; onSelect: (b: any) => void;
}) {
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of weekDays) map[d] = [];
    for (const b of bookings) {
      const ymd = ymdInTz(new Date(b.starts_at), tz);
      if (map[ymd]) map[ymd].push(b);
    }
    for (const d of weekDays) map[d].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [bookings, weekDays, tz]);

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {weekDays.map((d) => {
        const dow = new Date(d + "T00:00:00Z").getUTCDay();
        const list = byDay[d];
        const active = list.filter((b) => b.status !== "cancelada" && b.status !== "no_show").length;
        return (
          <div key={d} className={`card p-2 min-h-[120px] ${d === today ? "ring-2 ring-brand-300" : ""}`}>
            <div className="flex items-baseline justify-between px-1 pb-1.5 border-b border-slate-100 dark:border-slate-800 mb-2">
              <span className="text-[11px] uppercase text-slate-400 dark:text-slate-500">{WEEKDAYS_SHORT_ES[dow]} <span className={`text-sm font-bold ${d === today ? "text-brand-600" : "text-slate-700 dark:text-slate-200"}`}>{d.slice(8)}</span></span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{active ? `${active} enc.` : ""}</span>
            </div>
            <div className="space-y-1.5">
              {list.length === 0 && <p className="text-[11px] text-slate-300 dark:text-slate-600 px-1">—</p>}
              {list.map((b) => {
                const bs = blockStyle(b);
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className={`w-full text-left rounded-md px-1.5 py-1 hover:shadow-md transition ${bs.className}`}
                    style={bs.style}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{formatTime(b.starts_at, tz)} · {b.customer_name}</div>
                    <div className="text-[11px] leading-tight opacity-80">{detail(b)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Rejilla semanal ------------------------------ */
function WeekGrid({ weekDays, tz, bookings, today, onSelect, trackPayments, meetings, onMeeting }: {
  weekDays: string[]; tz: string; bookings: any[]; today: string; onSelect: (b: any) => void; trackPayments: boolean;
  meetings: Meeting[]; onMeeting: (m: Meeting) => void;
}) {
  const HOUR = 46; // px por hora

  // Rango horario visible: derivado de las reservas, con margen 8–22 por defecto.
  const { startH, endH } = useMemo(() => {
    let minM = 8 * 60, maxM = 22 * 60;
    for (const b of [...bookings, ...meetings]) {
      const s = minutesOfDayInTz(b.starts_at, tz);
      let e = minutesOfDayInTz(b.ends_at, tz);
      if (e <= s) e = 24 * 60; // cruza medianoche → cap a fin de día
      minM = Math.min(minM, s);
      maxM = Math.max(maxM, e);
    }
    return { startH: Math.max(0, Math.floor(minM / 60)), endH: Math.min(24, Math.ceil(maxM / 60)) };
  }, [bookings, meetings, tz]);

  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridHeight = (endH - startH) * HOUR;

  // Hora actual (en la zona del negocio) para la línea de «ahora» de la columna de hoy; se refresca cada minuto.
  const [nowMin, setNowMin] = useState(() => minutesOfDayInTz(new Date().toISOString(), tz));
  useEffect(() => {
    const t = setInterval(() => setNowMin(minutesOfDayInTz(new Date().toISOString(), tz)), 60000);
    return () => clearInterval(t);
  }, [tz]);

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
          <div className="border-b border-slate-200 dark:border-slate-700" />
          {weekDays.map((d) => {
            const dow = new Date(d + "T00:00:00Z").getUTCDay();
            const isToday = d === today;
            return (
              <div key={d} className={`border-b border-l border-slate-200 dark:border-slate-700 py-2 text-center ${isToday ? "bg-brand-50/60 dark:bg-brand-500/10" : ""}`}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{WEEKDAYS_SHORT_ES[dow]}</div>
                <div className={`tg-display tg-num mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-[17px] ${isToday ? "bg-brand-500 text-white" : "text-slate-700 dark:text-slate-200"}`}>{d.slice(8)}</div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo con eje horario + columnas */}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          {/* Eje de horas */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="tg-num absolute right-1.5 text-[11px] text-slate-400 dark:text-slate-500" style={{ top: i * HOUR - 6 }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {weekDays.map((d) => (
            <div key={d} className={`relative border-l border-slate-200 dark:border-slate-700 ${d === today ? "bg-brand-50/30 dark:bg-brand-500/[.04]" : ""}`} style={{ height: gridHeight }}>
              {/* Líneas de hora */}
              {hours.map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-b border-slate-100 dark:border-slate-800" style={{ top: i * HOUR }} />
              ))}
              {/* Línea de «ahora» */}
              {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <div className="pointer-events-none absolute left-0 right-0 z-[5]" style={{ top: ((nowMin - startH * 60) / 60) * HOUR }} aria-hidden="true">
                  <div className="h-px bg-coral-500" />
                  <div className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-coral-500" />
                </div>
              )}
              {/* Reuniones: encima de las citas; si coinciden con alguna, ocupan solo la mitad derecha. */}
              {meetings.filter((m) => ymdInTz(new Date(m.starts_at), tz) === d).map((m) => {
                const s = minutesOfDayInTz(m.starts_at, tz);
                let e = minutesOfDayInTz(m.ends_at, tz);
                if (e <= s) e = 24 * 60;
                const shared = byDay[d].some((b) => b.starts_at < m.ends_at && b.ends_at > m.starts_at);
                const height = Math.max(20, ((e - s) / 60) * HOUR - 2);
                return (
                  <button key={m.id} onClick={() => onMeeting(m)} title={`Reunión: ${m.title}`}
                    className={`absolute right-1 z-[4] rounded-lg px-2 py-1 text-left overflow-hidden shadow-sm text-slate-900 dark:text-slate-50 hover:z-10 hover:shadow-md ${shared ? "left-1/2" : "left-1"}`}
                    style={{ top: ((s - startH * 60) / 60) * HOUR, height, ...MEETING_STYLE }}>
                    <div className="text-[11px] font-semibold leading-tight">{formatTime(m.starts_at, tz)}</div>
                    <div className="text-[11px] font-medium leading-tight truncate">{m.title}</div>
                    {height > 44 && <div className="text-[10px] opacity-80 leading-tight">Reunión</div>}
                  </button>
                );
              })}
              {/* Bloques de reserva */}
              {byDay[d].map((b) => {
                const s = minutesOfDayInTz(b.starts_at, tz);
                let e = minutesOfDayInTz(b.ends_at, tz);
                if (e <= s) e = 24 * 60;
                const top = ((s - startH * 60) / 60) * HOUR;
                const height = Math.max(20, ((e - s) / 60) * HOUR - 2);
                const bs = blockStyle(b);
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelect(b)}
                    title={`${b.customer_name} · ${detail(b)}`}
                    className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden shadow-sm hover:z-10 hover:shadow-md transition ${bs.className}`}
                    style={{ top, height, ...bs.style }}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{formatTime(b.starts_at, tz)}{trackPayments && payState(b) && <span className={payState(b) === "paid" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}> {payState(b) === "paid" ? "€✓" : "€?"}</span>}</div>
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

/* ------------------------------ Rejilla mensual ------------------------------ */
function MonthGrid({ monthDays, tz, bookings, today, anchorMonth, onSelect, onDayClick, meetings, onMeeting }: {
  monthDays: string[]; tz: string; bookings: any[]; today: string; anchorMonth: string;
  meetings: Meeting[]; onMeeting: (m: Meeting) => void;
  onSelect: (b: any) => void; onDayClick: (ymd: string) => void;
}) {
  const currentMonth = anchorMonth.slice(0, 7); // YYYY-MM

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of monthDays) map[d] = [];
    for (const b of bookings) {
      const ymd = ymdInTz(new Date(b.starts_at), tz);
      if (map[ymd]) map[ymd].push(b);
    }
    for (const d of monthDays) map[d].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [bookings, monthDays, tz]);

  const weeks = Array.from({ length: monthDays.length / 7 }, (_, i) => monthDays.slice(i * 7, i * 7 + 7));
  const MAX_VISIBLE = 3;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {WEEKDAYS_SHORT_ES.slice(1).concat(WEEKDAYS_SHORT_ES[0]).map((d) => (
          <div key={d} className="py-2 text-center text-[11px] uppercase text-slate-400 dark:text-slate-500 font-medium">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
          {week.map((d) => {
            const isToday = d === today;
            const inMonth = d.slice(0, 7) === currentMonth;
            const dayBookings = byDay[d];
            return (
              <button
                key={d}
                onClick={() => onDayClick(d)}
                className={`min-h-[92px] border-l border-slate-100 dark:border-slate-800 first:border-l-0 p-1.5 text-left align-top ${inMonth ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/60"} hover:bg-brand-50/50 transition`}
              >
                <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? "bg-brand-500 text-white" : inMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300"}`}>
                  {d.slice(8)}
                </div>
                <div className="space-y-0.5">
                  {/* Las reuniones van siempre visibles, sin entrar en el recuento de «+N más». */}
                  {meetings.filter((m) => ymdInTz(new Date(m.starts_at), tz) === d).map((m) => (
                    <div key={m.id} role="button" onClick={(e) => { e.stopPropagation(); onMeeting(m); }} title={`Reunión: ${m.title}`}
                      className="text-[10px] font-semibold leading-tight truncate rounded px-1 py-0.5 text-slate-900 dark:text-slate-50" style={MEETING_STYLE}>
                      {formatTime(m.starts_at, tz)} {m.title}
                    </div>
                  ))}
                  {dayBookings.slice(0, MAX_VISIBLE).map((b) => {
                    const bs = blockStyle(b);
                    return (
                      <div
                        key={b.id}
                        role="button"
                        onClick={(e) => { e.stopPropagation(); onSelect(b); }}
                        title={`${b.customer_name} · ${detail(b)}`}
                        className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 ${bs.className}`}
                        style={bs.style}
                      >
                        {formatTime(b.starts_at, tz)} {b.customer_name}
                      </div>
                    );
                  })}
                  {dayBookings.length > MAX_VISIBLE && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{dayBookings.length - MAX_VISIBLE} más</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Modal de reserva ------------------------------ */
/** Estado de cobro de una cita (solo psicólogos): "paid", "due" (ya pasada,
 * activa y sin cobrar) o null (futura/cancelada/ausente: no aplica). */
function payState(b: any): "paid" | "due" | null {
  if (b.paid_at) return "paid";
  if (b.status === "cancelada" || b.status === "no_show") return null;
  return new Date(b.starts_at).getTime() <= Date.now() ? "due" : null;
}
function PayBadge({ b }: { b: any }) {
  const st = payState(b);
  if (!st) return null;
  return <span className={`badge ${st === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{st === "paid" ? "Pagada" : "Sin pagar"}</span>;
}

function BookingModal({ booking, tz, trackPayments, onClose, onChanged }: {
  booking: any; tz: string; trackPayments: boolean; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { business } = useAuth();
  const orderMode = !!business?.order_mode && !!booking.option_label;
  const [busy, setBusy] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [newStart, setNewStart] = useState(toLocalInput(booking.starts_at, tz));
  const durationMin = (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000;
  const [tableOptions, setTableOptions] = useState<{ id: string; name: string; zone_name: string | null; is_free: boolean }[] | null>(null);
  const [tableId, setTableId] = useState(booking.dining_table_id ?? "");
  const [savingTable, setSavingTable] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickingMethod, setPickingMethod] = useState(false);

  async function loadTableOptions() {
    const { data } = await supabase.rpc("get_dining_table_options", {
      p_business_id: booking.business_id, p_shift_id: booking.dining_shift_id, p_starts_at: booking.starts_at, p_ends_at: booking.ends_at,
      p_party_size: booking.party_size, p_exclude_booking_id: booking.id,
    });
    setTableOptions((data as any[]) ?? []);
  }
  async function saveTable() {
    setSavingTable(true);
    const { error } = await supabase.from("bookings").update({ dining_table_id: tableId || null }).eq("id", booking.id);
    setSavingTable(false);
    if (error) { alert("Esa mesa ya está ocupada en ese horario."); return; }
    qc.invalidateQueries(); onChanged();
  }

  // Sincroniza (fire-and-forget) el evento de Google Calendar del
  // profesional, si lo tiene conectado; nunca bloquea la acción del panel.
  function syncGoogle(action: "upsert" | "delete") {
    if (booking.type !== "citas") return;
    supabase.functions.invoke("sync-google-event", { body: { booking_id: booking.id, action } }).catch(() => {});
  }

  async function setStatus(status: Booking["status"]) {
    setBusy(true);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", booking.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    syncGoogle(status === "cancelada" ? "delete" : "upsert");
    qc.invalidateQueries(); onChanged();
  }
  async function setPaid(method: PaymentMethod | null) {
    setPickingMethod(false);
    setBusy(true);
    const { error } = await supabase.from("bookings").update({ paid_at: method ? new Date().toISOString() : null, payment_method: method }).eq("id", booking.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries(); onChanged();
  }
  // Consentimiento de confidencialidad: constancia en la cita; se puede marcar a mano si faltó.
  const consentActive = !!business?.consent_required && booking.type === "citas";
  async function markConsent() {
    setBusy(true);
    const { error } = await supabase.from("bookings").update({
      consent_accepted_at: new Date().toISOString(), consent_text: business?.consent_text ?? null, consent_source: "panel",
    }).eq("id", booking.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries(); onChanged();
  }
  async function remove() {
    setConfirmingDelete(false);
    setBusy(true);
    // Borra primero el evento de Google (necesita leer la reserva, que
    // desaparece en cuanto la eliminamos) y luego la reserva en sí.
    syncGoogle("delete");
    await supabase.from("bookings").delete().eq("id", booking.id);
    qc.invalidateQueries(); setBusy(false); onChanged();
  }
  // Antes de mover una cita se avisa si la hora nueva se sale de lo normal.
  const [rescheduleWarnings, setRescheduleWarnings] = useState<string[] | null>(null);
  async function checkReschedule() {
    if (booking.type !== "citas" || orderMode) { await saveReschedule(); return; }
    setBusy(true);
    const w = await fetchScheduleWarnings({
      supabase, businessId: booking.business_id, tz, professionalId: booking.professional_id,
      startISO: fromLocalInput(newStart, tz), durationMin, excludeBookingId: booking.id,
    });
    setBusy(false);
    if (w.length > 0) { setRescheduleWarnings(w); return; }
    await saveReschedule();
  }
  async function saveReschedule() {
    setRescheduleWarnings(null);
    setBusy(true);
    const start = fromLocalInput(newStart, tz);
    const end = new Date(new Date(start).getTime() + durationMin * 60000).toISOString();
    const { error } = await supabase.from("bookings").update({ starts_at: start, ends_at: end }).eq("id", booking.id);
    setBusy(false);
    if (error) { alert(booking.type === "restaurante" ? "Esa mesa ya está ocupada en ese horario." : error.message); return; }
    syncGoogle("upsert");
    qc.invalidateQueries(); onChanged();
  }

  return (
    <Modal open onClose={onClose} title={`${booking.customer_name} ${booking.customer_last_name ?? ""}`}>
      <div className="space-y-2 text-sm">
        {orderMode ? (
          <>
            <Row k="Sabor" v={booking.option_label} />
            <Row k="Tamaño" v={booking.services?.size_label ?? booking.services?.name ?? "—"} />
            {booking.services?.price != null && <Row k="Precio" v={`${booking.services.price} €`} />}
          </>
        ) : booking.type === "restaurante"
          ? <Row k="Mesa" v={`${tableLabel(booking)} · ${booking.party_size} comensales`} />
          : <Row k="Servicio" v={booking.services?.name ?? "—"} />}
        {booking.professionals?.name && <Row k="Profesional" v={booking.professionals.name} />}
        <Row k={orderMode ? "Día de recogida" : "Fecha"} v={formatDate(booking.starts_at, tz)} />
        <Row k={orderMode ? "Hora de recogida" : "Hora"} v={orderMode ? formatTime(booking.starts_at, tz) : `${formatTime(booking.starts_at, tz)} – ${formatTime(booking.ends_at, tz)}`} />
        <Row k="Teléfono" v={booking.customer_phone ?? "—"} />
        <Row k="Email" v={booking.customer_email ?? "—"} />
        <Row k="Localizador" v={booking.locator} />
        <Row k="Estado" v={<StatusBadge status={booking.status} order={orderMode} />} />
        {trackPayments && booking.type === "citas" && (
          <Row k="Pago" v={
            <span className="flex items-center gap-2">
              {booking.paid_at ? <span className="badge bg-emerald-100 text-emerald-700">Pagada{booking.payment_method ? ` · ${PAYMENT_METHOD_LABEL[booking.payment_method as PaymentMethod]}` : ""}</span> : <span className="badge bg-amber-100 text-amber-700">Sin pagar</span>}
              {booking.services?.price != null && <span className="text-slate-500 dark:text-slate-400">{booking.services.price} €</span>}
            </span>
          } />
        )}
        {booking.type === "citas" && (booking.consent_accepted_at || consentActive) && (
          <Row k="Confidencialidad" v={
            booking.consent_accepted_at ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="badge bg-emerald-100 text-emerald-700">Aceptada</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatDate(booking.consent_accepted_at, tz)} {formatTime(booking.consent_accepted_at, tz)} · {booking.consent_source === "widget" ? "al reservar online" : "confirmada en el panel"}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="badge bg-amber-100 text-amber-700">Sin registrar</span>
                <button className="btn-ghost text-xs" onClick={markConsent} disabled={busy}>Marcar como aceptada</button>
              </span>
            )
          } />
        )}
        {booking.notes && <Row k={orderMode ? "Dedicatoria / alergias" : "Notas"} v={booking.notes} />}
      </div>

      {booking.type === "restaurante" && booking.table_combo_id && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 border-t pt-4">Mesa combinada asignada automáticamente; la reasignación manual de combinaciones no está disponible desde aquí.</p>
      )}

      {booking.type === "restaurante" && !booking.table_combo_id && (
        <div className="mt-4 border-t pt-4">
          {tableOptions === null ? (
            <button className="btn-ghost text-xs" onClick={loadTableOptions}>Cambiar mesa</button>
          ) : (
            <>
              <label className="label">Mesa</label>
              <div className="flex gap-2">
                <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">Sin mesa</option>
                  {tableOptions.map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.is_free && t.id !== booking.dining_table_id}>
                      {t.name}{t.zone_name ? ` · ${t.zone_name}` : ""}{!t.is_free && t.id !== booking.dining_table_id ? " — ocupada" : ""}
                    </option>
                  ))}
                </select>
                <button className="btn-primary shrink-0" disabled={savingTable} onClick={saveTable}>Guardar</button>
              </div>
            </>
          )}
        </div>
      )}

      {reschedule ? (
        <div className="mt-4 border-t pt-4">
          <label className="label">Nueva fecha y hora</label>
          <input type="datetime-local" className="input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" disabled={busy || !newStart} onClick={checkReschedule}>Guardar</button>
            <button className="btn-ghost" onClick={() => setReschedule(false)}>Cancelar</button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Reprogramación manual (sin re-verificar disponibilidad).</p>
        </div>
      ) : (
        <div className="mt-5 border-t pt-4 flex flex-wrap gap-2">
          {(orderMode ? STATUSES_ENCARGO : booking.type === "restaurante" ? STATUSES_RESTAURANTE : STATUSES_CITAS).filter((s) => s !== booking.status).map((s) => (
            <button key={s} className={orderMode && s === "confirmada" && booking.status === "pendiente" ? "btn-primary" : "btn-ghost"} disabled={busy} onClick={() => setStatus(s)}>
              {orderMode ? ENCARGO_ACTION[s] : <>Marcar {label(s)}</>}
            </button>
          ))}
          {trackPayments && booking.type === "citas" && (
            <button className="btn-primary" disabled={busy} onClick={() => (booking.paid_at ? setPaid(null) : setPickingMethod(true))}>{booking.paid_at ? "Marcar sin pagar" : "Marcar pagada"}</button>
          )}
          <button className="btn-ghost" onClick={() => setReschedule(true)}>Reprogramar</button>
          <button className="btn-danger ml-auto" disabled={busy} onClick={() => setConfirmingDelete(true)}>Eliminar</button>
        </div>
      )}
      <PaymentMethodDialog open={pickingMethod} count={1} onPick={setPaid} onCancel={() => setPickingMethod(false)} />
      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar reserva"
        message="¿Eliminar esta reserva definitivamente?"
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
      <ConfirmDialog
        open={!!rescheduleWarnings}
        title="Revisa la hora"
        message={(rescheduleWarnings ?? []).join(" ")}
        confirmLabel="Guardar de todos modos"
        onConfirm={saveReschedule}
        onCancel={() => setRescheduleWarnings(null)}
      />
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-slate-500 dark:text-slate-400">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
function label(s: string) {
  return ({ pendiente: "pendiente", confirmada: "confirmada", sentada: "sentada", listo: "listo", completada: "completada", no_show: "ausente", cancelada: "cancelada" } as any)[s];
}
function fmtShort(ymd: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: tz }).format(new Date(zonedDayRange(ymd, tz)[0]));
}
// Suma meses a un YYYY-MM-DD (calendario, sin tz), fijando el día al 1 para
// evitar saltos de mes al restar/sumar sobre días que no existen en el mes destino.
function addMonthsYmd(ymd: string, months: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return dt.toISOString().slice(0, 10);
}
function fmtMonthYear(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
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
