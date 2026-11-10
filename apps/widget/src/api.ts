import { createSupabase } from "@reservas/shared";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Widget público: sin persistencia de sesión (clientes anónimos).
export const supabase = createSupabase(url, anon, { persistSession: false });

export type PublicBusiness = {
  id: string;
  name: string;
  type: "citas" | "restaurante" | "psicologo" | "autonomo" | "asesoria" | "agencia";
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  slot_interval_min: number;
  order_mode: boolean;
  online_orders: boolean;
};

export type PublicProfessional = { id: string; name: string; color: string };

export type PublicService = {
  id: string;
  name: string;
  duration_min: number;
  price: number | null;
  professionals: PublicProfessional[];
  // Modo encargo: cada servicio es un tamaño × nivel de precio.
  size_key: string | null;
  size_label: string | null;
  option_group: string | null;
};

export type PublicOption = {
  id: string;
  option_group: string;
  group_label: string;
  group_sort: number;
  name: string;
  is_available: boolean;
  sort_order: number;
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

export async function fetchOptions(businessId: string): Promise<PublicOption[]> {
  const { data, error } = await supabase.rpc("get_public_options", { p_business_id: businessId });
  if (error) throw error;
  return (data ?? []) as PublicOption[];
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

/** Días (YYYY-MM-DD) dentro del rango que tienen al menos un hueco disponible. */
export async function fetchAvailableDays(
  businessId: string,
  serviceId: string,
  dateFrom: string,
  dateTo: string,
  professionalId?: string | null
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_available_days", {
    p_business_id: businessId,
    p_service_id: serviceId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_professional_id: professionalId || undefined,
  });
  if (error) throw error;
  return new Set((data ?? []).map((r: { day: string }) => r.day));
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

/** Días (YYYY-MM-DD) del rango con al menos una mesa disponible para ese nº de comensales. */
export async function fetchAvailableDiningDays(
  businessId: string,
  dateFrom: string,
  dateTo: string,
  partySize: number
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_available_dining_days", {
    p_business_id: businessId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_party_size: partySize,
  });
  if (error) throw error;
  return new Set((data ?? []).map((r: { day: string }) => r.day));
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
  option_id?: string; // modo encargo: sabor
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
  option_label?: string | null;
  size_label?: string | null;
  order_mode?: boolean;
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
  status: "confirmada" | "cancelada" | "completada" | "no_show" | "pendiente" | "listo";
  type: "citas" | "restaurante" | "psicologo" | "autonomo" | "asesoria" | "agencia";
  starts_at: string;
  ends_at: string;
  business_name: string;
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  service_name: string | null;
  party_size: number | null;
  customer_name: string;
  option_label: string | null;
  size_label: string | null;
  order_mode: boolean;
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

/* ------------------------- Pedidos para llevar (restaurante) ------------------------- */

export type MenuModifier = { id: string; name: string; price_delta: number; is_available: boolean };
export type MenuGroup = { id: string; name: string; min_choices: number; max_choices: number; modifiers: MenuModifier[] };
export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  allergens: string[];
  is_available: boolean;
  groups: MenuGroup[];
};
export type MenuCategory = { id: string; name: string; items: MenuItem[] };
export type PublicMenu = {
  accepting: boolean;
  min_order_amount: number;
  prep_minutes: number;
  max_advance_days: number;
  categories: MenuCategory[];
};

/** Carta pública; null si el negocio no tiene pedidos online. */
export async function fetchMenu(businessId: string): Promise<PublicMenu | null> {
  const { data, error } = await supabase.rpc("get_public_menu", { p_business_id: businessId });
  if (error) throw error;
  return (data as unknown as PublicMenu | null) ?? null;
}

export async function fetchTakeawaySlots(businessId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_takeaway_slots", { p_business_id: businessId, p_date: date });
  if (error) throw error;
  return (data ?? []).map((r: { slot_start: string }) => r.slot_start);
}

export async function fetchTakeawayDays(businessId: string, dateFrom: string, dateTo: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_takeaway_days", {
    p_business_id: businessId, p_date_from: dateFrom, p_date_to: dateTo,
  });
  if (error) throw error;
  return new Set((data ?? []).map((r: { day: string }) => r.day));
}

export type OrderLineInput = { item_id: string; quantity: number; modifier_ids: string[]; notes?: string };
export type OrderInput = {
  business_id: string;
  pickup_at: string;
  items: OrderLineInput[];
  name: string;
  last_name: string;
  phone: string;
  email: string;
  notes?: string;
};
export type OrderResult = {
  locator: string;
  status: string;
  pickup_at: string;
  total: number;
  business_name: string;
};

/** Crea el pedido a través de la Edge Function (recalcula precios en servidor y envía el email). */
export async function createOrder(input: OrderInput): Promise<OrderResult> {
  const { data, error } = await supabase.functions.invoke("create-order", { body: input });
  if (error) {
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
  return data as OrderResult;
}

export type OrderLookup = {
  locator: string;
  status: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
  pickup_at: string;
  total: number;
  customer_name: string;
  notes: string | null;
  business_name: string;
  primary_color: string;
  logo_url: string | null;
  timezone: string;
  items: { name: string; quantity: number; line_total: number; modifiers: { name: string; price_delta: number }[]; notes: string | null }[];
};

export async function lookupOrder(locator: string): Promise<OrderLookup | null> {
  const { data, error } = await supabase.rpc("get_order_by_locator", { p_locator: locator.trim() });
  if (error) throw error;
  return (data as unknown as OrderLookup | null) ?? null;
}

export async function cancelOrder(locator: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("cancel_order_by_locator", { p_locator: locator.trim() });
  if (error) throw error;
  return data as boolean;
}
