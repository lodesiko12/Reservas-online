import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Spinner, StatCard } from "../../components/ui";
import { useAdvClients, useAdvDocuments, type AdvDocument } from "./hooks";
import { UploadModal, DocumentModal, DocumentTable } from "./DocComponents";

export function ResumenAsesoria() {
  const { data: clients } = useAdvClients();
  const { data: docs, isLoading } = useAdvDocuments();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<AdvDocument | null>(null);

  const all = docs ?? [];
  const inbox = all.filter((d) => !d.client_id || d.status === "review" || d.status === "failed").length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = all.filter((d) => new Date(d.created_at) >= monthStart).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        subtitle="Organizador de documentos de tus clientes"
        actions={<button className="btn-primary" onClick={() => setUploading(true)}>Subir documentos</button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Clientes" value={clients?.length ?? "—"} />
        <StatCard label="Documentos este mes" value={isLoading ? "—" : thisMonth} />
        <Link to="/app/sin-clasificar">
          <StatCard label="Sin clasificar / por revisar" value={isLoading ? "—" : inbox} accent={inbox ? "#B7791F" : undefined} hint="Haz clic para abrir la bandeja" />
        </Link>
      </div>
      <section>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Últimos documentos</h2>
        {isLoading ? <Spinner /> : all.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay documentos. Sube los primeros con el botón de arriba.</p>
        ) : (
          <DocumentTable docs={all.slice(0, 10)} showClient onOpen={setOpen} />
        )}
      </section>
      {uploading && <UploadModal open onClose={() => setUploading(false)} />}
      <DocumentModal doc={open} onClose={() => setOpen(null)} />
    </div>
  );
}
