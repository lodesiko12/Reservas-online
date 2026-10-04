import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PageHeader, Spinner, EmptyState, StatCard } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { addDaysYmd, formatDateTime, ymdInTz, zonedDayRange } from "@reservas/shared";
import {
  formatDueDate, isOverdue, useAgencyAssignees, useAgencyEvents, useAgencyMembers, useAgencyMe, useAgencyTasks,
  useAgencyTeams, useTodayYmd, type AgencyTask,
} from "./hooks";
import { AvatarStack, DoneCheck, DueBadge, TeamChip } from "./components";
import { TaskModal } from "./TaskModal";

function TaskRow({ task, teamName, onOpen, people }: {
  task: AgencyTask; teamName: string; onOpen: () => void; people?: { user_id: string; full_name: string }[];
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={onOpen}>
      <DoneCheck task={task} />
      <div className="min-w-0 flex-1">
        <div className={`font-semibold truncate ${task.status === "hecha" ? "line-through text-slate-400" : ""}`}>{task.title}</div>
        <div className="mt-0.5"><TeamChip name={teamName} /></div>
      </div>
      {people && <AvatarStack members={people} />}
      <DueBadge task={task} />
    </div>
  );
}

/** Mi panel: lo que tengo pendiente de todos mis equipos, ordenado por fecha límite. */
export function MiPanel() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { me, userId } = useAgencyMe();
  const { data: tasks, isLoading } = useAgencyTasks();
  const { data: assignees } = useAgencyAssignees();
  const { data: teams } = useAgencyTeams();
  const today = useTodayYmd();
  const [open, setOpen] = useState<AgencyTask | null>(null);

  const [from, to] = useMemo(() => [zonedDayRange(today, tz)[0], zonedDayRange(addDaysYmd(today, 8), tz)[0]], [today, tz]);
  const { data: events } = useAgencyEvents(from, to);

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "";
  const mine = useMemo(() => {
    const ids = new Set((assignees ?? []).filter((a) => a.user_id === userId).map((a) => a.task_id));
    return (tasks ?? []).filter((t) => ids.has(t.id) && t.status !== "hecha");
  }, [tasks, assignees, userId]);

  const groups = useMemo(() => {
    const week = addDaysYmd(today, 7);
    const sorted = [...mine].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    return [
      { key: "atrasadas", label: "Atrasadas", tone: "text-red-600", items: sorted.filter((t) => t.due_date && t.due_date < today) },
      { key: "hoy", label: "Hoy", tone: "text-coral-700", items: sorted.filter((t) => t.due_date === today) },
      { key: "semana", label: "Esta semana", tone: "", items: sorted.filter((t) => t.due_date && t.due_date > today && t.due_date <= week) },
      { key: "despues", label: "Más adelante", tone: "", items: sorted.filter((t) => t.due_date && t.due_date > week) },
      { key: "sinfecha", label: "Sin fecha", tone: "", items: sorted.filter((t) => !t.due_date) },
    ].filter((g) => g.items.length);
  }, [mine, today]);

  if (isLoading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  const first = me?.full_name.split(" ")[0];

  return (
    <div>
      <PageHeader title={first ? `Hola, ${first}` : "Mi panel"} subtitle={mine.length ? `Tienes ${mine.length} tarea${mine.length === 1 ? "" : "s"} pendiente${mine.length === 1 ? "" : "s"}` : "Estás al día"} />

      {!groups.length ? (
        <EmptyState title="No tienes tareas pendientes" hint="Cuando te asignen una tarea en un equipo aparecerá aquí." action={<Link to="/app/equipos" className="btn-primary">Ver equipos</Link>} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className={`text-sm font-extrabold uppercase tracking-wide mb-2 ${g.tone || "text-slate-500 dark:text-slate-400"}`}>{g.label} · {g.items.length}</h2>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {g.items.map((t) => <TaskRow key={t.id} task={t} teamName={teamName(t.team_id)} onOpen={() => setOpen(t)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {!!events?.length && (
        <section className="mt-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wide mb-2 text-slate-500 dark:text-slate-400">Próximos eventos</h2>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((e) => (
              <Link to="/app/calendario" key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="text-xl">📅</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{e.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{e.all_day ? ymdInTz(new Date(e.starts_at), tz) : formatDateTime(e.starts_at, tz)}</div>
                </div>
                {e.team_id ? <TeamChip name={teamName(e.team_id)} /> : <span className="badge bg-coral-50 text-coral-700">General</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
      {open && <TaskModal teamId={open.team_id} task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Panel global (solo directiva): resumen por equipo y tareas atrasadas de toda la agrupación. */
export function PanelGlobal() {
  const { isDirectiva, loading } = useAgencyMe();
  const { data: tasks, isLoading } = useAgencyTasks();
  const { data: teams } = useAgencyTeams();
  const { data: assignees } = useAgencyAssignees();
  const { data: members } = useAgencyMembers();
  const today = useTodayYmd();
  const [open, setOpen] = useState<AgencyTask | null>(null);

  const rows = useMemo(() => {
    return (teams ?? []).filter((t) => !t.is_archived).map((team) => {
      const open = (tasks ?? []).filter((t) => t.team_id === team.id && t.status !== "hecha");
      const dues = open.map((t) => t.due_date).filter((d): d is string => !!d && d >= today).sort();
      return { team, open: open.length, overdue: open.filter((t) => isOverdue(t, today)).length, next: dues[0] ?? null };
    });
  }, [teams, tasks, today]);

  const overdueTasks = useMemo(
    () => (tasks ?? []).filter((t) => isOverdue(t, today)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    [tasks, today]
  );
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);

  if (loading || isLoading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (!isDirectiva) return <Navigate to="/app" replace />;

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "";
  const peopleOf = (taskId: string) => {
    const ids = (assignees ?? []).filter((a) => a.task_id === taskId).map((a) => a.user_id);
    return (members ?? []).filter((m) => ids.includes(m.user_id));
  };

  return (
    <div>
      <PageHeader title="Panel global" subtitle="Vista de toda la agrupación (solo directiva)" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Equipos activos" value={rows.length} />
        <StatCard label="Tareas abiertas" value={totalOpen} accent="var(--chart-1)" />
        <StatCard label="Atrasadas" value={overdueTasks.length} accent={overdueTasks.length ? "#C0392B" : undefined} />
        <StatCard label="Miembros activos" value={(members ?? []).filter((m) => m.is_active).length} />
      </div>

      <h2 className="text-sm font-extrabold uppercase tracking-wide mb-2 text-slate-500 dark:text-slate-400">Equipos</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
        {rows.map((r) => (
          <Link key={r.team.id} to={`/app/equipos/${r.team.id}`} className="card p-4 hover:border-brand-400 transition">
            <div className="font-bold truncate">{r.team.name}</div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span><strong>{r.open}</strong> abiertas</span>
              <span className={r.overdue ? "text-red-600 font-semibold" : "text-slate-400"}>{r.overdue} atrasadas</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.next ? `Próxima fecha: ${formatDueDate(r.next)}` : "Sin fechas próximas"}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-extrabold uppercase tracking-wide mb-2 text-red-600">Tareas atrasadas · {overdueTasks.length}</h2>
      {!overdueTasks.length ? (
        <EmptyState title="Ninguna tarea atrasada 🎉" />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {overdueTasks.map((t) => <TaskRow key={t.id} task={t} teamName={teamName(t.team_id)} people={peopleOf(t.id)} onOpen={() => setOpen(t)} />)}
        </div>
      )}
      {open && <TaskModal teamId={open.team_id} task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
