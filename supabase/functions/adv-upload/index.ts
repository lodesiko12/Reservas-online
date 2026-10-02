// adv-upload — Subida manual de documentos al organizador de una asesoría.
// Endpoint AUTENTICADO (verify_jwt = true). multipart/form-data:
//   business_id (obligatorio), client_id (opcional), doc_type_id (opcional), file (uno o varios).
// Valida cada archivo en el servidor (tamaño, firma real de los primeros bytes, PDF con
// contenido activo), calcula el hash para detectar duplicados, lo guarda en el bucket
// privado y crea la fila en adv_documents. Nunca se confía en el MIME que declara el cliente.
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { ADV_BUCKET, audit, authorizeBusiness } from "../_shared/advAuth.ts";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 20;

type Detected = { mime: string; ext: string };

function detectType(b: Uint8Array): Detected | null {
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { mime: "application/pdf", ext: "pdf" };
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  // HEIC/HEIF (ISO BMFF): "ftyp" en el offset 4 con una marca heic/heix/mif1...
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

// Un PDF de documentación fiscal no necesita JavaScript, lanzar programas ni llevar archivos
// incrustados. Búsqueda sobre los bytes crudos (heurística, no un antivirus real).
const PDF_ACTIVE = [/\/JavaScript/, /\/JS\s*[(<]/, /\/Launch/, /\/EmbeddedFile/, /\/RichMedia/];
function pdfHasActiveContent(bytes: Uint8Array): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  return PDF_ACTIVE.some((re) => re.test(text));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "documento";
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, "").slice(0, 150) || "documento";
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "Formulario no válido" }, 400); }

  const businessId = String(form.get("business_id") ?? "");
  const clientId = String(form.get("client_id") ?? "") || null;
  const docTypeId = String(form.get("doc_type_id") ?? "") || null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(businessId)) return json({ error: "Falta business_id" }, 400);
  if ((clientId && !uuidRe.test(clientId)) || (docTypeId && !uuidRe.test(docTypeId))) {
    return json({ error: "Identificador no válido" }, 400);
  }

  const ctx = await authorizeBusiness(req, businessId);
  if (!ctx) return json({ error: "No autorizado" }, 403);
  const { service, asCaller, userId } = ctx;

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return json({ error: "No se ha enviado ningún archivo" }, 400);
  if (files.length > MAX_FILES) return json({ error: `Máximo ${MAX_FILES} archivos por subida` }, 400);

  if (!(await rateLimitHit(service, `adv-upload:user:${userId}`, 300, 3600))) return tooManyRequests(3600);

  // Cliente de destino: se comprueba con RLS (un gestor solo puede subir a los suyos).
  if (clientId) {
    const { data: c } = await asCaller.from("adv_clients").select("id").eq("id", clientId).eq("business_id", businessId).maybeSingle();
    if (!c) return json({ error: "Cliente no encontrado" }, 404);
  }
  if (docTypeId) {
    const { data: t } = await service.from("adv_doc_types").select("id").eq("id", docTypeId).eq("business_id", businessId).maybeSingle();
    if (!t) return json({ error: "Tipo de documento no encontrado" }, 404);
  }

  const results: Array<{ filename: string; ok: boolean; id?: string; duplicate_of?: string | null; error?: string }> = [];

  for (const file of files) {
    const filename = safeName(file.name);
    try {
      if (file.size === 0) { results.push({ filename, ok: false, error: "Archivo vacío" }); continue; }
      if (file.size > MAX_BYTES) { results.push({ filename, ok: false, error: "Supera los 15 MB" }); continue; }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectType(bytes);
      if (!detected) { results.push({ filename, ok: false, error: "Tipo de archivo no permitido (solo PDF e imágenes)" }); continue; }
      if (detected.mime === "application/pdf" && pdfHasActiveContent(bytes)) {
        results.push({ filename, ok: false, error: "El PDF contiene elementos activos y se ha rechazado por seguridad" });
        continue;
      }

      const hash = await sha256Hex(bytes);
      const { data: dup } = await service.from("adv_documents").select("id")
        .eq("business_id", businessId).eq("file_hash", hash).order("created_at").limit(1).maybeSingle();

      const docId = crypto.randomUUID();
      const path = `${businessId}/${docId}.${detected.ext}`;
      const { error: upErr } = await service.storage.from(ADV_BUCKET).upload(path, bytes, {
        contentType: detected.mime, upsert: false,
      });
      if (upErr) { results.push({ filename, ok: false, error: "No se pudo guardar el archivo" }); console.error(upErr.message); continue; }

      // Con cliente y tipo elegidos a mano el documento queda "corregido" (decisión humana);
      // sin cliente, a la bandeja "Sin clasificar"; con cliente y sin tipo, a la espera de IA.
      const status = !clientId ? "unclassified" : docTypeId ? "corrected" : "pending";
      const { error: insErr } = await service.from("adv_documents").insert({
        id: docId,
        business_id: businessId,
        client_id: clientId,
        doc_type_id: docTypeId,
        source: "upload",
        original_filename: filename,
        mime_type: detected.mime,
        size_bytes: bytes.length,
        storage_path: path,
        file_hash: hash,
        status,
        duplicate_of: dup?.id ?? null,
        uploaded_by: userId,
        assignment_reason: clientId ? { by: "manual", user_id: userId } : {},
      });
      if (insErr) {
        await service.storage.from(ADV_BUCKET).remove([path]);
        results.push({ filename, ok: false, error: "No se pudo registrar el documento" });
        console.error(insErr.message);
        continue;
      }
      await audit(service, { business_id: businessId, user_id: userId, action: "upload", document_id: docId, client_id: clientId, detail: { filename, source: "upload" } });
      results.push({ filename, ok: true, id: docId, duplicate_of: dup?.id ?? null });
    } catch (e) {
      console.error("adv-upload error:", e);
      results.push({ filename, ok: false, error: "Error procesando el archivo" });
    }
  }

  return json({ results });
});
