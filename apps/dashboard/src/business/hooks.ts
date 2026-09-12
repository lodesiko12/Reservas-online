import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Tables } from "@reservas/shared";

export type Booking = Tables<"bookings">;
export type Service = Tables<"services">;
export type Professional = Tables<"professionals">;
export type Customer = Tables<"customers">;

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
        .select("*, services(name), professionals(name)")
        .eq("business_id", bid)
        .gte("starts_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at");
      if (error) throw error;
      return data as unknown as (Booking & { services: { name: string } | null; professionals: { name: string } | null })[];
    },
  });
}
