// Helpers compartidos por las Edge Functions del organizador de asesorías (adv-*).
// Patrón dual-cliente (igual que generate-client-ai-report): `asCaller` usa el JWT de quien
// llama y por tanto pasa por RLS (un gestor solo ve lo suyo); `service` salta RLS y solo se
// usa para Storage, auditoría y escrituras ya autorizadas.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type AdvContext = {
  asCaller: SupabaseClient;
  service: SupabaseClient;
  userId: string;
  isSuperAdmin: boolean;
  role: "owner" | "staff" | null;
};

export const ADV_BUCKET = "asesoria-docs";

export function makeClients(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
  );
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
  return { asCaller, service };
}

/**
 * Autentica al llamante y comprueba que es miembro de `businessId` y que el negocio es de
 * tipo asesoría. Devuelve null si algo no cuadra (el llamador responde 403).
 */
export async function authorizeBusiness(req: Request, businessId: string): Promise<AdvContext | null> {
  const { asCaller, service } = makeClients(req);
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return null;

  const [{ data: prof }, { data: member }, { data: biz }] = await Promise.all([
    service.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle(),
    service.from("business_users").select("role").eq("business_id", businessId).eq("user_id", user.id).maybeSingle(),
    service.from("businesses").select("type").eq("id", businessId).maybeSingle(),
  ]);
  const isSuperAdmin = !!prof?.is_super_admin;
  if (!isSuperAdmin && !member) return null;
  if (biz?.type !== "asesoria") return null;
  return { asCaller, service, userId: user.id, isSuperAdmin, role: (member?.role as "owner" | "staff" | undefined) ?? null };
}

export async function audit(
  service: SupabaseClient,
  row: { business_id: string; user_id: string; action: string; document_id?: string | null; client_id?: string | null; detail?: unknown }
) {
  const { error } = await service.from("adv_audit_log").insert({
    business_id: row.business_id,
    user_id: row.user_id,
    action: row.action,
    document_id: row.document_id ?? null,
    client_id: row.client_id ?? null,
    detail: row.detail ?? {},
  });
  if (error) console.error("adv_audit_log insert error:", error.message);
}
