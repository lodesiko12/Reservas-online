import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { InstallAppButton } from "./InstallAppButton";

export type NavItem = { to: string; label: string; icon: string; end?: boolean; badge?: number };

const COLLAPSE_KEY = "turnigo:sidebar-collapsed";

/** `mobileTabs`: barra inferior fija en móvil (para uso con el pulgar); el resto va en el menú «Más». */
export function Layout({ nav, brandLabel, mobileTabs }: { nav: NavItem[]; brandLabel: string; mobileTabs?: NavItem[] }) {
  const { signOut, session, business, businesses, setActiveBusiness } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* localStorage no disponible */
    }
  }, [collapsed]);

  // Cierra el menú móvil al navegar a otra página.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function SidebarContent({ isCollapsed, onNavigate }: { isCollapsed: boolean; onNavigate?: () => void }) {
    return (
      <>
        <div className={`h-16 shrink-0 flex items-center border-b border-slate-200 dark:border-slate-800 ${isCollapsed ? "justify-center px-2" : "gap-2 px-5"}`}>
          <img src="/brand/turnigo-icono.svg" alt="" className="h-8 w-8 shrink-0" />
          {!isCollapsed && <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{brandLabel}</span>}
        </div>

        {!isCollapsed && businesses.length > 1 && business && (
          <div className="px-3 pt-3">
            <select
              className="input text-sm"
              value={business.id}
              onChange={(e) => setActiveBusiness(e.target.value)}
            >
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              title={isCollapsed ? n.label : undefined}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isCollapsed ? "justify-center" : ""} ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span className="text-base w-5 text-center shrink-0 relative">
                {n.icon}
                {!!n.badge && isCollapsed && <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-coral-500" />}
              </span>
              {!isCollapsed && n.label}
              {!isCollapsed && !!n.badge && <span className="ml-auto badge bg-coral-500 text-white">{n.badge > 99 ? "99+" : n.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`border-t border-slate-200 dark:border-slate-800 p-3 space-y-2 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          <button
            className={`btn-ghost ${isCollapsed ? "w-auto px-2.5" : "w-full justify-start"}`}
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            <span>{theme === "dark" ? "☀️" : "🌙"}</span>
            {!isCollapsed && (theme === "dark" ? "Modo claro" : "Modo oscuro")}
          </button>

          {!isCollapsed && <InstallAppButton />}

          {!isCollapsed && (
            <div className="px-2 pt-1 text-xs text-slate-400 dark:text-slate-500 truncate">{session?.user.email}</div>
          )}
          <button
            className={`btn-ghost ${isCollapsed ? "w-auto px-2.5" : "w-full justify-start"}`}
            onClick={signOut}
            title="Cerrar sesión"
          >
            <span>↩</span> {!isCollapsed && "Cerrar sesión"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar de escritorio: fija a la ventana, plegable */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 transition-[width] duration-200 relative ${
          collapsed ? "w-[76px]" : "w-60"
        }`}
      >
        <SidebarContent isCollapsed={collapsed} />
        <button
          className="absolute -right-3 top-[52px] h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-500 shadow grid place-items-center text-xs hover:text-brand-600 hover:border-brand-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menú" : "Plegar menú"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </aside>

      {/* Menú móvil: overlay a pantalla completa */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[82vw] h-full flex flex-col bg-white dark:bg-slate-900 shadow-xl">
            <SidebarContent isCollapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar móvil/tablet */}
        <header className="lg:hidden h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 sticky top-0 z-30">
          <button
            className="h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <img src="/brand/turnigo-icono.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{brandLabel}</span>
          <button
            className="ml-auto h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </header>

        <main className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full ${mobileTabs ? "pb-28 lg:pb-8" : ""}`}>
          <Outlet />
        </main>
      </div>

      {/* Barra inferior móvil */}
      {mobileTabs && (
        <nav style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-800 grid pb-[env(safe-area-inset-bottom)]">
          {mobileTabs.map((n) => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold relative ${isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`}
            >
              <span className="text-xl leading-none relative">
                {n.icon}
                {!!n.badge && <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] grid place-items-center">{n.badge > 99 ? "99+" : n.badge}</span>}
              </span>
              {n.label}
            </NavLink>
          ))}
          <button className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400" onClick={() => setMobileOpen(true)}>
            <span className="text-xl leading-none">☰</span>Más
          </button>
        </nav>
      )}
    </div>
  );
}
