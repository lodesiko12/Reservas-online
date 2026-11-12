import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Tables } from "@reservas/shared";
import { useBusinessId } from "../hooks";

export type WaConversation = Tables<"whatsapp_conversations"> & {
  customers: { full_name: string; last_name: string | null } | null;
};
export type WaMessage = Tables<"whatsapp_messages">;

/**
 * Suscripción en vivo al buzón de WhatsApp del negocio. Se monta una sola vez (en BusinessApp)
 * y mantiene frescas las consultas de la bandeja, del hilo abierto y del globo de no leídos.
 */
export function useWhatsappRealtime(enabled: boolean) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  useEffect(() => {
    if (!bid || !enabled) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["wa-convs", bid] });
      qc.invalidateQueries({ queryKey: ["wa-msgs", bid] });
    };
    const channel = supabase
      .channel(`wa-inbox-${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `business_id=eq.${bid}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `business_id=eq.${bid}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, enabled, qc]);
}

/** Conversaciones del negocio, la más reciente primero. */
export function useWaConversations(enabled = true) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["wa-convs", bid],
    enabled: !!bid && enabled,
    refetchInterval: 60000, // red de seguridad si el canal en vivo se cae
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*, customers(full_name, last_name)")
        .eq("business_id", bid)
        .order("last_message_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as WaConversation[];
    },
  });
}

/** Mensajes de una conversación, del más antiguo al más reciente. */
export function useWaMessages(conversationId: string | null) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["wa-msgs", bid, conversationId],
    enabled: !!bid && !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as WaMessage[];
    },
  });
}

/** Total de mensajes sin leer en conversaciones no archivadas (globo del menú). */
export function useWaUnread(enabled: boolean): number {
  const { data } = useWaConversations(enabled);
  return (data ?? []).filter((c) => !c.is_archived).reduce((n, c) => n + c.unread_count, 0);
}
