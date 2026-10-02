import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useBusinessId } from "../hooks";
import { formatDateTime } from "@reservas/shared";
import { Modal, ConfirmDialog, Spinner } from "../../components/ui";
import {
  useAdvClients, useAdvDocTypes, functionError, formatBytes, quarterOf,
  DOC_STATUS_LABEL, DOC_STATUS_STYLE, type AdvDocument,
} from "./hooks";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

function useInvalidateDocs() {
  const qc = useQueryClient();
  const bid = useBusinessId();
  return () => qc.invalidateQueries({ queryKey: ["adv_documents", bid] });
}

/** Subida manual: arrastrar y soltar uno o varios archivos, con cliente y tipo opcionales. */
export function UploadModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId?: string }) {
  const bid = useBusinessId();
  const invalidate = useInvalidateDocs();
  const { data: clients } = useAdvClients();
  const { data: docTypes } = useAdvDocTypes();
  const [files, setFiles] = useState<File[]>([]);
  const [client, setClient] = useState(clientId ?? "");
  const [docType, setDocType] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<{ filename: string; ok: boolean; duplicate_of?: string | null; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setResults(null);
  }

  async function upload() {
    if (!files.length) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append("business_id", bid);
    if (client) fd.append("client_id", client);
    if (docType) fd.append("doc_type_id", docType);
    files.forEach((f) => fd.append("file", f));
    const { data, error } = await supabase.functions.invoke("adv-upload", { body: fd });
    setBusy(false);
    if (error) { setError(await functionError(error, "No se pudo subir")); return; }
    setResults(data.results);
    setFiles([]);
    invalidate();
  }

  function close() { setFiles([]); setResults(null); setError(null); onClose(); }

  return (
    <Modal open={open} onClose={close} title="Subir documentos" width="max-w-xl">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-brand-500 bg-brand-500/5" : "border-slate-300 dark:border-slate-700"}`}
      >
        <p className="font-medium text-slate-700 dark:text-slate-200">Arrastra aquí tus archivos o haz clic para elegirlos</p>
        <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG, WebP o HEIC · máx. 15 MB cada uno</p>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 text-sm space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.name} <span className="text-slate-400">({formatBytes(f.size)})</span></span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="label">Cliente (opcional)</label>
          <select className="input" value={client} disabled={!!clientId} onChange={(e) => setClient(e.target.value)}>
            <option value="">Sin asignar → bandeja «Sin clasificar»</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo (opcional)</label>
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">Sin indicar</option>
            {(docTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {results && (
        <ul className="mt-3 text-sm space-y-1">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "text-emerald-700" : "text-red-600"}>
              {r.ok ? "✓" : "✕"} {r.filename}{r.error ? ` — ${r.error}` : ""}
              {r.ok && r.duplicate_of ? <span className="text-amber-600"> · posible duplicado</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={close}>{results ? "Cerrar" : "Cancelar"}</button>
        <button className="btn-primary" disabled={!files.length || busy} onClick={upload}>
          {busy ? "Subiendo…" : `Subir ${files.length || ""} archivo${files.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}

/** Vista de documento: previsualización (URL firmada de 60 s) + origen + edición manual. */
export function DocumentModal({ doc, onClose }: { doc: AdvDocument | null; onClose: () => void }) {
  const invalidate = useInvalidateDocs();
  const { data: clients } = useAdvClients();
  const { data: docTypes } = useAdvDocTypes(true);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [clientId, setClientId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Al abrir otro documento, reinicia el formulario y pide la URL firmada.
  if (doc && loadedFor !== doc.id) {
    setLoadedFor(doc.id);
    setClientId(doc.client_id ?? ""); setTypeId(doc.doc_type_id ?? "");
    setYear(doc.period_year?.toString() ?? ""); setMonth(doc.period_month?.toString() ?? "");
    setUrl(null); setError(null); setLoadingUrl(true);
    supabase.functions.invoke("adv-file-url", { body: { document_id: doc.id, purpose: "view" } }).then(async ({ data, error }) => {
      if (error) setError(await functionError(error, "No se pudo cargar el archivo"));
      else setUrl(data.url);
      setLoadingUrl(false);
    });
  }
  if (!doc && loadedFor) setLoadedFor(null);

  async function download() {
    if (!doc) return;
    const { data, error } = await supabase.functions.invoke("adv-file-url", { body: { document_id: doc.id, purpose: "download" } });
    if (error) { setError(await functionError(error, "No se pudo descargar")); return; }
    window.location.href = data.url;
  }

  async function save() {
    if (!doc) return;
    setSaving(true); setError(null);
    const changedAssignment = (clientId || null) !== doc.client_id || (typeId || null) !== doc.doc_type_id;
    const patch: Partial<AdvDocument> = {
      client_id: clientId || null,
      doc_type_id: typeId || null,
      period_year: year ? Number(year) : null,
      period_month: month ? Number(month) : null,
    };
    // Una decisión humana sobre cliente/tipo deja el documento "confirmado".
    if (changedAssignment || doc.status === "review") {
      patch.status = clientId ? "corrected" : "unclassified";
      if (clientId) patch.assignment_reason = { by: "manual" };
    }
    const { error } = await supabase.from("adv_documents").update(patch).eq("id", doc.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    invalidate();
    onClose();
  }

  const isImage = doc?.mime_type.startsWith("image/") && doc.mime_type !== "image/heic";
  const isPdf = doc?.mime_type === "application/pdf";

  return (
    <Modal open={!!doc} onClose={onClose} title={doc?.original_filename ?? "Documento"} width="max-w-4xl">
      {doc && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 min-h-[320px] rounded-lg bg-slate-100 dark:bg-slate-800 grid place-items-center overflow-hidden">
            {loadingUrl ? <Spinner /> : url && isPdf ? (
              <iframe src={url} title={doc.original_filename} className="w-full h-[60vh]" />
            ) : url && isImage ? (
              <img src={url} alt={doc.original_filename} className="max-h-[60vh] object-contain" />
            ) : (
              <p className="text-sm text-slate-500 p-6 text-center">Vista previa no disponible para este formato. Usa «Descargar».</p>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`badge ${DOC_STATUS_STYLE[doc.status]}`}>{DOC_STATUS_LABEL[doc.status]}</span>
              {doc.duplicate_of && <span className="badge bg-amber-100 text-amber-700">Posible duplicado</span>}
            </div>
            <dl className="text-slate-600 dark:text-slate-300 space-y-0.5">
              <div>Origen: <b>{doc.source === "upload" ? "Subida manual" : doc.source === "whatsapp" ? "WhatsApp" : "Correo"}</b></div>
              <div>Recibido: {formatDateTime(doc.created_at, "Europe/Madrid")}</div>
              {doc.sender && <div>Remitente: {doc.sender}</div>}
              <div>Tamaño: {formatBytes(doc.size_bytes)}</div>
            </dl>

            <div>
              <label className="label">Cliente</label>
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Sin asignar</option>
                {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de documento</label>
              <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Sin indicar</option>
                {(docTypes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_active ? "" : " (inactivo)"}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Año</label>
                <input className="input" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
              </div>
              <div>
                <label className="label">Mes{month ? ` (T${quarterOf(Number(month))})` : ""}</label>
                <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-red-600">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={download}>Descargar</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Tabla de documentos con acciones de ver y borrar (borra también el archivo en Storage). */
export function DocumentTable({ docs, showClient = false, onOpen }: {
  docs: AdvDocument[]; showClient?: boolean; onOpen: (d: AdvDocument) => void;
}) {
  const invalidate = useInvalidateDocs();
  const { data: clients } = useAdvClients();
  const { data: docTypes } = useAdvDocTypes(true);
  const [deleting, setDeleting] = useState<AdvDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!deleting) return;
    const { error } = await supabase.functions.invoke("adv-delete", { body: { document_id: deleting.id } });
    setDeleting(null);
    if (error) { setError(await functionError(error, "No se pudo borrar")); return; }
    invalidate();
  }

  const clientName = (id: string | null) => clients?.find((c) => c.id === id)?.name ?? "—";
  const typeName = (id: string | null) => docTypes?.find((t) => t.id === id)?.name ?? "Sin tipo";

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2.5">Documento</th>
                {showClient && <th className="px-4 py-2.5">Cliente</th>}
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Periodo</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Recibido</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => onOpen(d)}>
                  <td className="px-4 py-2.5 max-w-[240px] truncate font-medium dark:text-slate-100">{d.original_filename}</td>
                  {showClient && <td className="px-4 py-2.5">{clientName(d.client_id)}</td>}
                  <td className="px-4 py-2.5">{typeName(d.doc_type_id)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {d.period_year ? `${d.period_year}${d.period_month ? ` · T${quarterOf(d.period_month)} · m${d.period_month}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${DOC_STATUS_STYLE[d.status]}`}>{DOC_STATUS_LABEL[d.status]}</span>
                    {d.duplicate_of && <span className="badge bg-amber-100 text-amber-700 ml-1">Duplicado?</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{formatDateTime(d.created_at, "Europe/Madrid")}</td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="text-slate-400 hover:text-red-600" title="Borrar" onClick={() => setDeleting(d)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleting}
        title="Borrar documento"
        message={`Se eliminará «${deleting?.original_filename}» y su archivo de forma definitiva.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
