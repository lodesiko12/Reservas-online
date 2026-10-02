// adv-file-url — URL firmada de corta duración para ver/descargar un documento.
// Endpoint AUTENTICADO (verify_jwt = true). Body: { document_id, purpose?: "view" | "download" }.
// El acceso se decide con RLS (cliente del llamante): un gestor solo obtiene URL de los
// documentos de sus clientes. Cada petición queda registrada en adv_audit_log.
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { ADV_BUCKET, audit, makeClients } from "../_shared/advAuth.ts";

const SIGNED_URL_SECONDS = 60;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const { asCaller, service } = makeClients(req);
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);

  const body = await req.json().catch(() => ({}));
  const documentId = String(body.document_id ?? "");
  const purpose = body.purpose === "download" ? "download" : "view";
  if (!documentId) return json({ error: "Falta document_id" }, 400);

  if (!(await rateLimitHit(service, `adv-file-url:user:${user.id}`, 600, 3600))) return tooManyRequests(3600);

  // RLS: si el llamante no puede ver el documento, la consulta no devuelve nada.
  const { data: doc } = await asCaller.from("adv_documents")
    .select("id, business_id, client_id, storage_path, original_filename")
    .eq("id", documentId).maybeSingle();
  if (!doc) return json({ error: "Documento no encontrado" }, 404);

  const { data: signed, error } = await service.storage.from(ADV_BUCKET).createSignedUrl(
    doc.storage_path, SIGNED_URL_SECONDS,
    purpose === "download" ? { download: doc.original_filename } : undefined
  );
  if (error || !signed) return json({ error: "No se pudo generar el enlace" }, 500);

  await audit(service, {
    business_id: doc.business_id, user_id: user.id, action: purpose,
    document_id: doc.id, client_id: doc.client_id, detail: { filename: doc.original_filename },
  });
  return json({ url: signed.signedUrl, expires_in: SIGNED_URL_SECONDS });
});
