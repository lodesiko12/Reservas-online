import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { addDaysYmd, formatTime, ymdInTz, zonedDayRange, WEEKDAYS_SHORT_ES } from "@reservas/shared";
import { fromLocalInput, toLocalInput } from "../../lib/datetime";
import { PageHeader, Spinner, Modal, ConfirmDialog, EmptyState } from "../../components/ui";
import {
  useAgencyEvents, useAgencyMe, useAgencyTasks, useAgencyTeams, useTodayYmd,
  type AgencyEvent, type AgencyTask,
} from "./hooks";
import { TaskModal } from "./TaskModal";

type Item =
  | { kind: "event"; id: string; ymd: string; sort: string; title: string; teamId: string | null; time: string | null; event: AgencyEvent }
  | { kind: "task"; id: string; ymd: string; sort: string; title: string; teamId: string; time: null; task: AgencyTask };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEK_HEAD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthGrid(anchor: string): string[] {
  const [y, m] = anchor.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const start = addDaysYmd(first, -((new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7));
  const end = addDaysYmd(last, (7 - new Date(last + "T00:00:00Z").getUTCDay()) % 7);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDaysYmd(d, 1)) days.push(d);
  return days;
}

function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = WEEKDAYS_SHORT_ES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} de ${MONTHS[m - 1]}`;
}

/** Calendario común: eventos de los equipos del usuario + fechas límite de tareas. Vista mensual y agenda. */
export function Calendario() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const today = useTodayYmd();
  const { data: teams } = useAgencyTeams();
  const { data: tasks } = useAgencyTasks();
  const [view, setView] = useState<"mes" | "agenda">("mes");
  const [anchor, setAnchor] = useState(today.slice(0, 8) + "01");
  const [selected, setSelected] = useState(today);
  const [teamFilter, setTeamFilter] = useState<string>("all"); // all | general | <teamId>
  const [showTasks, setShowTasks] = useState(true);
  const [editing, setEditing] = useState<AgencyEvent | "new" | null>(null);
  const [openTask, setOpenTask] = useState<AgencyTask | null>(null);

  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const from = zonedDayRange(days[0], tz)[0];
  const to = zonedDayRange(addDaysYmd(days[days.length - 1], 1), tz)[0];
  const { data: events, isLoading } = useAgencyEvents(from, to);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const e of events ?? []) {
      if (teamFilter === "general" && e.team_id) continue;
      if (teamFilter !== "all" && teamFilter !== "general" && e.team_id !== teamFilter) continue;
      const ymd = ymdInTz(new Date(e.starts_at), tz);
      out.push({ kind: "event", id: e.id, ymd, sort: e.all_day ? "00:00" : formatTime(e.starts_at, tz), title: e.title, teamId: e.team_id, time: e.all_day ? null : formatTime(e.starts_at, tz), event: e });
    }
    if (showTasks) {
      for (const t of tasks ?? []) {
        if (!t.due_date || t.due_date < days[0] || t.due_date > days[days.length - 1]) continue;
        if (teamFilter === "general") continue;
        if (teamFilter !== "all" && t.team_id !== teamFilter) continue;
        out.push({ kind: "task", id: t.id, ymd: t.due_date, sort: "99:99", title: t.title, teamId: t.team_id, time: null, task: t });
      }
    }
    return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.sort.localeCompare(b.sort));
  }, [events, tasks, teamFilter, showTasks, tz, days]);

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) m.set(i.ymd, [...(m.get(i.ymd) ?? []), i]);
    return m;
  }, [items]);

  const teamName = (id: string | null) => (id ? teams?.find((t) => t.id === id)?.name ?? "" : "General");
  const monthLabel = (() => { const [y, m] = anchor.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; })();
  const shift = (n: number) => {
    const [y, m] = anchor.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
  };
  function open(i: Item) { if (i.kind === "event") setEditing(i.event); else setOpenTask(i.task); }
  const inMonth = (ymd: string) => ymd.slice(0, 7) === anchor.slice(0, 7);
  const agendaDays = [...byDay.keys()].filter(inMonth).sort();

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Eventos y fechas límite de tus equipos" actions={<button className="btn-primary" onClick={() => setEditing("new")}>+ Evento</button>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-3" onClick={() => shift(-1)} aria-label="Mes anterior">‹</button>
          <button className="btn-ghost" onClick={() => { setAnchor(today.slice(0, 8) + "01"); setSelected(today); }}>Hoy</button>
          <button className="btn-ghost px-3" onClick={() => shift(1)} aria-label="Mes siguiente">›</button>
        </div>
        <div className="font-extrabold text-lg capitalize min-w-[9rem]">{monthLabel}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">Todos los equipos</option>
            <option value="general">Solo generales</option>
            {(teams ?? []).filter((t) => !t.is_archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} /> Tareas
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(["mes", "agenda"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm font-semibold capitalize ${view === v ? "bg-brand-500 text-white" : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? <div className="grid place-items-center py-16"><Spinner /></div> : view === "mes" ? (
        <>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              {WEEK_HEAD.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const list = byDay.get(d) ?? [];
                const isToday = d === today;
                return (
                  <button
                    key={d} onClick={() => setSelected(d)}
                    className={`min-h-[64px] sm:min-h-[96px] p-1 text-left border-b border-r border-slate-100 dark:border-slate-800 align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${!inMonth(d) ? "opacity-40" : ""} ${selected === d ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}
                  >
                    <span className={`inline-grid place-items-center h-6 w-6 rounded-full text-xs font-bold ${isToday ? "bg-coral-500 text-white" : ""}`}>{Number(d.slice(8))}</span>
                    {/* Móvil: puntos. Escritorio: títulos. */}
                    <div className="sm:hidden flex flex-wrap gap-0.5 mt-1">
                      {list.slice(0, 6).map((i) => <span key={i.kind + i.id} className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor(i) }} />)}
                    </div>
                    <div className="hidden sm:block space-y-0.5 mt-0.5">
                      {list.slice(0, 3).map((i) => (
                        <div key={i.kind + i.id} className="truncate rounded px-1 text-[11px] font-semibold text-white" style={{ background: dotColor(i) }}>{i.title}</div>
                      ))}
                      {list.length > 3 && <div className="text-[11px] text-slate-500">+{list.length - 3} más</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <section className="mt-5">
            <h2 className="font-extrabold mb-2 capitalize">{fmtDay(selected)}</h2>
            <DayList items={byDay.get(selected) ?? []} teamName={teamName} onOpen={open} />
          </section>
        </>
      ) : agendaDays.length ? (
        <div className="space-y-5">
          {agendaDays.map((d) => (
            <section key={d}>
              <h2 className={`font-extrabold mb-2 capitalize ${d === today ? "text-coral-700" : ""}`}>{fmtDay(d)}{d === today && " · hoy"}</h2>
              <DayList items={byDay.get(d) ?? []} teamName={teamName} onOpen={open} />
            </section>
          ))}
        </div>
      ) : <EmptyState title="Nada programado este mes" hint="Crea un evento con el botón de arriba." />}

      {editing && <EventModal event={editing === "new" ? null : editing} defaultDay={selected} onClose={() => setEditing(null)} />}
      {openTask && <TaskModal teamId={openTask.team_id} task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function dotColor(i: Item): string {
  if (i.kind === "event") return "#0B6E6A";
  return i.task.status === "hecha" ? "#8CA3A1" : "#C8401F";
}

function DayList({ items, teamName, onOpen }: { items: Item[]; teamName: (id: string | null) => string; onOpen: (i: Item) => void }) {
  if (!items.length) return <p className="text-sm text-slate-400">Nada programado este día.</p>;
  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((i) => (
        <button key={i.kind + i.id} onClick={() => onOpen(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: dotColor(i) }} />
          <div className="min-w-0 flex-1">
            <div className={`font-semibold truncate ${i.kind === "task" && i.task.status === "hecha" ? "line-through text-slate-400" : ""}`}>{i.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {i.kind === "event" ? (i.time ?? "Todo el día") : "Fecha límite de tarea"} · {teamName(i.teamId)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function EventModal({ event, defaultDay, onClose }: { event: AgencyEvent | null; defaultDay: string; onClose: () => void }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { isDirectiva } = useAgencyMe();
  const { data: teams } = useAgencyTeams();

  const startLocal = event ? toLocalInput(event.starts_at, tz) : `${defaultDay}T10:00`;
  const endLocal = event?.ends_at ? toLocalInput(event.ends_at, tz) : "";
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [teamId, setTeamId] = useState<string>(event?.team_id ?? (isDirectiva ? "" : (teams?.[0]?.id ?? "")));
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [date, setDate] = useState(startLocal.slice(0, 10));
  const [start, setStart] = useState(startLocal.slice(11, 16));
  const [end, setEnd] = useState(endLocal.slice(11, 16));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Un evento general solo lo puede editar la directiva; uno de equipo, quien esté en el equipo.
  const readOnly = !!event && !event.team_id && !isDirectiva;
  const teamOptions = (teams ?? []).filter((t) => !t.is_archived);

  async function save() {
    if (!title.trim()) { setError("Escribe un título."); return; }
    if (!teamId && !isDirectiva) { setError("Elige un equipo."); return; }
    setSaving(true); setError(null);
    const starts_at = fromLocalInput(`${date}T${allDay ? "00:00" : start || "00:00"}`, tz);
    const ends_at = !allDay && end ? fromLocalInput(`${date}T${end}`, tz) : null;
    if (ends_at && ends_at < starts_at) { setSaving(false); setError("La hora de fin es anterior al inicio."); return; }
    const row = { title: title.trim(), description: description.trim() || null, team_id: teamId || null, starts_at, ends_at, all_day: allDay };
    const { error } = event
      ? await supabase.from("agency_events").update(row).eq("id", event.id).eq("business_id", bid)
      : await supabase.from("agency_events").insert({ ...row, business_id: bid });
    setSaving(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["agency_events", bid] });
    onClose();
  }

  async function remove() {
    if (!event) return;
    await supabase.from("agency_events").delete().eq("id", event.id).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_events", bid] });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={event ? (readOnly ? "Evento" : "Editar evento") : "Nuevo evento"}>
      <fieldset disabled={readOnly} className="space-y-3">
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!event} />
        </div>
        <div>
          <label className="label">Equipo</label>
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {isDirectiva && <option value="">General (toda la agrupación)</option>}
            {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Todo el día</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1"><label className="label">Fecha</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {!allDay && <>
            <div><label className="label">Inicio</label><input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="label">Fin</label><input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </>}
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </fieldset>
      {readOnly && <p className="text-sm text-slate-500 mt-3">Los eventos generales los gestiona la directiva.</p>}
      {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex items-center justify-between gap-2 mt-5">
        {event && !readOnly ? <button className="btn-ghost text-red-600" onClick={() => setConfirmDelete(true)}>Eliminar</button> : <span />}
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>{readOnly ? "Cerrar" : "Cancelar"}</button>
          {!readOnly && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>}
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} title="Eliminar evento" message={`Se borrará «${event?.title}».`} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </Modal>
  );
}
