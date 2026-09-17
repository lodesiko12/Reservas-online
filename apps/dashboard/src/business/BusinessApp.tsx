import { Routes, Route, Navigate } from "react-router-dom";
import { Layout, type NavItem } from "../components/Layout";
import { useAuth } from "../lib/auth";
import { Dashboard } from "./Dashboard";
import { Agenda } from "./Agenda";
import { NuevaReserva } from "./NuevaReserva";
import { Clientes } from "./Clientes";
import { Bloqueos } from "./Bloqueos";
import { Servicios } from "./Servicios";
import { Reportes } from "./Reportes";
import { Configuracion } from "./Configuracion";
import { Franjas } from "./Franjas";
import { Mesas } from "./Mesas";

export function BusinessApp() {
  const { business } = useAuth();
  const isRestaurant = business?.type === "restaurante";

  const nav: NavItem[] = [
    { to: "/app", label: "Resumen", icon: "📊", end: true },
    { to: "/app/agenda", label: "Agenda", icon: "🗓️" },
    { to: "/app/nueva", label: "Nueva reserva", icon: "➕" },
    { to: "/app/clientes", label: "Clientes", icon: "👤" },
    isRestaurant
      ? { to: "/app/franjas", label: "Franjas y aforo", icon: "🍽️" }
      : { to: "/app/servicios", label: "Servicios", icon: "✂️" },
    ...(isRestaurant ? [{ to: "/app/mesas", label: "Mesas y zonas", icon: "🪑" }] : []),
    { to: "/app/bloqueos", label: "Bloqueos", icon: "🚫" },
    { to: "/app/reportes", label: "Reportes", icon: "📈" },
    { to: "/app/config", label: "Configuración", icon: "⚙️" },
  ];

  return (
    <Routes>
      <Route element={<Layout nav={nav} brandLabel={business?.name ?? "Panel"} />}>
        <Route index element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="nueva" element={<NuevaReserva />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="servicios" element={<Servicios />} />
        <Route path="franjas" element={<Franjas />} />
        <Route path="mesas" element={<Mesas />} />
        <Route path="bloqueos" element={<Bloqueos />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="config" element={<Configuracion />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}
