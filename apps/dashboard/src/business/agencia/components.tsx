import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import {
  initials, formatDueDate, isOverdue, useTodayYmd,
  type AgencyMember, type AgencyTask,
} from "./hooks";

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      className="inline-grid place-items-center rounded-full bg-brand-100 text-brand-700 font-bold shrink-0 dark:bg-brand-500/25 dark:text-brand-200 ring-2 ring-white dark:ring-slate-900"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ members, max = 3 }: { members: Pick<AgencyMember, "user_id" | "full_name">[]; max?: number }) {
  if (!members.length) return null;
  return (
    <span className="inline-flex -space-x-1.5">
      {members.slice(0, max).map((m) => <Avatar key={m.user_id} name={m.full_name} size={24} />)}
      {members.length > max && (
        <span className="inline-grid place-items-center h-6 w-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900">
          +{members.length - max}
        </span>
      )}
    </span>
  );
}

/** Fecha límite: roja si está atrasada, coral si es hoy/mañana. */
export function DueBadge({ task }: { task: Pick<AgencyTask, "due_date" | "status"> }) {
  const today = useTodayYmd();
  if (!task.due_date) return null;
  const overdue = isOverdue(task, today);
  const soon = !overdue && task.status !== "hecha" && task.due_date <= nextDay(today);
  const cls = task.status === "hecha"
    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
    : overdue ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
    : soon ? "bg-coral-50 text-coral-700 dark:bg-coral-500/20 dark:text-coral-500"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return <span className={`badge ${cls}`}>{overdue ? "Atrasada · " : ""}{formatDueDate(task.due_date)}</span>;
}

function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function TeamChip({ name }: { name: string }) {
  return <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200 max-w-[10rem] truncate">{name}</span>;
}

/** Marca/desmarca una tarea como hecha con un toque (optimista no: invalida y refresca). */
export function useToggleDone() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  return async function toggle(task: Pick<AgencyTask, "id" | "status">) {
    const next = task.status === "hecha" ? "pendiente" : "hecha";
    await supabase.from("agency_tasks").update({ status: next }).eq("id", task.id).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_tasks", bid] });
  };
}

export function DoneCheck({ task, size = 22 }: { task: Pick<AgencyTask, "id" | "status">; size?: number }) {
  const toggle = useToggleDone();
  const done = task.status === "hecha";
  return (
    <button
      type="button"
      aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
      onClick={(e) => { e.stopPropagation(); toggle(task); }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`shrink-0 grid place-items-center rounded-full border-2 transition ${done ? "bg-green-600 border-green-600 text-white" : "border-slate-300 text-transparent hover:border-brand-500 dark:border-slate-600"}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5" /></svg>
    </button>
  );
}
