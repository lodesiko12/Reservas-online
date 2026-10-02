// adv-delete — Borrado completo (RGPD): elimina documentos o un cliente entero junto con
// TODOS sus archivos de Storage. Endpoint AUTENTICADO (verify_jwt = true).
// Body: { document_id } o { client_id }.
//   * document_id: cualquier miembro con acceso al documento (RLS).
//   * client_id:   solo owner/super-admin de la asesoría (borra cliente, contactos,
//                  documentos y archivos). La auditoría conserva el rastro del borrado.
// Los archivos se borran ANTES que las filas: si falla Storage no se pierde la referencia.
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { ADV_BUCKET, audit, makeClients } from "../_shared/advAuth.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const { asCaller, service } = makeClients(req);
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return json({ error: "No autorizado" }, 401);
  if (!(await rateLimitHit(service, `adv-delete:user:${user.id}`, 120, 3600))) return tooManyRequests(3600);

  const body = await req.json().catch(() => ({}));
  const documentId = body.document_id ? String(body.document_id) : null;
  const clientId = body.client_id ? String(body.client_id) : null;
  if (!documentId === !clientId) return json({ error: "Indica document_id o client_id" }, 400);

  if (documentId) {
    const { data: doc } = await asCaller.from("adv_documents")
      .select("id, business_id, client_id, storage_path, original_filename").eq("id", documentId).maybeSingle();
    if (!doc) return json({ error: "Documento no encontrado" }, 404);

    const { error: rmErr } = await service.storage.from(ADV_BUCKET).remove([doc.storage_path]);
    if (rmErr) return json({ error: "No se pudo borrar el archivo" }, 500);
    const { error } = await service.from("adv_documents").delete().eq("id", doc.id);
    if (error) return json({ error: error.message }, 400);
    await audit(service, { business_id: doc.business_id, user_id: user.id, action: "delete_document", document_id: doc.id, client_id: doc.client_id, detail: { filename: doc.original_filename } });
    return json({ ok: true });
  }

  const { data: client } = await asCaller.from("adv_clients").select("id, business_id, name").eq("id", clientId!).maybeSingle();
  if (!client) return json({ error: "Cliente no encontrado" }, 404);
  const { data: isOwner } = await asCaller.rpc("is_business_owner", { b: client.business_id });
  if (!isOwner) return json({ error: "Solo el administrador de la asesoría puede borrar un cliente" }, 403);

  const { data: docs, error: listErr } = await service.from("adv_documents").select("id, storage_path").eq("client_id", client.id);
  if (listErr) return json({ error: listErr.message }, 400);
  const paths = (docs ?? []).map((d) => d.storage_path);
  // Storage admite borrados por lotes; troceamos para no pasarnos de tamaño de petición.
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await service.storage.from(ADV_BUCKET).remove(paths.slice(i, i + 100));
    if (rmErr) return json({ error: "No se pudieron borrar todos los archivos; el cliente no se ha eliminado" }, 500);
  }
  const { error: delErr } = await service.from("adv_clients").delete().eq("id", client.id);
  if (delErr) return json({ error: delErr.message }, 400);
  await audit(service, { business_id: client.business_id, user_id: user.id, action: "delete_client", client_id: client.id, detail: { name: client.name, documents_deleted: paths.length } });
  return json({ ok: true, documents_deleted: paths.length });
});
