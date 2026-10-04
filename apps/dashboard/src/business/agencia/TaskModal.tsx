import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Modal, ConfirmDialog } from "../../components/ui";
import { useBusinessId } from "../hooks";
import { formatDateTime } from "@reservas/shared";
import { useAuth } from "../../lib/auth";
import {
  STATUSES, useAgencyAssignees, useAgencyMembers, useAgencyTeamMembers, useAgencyTeams, useTaskComments,
  useAgencyMe, memberName, type AgencyTask, type TaskStatus,
} from "./hooks";
import { Avatar } from "./components";

/** Crear o editar una tarea de un equipo, con asignados y comentarios (con menciones). */
export function TaskModal({ teamId, task, defaultStatus, onClose }: {
  teamId: string; task: AgencyTask | null; defaultStatus?: TaskStatus; onClose: () => void;
}) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { userId, isDirectiva } = useAgencyMe();
  const { data: members } = useAgencyMembers();
  const { data: teamMembers } = useAgencyTeamMembers();
  const { data: allAssignees } = useAgencyAssignees();
  const { data: teams } = useAgencyTeams();
  const teamName = teams?.find((t) => t.id === teamId)?.name ?? "";

  const people = useMemo(() => {
    const ids = new Set((teamMembers ?? []).filter((tm) => tm.team_id === teamId).map((tm) => tm.user_id));
    return (members ?? []).filter((m) => ids.has(m.user_id) && m.is_active);
  }, [members, teamMembers, teamId]);

  const initialAssignees = useMemo(
    () => (task ? (allAssignees ?? []).filter((a) => a.task_id === task.id).map((a) => a.user_id) : []),
    [allAssignees, task]
  );

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? defaultStatus ?? "pendiente");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [assignees, setAssignees] = useState<string[] | null>(null); // null = sin tocar (valores iniciales)
  const current = assignees ?? initialAssignees;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleAssignee(id: string) {
    setAssignees(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["agency_tasks", bid] });
    qc.invalidateQueries({ queryKey: ["agency_assignees", bid] });
  }

  async function save() {
    if (!title.trim()) { setError("Escribe un título."); return; }
    setSaving(true); setError(null);
    let id = task?.id;
    if (task) {
      const { error } = await supabase.from("agency_tasks").update({
        title: title.trim(), description: description.trim() || null, status, due_date: due || null,
      }).eq("id", task.id).eq("business_id", bid);
      if (error) { setSaving(false); setError(error.message); return; }
    } else {
      const { data, error } = await supabase.from("agency_tasks").insert({
        business_id: bid, team_id: teamId, title: title.trim(), description: description.trim() || null,
        status, due_date: due || null, sort_order: Date.now(),
      }).select("id").single();
      if (error || !data) { setSaving(false); setError(error?.message ?? "No se pudo crear la tarea"); return; }
      id = data.id;
    }
    // Diferencias de asignados.
    const toAdd = current.filter((u) => !initialAssignees.includes(u));
    const toRemove = initialAssignees.filter((u) => !current.includes(u));
    if (toAdd.length) {
      const { error } = await supabase.from("agency_task_assignees").insert(toAdd.map((user_id) => ({ task_id: id!, user_id, business_id: bid, team_id: teamId })));
      if (error) { setSaving(false); setError(error.message); refresh(); return; }
    }
    if (toRemove.length) {
      await supabase.from("agency_task_assignees").delete().eq("task_id", id!).in("user_id", toRemove);
    }
    setSaving(false);
    refresh();
    onClose();
  }

  async function remove() {
    if (!task) return;
    const { error } = await supabase.from("agency_tasks").delete().eq("id", task.id).eq("business_id", bid);
    if (error) { setError(error.message); setConfirmDelete(false); return; }
    refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={task ? "Tarea" : "Nueva tarea"} width="max-w-xl">
      <div className="space-y-4">
        <div className="text-xs text-slate-500 dark:text-slate-400">Equipo: <strong>{teamName}</strong></div>
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task} placeholder="¿Qué hay que hacer?" />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles, enlaces, lo que haga falta…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Estado</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Asignados</label>
          {people.length ? (
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = current.includes(p.user_id);
                return (
                  <button
                    key={p.user_id} type="button" onClick={() => toggleAssignee(p.user_id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
                  >
                    <Avatar name={p.full_name} size={20} />{p.full_name}{on && " ✓"}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Este equipo aún no tiene personas. {isDirectiva ? "Añádelas en la pestaña Personas del equipo." : "La directiva puede añadirlas."}</p>
          )}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex items-center justify-between gap-2 pt-1">
          {task ? <button className="btn-ghost text-red-600" onClick={() => setConfirmDelete(true)}>Eliminar</button> : <span />}
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : task ? "Guardar" : "Crear tarea"}</button>
          </div>
        </div>

        {task && <Comments taskId={task.id} teamId={teamId} people={people} userId={userId} tz={tz} />}
      </div>
      <ConfirmDialog
        open={confirmDelete} title="Eliminar tarea"
        message={`Se borrará «${task?.title}» con sus comentarios. No se puede deshacer.`}
        onConfirm={remove} onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}

function Comments({ taskId, teamId, people, userId, tz }: {
  taskId: string; teamId: string; people: { user_id: string; full_name: string }[]; userId: string; tz: string;
}) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { data: comments } = useTaskComments(taskId);
  const { data: members } = useAgencyMembers();
  const { isDirectiva } = useAgencyMe();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function mention(name: string) {
    setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${name} `);
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    // Menciones: las personas cuyo "@Nombre" aparece en el texto.
    const mentions = people.filter((p) => p.user_id !== userId && body.includes(`@${p.full_name}`)).map((p) => p.user_id);
    const { error } = await supabase.from("agency_task_comments").insert({ business_id: bid, team_id: teamId, task_id: taskId, body, mentions });
    setSending(false);
    if (error) return;
    setText("");
    qc.invalidateQueries({ queryKey: ["agency_comments", bid, taskId] });
  }

  async function removeComment(id: string) {
    await supabase.from("agency_task_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["agency_comments", bid, taskId] });
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <h3 className="text-sm font-bold mb-2">Comentarios</h3>
      <div className="space-y-3 mb-3">
        {!comments?.length && <p className="text-sm text-slate-400">Aún no hay comentarios.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar name={memberName(members, c.author_id)} size={26} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-200">{memberName(members, c.author_id)}</strong> · {formatDateTime(c.created_at, tz)}
                {(c.author_id === userId || isDirectiva) && (
                  <button className="ml-2 text-slate-400 hover:text-red-600" onClick={() => removeComment(c.id)}>borrar</button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <textarea className="input min-h-[60px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un comentario…" />
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-slate-400">Mencionar:</span>
          {people.filter((p) => p.user_id !== userId).map((p) => (
            <button key={p.user_id} type="button" className="text-xs rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300" onClick={() => mention(p.full_name)}>
              @{p.full_name.split(" ")[0]}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={send} disabled={sending || !text.trim()}>Comentar</button>
      </div>
    </div>
  );
}
