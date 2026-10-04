import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { formatDate } from "@reservas/shared";
import { Spinner, EmptyState, ConfirmDialog } from "../../components/ui";
import { formatBytes, memberName, useAgencyDocuments, useAgencyMembers, type AgencyDocument } from "./hooks";

const BUCKET = "agencia-docs";
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function icon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("word")) return "📘";
  if (mime.includes("sheet") || mime.includes("excel")) return "📗";
  return "📄";
}

/** Documentos de un equipo: subida a Storage (bucket privado), descarga con URL firmada y borrado. */
export function DocumentosEquipo({ teamId }: { teamId: string }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { data: docs, isLoading } = useAgencyDocuments(teamId);
  const { data: members } = useAgencyMembers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AgencyDocument | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(null);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = MIME_BY_EXT[ext];
      if (!mime) { setError(`«${file.name}»: formato no admitido (PDF, imágenes, Word o Excel).`); continue; }
      if (file.size > MAX_BYTES) { setError(`«${file.name}»: supera los 20 MB.`); continue; }
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${bid}/${teamId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime });
      if (upErr) { setError(`«${file.name}»: ${upErr.message}`); continue; }
      const { error: dbErr } = await supabase.from("agency_documents").insert({
        business_id: bid, team_id: teamId, name: file.name, storage_path: path, mime_type: mime, size_bytes: file.size,
      });
      if (dbErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        setError(`«${file.name}»: ${dbErr.message}`);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["agency_documents", bid, teamId] });
  }

  async function download(d: AgencyDocument) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60, { download: d.name });
    if (error || !data) { setError(error?.message ?? "No se pudo descargar"); return; }
    window.location.href = data.signedUrl;
  }

  async function remove() {
    if (!deleting) return;
    const d = deleting;
    setDeleting(null);
    // Primero la fila (la RLS comprueba que eres del equipo) y después el archivo.
    const { error: dbErr } = await supabase.from("agency_documents").delete().eq("id", d.id).eq("business_id", bid);
    if (dbErr) { setError(dbErr.message); return; }
    await supabase.storage.from(BUCKET).remove([d.storage_path]);
    qc.invalidateQueries({ queryKey: ["agency_documents", bid, teamId] });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-slate-500 dark:text-slate-400">PDF, imágenes, Word y Excel (máx. 20 MB). Solo los ve el equipo y la directiva.</p>
        <div>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files)} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Subiendo…" : "+ Subir archivo"}</button>
        </div>
      </div>
      {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {isLoading ? <div className="grid place-items-center py-12"><Spinner /></div>
        : !docs?.length ? <EmptyState title="Aún no hay documentos" hint="Sube el primero con el botón de arriba." />
        : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">{icon(d.mime_type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{d.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {memberName(members, d.uploaded_by)} · {formatDate(d.created_at, tz)} · {formatBytes(d.size_bytes)}
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => download(d)}>Descargar</button>
                <button className="btn-ghost text-red-600" onClick={() => setDeleting(d)} aria-label="Borrar documento">🗑</button>
              </div>
            ))}
          </div>
        )}
      <ConfirmDialog
        open={!!deleting} title="Borrar documento"
        message={`Se borrará «${deleting?.name}» para todo el equipo.`}
        onConfirm={remove} onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
