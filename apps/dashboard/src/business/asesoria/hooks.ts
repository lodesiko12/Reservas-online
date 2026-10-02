import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import type { Tables } from "@reservas/shared";

export type AdvClient = Tables<"adv_clients">;
export type AdvContact = Tables<"adv_client_contacts">;
export type AdvDocType = Tables<"adv_doc_types">;
export type AdvDocument = Tables<"adv_documents">;

export const CLIENT_KIND_LABEL: Record<string, string> = {
  autonomo: "Autónomo", sociedad: "Sociedad", particular: "Particular", otro: "Otro",
};

export const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de clasificar", auto: "Clasificado", review: "Revisar",
  corrected: "Confirmado", unclassified: "Sin clasificar", failed: "Error",
};
export const DOC_STATUS_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  auto: "bg-emerald-100 text-emerald-700",
  review: "bg-amber-100 text-amber-700",
  corrected: "bg-sky-100 text-sky-700",
  unclassified: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
};

/** Rol del usuario en la asesoría activa: owner = administrador, staff = gestor. */
export function useAdvRole() {
  const bid = useBusinessId();
  const { session, isSuperAdmin } = useAuth();
  const uid = session?.user.id;
  const { data } = useQuery({
    queryKey: ["adv_role", bid, uid],
    enabled: !!bid && !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("business_users").select("role").eq("business_id", bid).eq("user_id", uid!).maybeSingle();
      return data?.role ?? null;
    },
  });
  return { isOwner: isSuperAdmin || data === "owner", userId: uid ?? "" };
}

export function useAdvClients() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["adv_clients", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("adv_clients").select("*").eq("business_id", bid).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAdvDocTypes(includeInactive = false) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["adv_doc_types", bid, includeInactive],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase.from("adv_doc_types").select("*").eq("business_id", bid).order("position").order("name");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useAdvTeam() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["adv_team", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("adv_list_team", { p_business_id: bid });
      if (error) throw error;
      return data;
    },
  });
}

/** Documentos del negocio. `clientId`: de un cliente; "none": solo los sin cliente. */
export function useAdvDocuments(clientId?: string | "none") {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["adv_documents", bid, clientId ?? "all"],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase.from("adv_documents").select("*").eq("business_id", bid).order("created_at", { ascending: false }).limit(500);
      if (clientId === "none") q = q.is("client_id", null);
      else if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function managerLabel(
  team: { user_id: string; full_name: string | null; email: string | null }[] | undefined,
  managerId: string | null
): string {
  if (!managerId) return "Sin gestor";
  const m = team?.find((t) => t.user_id === managerId);
  return m?.full_name || m?.email || "Gestor";
}

export function quarterOf(month: number | null): number | null {
  return month ? Math.ceil(month / 3) : null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Mensaje legible de un error de supabase.functions.invoke (el cuerpo JSON viene en `context`). */
export async function functionError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const b = await ctx.json(); if (b?.error) return String(b.error); } catch { /* sin cuerpo */ }
  }
  return (error as Error)?.message || fallback;
}
