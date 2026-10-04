import { Routes, Route, Navigate } from "react-router-dom";
import { Layout, type NavItem } from "../../components/Layout";
import { Spinner } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useAgencyMe } from "./hooks";
import { MiPanel, PanelGlobal } from "./Paneles";
import { Equipos, EquipoDetalle } from "./Equipos";
import { Calendario } from "./Calendario";
import { Avisos, useUnreadCount } from "./Avisos";
import { Miembros } from "./Miembros";

/** Panel del tipo de negocio "agencia": equipos, tareas, calendario, documentos y avisos. */
export function AgenciaApp() {
  const { business, signOut } = useAuth();
  const { loading, active, isDirectiva } = useAgencyMe();
  const unread = useUnreadCount();

  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (!active) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-8 max-w-md">
          <h1 className="text-lg font-bold mb-2">Cuenta desactivada</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Tu acceso a {business?.name} no está activo. Habla con la directiva si crees que es un error.</p>
          <button className="btn-ghost mt-4" onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  const nav: NavItem[] = [
    { to: "/app", label: "Mi panel", icon: "🏠", end: true },
    ...(isDirectiva ? [{ to: "/app/panel", label: "Panel global", icon: "📊" }] : []),
    { to: "/app/equipos", label: "Equipos", icon: "👥" },
    { to: "/app/calendario", label: "Calendario", icon: "📅" },
    { to: "/app/avisos", label: "Avisos", icon: "🔔", badge: unread },
    ...(isDirectiva ? [{ to: "/app/miembros", label: "Miembros", icon: "🧑‍🤝‍🧑" }] : []),
  ];
  const tabs: NavItem[] = [nav[0], nav.find((n) => n.to === "/app/equipos")!, nav.find((n) => n.to === "/app/calendario")!, nav.find((n) => n.to === "/app/avisos")!];

  return (
    <Routes>
      <Route element={<Layout nav={nav} mobileTabs={tabs} brandLabel={business?.name ?? "Agrupación"} />}>
        <Route index element={<MiPanel />} />
        <Route path="panel" element={<PanelGlobal />} />
        <Route path="equipos" element={<Equipos />} />
        <Route path="equipos/:teamId" element={<EquipoDetalle />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="miembros" element={<Miembros />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}
