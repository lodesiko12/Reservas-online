import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, DragOverlay, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { Spinner, EmptyState } from "../../components/ui";
import {
  STATUSES, STATUS_LABEL, useAgencyAssignees, useAgencyMembers, useAgencyMe, useAgencyTasks,
  type AgencyTask, type TaskStatus,
} from "./hooks";
import { AvatarStack, DoneCheck, DueBadge } from "./components";
import { TaskModal } from "./TaskModal";

const VIEW_KEY = "turnigo:agencia-vista";

/** Tareas de un equipo: tablero (kanban) y lista, con alta rápida. */
export function TareasEquipo({ teamId, openTaskId }: { teamId: string; openTaskId?: string | null }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { userId } = useAgencyMe();
  const { data: allTasks, isLoading } = useAgencyTasks();
  const { data: assignees } = useAgencyAssignees();
  const { data: members } = useAgencyMembers();

  const [view, setView] = useState<"kanban" | "list">(() => {
    try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "kanban"; } catch { return "kanban"; }
  });
  const [onlyMine, setOnlyMine] = useState(false);
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<AgencyTask | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);
  const [activeTask, setActiveTask] = useState<AgencyTask | null>(null);
  const [deepLinkDone, setDeepLinkDone] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  function changeView(v: "kanban" | "list") {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin localStorage */ }
  }

  const assigneesByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignees ?? []) map.set(a.task_id, [...(map.get(a.task_id) ?? []), a.user_id]);
    return map;
  }, [assignees]);

  const tasks = useMemo(() => {
    let list = (allTasks ?? []).filter((t) => t.team_id === teamId);
    if (onlyMine) list = list.filter((t) => assigneesByTask.get(t.id)?.includes(userId));
    return list;
  }, [allTasks, teamId, onlyMine, assigneesByTask, userId]);

  // Enlace profundo (?tarea=id, desde un aviso push): abre la tarea una sola vez.
  useEffect(() => {
    if (!openTaskId || deepLinkDone || !allTasks) return;
    const t = allTasks.find((x) => x.id === openTaskId);
    if (t) setEditing(t);
    setDeepLinkDone(true);
  }, [openTaskId, deepLinkDone, allTasks]);

  function peopleOf(taskId: string) {
    const ids = assigneesByTask.get(taskId) ?? [];
    return (members ?? []).filter((m) => ids.includes(m.user_id));
  }

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    const { error } = await supabase.from("agency_tasks").insert({ business_id: bid, team_id: teamId, title, sort_order: Date.now() });
    if (!error) qc.invalidateQueries({ queryKey: ["agency_tasks", bid] });
  }

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, AgencyTask[]> = { pendiente: [], en_curso: [], hecha: [] };
    for (const t of tasks) map[(t.status as TaskStatus) ?? "pendiente"]?.push(t);
    for (const k of Object.keys(map) as TaskStatus[]) map[k].sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [tasks]);

  async function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over || !allTasks) return;
    const moved = allTasks.find((t) => t.id === active.id);
    if (!moved) return;
    const overStatus = STATUSES.find((s) => s.key === over.id)?.key;
    const overTask = overStatus ? undefined : allTasks.find((t) => t.id === over.id);
    const target = (overStatus ?? overTask?.status) as TaskStatus | undefined;
    if (!target) return;
    if (target === moved.status && (!overTask || overTask.id === moved.id)) return;

    const col = byStatus[target].filter((t) => t.id !== moved.id);
    let order: number;
    if (overTask && overTask.id !== moved.id) {
      const idx = col.findIndex((t) => t.id === overTask.id);
      const prev = idx > 0 ? col[idx - 1].sort_order : overTask.sort_order - 2000;
      order = (prev + overTask.sort_order) / 2;
    } else {
      order = (col[col.length - 1]?.sort_order ?? 0) + 1000;
    }

    qc.setQueryData(["agency_tasks", bid], allTasks.map((t) => (t.id === moved.id ? { ...t, status: target, sort_order: order } : t)));
    await supabase.from("agency_tasks").update({ status: target, sort_order: order }).eq("id", moved.id).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_tasks", bid] });
  }

  if (isLoading) return <div className="grid place-items-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form className="flex-1 min-w-[12rem] flex gap-2" onSubmit={(e) => { e.preventDefault(); quickAdd(); }}>
          <input className="input" placeholder="Nueva tarea… (Enter para añadir)" value={quick} onChange={(e) => setQuick(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!quick.trim()}>Añadir</button>
        </form>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Solo mías
        </label>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(["kanban", "list"] as const).map((v) => (
            <button key={v} onClick={() => changeView(v)}
              className={`px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-brand-500 text-white" : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
              {v === "kanban" ? "Tablero" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveTask((allTasks ?? []).find((t) => t.id === e.active.id) ?? null)}
          onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
            {STATUSES.map((s) => (
              <Column key={s.key} status={s.key} label={s.label} color={s.color} tasks={byStatus[s.key]}
                peopleOf={peopleOf} onOpen={setEditing} onAdd={() => setCreating(s.key)} />
            ))}
          </div>
          <DragOverlay>{activeTask && <div className="rotate-2 shadow-lg"><TaskCard task={activeTask} people={peopleOf(activeTask.id)} onOpen={() => {}} /></div>}</DragOverlay>
        </DndContext>
      ) : tasks.length ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {[...tasks].sort(compareList).map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => setEditing(t)}>
              <DoneCheck task={t} />
              <div className="min-w-0 flex-1">
                <div className={`font-semibold truncate ${t.status === "hecha" ? "line-through text-slate-400" : ""}`}>{t.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{STATUS_LABEL[t.status]}</div>
              </div>
              <AvatarStack members={peopleOf(t.id)} />
              <DueBadge task={t} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin tareas" hint="Escribe arriba el título de la primera tarea y pulsa Enter." />
      )}

      {editing && <TaskModal teamId={teamId} task={editing} onClose={() => setEditing(null)} />}
      {creating && <TaskModal teamId={teamId} task={null} defaultStatus={creating} onClose={() => setCreating(null)} />}
    </div>
  );
}

const STATUS_RANK: Record<string, number> = { pendiente: 0, en_curso: 1, hecha: 2 };
function compareList(a: AgencyTask, b: AgencyTask) {
  if (a.status === "hecha" !== (b.status === "hecha")) return a.status === "hecha" ? 1 : -1;
  if (a.due_date !== b.due_date) return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  return (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
}

function Column({ status, label, color, tasks, peopleOf, onOpen, onAdd }: {
  status: TaskStatus; label: string; color: string; tasks: AgencyTask[];
  peopleOf: (id: string) => { user_id: string; full_name: string }[]; onOpen: (t: AgencyTask) => void; onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="shrink-0 w-[85vw] sm:w-80 lg:w-auto snap-center">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="font-bold text-sm">{label}</span>
          <span className="text-xs text-slate-400">{tasks.length}</span>
        </div>
        <button className="text-slate-400 hover:text-brand-600 text-lg leading-none px-1" onClick={onAdd} title="Añadir tarea">+</button>
      </div>
      <div ref={setNodeRef} className={`rounded-2xl p-2 min-h-[140px] space-y-2 transition-colors ${isOver ? "bg-brand-50 dark:bg-brand-500/10" : "bg-slate-100/70 dark:bg-slate-800/40"}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableTask key={t.id} task={t} people={peopleOf(t.id)} onOpen={() => onOpen(t)} />)}
        </SortableContext>
        {!tasks.length && <div className="text-xs text-slate-400 text-center py-6">Arrastra aquí o pulsa +</div>}
      </div>
    </div>
  );
}

function SortableTask({ task, people, onOpen }: { task: AgencyTask; people: { user_id: string; full_name: string }[]; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <TaskCard task={task} people={people} onOpen={onOpen} />
    </div>
  );
}

function TaskCard({ task, people, onOpen }: { task: AgencyTask; people: { user_id: string; full_name: string }[]; onOpen: () => void }) {
  return (
    <div onClick={onOpen} className="card p-3 cursor-grab active:cursor-grabbing select-none touch-manipulation">
      <div className="flex items-start gap-2">
        <DoneCheck task={task} size={20} />
        <div className={`text-sm font-semibold break-words min-w-0 ${task.status === "hecha" ? "line-through text-slate-400" : ""}`}>{task.title}</div>
      </div>
      {(task.due_date || people.length > 0) && (
        <div className="flex items-center justify-between gap-2 mt-2 pl-7">
          <DueBadge task={task} />
          <AvatarStack members={people} />
        </div>
      )}
    </div>
  );
}
