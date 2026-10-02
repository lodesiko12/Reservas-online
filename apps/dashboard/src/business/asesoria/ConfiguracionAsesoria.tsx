import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { advDocTypeSchema, firstIssue } from "@reservas/shared";
import { PageHeader, Spinner } from "../../components/ui";
import { useAdvDocTypes, useAdvRole, useAdvTeam, type AdvDocType } from "./hooks";

export function ConfiguracionAsesoria() {
  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" subtitle="Tipos de documento y equipo de la asesoría" />
      <DocTypesSection />
      <TeamSection />
    </div>
  );
}

function DocTypesSection() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { isOwner } = useAdvRole();
  const { data: types, isLoading } = useAdvDocTypes(true);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["adv_doc_types", bid] });

  function handle(error: { code?: string; message: string } | null) {
    if (error) { setError(error.code === "23505" ? "Ya existe un tipo con ese nombre." : error.message); return false; }
    setError(null); refresh(); return true;
  }

  async function add() {
    const parsed = advDocTypeSchema.safeParse({ name });
    if (!parsed.success) { setError(firstIssue(parsed.error)); return; }
    const position = (types?.reduce((m, t) => Math.max(m, t.position), -1) ?? -1) + 1;
    const { error } = await supabase.from("adv_doc_types").insert({ business_id: bid, name: parsed.data.name, position });
    if (handle(error)) setName("");
  }
  async function rename() {
    if (!editing) return;
    const parsed = advDocTypeSchema.safeParse({ name: editing.name });
    if (!parsed.success) { setError(firstIssue(parsed.error)); return; }
    const { error } = await supabase.from("adv_doc_types").update({ name: parsed.data.name }).eq("id", editing.id);
    if (handle(error)) setEditing(null);
  }
  async function toggle(t: AdvDocType) {
    handle((await supabase.from("adv_doc_types").update({ is_active: !t.is_active }).eq("id", t.id)).error);
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">Tipos de documento</h2>
      <p className="text-xs text-slate-500 mb-4">
        Los clasificará la IA y los verás al filtrar. Los tipos desactivados no se ofrecen al subir ni al clasificar, pero los documentos que ya los tienen se conservan.
      </p>
      {isLoading ? <Spinner /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {(types ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              {editing?.id === t.id ? (
                <input className="input max-w-xs" autoFocus value={editing.name}
                  onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setEditing(null); }} />
              ) : (
                <span className={t.is_active ? "dark:text-slate-100" : "text-slate-400 line-through"}>{t.name}</span>
              )}
              {isOwner && (
                <div className="flex items-center gap-3 text-sm">
                  {editing?.id === t.id ? (
                    <button className="text-brand-600" onClick={rename}>Guardar</button>
                  ) : (
                    <button className="text-slate-500 hover:text-brand-600" onClick={() => setEditing({ id: t.id, name: t.name })}>Renombrar</button>
                  )}
                  <button className="text-slate-500 hover:text-brand-600" onClick={() => toggle(t)}>{t.is_active ? "Desactivar" : "Activar"}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <div className="flex gap-2 mt-4">
          <input className="input max-w-xs" placeholder="Nuevo tipo (p. ej. Recibo de autónomos)" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn-primary" onClick={add}>Añadir</button>
        </div>
      )}
      {!isOwner && <p className="text-xs text-slate-400 mt-3">Solo el administrador de la asesoría puede editar los tipos.</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}

function TeamSection() {
  const { data: team, isLoading } = useAdvTeam();
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">Equipo</h2>
      <p className="text-xs text-slate-500 mb-4">
        Los usuarios los da de alta el administrador de Turnigo. El administrador ve todos los clientes; cada gestor, solo los que tiene asignados.
      </p>
      {isLoading ? <Spinner /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {(team ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <span className="dark:text-slate-100">{m.full_name || m.email} <span className="text-slate-400">{m.full_name ? m.email : ""}</span></span>
              <span className={`badge ${m.role === "owner" ? "bg-brand-500/10 text-brand-600" : "bg-slate-100 text-slate-600"}`}>
                {m.role === "owner" ? "Administrador" : "Gestor"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
