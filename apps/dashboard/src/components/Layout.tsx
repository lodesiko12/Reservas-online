import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { InstallAppButton } from "./InstallAppButton";
import { NavIcon } from "./NavIcon";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Moon, Sun } from "lucide-react";

/** `group`: título de sección; se muestra cuando cambia respecto al elemento anterior. */
export type NavItem = { to: string; label: string; icon: string; end?: boolean; badge?: number; group?: string };

const COLLAPSE_KEY = "turnigo:sidebar-collapsed";

/**
 * `mobileTabs`: barra inferior fija en móvil (para uso con el pulgar); el resto va en el menú «Más».
 * `action`: botón destacado fijo encima del menú (p. ej. «+ Nueva cita»).
 */
export function Layout({ nav, brandLabel, mobileTabs, action }: { nav: NavItem[]; brandLabel: string; mobileTabs?: NavItem[]; action?: NavItem }) {
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
        <div className={`h-16 shrink-0 flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
          <img src="/brand/turnigo-icono-negativo.svg" alt="" className="h-8 w-8 shrink-0 dark:hidden" />
          <img src="/brand/turnigo-icono.svg" alt="" className="h-8 w-8 shrink-0 hidden dark:block" />
          {!isCollapsed && <span className="tg-display text-[17px] text-white truncate">{brandLabel}</span>}
        </div>

        {!isCollapsed && businesses.length > 1 && business && (
          <div className="px-3 pt-3">
            <select
              className="input text-sm !bg-white/10 !border-white/20 !text-white focus:!border-white/50"
              value={business.id}
              onChange={(e) => setActiveBusiness(e.target.value)}
            >
              {businesses.map((b) => <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>)}
            </select>
          </div>
        )}

        {action && (
          <div className="px-3 pt-3">
            <NavLink
              to={action.to}
              onClick={onNavigate}
              title={isCollapsed ? action.label : undefined}
              className={`btn w-full bg-white text-brand-600 hover:bg-brand-50 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-400 dark:ring-1 dark:ring-white/15 ${isCollapsed ? "px-0 justify-center" : ""}`}
            >
              <NavIcon icon={action.icon} size={16} />
              {!isCollapsed && action.label}
            </NavLink>
          </div>
        )}

        <nav className="sidebar-scroll flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n, i) => {
            const newGroup = !!n.group && n.group !== nav[i - 1]?.group;
            return (
              <div key={n.to}>
                {newGroup && (isCollapsed
                  ? (i > 0 && <div className="my-2 border-t border-white/10" />)
                  : <div className={`px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/55 ${i > 0 ? "pt-5" : "pt-1"}`}>{n.group}</div>)}
                <NavLink
                  to={n.to}
                  end={n.end}
                  title={isCollapsed ? n.label : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-200 ${isCollapsed ? "justify-center" : ""} ${
                      isActive
                        ? "bg-white/[.13] text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-coral-500"
                        : "text-white/70 hover:bg-white/[.08] hover:text-white"
                    }`
                  }
                >
                  <span className="w-5 shrink-0 grid place-items-center relative">
                    <NavIcon icon={n.icon} />
                    {!!n.badge && isCollapsed && <span className="absolute -top-1 -right-2 h-2.5 w-2.5 rounded-full bg-coral-500" />}
                  </span>
                  {!isCollapsed && n.label}
                  {!isCollapsed && !!n.badge && <span className="ml-auto badge bg-coral-500 text-white">{n.badge > 99 ? "99+" : n.badge}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className={`border-t border-white/10 p-3 space-y-1 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          <button
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/[.08] hover:text-white transition-colors duration-200 ${isCollapsed ? "justify-center px-2.5" : "w-full"}`}
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            {theme === "dark" ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            {!isCollapsed && (theme === "dark" ? "Modo claro" : "Modo oscuro")}
          </button>

          {!isCollapsed && <InstallAppButton className="btn w-full justify-start !bg-transparent !text-white/70 hover:!bg-white/[.08] hover:!text-white" />}

          {!isCollapsed && (
            <div className="px-2 pt-1 text-xs text-white/55 truncate">{session?.user.email}</div>
          )}
          <button
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/[.08] hover:text-white transition-colors duration-200 ${isCollapsed ? "justify-center px-2.5" : "w-full"}`}
            onClick={signOut}
            title="Cerrar sesión"
          >
            <LogOut size={18} strokeWidth={1.75} /> {!isCollapsed && "Cerrar sesión"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar de escritorio: fija a la ventana, plegable */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-brand-700 dark:bg-ink border-r border-black/10 dark:border-white/5 transition-[width] duration-300 ease-[cubic-bezier(.22,.8,.3,1)] relative ${
          collapsed ? "w-[76px]" : "w-60"
        }`}
      >
        <SidebarContent isCollapsed={collapsed} />
        <button
          className="absolute -right-3 top-[52px] h-6 w-6 rounded-full border border-slate-200 bg-white text-slate-500 shadow-card grid place-items-center hover:text-brand-600 hover:border-brand-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menú" : "Plegar menú"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </aside>

      {/* Menú móvil: overlay a pantalla completa */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[82vw] h-full flex flex-col bg-brand-700 dark:bg-ink shadow-xl">
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
            <Menu size={18} />
          </button>
          <img src="/brand/turnigo-icono.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="tg-display text-[17px] text-slate-800 dark:text-slate-100 truncate">{brandLabel}</span>
          <button
            className="ml-auto h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full ${mobileTabs ? "pb-28 lg:pb-8" : ""}`}>
          <div key={location.pathname} className="tg-page"><Outlet /></div>
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
              <span className="leading-none relative">
                <NavIcon icon={n.icon} size={22} />
                {!!n.badge && <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-coral-500 text-white text-[10px] grid place-items-center">{n.badge > 99 ? "99+" : n.badge}</span>}
              </span>
              {n.label}
            </NavLink>
          ))}
          <button className="flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400" onClick={() => setMobileOpen(true)}>
            <span className="leading-none"><Menu size={22} strokeWidth={1.75} /></span>Más
          </button>
        </nav>
      )}
    </div>
  );
}
