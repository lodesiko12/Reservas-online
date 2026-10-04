import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { ymdInTz } from "@reservas/shared";
import type { Tables } from "@reservas/shared";

export type AgencyMember = Tables<"agency_members">;
export type AgencyTeam = Tables<"agency_teams">;
export type AgencyTeamMember = Tables<"agency_team_members">;
export type AgencyTask = Tables<"agency_tasks">;
export type AgencyAssignee = Tables<"agency_task_assignees">;
export type AgencyComment = Tables<"agency_task_comments">;
export type AgencyEvent = Tables<"agency_events">;
export type AgencyDocument = Tables<"agency_documents">;
export type AgencyNotification = Tables<"agency_notifications">;
export type AgencyChatMessage = Tables<"agency_chat_messages">;

export type TaskStatus = "pendiente" | "en_curso" | "hecha";
export const STATUSES: { key: TaskStatus; label: string; color: string }[] = [
  { key: "pendiente", label: "Pendiente", color: "#8CA3A1" },
  { key: "en_curso", label: "En curso", color: "#2563A8" },
  { key: "hecha", label: "Hecha", color: "#1F8A4C" },
];
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

export const DIRECTIVA_ROLES: { key: string; label: string }[] = [
  { key: "presidente", label: "Presidente" },
  { key: "vicepresidente1", label: "Vicepresidente 1º" },
  { key: "vicepresidente2", label: "Vicepresidente 2º" },
  { key: "secretario", label: "Secretario" },
  { key: "tesorero", label: "Tesorero" },
];
export const DIRECTIVA_ROLE_LABEL: Record<string, string> = Object.fromEntries(DIRECTIVA_ROLES.map((r) => [r.key, r.label]));

/** Texto del cargo: la etiqueta libre y, si no hay, el puesto de la directiva. */
export function cargoLabel(m: Pick<AgencyMember, "cargo" | "directiva_role" | "access_level">): string {
  if (m.cargo) return m.cargo;
  if (m.directiva_role) return DIRECTIVA_ROLE_LABEL[m.directiva_role] ?? "Directiva";
  return m.access_level === "directiva" ? "Directiva" : "Miembro";
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function useTodayYmd(): string {
  const { business } = useAuth();
  return ymdInTz(new Date(), business?.timezone ?? "Europe/Madrid");
}

export function isOverdue(t: Pick<AgencyTask, "due_date" | "status">, today: string): boolean {
  return !!t.due_date && t.status !== "hecha" && t.due_date < today;
}

/** "2026-10-05" → "5 oct" (sin pasar por zonas horarias: es una fecha de calendario). */
export function formatDueDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Mi fila de miembro en la agencia activa y mi nivel de acceso. */
export function useAgencyMe() {
  const bid = useBusinessId();
  const { session, isSuperAdmin } = useAuth();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: ["agency_me", bid, uid],
    enabled: !!bid && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_members").select("*").eq("business_id", bid).eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const me = q.data ?? null;
  const active = isSuperAdmin || !!me?.is_active;
  const isDirectiva = isSuperAdmin || (!!me?.is_active && me.access_level === "directiva");
  const canManageMembers = isSuperAdmin || (isDirectiva && ["presidente", "secretario"].includes(me?.directiva_role ?? ""));
  return { me, userId: uid ?? "", loading: q.isLoading, active, isDirectiva, canManageMembers };
}

export function useAgencyMembers(businessId?: string) {
  const own = useBusinessId();
  const bid = businessId ?? own;
  return useQuery({
    queryKey: ["agency_members", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_members").select("*").eq("business_id", bid).order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAgencyTeams(businessId?: string) {
  const own = useBusinessId();
  const bid = businessId ?? own;
  return useQuery({
    queryKey: ["agency_teams", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_teams").select("*").eq("business_id", bid).order("position").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAgencyTeamMembers(businessId?: string) {
  const own = useBusinessId();
  const bid = businessId ?? own;
  return useQuery({
    queryKey: ["agency_team_members", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_team_members").select("*").eq("business_id", bid);
      if (error) throw error;
      return data;
    },
  });
}

/** Todas las tareas que el usuario puede ver (la RLS ya limita a sus equipos). */
export function useAgencyTasks() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_tasks", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_tasks").select("*").eq("business_id", bid)
        .order("sort_order").order("created_at").limit(3000);
      if (error) throw error;
      return data;
    },
  });
}

export function useAgencyAssignees() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_assignees", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_task_assignees").select("*").eq("business_id", bid).limit(10000);
      if (error) throw error;
      return data;
    },
  });
}

export function useTaskComments(taskId: string | null) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_comments", bid, taskId],
    enabled: !!bid && !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_task_comments").select("*")
        .eq("business_id", bid).eq("task_id", taskId!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Eventos entre dos instantes ISO (ambos incluidos el inicio y excluido el final). */
export function useAgencyEvents(fromISO: string, toISO: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_events", bid, fromISO, toISO],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_events").select("*").eq("business_id", bid)
        .gte("starts_at", fromISO).lt("starts_at", toISO).order("starts_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAgencyDocuments(teamId: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_documents", bid, teamId],
    enabled: !!bid && !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_documents").select("*")
        .eq("business_id", bid).eq("team_id", teamId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Suscripción Realtime a los avisos propios. Llamar UNA sola vez (en AgenciaApp): dos
 * suscripciones con el mismo canal hacen fallar a supabase-js. */
export function useNotificationsRealtime() {
  const bid = useBusinessId();
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();

  useEffect(() => {
    if (!bid || !uid) return;
    const ch = supabase
      .channel(`agency-notifications-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agency_notifications", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["agency_notifications", bid] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bid, uid, qc]);
}

/** Avisos propios (campana). */
export function useAgencyNotifications() {
  const bid = useBusinessId();
  const { session } = useAuth();
  const uid = session?.user.id;

  return useQuery({
    queryKey: ["agency_notifications", bid],
    enabled: !!bid && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_notifications").select("*")
        .eq("business_id", bid).eq("user_id", uid!).order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data;
    },
  });
}

export function memberName(members: { user_id: string; full_name: string }[] | undefined, userId: string | null | undefined): string {
  if (!userId) return "—";
  return members?.find((m) => m.user_id === userId)?.full_name ?? "Antiguo miembro";
}

/** Mensaje legible de un error de supabase.functions.invoke (el cuerpo JSON viene en `context`). */
export async function functionError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const b = await ctx.json(); if (b?.error) return String(b.error); } catch { /* sin cuerpo */ }
  }
  return (error as Error)?.message || fallback;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Suscripción Realtime al chat de la agencia. Llamar UNA sola vez (en AgenciaApp). La RLS ya
 * limita los eventos a los grupos que el usuario puede ver. */
export function useChatRealtime() {
  const bid = useBusinessId();
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  useEffect(() => {
    if (!bid || !uid) return;
    const ch = supabase
      .channel(`agency-chat-${bid}-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agency_chat_messages", filter: `business_id=eq.${bid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["agency_chat_messages", bid] });
          qc.invalidateQueries({ queryKey: ["agency_chat_unread", bid] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bid, uid, qc]);
}

/** Mensajes sin leer por grupo: mapa scope_id → nº. scope_id = id del equipo, o el de la agencia para el General. */
export function useChatUnread() {
  const bid = useBusinessId();
  const { session } = useAuth();
  return useQuery({
    queryKey: ["agency_chat_unread", bid],
    enabled: !!bid && !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agency_chat_unread", { p_business_id: bid });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.scope_id] = Number(r.unread);
      return map;
    },
  });
}

/** Últimos mensajes de un grupo (orden cronológico). */
export function useChatMessages(scopeId: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["agency_chat_messages", bid, scopeId],
    enabled: !!bid && !!scopeId,
    queryFn: async () => {
      let q = supabase.from("agency_chat_messages").select("*").eq("business_id", bid);
      q = scopeId === bid ? q.is("team_id", null) : q.eq("team_id", scopeId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data.reverse();
    },
  });
}
