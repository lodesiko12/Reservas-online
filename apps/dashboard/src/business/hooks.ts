import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Tables } from "@reservas/shared";

export type Booking = Tables<"bookings">;
export type Service = Tables<"services">;
export type Professional = Tables<"professionals">;
export type Customer = Tables<"customers">;
export type DiningZone = Tables<"dining_zones">;
export type DiningTable = Tables<"dining_tables">;
export type DiningTableCombo = Tables<"dining_table_combos">;
export type DiningSettings = Tables<"dining_settings">;
export type DiningShift = Tables<"dining_shifts">;
export type WaitlistEntry = Tables<"waitlist">;
export type OrderSettings = Tables<"order_settings">;
export type ServiceOption = Tables<"service_options">;
export type OptionGroup = Tables<"service_option_groups">;
export type DayOverride = Tables<"business_day_overrides">;
export type MenuCategory = Tables<"menu_categories">;
export type MenuItemRow = Tables<"menu_items">;
export type ModifierGroup = Tables<"menu_modifier_groups">;
export type Modifier = Tables<"menu_modifiers">;
export type ItemGroupLink = Tables<"menu_item_modifier_groups">;
export type TakeawaySettings = Tables<"takeaway_settings">;
export type TakeawayHour = Tables<"takeaway_hours">;
export type OrderItemRow = Tables<"order_items">;
export type OrderRow = Tables<"orders"> & { order_items: OrderItemRow[] };

export function useBusinessId() {
  const { business } = useAuth();
  return business?.id ?? "";
}

export function useServices(includeInactive = false) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["services", bid, includeInactive],
    enabled: !!bid,
    queryFn: async () => {
      let q = supabase.from("services").select("*").eq("business_id", bid).order("sort_order");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Service[];
    },
  });
}

export function useProfessionals() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["professionals", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").eq("business_id", bid).order("name");
      if (error) throw error;
      return data as Professional[];
    },
  });
}

/** Relación servicio<->profesional del negocio (tabla puente service_professionals). */
export function useServiceProfessionals() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["service_professionals", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_professionals")
        .select("service_id, professional_id, services!inner(business_id)")
        .eq("services.business_id", bid);
      if (error) throw error;
      return (data ?? []) as { service_id: string; professional_id: string }[];
    },
  });
}

/** Reservas en un rango [fromISO, toISO). */
export function useBookings(fromISO: string, toISO: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["bookings", bid, fromISO, toISO],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, services(name, price, size_label, size_key), professionals(name, color), dining_tables(name), dining_table_combos(name)")
        .eq("business_id", bid)
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at");
      if (error) throw error;
      return data as unknown as (Booking & {
        services: { name: string; price: number | null; size_label: string | null; size_key: string | null } | null;
        professionals: { name: string; color: string } | null;
        dining_tables: { name: string } | null;
        dining_table_combos: { name: string | null } | null;
      })[];
    },
  });
}

/** Suscripción en vivo a cambios de reservas del negocio (para el plano de
 * sala y cualquier otra vista que necesite refrescarse sin recargar). */
export function useBookingsRealtime() {
  const bid = useBusinessId();
  const qc = useQueryClient();
  useEffect(() => {
    if (!bid) return;
    const channel = supabase
      .channel(`bookings-${bid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `business_id=eq.${bid}` },
        () => qc.invalidateQueries({ queryKey: ["bookings", bid] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);
}

/** Zonas de sala del negocio (tipo restaurante). */
export function useDiningZones() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["dining_zones", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_zones").select("*").eq("business_id", bid).order("sort_order");
      if (error) throw error;
      return data as DiningZone[];
    },
  });
}

/** Mesas físicas del negocio (tipo restaurante). */
export function useDiningTables() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["dining_tables", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_tables").select("*, dining_zones(name)").eq("business_id", bid).order("name");
      if (error) throw error;
      return data as unknown as (DiningTable & { dining_zones: { name: string } | null })[];
    },
  });
}

/** Combinaciones de mesas configuradas (grupos grandes). */
export function useDiningTableCombos() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["dining_table_combos", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_table_combos").select("*").eq("business_id", bid).order("name");
      if (error) throw error;
      return data as DiningTableCombo[];
    },
  });
}

/** Franjas de servicio del negocio (tipo restaurante). */
export function useDiningShifts() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["dining_shifts", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_shifts").select("*").eq("business_id", bid).order("start_time");
      if (error) throw error;
      return data as DiningShift[];
    },
  });
}

/** Lista de espera activa (no sentados ni cancelados) del negocio. */
export function useWaitlist() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["waitlist", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("waitlist").select("*")
        .eq("business_id", bid).in("status", ["esperando", "avisado"]).order("created_at");
      if (error) throw error;
      return data as WaitlistEntry[];
    },
  });
}

/** Ajustes generales de restaurante (antelación, comensales online, confirmación manual). */
export function useDiningSettings() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["dining_settings", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("dining_settings").select("*").eq("business_id", bid).maybeSingle();
      if (error) throw error;
      return data as DiningSettings | null;
    },
  });
}

/* ------------------------- Modo encargo (order_mode) ------------------------- */

/** Ajustes de encargos del negocio (antelación mínima, capacidad diaria…); null si aún no hay fila. */
export function useOrderSettings() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["order_settings", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("order_settings").select("*").eq("business_id", bid).maybeSingle();
      if (error) throw error;
      return data as OrderSettings | null;
    },
  });
}

/** Niveles de precio (Básicas, Clásicas…). */
export function useOptionGroups() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["service_option_groups", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_option_groups").select("*").eq("business_id", bid).order("sort_order");
      if (error) throw error;
      return data as OptionGroup[];
    },
  });
}

/** Sabores del negocio. */
export function useServiceOptions() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["service_options", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_options").select("*").eq("business_id", bid).order("sort_order").order("name");
      if (error) throw error;
      return data as ServiceOption[];
    },
  });
}

/** Días especiales (festivos que usan el horario de otro día, o cierres). */
export function useDayOverrides() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["business_day_overrides", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("business_day_overrides").select("*").eq("business_id", bid).order("day");
      if (error) throw error;
      return data as DayOverride[];
    },
  });
}

/* ------------------------- Pedidos para llevar (online_orders) ------------------------- */

export function useMenuCategories() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["menu_categories", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_categories").select("*").eq("business_id", bid).order("sort_order").order("name");
      if (error) throw error;
      return data as MenuCategory[];
    },
  });
}

export function useMenuItems() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["menu_items", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("business_id", bid).order("sort_order").order("name");
      if (error) throw error;
      return data as MenuItemRow[];
    },
  });
}

export function useModifierGroups() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["menu_modifier_groups", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_modifier_groups").select("*").eq("business_id", bid).order("sort_order").order("name");
      if (error) throw error;
      return data as ModifierGroup[];
    },
  });
}

export function useModifiers() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["menu_modifiers", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_modifiers").select("*").eq("business_id", bid).order("sort_order").order("name");
      if (error) throw error;
      return data as Modifier[];
    },
  });
}

/** Qué grupos de extras tiene cada plato (tabla puente). */
export function useItemGroupLinks() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["menu_item_modifier_groups", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_modifier_groups")
        .select("item_id, group_id, sort_order, menu_items!inner(business_id)")
        .eq("menu_items.business_id", bid);
      if (error) throw error;
      return (data ?? []).map((r) => ({ item_id: r.item_id, group_id: r.group_id, sort_order: r.sort_order })) as ItemGroupLink[];
    },
  });
}

export function useTakeawaySettings() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["takeaway_settings", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("takeaway_settings").select("*").eq("business_id", bid).maybeSingle();
      if (error) throw error;
      return data as TakeawaySettings | null;
    },
  });
}

export function useTakeawayHours() {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["takeaway_hours", bid],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase.from("takeaway_hours").select("*").eq("business_id", bid).order("weekday").order("start_time");
      if (error) throw error;
      return data as TakeawayHour[];
    },
  });
}

/** Pedidos con recogida en [fromISO, toISO), con sus líneas. */
export function useOrders(fromISO: string, toISO: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["orders", bid, fromISO, toISO],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("business_id", bid)
        .gte("pickup_at", fromISO)
        .lt("pickup_at", toISO)
        .order("pickup_at");
      if (error) throw error;
      const rows = data as unknown as OrderRow[];
      rows.forEach((o) => o.order_items.sort((a, b) => a.sort_order - b.sort_order));
      return rows;
    },
  });
}

/** Pedidos nuevos sin atender (para el globo del menú), con suscripción en vivo a `orders`. */
export function useNewOrdersCount(enabled: boolean) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  useEffect(() => {
    if (!bid || !enabled) return;
    const channel = supabase
      .channel(`orders-${bid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `business_id=eq.${bid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["orders", bid] });
          qc.invalidateQueries({ queryKey: ["orders-new", bid] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, enabled, qc]);
  const { data } = useQuery({
    queryKey: ["orders-new", bid],
    enabled: !!bid && enabled,
    queryFn: async () => {
      const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "nuevo");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000, // red de seguridad si el canal en vivo se cae
  });
  return data ?? 0;
}
