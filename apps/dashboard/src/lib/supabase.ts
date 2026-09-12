import { createSupabase } from "@reservas/shared";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Panel: persistimos sesión (login de staff/super-admin).
export const supabase = createSupabase(url, anon, { persistSession: true });
