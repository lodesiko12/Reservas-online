import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Tables } from "@reservas/shared";
import { supabase } from "./supabase";

type Business = Tables<"businesses">;

type AuthState = {
  session: Session | null;
  loading: boolean;
  isSuperAdmin: boolean;
  business: Business | null;      // negocio activo del staff (primero si hay varios)
  businesses: Business[];         // negocios a los que pertenece el usuario
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveBusiness: (id: string) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Usuario cuyo perfil/negocios ya están cargados: evita recargar (y desmontar todo el panel)
  // cuando supabase-js re-emite SIGNED_IN al volver a la pestaña.
  const loadedUserId = useRef<string | null>(null);

  async function loadProfile() {
    const { data: sess } = await supabase.auth.getSession();
    setSession(sess.session);
    if (!sess.session) { loadedUserId.current = null; setLoading(false); return; }
    // Solo mostramos el spinner global en la primera carga; un refresh posterior no debe
    // desmontar las pantallas (perdería formularios a medio rellenar).
    if (loadedUserId.current !== sess.session.user.id) setLoading(true);

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      supabase.from("profiles").select("is_super_admin").eq("id", sess.session.user.id).maybeSingle(),
      supabase.from("business_users").select("business_id").eq("user_id", sess.session.user.id),
    ]);
    setIsSuperAdmin(!!profile?.is_super_admin);

    const ids = (memberships ?? []).map((m) => m.business_id);
    if (ids.length) {
      const { data: bizs } = await supabase.from("businesses").select("*").in("id", ids).order("name");
      setBusinesses(bizs ?? []);
      setActiveId((prev) => prev ?? bizs?.[0]?.id ?? null);
    } else {
      setBusinesses([]);
    }
    loadedUserId.current = sess.session.user.id;
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT" || !s) {
        loadedUserId.current = null;
        setIsSuperAdmin(false); setBusinesses([]); setActiveId(null); setLoading(false);
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // supabase-js emite SIGNED_IN también cada vez que la pestaña vuelve a estar visible.
        // Solo recargamos perfil/negocios si es un usuario distinto al ya cargado.
        if (loadedUserId.current !== s.user.id) loadProfile();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line
  }, []);

  const business = businesses.find((b) => b.id === activeId) ?? businesses[0] ?? null;

  const value: AuthState = {
    session, loading, isSuperAdmin, business, businesses,
    refresh: loadProfile,
    signOut: async () => { await supabase.auth.signOut(); },
    setActiveBusiness: setActiveId,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fuera de AuthProvider");
  return c;
}
