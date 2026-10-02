import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { advContactSchema, firstIssue } from "@reservas/shared";
import { PageHeader, Spinner, EmptyState, ConfirmDialog } from "../../components/ui";
import {
  useAdvClients, useAdvDocuments, useAdvDocTypes, useAdvRole, useAdvTeam, managerLabel,
  functionError, CLIENT_KIND_LABEL, quarterOf, type AdvDocument,
} from "./hooks";
import { UploadModal, DocumentModal, DocumentTable } from "./DocComponents";
import { ClientFormModal } from "./Clientes";

export function FichaCliente() {
  const { id = "" } = useParams();
  const bid = useBusinessId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isOwner } = useAdvRole();
  const { data: clients, isLoading } = useAdvClients();
  const { data: team } = useAdvTeam();
  const { data: docs } = useAdvDocuments(id);
  const { data: docTypes } = useAdvDocTypes(true);
  const client = clients?.find((c) => c.id === id);

  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<AdvDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("");
  const [search, setSearch] = useState("");

  if (isLoading) return <Spinner />;
  if (!client) return <EmptyState title="Cliente no encontrado" action={<Link className="btn-ghost" to="/app/clientes">Volver a clientes</Link>} />;

  const years = [...new Set((docs ?? []).map((d) => d.period_year).filter((y): y is number => !!y))].sort((a, b) => b - a);
  const filtered = (docs ?? []).filter((d) =>
    (!typeFilter || d.doc_type_id === typeFilter) &&
    (!yearFilter || d.period_year === Number(yearFilter)) &&
    (!quarterFilter || quarterOf(d.period_month) === Number(quarterFilter)) &&
    (!search || d.original_filename.toLowerCase().includes(search.toLowerCase()))
  );

  async function removeClient() {
    const { error } = await supabase.functions.invoke("adv-delete", { body: { client_id: id } });
    setDeleting(false);
    if (error) { setError(await functionError(error, "No se pudo borrar el cliente")); return; }
    qc.invalidateQueries({ queryKey: ["adv_clients", bid] });
    qc.invalidateQueries({ queryKey: ["adv_documents", bid] });
    navigate("/app/clientes");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle={`${CLIENT_KIND_LABEL[client.client_kind]}${client.nif ? ` · ${client.nif}` : ""} · ${managerLabel(team, client.manager_id)}`}
        actions={
          <>
            <Link className="btn-ghost" to="/app/clientes">← Clientes</Link>
            <button className="btn-ghost" onClick={() => setEditing(true)}>Editar</button>
            {isOwner && <button className="btn-danger" onClick={() => setDeleting(true)}>Borrar cliente</button>}
            <button className="btn-primary" onClick={() => setUploading(true)}>Subir documentos</button>
          </>
        }
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {client.notes && <p className="card p-4 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{client.notes}</p>}

      <Contacts clientId={client.id} />

      <section>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Documentos ({docs?.length ?? 0})</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input className="input max-w-[220px]" placeholder="Buscar archivo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-[200px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos los tipos</option>
            {(docTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="input max-w-[120px]" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">Año</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input max-w-[120px]" value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)}>
            <option value="">Trimestre</option>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
          </select>
        </div>
        {!docs ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState title={docs.length ? "Ningún documento coincide con los filtros" : "Este cliente aún no tiene documentos"} />
        ) : (
          <DocumentTable docs={filtered} onOpen={setOpen} />
        )}
      </section>

      {uploading && <UploadModal open onClose={() => setUploading(false)} clientId={client.id} />}
      <DocumentModal doc={open} onClose={() => setOpen(null)} />
      {editing && (
        <ClientFormModal
          open client={client} defaultManager=""
          onClose={() => setEditing(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["adv_clients", bid] })}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="Borrar cliente"
        message={`Se eliminará «${client.name}» con todos sus contactos y ${docs?.length ?? 0} documento(s), incluidos los archivos. No se puede deshacer.`}
        confirmLabel="Borrar todo"
        onConfirm={removeClient}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

/** Teléfonos y emails reconocidos: la señal «remitente» con la que se asignarán los documentos. */
function Contacts({ clientId }: { clientId: string }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: contacts } = useQuery({
    queryKey: ["adv_contacts", bid, clientId],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("adv_client_contacts").select("*").eq("client_id", clientId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["adv_contacts", bid, clientId] });

  async function add() {
    const parsed = advContactSchema.safeParse({ kind, value });
    if (!parsed.success) { setError(firstIssue(parsed.error)); return; }
    setError(null);
    const { error } = await supabase.from("adv_client_contacts").insert({ business_id: bid, client_id: clientId, kind, value: parsed.data.value });
    if (error) { setError(error.code === "23505" ? "Ese contacto ya pertenece a otro cliente de la asesoría." : error.message); return; }
    setValue(""); refresh();
  }
  async function remove(id: string) {
    await supabase.from("adv_client_contacts").delete().eq("id", id);
    refresh();
  }

  return (
    <section className="card p-4">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Contactos reconocidos</h2>
      <p className="text-xs text-slate-500 mb-3">Los documentos que lleguen desde estos teléfonos o emails se asignarán a este cliente.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {(contacts ?? []).map((c) => (
          <span key={c.id} className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1.5">
            {c.kind === "phone" ? "📱" : "✉️"} {c.value}
            <button className="text-slate-400 hover:text-red-600" onClick={() => remove(c.id)}>×</button>
          </span>
        ))}
        {contacts?.length === 0 && <span className="text-sm text-slate-400">Ninguno todavía</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-[120px]" value={kind} onChange={(e) => setKind(e.target.value as "phone" | "email")}>
          <option value="phone">Teléfono</option>
          <option value="email">Email</option>
        </select>
        <input className="input max-w-xs" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "phone" ? "612 345 678" : "cliente@correo.com"}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-ghost" onClick={add}>Añadir</button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </section>
  );
}
