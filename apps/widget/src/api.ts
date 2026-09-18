import { createSupabase } from "@reservas/shared";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Widget público: sin persistencia de sesión (clientes anónimos).
export const supabase = createSupabase(url, anon, { persistSession: false });

export type PublicBusiness = {
  id: string;
  name: string;
  type: "citas" | "restaurante";
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  slot_interval_min: number;
};

export type PublicProfessional = { id: string; name: string; color: string };

export type PublicService = {
  id: string;
  name: string;
  duration_min: number;
  price: number | null;
  professionals: PublicProfessional[];
};

export type Slot = { slot_start: string; slot_end: string };
export type DiningSlot = { slot_start: string; slot_end: string; shift_id: string; shift_name: string };

export async function fetchBusiness(slug: string): Promise<PublicBusiness | null> {
  const { data, error } = await supabase.rpc("get_public_business", { p_slug: slug });
  if (error) throw error;
  return data && data.length ? (data[0] as PublicBusiness) : null;
}

export async function fetchServices(businessId: string): Promise<PublicService[]> {
  const { data, error } = await supabase.rpc("get_public_services", { p_business_id: businessId });
  if (error) throw error;
  return (data ?? []) as PublicService[];
}

export async function fetchSlots(
  businessId: string,
  serviceId: string,
  date: string,
  professionalId?: string | null
): Promise<Slot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_date: date,
    p_professional_id: professionalId || undefined,
  });
  if (error) throw error;
  return (data ?? []) as Slot[];
}

export async function fetchDiningSlots(
  businessId: string,
  date: string,
  partySize: number
): Promise<DiningSlot[]> {
  const { data, error } = await supabase.rpc("get_available_dining_slots", {
    p_business_id: businessId,
    p_date: date,
    p_party_size: partySize,
  });
  if (error) throw error;
  return (data ?? []) as DiningSlot[];
}

export type DiningSettings = { min_party_online: number; max_party_online: number };

export async function fetchDiningSettings(businessId: string): Promise<DiningSettings> {
  const { data, error } = await supabase.rpc("get_public_dining_settings", { p_business_id: businessId });
  if (error) throw error;
  return (data && data.length ? data[0] : { min_party_online: 1, max_party_online: 12 }) as DiningSettings;
}

export type BookingInput = {
  business_id: string;
  // citas:
  service_id?: string;
  professional_id?: string | null;
  // restaurante:
  dining_shift_id?: string;
  party_size?: number;
  // comunes:
  starts_at: string;
  name: string;
  last_name: string;
  phone: string;
  email: string;
  notes?: string;
};

export type BookingResult = {
  locator: string;
  starts_at: string;
  ends_at: string;
  service_name: string | null;
  business_name: string;
  status: "confirmada" | "pendiente";
};

/** Crea la reserva a través de la Edge Function (envía también el email). */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const { data, error } = await supabase.functions.invoke("create-booking", { body: input });
  if (error) {
    // El cuerpo de error de la función suele traer un mensaje útil.
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return data as BookingResult;
}

export type BookingLookup = {
  locator: string;
  status: "confirmada" | "cancelada" | "completada" | "no_show" | "pendiente";
  type: "citas" | "restaurante";
  starts_at: string;
  ends_at: string;
  business_name: string;
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  service_name: string | null;
  party_size: number | null;
  customer_name: string;
};

export async function lookupBooking(locator: string): Promise<BookingLookup | null> {
  const { data, error } = await supabase.rpc("get_booking_by_locator", { p_locator: locator.trim() });
  if (error) throw error;
  return data && data.length ? (data[0] as BookingLookup) : null;
}

export async function cancelBooking(locator: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_booking_by_locator", { p_locator: locator.trim() });
  if (error) throw error;
  return data as boolean;
}
