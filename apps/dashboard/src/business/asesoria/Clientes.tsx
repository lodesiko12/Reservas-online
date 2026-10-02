import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { advClientSchema, firstIssue, ADV_CLIENT_KINDS } from "@reservas/shared";
import { PageHeader, Spinner, Modal, EmptyState } from "../../components/ui";
import { useAdvClients, useAdvRole, useAdvTeam, managerLabel, CLIENT_KIND_LABEL } from "./hooks";

export function Clientes() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { isOwner, userId } = useAdvRole();
  const { data: clients, isLoading } = useAdvClients();
  const { data: team } = useAdvTeam();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = (clients ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.nif ?? "").toLowerCase().includes(q.replace(/[^a-z0-9]/g, ""));
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={isOwner ? "Todos los clientes de la asesoría" : "Tus clientes asignados"}
        actions={<button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo cliente</button>}
      />
      <input className="input max-w-sm mb-4" placeholder="Buscar por nombre o NIF…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {isLoading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState
          title={clients?.length ? "Sin resultados" : "Aún no hay clientes"}
          hint={clients?.length ? undefined : "Crea el primero para empezar a archivar sus documentos."}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">NIF/CIF</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  {isOwner && <th className="px-4 py-2.5">Gestor</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-medium">
                      <Link className="text-brand-600 hover:underline" to={`/app/clientes/${c.id}`}>{c.name}</Link>
                    </td>
                    <td className="px-4 py-2.5">{c.nif ?? "—"}</td>
                    <td className="px-4 py-2.5">{CLIENT_KIND_LABEL[c.client_kind]}</td>
                    {isOwner && <td className="px-4 py-2.5">{managerLabel(team, c.manager_id)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <ClientFormModal
          open
          onClose={() => setCreating(false)}
          defaultManager={isOwner ? "" : userId}
          onSaved={() => qc.invalidateQueries({ queryKey: ["adv_clients", bid] })}
        />
      )}
    </div>
  );
}

export function ClientFormModal({ open, onClose, onSaved, defaultManager, client }: {
  open: boolean; onClose: () => void; onSaved: () => void; defaultManager: string;
  client?: { id: string; name: string; nif: string | null; client_kind: string; manager_id: string | null; notes: string | null };
}) {
  const bid = useBusinessId();
  const { isOwner } = useAdvRole();
  const { data: team } = useAdvTeam();
  const [name, setName] = useState(client?.name ?? "");
  const [nif, setNif] = useState(client?.nif ?? "");
  const [kind, setKind] = useState(client?.client_kind ?? "autonomo");
  const [manager, setManager] = useState(client?.manager_id ?? defaultManager);
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = advClientSchema.safeParse({ name, nif, client_kind: kind, notes });
    if (!parsed.success) { setError(firstIssue(parsed.error)); return; }
    setSaving(true); setError(null);
    const row = {
      name: parsed.data.name, nif: parsed.data.nif ?? null, client_kind: parsed.data.client_kind,
      notes: parsed.data.notes ?? null, manager_id: manager || null,
    };
    const { error } = client
      ? await supabase.from("adv_clients").update(row).eq("id", client.id)
      : await supabase.from("adv_clients").insert({ ...row, business_id: bid });
    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "Ya existe un cliente con ese NIF/CIF." : error.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? "Editar cliente" : "Nuevo cliente"}>
      <div className="space-y-3">
        <div>
          <label className="label">Nombre o razón social</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">NIF/CIF</label>
            <input className="input" value={nif} onChange={(e) => setNif(e.target.value)} />
          </div>
          <div>
            <label className="label">Tipo de cliente</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {ADV_CLIENT_KINDS.map((k) => <option key={k} value={k}>{CLIENT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
        </div>
        {isOwner && (
          <div>
            <label className="label">Gestor asignado</label>
            <select className="input" value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">Sin gestor (solo lo ve el administrador)</option>
              {(team ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Notas</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}
