import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";

export type NavItem = { to: string; label: string; icon: string; end?: boolean };

const COLLAPSE_KEY = "turnigo:sidebar-collapsed";

export function Layout({ nav, brandLabel }: { nav: NavItem[]; brandLabel: string }) {
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
          <div className="h-8 w-8 shrink-0 rounded-lg bg-brand-500 grid place-items-center text-white font-bold">T</div>
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
              <span className="text-base w-5 text-center shrink-0">{n.icon}</span>
              {!isCollapsed && n.label}
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
      {/* Sidebar de escritorio: estática, plegable */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-slate-200 dark:bg-slate-900 dark:border-slate-800 transition-[width] duration-200 relative ${
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
          <div className="h-7 w-7 shrink-0 rounded-lg bg-brand-500 grid place-items-center text-white font-bold text-sm">T</div>
          <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{brandLabel}</span>
          <button
            className="ml-auto h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </header>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
