import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import type { CrmEvent } from "./types";
import {
  ymdInTz, addDaysYmd, zonedDayRange, formatTime, formatDate, WEEKDAYS_SHORT_ES,
} from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState, ConfirmDialog } from "../../components/ui";

const TYPE_LABEL: Record<string, string> = { visita: "Visita", llamada: "Llamada", trabajo: "Trabajo", otro: "Otro" };
const TYPE_COLOR: Record<string, string> = { visita: "#0ea5e9", llamada: "#8b5cf6", trabajo: "#f59e0b", otro: "#64748b" };

function useCrmEvents(fromISO: string, toISO: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["crm_events", bid, fromISO, toISO],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_events")
        .select("*, customers(full_name, last_name, phone)")
        .eq("business_id", bid)
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at");
      if (error) throw error;
      return data as unknown as (CrmEvent & { customers: { full_name: string; last_name: string | null; phone: string | null } | null })[];
    },
  });
}

export function AgendaInterna() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(ymdInTz(new Date(), tz));
  const [selected, setSelected] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const weekDays = useMemo(() => {
    const dow = new Date(anchor + "T00:00:00Z").getUTCDay();
    const monday = addDaysYmd(anchor, -((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  }, [anchor]);

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

  const { data: events, isLoading, refetch } = useCrmEvents(from, to);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of events ?? []) {
      const ymd = ymdInTz(new Date(ev.starts_at), tz);
      (map[ymd] ??= []).push(ev);
    }
    return map;
  }, [events, tz]);

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
    ? `${fmtShort(weekDays[0])} – ${fmtShort(weekDays[6])}`
    : fmtMonthYear(anchor);

  const today = ymdInTz(new Date(), tz);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={title}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button className={`px-3 py-1.5 text-sm font-medium ${view === "day" ? "bg-brand-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`} onClick={() => setView("day")}>Día</button>
              <button className={`px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-brand-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`} onClick={() => setView("week")}>Semana</button>
              <button className={`px-3 py-1.5 text-sm font-medium ${view === "month" ? "bg-brand-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`} onClick={() => setView("month")}>Mes</button>
            </div>
            <button className="btn-ghost" onClick={goBack}>←</button>
            <button className="btn-ghost" onClick={() => setAnchor(today)}>Hoy</button>
            <button className="btn-ghost" onClick={goForward}>→</button>
            <button className="btn-primary" onClick={() => setCreating(true)}>+ Evento</button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : view === "month" ? (
        <MonthGrid monthDays={monthDays} byDay={byDay} today={today} anchorMonth={anchor} tz={tz}
          onSelect={setSelected} onDayClick={(d) => { setAnchor(d); setView("day"); }} />
      ) : view === "week" ? (
        <div className="space-y-4">
          {weekDays.map((d) => (
            <DayAgenda key={d} ymd={d} tz={tz} events={byDay[d] ?? []} isToday={d === today} onSelect={setSelected} />
          ))}
        </div>
      ) : !(byDay[anchor] ?? []).length ? (
        <EmptyState title="Sin eventos este día" hint="Crea una visita, llamada o trabajo desde el botón + Evento." />
      ) : (
        <DayAgenda ymd={anchor} tz={tz} events={byDay[anchor] ?? []} isToday={anchor === today} onSelect={setSelected} expanded />
      )}

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} onChanged={() => { refetch(); setSelected(null); }} />}
      {creating && <EventModal onClose={() => setCreating(false)} onChanged={() => { refetch(); setCreating(false); }} defaultDate={anchor} />}
    </div>
  );
}

function DayAgenda({ ymd, tz, events, isToday, onSelect, expanded }: {
  ymd: string; tz: string; events: any[]; isToday: boolean; onSelect: (e: any) => void; expanded?: boolean;
}) {
  const dow = new Date(ymd + "T00:00:00Z").getUTCDay();
  const sorted = (events ?? []).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className="card overflow-hidden">
      <div className={`px-4 py-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 ${isToday ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}>
        <span className="text-xs uppercase text-slate-400 dark:text-slate-500">{WEEKDAYS_SHORT_ES[dow]}</span>
        <span className={`font-semibold text-sm ${isToday ? "text-brand-600" : ""}`}>{ymd.slice(8)} {!expanded ? "" : `de ${fmtMonthYear(ymd)}`}</span>
        {!sorted.length && <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">Sin eventos</span>}
      </div>
      {sorted.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((ev) => (
            <button key={ev.id} onClick={() => onSelect(ev)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: TYPE_COLOR[ev.type] }} />
              <div className="w-14 shrink-0 text-sm font-semibold text-brand-600">{formatTime(ev.starts_at, tz)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ev.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {TYPE_LABEL[ev.type]}{ev.customers ? ` · ${ev.customers.full_name} ${ev.customers.last_name ?? ""}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthGrid({ monthDays, byDay, today, anchorMonth, tz, onSelect, onDayClick }: {
  monthDays: string[]; byDay: Record<string, any[]>; today: string; anchorMonth: string; tz: string;
  onSelect: (e: any) => void; onDayClick: (ymd: string) => void;
}) {
  const currentMonth = anchorMonth.slice(0, 7);
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
            const dayEvents = (byDay[d] ?? []).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            return (
              <button key={d} onClick={() => onDayClick(d)}
                className={`min-h-[80px] border-l border-slate-100 dark:border-slate-800 first:border-l-0 p-1.5 text-left align-top ${inMonth ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/60"} hover:bg-brand-50/50 transition`}>
                <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? "bg-brand-500 text-white" : inMonth ? "text-slate-700 dark:text-slate-200" : "text-slate-300"}`}>
                  {d.slice(8)}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                    <div key={ev.id} role="button" onClick={(e) => { e.stopPropagation(); onSelect(ev); }}
                      className="text-[10px] leading-tight truncate rounded px-1 py-0.5 text-white"
                      style={{ background: TYPE_COLOR[ev.type] }}>
                      {formatTime(ev.starts_at, tz)} {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > MAX_VISIBLE && <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{dayEvents.length - MAX_VISIBLE} más</div>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Modal de creación/edición de evento de agenda interna. Reutilizable desde
 * Pipeline (CardDetail), la ficha de cliente (CitasTab) y la propia agenda. */
export function EventModal({ event, customerId, cardId, defaultDate, onClose, onChanged }: {
  event?: any; customerId?: string; cardId?: string; defaultDate?: string; onClose: () => void; onChanged: () => void;
}) {
  const bid = useBusinessId();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const isEdit = !!event;

  const [form, setForm] = useState(() => {
    const base = defaultDate ?? ymdInTz(new Date(), tz);
    return {
      title: event?.title ?? "",
      type: (event?.type ?? "trabajo") as string,
      date: event ? toLocalDate(event.starts_at, tz) : base,
      startTime: event ? toLocalTime(event.starts_at, tz) : "09:00",
      endTime: event ? toLocalTime(event.ends_at, tz) : "10:00",
      address: event?.address ?? "",
      notes: event?.notes ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm_events", bid] });
  }

  function syncGoogle(eventId: string, action: "upsert" | "delete") {
    supabase.functions.invoke("sync-google-event", { body: { event_id: eventId, action } }).catch(() => {});
  }

  async function save() {
    if (!form.title.trim()) return;
    setError(null);
    const starts_at = fromLocal(form.date, form.startTime, tz);
    const ends_at = fromLocal(form.date, form.endTime, tz);
    if (new Date(ends_at) <= new Date(starts_at)) { setError("La hora de fin debe ser posterior a la de inicio."); return; }
    setSaving(true);
    if (isEdit) {
      const { error } = await supabase.from("crm_events").update({
        title: form.title.trim(), type: form.type as any, starts_at, ends_at,
        address: form.address.trim() || null, notes: form.notes.trim() || null,
      }).eq("id", event.id).eq("business_id", bid);
      setSaving(false);
      if (error) { setError(error.message); return; }
      syncGoogle(event.id, "upsert");
    } else {
      const { data, error } = await supabase.from("crm_events").insert({
        business_id: bid, customer_id: customerId ?? event?.customer_id ?? null, card_id: cardId ?? event?.card_id ?? null,
        title: form.title.trim(), type: form.type as any, starts_at, ends_at,
        address: form.address.trim() || null, notes: form.notes.trim() || null,
      }).select("id").single();
      setSaving(false);
      if (error) { setError(error.message); return; }
      if (data) syncGoogle(data.id, "upsert");
    }
    invalidate();
    onChanged();
  }

  async function remove() {
    setConfirmingDelete(false);
    await supabase.from("crm_events").delete().eq("id", event.id).eq("business_id", bid);
    syncGoogle(event.id, "delete");
    invalidate();
    onChanged();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar evento" : "Nuevo evento"} width="max-w-sm">
      <div className="space-y-3">
        <div><label className="label">Título *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div><label className="label">Fecha</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Hora inicio</label><input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><label className="label">Hora fin</label><input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
        </div>
        <div><label className="label">Dirección</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-between gap-2">
          {isEdit ? <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>Eliminar</button> : <span />}
          <div className="flex gap-2 ml-auto">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!form.title.trim() || saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirmingDelete} title="Eliminar evento" message="¿Eliminar este evento de la agenda?" onConfirm={remove} onCancel={() => setConfirmingDelete(false)} />
    </Modal>
  );
}

function fmtShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}
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
function toLocalDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function toLocalTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fromLocal(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const pp: Record<string, string> = {};
  for (const part of dtf.formatToParts(guess)) pp[part.type] = part.value;
  const asUTC = Date.UTC(+pp.year, +pp.month - 1, +pp.day, +pp.hour, +pp.minute, +pp.second);
  return new Date(guess.getTime() - (asUTC - guess.getTime())).toISOString();
}
