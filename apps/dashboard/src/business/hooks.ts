import { useQuery } from "@tanstack/react-query";
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

/** Reservas en un rango [fromISO, toISO). */
export function useBookings(fromISO: string, toISO: string) {
  const bid = useBusinessId();
  return useQuery({
    queryKey: ["bookings", bid, fromISO, toISO],
    enabled: !!bid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, services(name), professionals(name), dining_tables(name), dining_table_combos(name)")
        .eq("business_id", bid)
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at");
      if (error) throw error;
      return data as unknown as (Booking & {
        services: { name: string } | null;
        professionals: { name: string } | null;
        dining_tables: { name: string } | null;
        dining_table_combos: { name: string | null } | null;
      })[];
    },
  });
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
