import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { PageHeader, Spinner, Modal, EmptyState } from "../../components/ui";
import {
  DIRECTIVA_ROLES, DIRECTIVA_ROLE_LABEL, cargoLabel, functionError, useAgencyMe, useAgencyMembers,
  useAgencyTeamMembers, useAgencyTeams, type AgencyMember,
} from "./hooks";
import { Avatar } from "./components";

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Página "Miembros" del panel de la agencia (solo directiva). */
export function Miembros() {
  const bid = useBusinessId();
  const { isDirectiva, canManageMembers, loading } = useAgencyMe();
  if (loading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  if (!isDirectiva) return <Navigate to="/app" replace />;
  return (
    <div>
      <PageHeader title="Miembros" subtitle="Altas, cargos, niveles de acceso y equipos de cada persona" />
      <MembersManager businessId={bid} canAdd={canManageMembers} canEdit />
    </div>
  );
}

/** Gestión de miembros reutilizable (panel de la agencia y ficha del negocio en el super-admin). */
export function MembersManager({ businessId, canAdd, canEdit }: { businessId: string; canAdd: boolean; canEdit: boolean }) {
  const { userId } = useAgencyMe();
  const { data: members, isLoading } = useAgencyMembers(businessId);
  const { data: teams } = useAgencyTeams(businessId);
  const { data: teamMembers } = useAgencyTeamMembers(businessId);
  const { data: emails } = useQuery({
    queryKey: ["agency_member_emails", businessId],
    enabled: !!businessId && canEdit,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agency_list_members_admin", { p_business_id: businessId });
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<AgencyMember | "new" | null>(null);
  const [search, setSearch] = useState("");

  const teamsOf = useMemo(() => {
    const names = new Map((teams ?? []).map((t) => [t.id, t.name]));
    const m = new Map<string, string[]>();
    for (const tm of teamMembers ?? []) m.set(tm.user_id, [...(m.get(tm.user_id) ?? []), names.get(tm.team_id) ?? ""]);
    return m;
  }, [teams, teamMembers]);

  const list = (members ?? [])
    .filter((m) => !search || m.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.access_level === "directiva") - Number(a.access_level === "directiva") || a.full_name.localeCompare(b.full_name));

  if (isLoading) return <div className="grid place-items-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input className="input max-w-xs" placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canAdd && <button className="btn-primary ml-auto" onClick={() => setEditing("new")}>+ Nuevo miembro</button>}
      </div>
      {!canAdd && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Solo el presidente o el secretario pueden dar de alta cuentas nuevas.</p>}
      {!list.length ? <EmptyState title="Sin miembros" /> : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {list.map((m) => (
            <div key={m.user_id} className={`flex items-center gap-3 px-4 py-3 ${m.is_active ? "" : "opacity-60"}`}>
              <Avatar name={m.full_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {m.full_name}
                  {m.access_level === "directiva" && <span className="badge bg-brand-100 text-brand-700 ml-2 dark:bg-brand-500/25 dark:text-brand-200">Directiva</span>}
                  {!m.is_active && <span className="badge bg-slate-100 text-slate-500 ml-2">Desactivado</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {cargoLabel(m)}{emails?.find((e) => e.user_id === m.user_id)?.email && ` · ${emails.find((e) => e.user_id === m.user_id)!.email}`}
                </div>
                <div className="text-xs text-slate-400 truncate">{(teamsOf.get(m.user_id) ?? []).join(" · ") || "Sin equipos"}</div>
              </div>
              {canEdit && <button className="btn-ghost" onClick={() => setEditing(m)}>Editar</button>}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <MemberModal
          businessId={businessId} member={editing === "new" ? null : editing} isSelf={editing !== "new" && editing.user_id === userId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function MemberModal({ businessId, member, isSelf, onClose }: { businessId: string; member: AgencyMember | null; isSelf: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: teams } = useAgencyTeams(businessId);
  const { data: teamMembers } = useAgencyTeamMembers(businessId);
  const initialTeams = useMemo(() => (member ? (teamMembers ?? []).filter((t) => t.user_id === member.user_id).map((t) => t.team_id) : []), [member, teamMembers]);

  const [name, setName] = useState(member?.full_name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(member ? "" : genPassword());
  const [level, setLevel] = useState<"directiva" | "miembro">((member?.access_level as "directiva" | "miembro") ?? "miembro");
  const [role, setRole] = useState<string>(member?.directiva_role ?? "");
  const [cargo, setCargo] = useState(member?.cargo ?? "");
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? initialTeams;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);

  function refresh() {
    for (const k of ["agency_members", "agency_team_members", "agency_member_emails"]) qc.invalidateQueries({ queryKey: [k, businessId] });
  }
  const toggleTeam = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  async function save() {
    setError(null);
    if (!name.trim()) { setError("Escribe el nombre."); return; }
    setSaving(true);
    if (!member) {
      const { data, error } = await supabase.functions.invoke("agency-members", {
        body: {
          action: "create", business_id: businessId, email, password, full_name: name, access_level: level,
          directiva_role: level === "directiva" ? role || null : null, cargo: cargo || null, team_ids: chosen,
        },
      });
      setSaving(false);
      if (error) { setError(await functionError(error, "No se pudo crear el miembro")); return; }
      if ((data as { error?: string })?.error) { setError((data as { error: string }).error); return; }
      refresh();
      setCreated({ email, password });
      return;
    }
    const upd: Partial<AgencyMember> = { full_name: name.trim(), cargo: cargo.trim() || null };
    if (!isSelf) { upd.access_level = level; upd.directiva_role = level === "directiva" ? role || null : null; }
    const { error } = await supabase.from("agency_members").update(upd).eq("business_id", businessId).eq("user_id", member.user_id);
    if (error) { setSaving(false); setError(error.message); return; }
    const add = chosen.filter((t) => !initialTeams.includes(t));
    const del = initialTeams.filter((t) => !chosen.includes(t));
    if (add.length) await supabase.from("agency_team_members").insert(add.map((team_id) => ({ team_id, user_id: member.user_id, business_id: businessId })));
    if (del.length) await supabase.from("agency_team_members").delete().eq("user_id", member.user_id).eq("business_id", businessId).in("team_id", del);
    setSaving(false);
    refresh();
    onClose();
  }

  async function setActive(active: boolean) {
    if (!member) return;
    setSaving(true); setError(null);
    const { error } = await supabase.functions.invoke("agency-members", { body: { action: "set_active", business_id: businessId, user_id: member.user_id, is_active: active } });
    setSaving(false);
    if (error) { setError(await functionError(error, "No se pudo cambiar el estado")); return; }
    refresh(); onClose();
  }

  async function resetPassword() {
    if (!member) return;
    const pw = genPassword();
    setSaving(true); setError(null);
    const { error } = await supabase.functions.invoke("agency-members", { body: { action: "reset_password", business_id: businessId, user_id: member.user_id, password: pw } });
    setSaving(false);
    if (error) { setError(await functionError(error, "No se pudo cambiar la contraseña")); return; }
    setResetDone(pw);
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Miembro creado" width="max-w-md">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Pásale estos datos para que entre en la app. Podrá cambiar de contraseña cuando quieras pidiéndolo a la directiva.</p>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm font-mono break-all">Email: {created.email}<br />Contraseña: {created.password}</div>
        <div className="flex justify-end mt-4"><button className="btn-primary" onClick={onClose}>Hecho</button></div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={member ? "Editar miembro" : "Nuevo miembro"} width="max-w-xl">
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Nombre completo</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><label className="label">Cargo (informativo)</label><input className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ej.: Responsable de pólvora" /></div>
        </div>
        {!member && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Email de acceso</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <label className="label">Contraseña inicial</label>
              <div className="flex gap-2"><input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="btn-ghost" onClick={() => setPassword(genPassword())} title="Generar otra">↻</button></div>
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Nivel de acceso</label>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as "directiva" | "miembro")} disabled={isSelf}>
              <option value="miembro">Miembro (solo sus equipos)</option>
              <option value="directiva">Directiva (ve todo)</option>
            </select>
          </div>
          {level === "directiva" && (
            <div>
              <label className="label">Puesto en la directiva</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
                <option value="">Sin puesto concreto</option>
                {DIRECTIVA_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              {role && <p className="text-xs text-slate-500 mt-1">{["presidente", "secretario"].includes(role) ? "Podrá dar de alta usuarios." : DIRECTIVA_ROLE_LABEL[role]}</p>}
            </div>
          )}
        </div>
        {isSelf && <p className="text-xs text-slate-500">No puedes cambiar tu propio nivel de acceso.</p>}
        <div>
          <label className="label">Equipos</label>
          <div className="flex flex-wrap gap-2">
            {(teams ?? []).filter((t) => !t.is_archived).map((t) => {
              const on = chosen.includes(t.id);
              return <button key={t.id} type="button" onClick={() => toggleTeam(t.id)} className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>{t.name}{on && " ✓"}</button>;
            })}
          </div>
        </div>
        {resetDone && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">Nueva contraseña: <span className="font-mono font-bold break-all">{resetDone}</span><br /><span className="text-xs">Anótala ahora: no se vuelve a mostrar.</span></div>}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
          <div className="flex gap-2">
            {member && !isSelf && (member.is_active
              ? <button className="btn-ghost text-red-600" onClick={() => setActive(false)} disabled={saving}>Desactivar</button>
              : <button className="btn-ghost" onClick={() => setActive(true)} disabled={saving}>Reactivar</button>)}
            {member && <button className="btn-ghost" onClick={resetPassword} disabled={saving}>Nueva contraseña</button>}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving || (!member && (!email || password.length < 8))}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
