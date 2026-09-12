import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

export type NavItem = { to: string; label: string; icon: string; end?: boolean };

export function Layout({ nav, brandLabel }: { nav: NavItem[]; brandLabel: string }) {
  const { signOut, session, business, businesses, setActiveBusiness } = useAuth();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <div className="h-8 w-8 rounded-lg bg-brand-500 grid place-items-center text-white font-bold">T</div>
          <span className="font-bold text-slate-800">{brandLabel}</span>
        </div>

        {businesses.length > 1 && business && (
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

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <span className="text-base w-5 text-center">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-2 pb-2 text-xs text-slate-400 truncate">{session?.user.email}</div>
          <button className="btn-ghost w-full justify-start" onClick={signOut}>
            <span>↩</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
}
