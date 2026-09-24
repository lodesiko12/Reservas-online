import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBusinessId, type Customer } from "./hooks";
import { formatDateTime } from "@reservas/shared";
import { PageHeader, Spinner, Modal, StatusBadge, EmptyState, ConfirmDialog } from "../components/ui";
import { HistorialTab } from "./ficha/HistorialTab";
import { EditarTab } from "./ficha/EditarTab";
import { InformeTab } from "./ficha/InformeTab";
import { ReciboTab } from "./ficha/ReciboTab";

/** Parser CSV mínimo: soporta comillas, comas y saltos de línea dentro de campos. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ["nombre", "name"],
  last_name: ["apellidos", "apellido", "last_name", "lastname"],
  phone: ["telefono", "teléfono", "phone", "movil", "móvil"],
  email: ["email", "correo"],
  notes: ["notas", "notes"],
};

function matchHeader(header: string): string | null {
  const h = header.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

export function Clientes() {
  const bid = useBusinessId();
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const [sel, setSel] = useState<Customer | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", bid, q],
    enabled: !!bid,
    queryFn: async () => {
      let query = supabase.from("customers").select("*").eq("business_id", bid).order("updated_at", { ascending: false }).limit(200);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  async function removeCustomer(c: Customer) {
    setToDelete(null);
    await supabase.from("customers").delete().eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["customers", bid] });
  }

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Histórico y ficha de cada cliente"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setImporting(true)}>⬆ Importar CSV</button>
            <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo cliente</button>
          </div>
        } />
      <div className="mb-4 max-w-sm">
        <input className="input" placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? <div className="grid place-items-center py-20"><Spinner /></div>
        : !customers?.length ? <EmptyState title="Sin clientes todavía" />
        : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Reservas</th>
                  <th className="px-5 py-3 font-medium">No-shows</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-5 py-3 font-medium cursor-pointer" onClick={() => setSel(c)}>{c.full_name} {c.last_name ?? ""}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 cursor-pointer" onClick={() => setSel(c)}>{c.phone ?? "—"}</td>
                    <td className="px-5 py-3 cursor-pointer" onClick={() => setSel(c)}>{c.bookings_count}</td>
                    <td className="px-5 py-3 cursor-pointer" onClick={() => setSel(c)}>{c.no_show_count > 0 ? <span className="text-red-600 font-semibold">{c.no_show_count}</span> : 0}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-ghost text-xs" onClick={() => setToDelete(c)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

      {sel && <CustomerModal customer={sel} onClose={() => setSel(null)} onDeleted={() => setSel(null)} />}
      {importing && <ImportCsvModal bid={bid} onClose={() => setImporting(false)} />}
      {creating && <NewCustomerModal bid={bid} onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar cliente"
        message={toDelete ? `¿Eliminar a ${toDelete.full_name}? Su historial de reservas se conserva, pero dejará de estar vinculado a esta ficha.` : ""}
        onConfirm={() => toDelete && removeCustomer(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function NewCustomerModal({ bid, onClose }: { bid: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", last_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    const { error } = await supabase.rpc("import_customer", {
      p_business_id: bid, p_full_name: form.full_name.trim(), p_last_name: form.last_name.trim() || undefined,
      p_phone: form.phone.trim() || undefined, p_email: form.email.trim() || undefined, p_notes: form.notes.trim() || undefined,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ["customers", bid] });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Nuevo cliente">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Nombre *</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">Apellidos</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!form.full_name.trim() || saving} onClick={save}>{saving ? "Guardando…" : "Crear cliente"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ImportCsvModal({ bid, onClose }: { bid: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<{ full_name: string; last_name?: string; phone?: string; email?: string; notes?: string }[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null);

  function onFile(file: File) {
    setFileError(null); setRows(null); setDone(null);
    file.text().then((text) => {
      const table = parseCsv(text);
      if (table.length < 2) { setFileError("El archivo no tiene filas de datos."); return; }
      const header = table[0].map(matchHeader);
      if (!header.includes("full_name")) { setFileError("Falta una columna de nombre (Nombre)."); return; }
      const parsed = table.slice(1).map((r) => {
        const obj: Record<string, string> = {};
        header.forEach((field, i) => { if (field && r[i]) obj[field] = r[i].trim(); });
        return obj as { full_name: string; last_name?: string; phone?: string; email?: string; notes?: string };
      }).filter((r) => r.full_name);
      if (!parsed.length) { setFileError("No se encontraron filas válidas."); return; }
      setRows(parsed);
    }).catch(() => setFileError("No se pudo leer el archivo."));
  }

  async function doImport() {
    if (!rows) return;
    setImporting(true); setProgress(0);
    let ok = 0, failed = 0;
    for (const r of rows) {
      const { error } = await supabase.rpc("import_customer", {
        p_business_id: bid, p_full_name: r.full_name, p_last_name: r.last_name || undefined,
        p_phone: r.phone || undefined, p_email: r.email || undefined, p_notes: r.notes || undefined,
      });
      if (error) failed++; else ok++;
      setProgress((p) => p + 1);
    }
    setImporting(false); setDone({ ok, failed });
    qc.invalidateQueries({ queryKey: ["customers", bid] });
  }

  return (
    <Modal open onClose={onClose} title="Importar clientes desde CSV">
      <div className="space-y-4">
        {!rows && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              El archivo debe tener cabeceras. Columnas reconocidas: <strong>Nombre</strong> (obligatoria), Apellidos, Teléfono, Email, Notas.
            </p>
            <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            {fileError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fileError}</div>}
          </>
        )}

        {rows && !done && (
          <>
            <p className="text-sm">{rows.length} clientes listos para importar.</p>
            <div className="max-h-56 overflow-y-auto border rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} className="px-3 py-1.5 text-sm">{r.full_name} {r.last_name ?? ""} · {r.phone ?? "sin teléfono"}</div>
              ))}
              {rows.length > 8 && <div className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">…y {rows.length - 8} más</div>}
            </div>
            {importing && <p className="text-sm text-slate-500 dark:text-slate-400">Importando {progress}/{rows.length}…</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRows(null)} disabled={importing}>Elegir otro archivo</button>
              <button className="btn-primary" onClick={doImport} disabled={importing}>{importing ? "Importando…" : `Importar ${rows.length}`}</button>
            </div>
          </>
        )}

        {done && (
          <div className="text-center py-4">
            <div className="text-3xl">✅</div>
            <p className="mt-2 font-medium">{done.ok} importados{done.failed > 0 ? `, ${done.failed} con error` : ""}</p>
            <button className="btn-primary mt-4" onClick={onClose}>Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CustomerModal({ customer, onClose, onDeleted }: { customer: Customer; onClose: () => void; onDeleted: () => void }) {
  const { business } = useAuth();
  const isPsicologo = business?.type === "psicologo";
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const bid = useBusinessId();
  const { data: history, isLoading } = useQuery({
    queryKey: ["customer-history", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings")
        .select("*, services(name, price)").eq("customer_id", customer.id)
        .order("starts_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const [notes, setNotes] = useState(customer.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tab, setTab] = useState<"historial" | "editar" | "informe" | "recibo">("historial");

  useEffect(() => { setNotes(customer.notes ?? ""); }, [customer]);

  async function remove() {
    setConfirmingDelete(false);
    setDeleting(true);
    await supabase.from("customers").delete().eq("id", customer.id);
    qc.invalidateQueries({ queryKey: ["customers", bid] });
    setDeleting(false);
    onDeleted();
  }

  async function saveNotes() {
    setSavingNotes(true);
    await supabase.from("customers").update({ notes: notes.trim() || null }).eq("id", customer.id);
    qc.invalidateQueries({ queryKey: ["customers", bid] });
    setSavingNotes(false);
  }

  return (
    <Modal open onClose={onClose} title={`${customer.full_name} ${customer.last_name ?? ""}`} width="max-w-xl">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-3 text-center"><div className="text-2xl font-bold">{customer.bookings_count}</div><div className="text-xs text-slate-500 dark:text-slate-400">Reservas</div></div>
        <div className="card p-3 text-center"><div className="text-2xl font-bold text-red-600">{customer.no_show_count}</div><div className="text-xs text-slate-500 dark:text-slate-400">No-shows</div></div>
        <div className="card p-3 text-center"><div className="text-sm font-semibold mt-1">{customer.phone ?? "—"}</div><div className="text-xs text-slate-500 dark:text-slate-400">{customer.email ?? "Sin email"}</div></div>
      </div>

      {isPsicologo ? (
        <>
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-4 overflow-x-auto">
            {([
              ["historial", "Historial"], ["editar", "Editar"],
              ["informe", "Informe"], ["recibo", "Recibo"],
            ] as const).map(([k, l]) => (
              <button key={k} type="button"
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${tab === k ? "border-b-2 border-brand-500 text-brand-600" : "text-slate-500 dark:text-slate-400"}`}
                onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === "historial" && <HistorialTab customer={customer} />}
          {tab === "editar" && <EditarTab customer={customer} onSaved={() => qc.invalidateQueries({ queryKey: ["customers", bid] })} />}
          {tab === "informe" && <InformeTab customer={customer} />}
          {tab === "recibo" && <ReciboTab customer={customer} />}
        </>
      ) : (
        <>
          <label className="label">Notas privadas</label>
          <textarea className="input mb-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Mesa preferida, alergias, preferencias…" />
          <button className="btn-ghost text-xs mb-4" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? "Guardando…" : "Guardar notas"}</button>

          <h3 className="font-semibold text-sm mb-2">Historial</h3>
          {isLoading ? <Spinner /> : !history?.length ? <p className="text-sm text-slate-400 dark:text-slate-500">Sin reservas.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {history.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                  <span>{formatDateTime(b.starts_at, tz)} · {b.services?.name ?? "—"}</span>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-5 border-t pt-4">
        <button className="btn-danger" disabled={deleting} onClick={() => setConfirmingDelete(true)}>{deleting ? "Eliminando…" : "Eliminar cliente"}</button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar cliente"
        message={`¿Eliminar a ${customer.full_name}? Su historial de reservas se conserva, pero dejará de estar vinculado a esta ficha.`}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Modal>
  );
}
