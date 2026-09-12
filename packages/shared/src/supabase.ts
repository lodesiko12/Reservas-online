import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type DB = Database;
export type TypedClient = SupabaseClient<Database>;

/**
 * Crea un cliente de Supabase tipado.
 * - En el panel usamos persistencia de sesión (login de staff/admin).
 * - En el widget público NO persistimos sesión (clientes anónimos).
 */
export function createSupabase(
  url: string,
  anonKey: string,
  opts: { persistSession?: boolean } = {}
): TypedClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: opts.persistSession ?? true,
      autoRefreshToken: opts.persistSession ?? true,
      detectSessionInUrl: false,
    },
  });
}
