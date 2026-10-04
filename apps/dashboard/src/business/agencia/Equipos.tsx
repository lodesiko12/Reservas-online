import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { PageHeader, Spinner, EmptyState, Modal, ConfirmDialog } from "../../components/ui";
import {
  cargoLabel, isOverdue, useAgencyAssignees, useAgencyMembers, useAgencyMe, useAgencyTasks, useAgencyTeamMembers,
  useAgencyTeams, useTodayYmd, type AgencyTeam,
} from "./hooks";
import { Avatar } from "./components";
import { TareasEquipo } from "./TareasEquipo";
import { DocumentosEquipo } from "./DocumentosEquipo";

/** Lista de equipos (los del usuario, o todos si es directiva) con su estado de un vistazo. */
export function Equipos() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { isDirectiva } = useAgencyMe();
  const { data: teams, isLoading } = useAgencyTeams();
  const { data: tasks } = useAgencyTasks();
  const { data: teamMembers } = useAgencyTeamMembers();
  const today = useTodayYmd();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<AgencyTeam | "new" | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { open: number; overdue: number; people: number }>();
    for (const t of teams ?? []) m.set(t.id, { open: 0, overdue: 0, people: 0 });
    for (const t of tasks ?? []) {
      const s = m.get(t.team_id);
      if (!s || t.status === "hecha") continue;
      s.open++;
      if (isOverdue(t, today)) s.overdue++;
    }
    for (const tm of teamMembers ?? []) { const s = m.get(tm.team_id); if (s) s.people++; }
    return m;
  }, [teams, tasks, teamMembers, today]);

  const visible = (teams ?? []).filter((t) => showArchived || !t.is_archived);

  async function save(name: string, team: AgencyTeam | null) {
    const { error } = team
      ? await supabase.from("agency_teams").update({ name }).eq("id", team.id).eq("business_id", bid)
      : await supabase.from("agency_teams").insert({ business_id: bid, name, position: (teams?.length ?? 0) });
    if (error) return error.message.includes("uq_agency_teams_name") ? "Ya existe un equipo con ese nombre." : error.message;
    qc.invalidateQueries({ queryKey: ["agency_teams", bid] });
    setEditing(null);
    return null;
  }

  async function toggleArchive(team: AgencyTeam) {
    await supabase.from("agency_teams").update({ is_archived: !team.is_archived }).eq("id", team.id).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_teams", bid] });
  }

  if (isLoading) return <div className="grid place-items-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title="Equipos"
        subtitle={isDirectiva ? "Todos los equipos de la agrupación" : "Los equipos a los que perteneces"}
        actions={isDirectiva && (
          <>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Ver archivados
            </label>
            <button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo equipo</button>
          </>
        )}
      />
      {!visible.length ? (
        <EmptyState title="Todavía no estás en ningún equipo" hint="La directiva te añadirá a los equipos que te correspondan." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((t) => {
            const s = stats.get(t.id);
            return (
              <div key={t.id} className={`card p-5 relative ${t.is_archived ? "opacity-60" : ""}`}>
                <Link to={`/app/equipos/${t.id}`} className="block">
                  <div className="font-bold text-lg text-slate-900 dark:text-slate-50 pr-8">{t.name}{t.is_archived && <span className="badge bg-slate-100 text-slate-500 ml-2">Archivado</span>}</div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span><strong className="text-lg">{s?.open ?? 0}</strong> <span className="text-slate-500 dark:text-slate-400">abiertas</span></span>
                    <span className={s?.overdue ? "text-red-600" : ""}><strong className="text-lg">{s?.overdue ?? 0}</strong> <span className="opacity-80">atrasadas</span></span>
                    <span><strong className="text-lg">{s?.people ?? 0}</strong> <span className="text-slate-500 dark:text-slate-400">personas</span></span>
                  </div>
                </Link>
                {isDirectiva && (
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button className="text-slate-400 hover:text-brand-600 px-1" title="Renombrar" onClick={() => setEditing(t)}>✎</button>
                    <button className="text-slate-400 hover:text-brand-600 px-1" title={t.is_archived ? "Restaurar" : "Archivar"} onClick={() => toggleArchive(t)}>{t.is_archived ? "↺" : "🗄"}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <TeamNameModal team={editing === "new" ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TeamNameModal({ team, onSave, onClose }: { team: AgencyTeam | null; onSave: (name: string, team: AgencyTeam | null) => Promise<string | null>; onClose: () => void }) {
  const [name, setName] = useState(team?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError(null);
    const err = await onSave(name.trim(), team);
    setSaving(false);
    if (err) setError(err);
  }
  return (
    <Modal open onClose={onClose} title={team ? "Renombrar equipo" : "Nuevo equipo"} width="max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nombre del equipo" />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving || !name.trim()}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

type Tab = "tareas" | "documentos" | "personas";

/** Un equipo: tareas, documentos y personas. */
export function EquipoDetalle() {
  const { teamId = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { data: teams, isLoading } = useAgencyTeams();
  const [tab, setTab] = useState<Tab>("tareas");
  const team = teams?.find((t) => t.id === teamId);

  if (isLoading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (!team) return <EmptyState title="Equipo no encontrado" hint="Puede que no pertenezcas a este equipo." action={<button className="btn-primary" onClick={() => navigate("/app/equipos")}>Ver mis equipos</button>} />;

  return (
    <div>
      <div className="mb-1"><Link to="/app/equipos" className="text-sm text-brand-600 hover:underline">← Equipos</Link></div>
      <PageHeader title={team.name} subtitle={team.is_archived ? "Equipo archivado" : undefined} />
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-5">
        {([["tareas", "Tareas"], ["documentos", "Documentos"], ["personas", "Personas"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${tab === k ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "tareas" && <TareasEquipo teamId={team.id} openTaskId={search.get("tarea")} />}
      {tab === "documentos" && <DocumentosEquipo teamId={team.id} />}
      {tab === "personas" && <PersonasEquipo teamId={team.id} />}
    </div>
  );
}

function PersonasEquipo({ teamId }: { teamId: string }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { isDirectiva } = useAgencyMe();
  const { data: members } = useAgencyMembers();
  const { data: teamMembers } = useAgencyTeamMembers();
  const { data: assignees } = useAgencyAssignees();
  const [removing, setRemoving] = useState<string | null>(null);

  const inTeam = new Set((teamMembers ?? []).filter((tm) => tm.team_id === teamId).map((tm) => tm.user_id));
  const people = (members ?? []).filter((m) => inTeam.has(m.user_id));
  const candidates = (members ?? []).filter((m) => m.is_active && !inTeam.has(m.user_id));
  const [adding, setAdding] = useState("");

  async function add() {
    if (!adding) return;
    await supabase.from("agency_team_members").insert({ team_id: teamId, user_id: adding, business_id: bid });
    setAdding("");
    qc.invalidateQueries({ queryKey: ["agency_team_members", bid] });
  }
  async function remove(userId: string) {
    setRemoving(null);
    await supabase.from("agency_team_members").delete().eq("team_id", teamId).eq("user_id", userId).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_team_members", bid] });
    qc.invalidateQueries({ queryKey: ["agency_assignees", bid] });
  }
  const removingMember = members?.find((m) => m.user_id === removing);
  const removingTasks = (assignees ?? []).filter((a) => a.team_id === teamId && a.user_id === removing).length;

  return (
    <div>
      {isDirectiva && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select className="input max-w-xs" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Añadir persona al equipo…</option>
            {candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
          </select>
          <button className="btn-primary" onClick={add} disabled={!adding}>Añadir</button>
        </div>
      )}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {people.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.full_name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{m.full_name}{!m.is_active && <span className="badge bg-slate-100 text-slate-500 ml-2">Desactivado</span>}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{cargoLabel(m)}</div>
            </div>
            {isDirectiva && <button className="btn-ghost" onClick={() => setRemoving(m.user_id)}>Quitar</button>}
          </div>
        ))}
        {!people.length && <div className="p-6 text-center text-sm text-slate-500">Este equipo no tiene personas todavía.</div>}
      </div>
      <ConfirmDialog
        open={!!removing} title="Quitar del equipo" confirmLabel="Quitar"
        message={`${removingMember?.full_name ?? ""} dejará de ver este equipo${removingTasks ? ` y se le desasignarán ${removingTasks} tarea(s)` : ""}.`}
        onConfirm={() => removing && remove(removing)} onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
