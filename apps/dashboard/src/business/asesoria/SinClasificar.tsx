import { useState } from "react";
import { PageHeader, Spinner, EmptyState } from "../../components/ui";
import { useAdvDocuments, type AdvDocument } from "./hooks";
import { UploadModal, DocumentModal, DocumentTable } from "./DocComponents";

/** Bandeja de documentos sin cliente (o que requieren revisión): el equipo los asigna a mano. */
export function SinClasificar() {
  const { data: docs, isLoading } = useAdvDocuments();
  const [open, setOpen] = useState<AdvDocument | null>(null);
  const [uploading, setUploading] = useState(false);

  const inbox = (docs ?? []).filter((d) => !d.client_id || d.status === "review" || d.status === "failed");

  return (
    <div>
      <PageHeader
        title="Sin clasificar"
        subtitle="Documentos sin cliente o pendientes de revisar. Ábrelos para asignarles cliente y tipo."
        actions={<button className="btn-primary" onClick={() => setUploading(true)}>Subir documentos</button>}
      />
      {isLoading ? <Spinner /> : inbox.length === 0 ? (
        <EmptyState title="Bandeja vacía" hint="Todo lo recibido está asignado a un cliente." />
      ) : (
        <DocumentTable docs={inbox} showClient onOpen={setOpen} />
      )}
      {uploading && <UploadModal open onClose={() => setUploading(false)} />}
      <DocumentModal doc={open} onClose={() => setOpen(null)} />
    </div>
  );
}
