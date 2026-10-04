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
import { PlanoSala } from "./PlanoSala";
import { Seguimiento } from "./Seguimiento";
import { ResumenAutonomo } from "./crm/ResumenAutonomo";
import { Pipeline } from "./crm/Pipeline";
import { AgendaInterna } from "./crm/AgendaInterna";
import { Presupuestos } from "./crm/Presupuestos";
import { Facturas } from "./crm/Facturas";
import { ResumenAsesoria } from "./asesoria/ResumenAsesoria";
import { Clientes as ClientesAsesoria } from "./asesoria/Clientes";
import { FichaCliente } from "./asesoria/FichaCliente";
import { SinClasificar } from "./asesoria/SinClasificar";
import { ConfiguracionAsesoria } from "./asesoria/ConfiguracionAsesoria";
import { AgenciaApp } from "./agencia/AgenciaApp";

export function BusinessApp() {
  const { business } = useAuth();
  const isRestaurant = business?.type === "restaurante";
  const isPsicologo = business?.type === "psicologo";
  const isAutonomo = business?.type === "autonomo";
  const isAsesoria = business?.type === "asesoria";
  if (business?.type === "agencia") return <AgenciaApp />;

  const nav: NavItem[] = isAsesoria
    ? [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        { to: "/app/sin-clasificar", label: "Sin clasificar", icon: "📥" },
        { to: "/app/config", label: "Configuración", icon: "⚙️" },
      ]
    : isAutonomo
    ? [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        { to: "/app/pipeline", label: "Pipeline", icon: "🗂️" },
        { to: "/app/agenda", label: "Agenda", icon: "🗓️" },
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        { to: "/app/presupuestos", label: "Presupuestos", icon: "📝" },
        { to: "/app/facturas", label: "Facturas", icon: "🧾" },
        { to: "/app/config", label: "Configuración", icon: "⚙️" },
      ]
    : [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        ...(isRestaurant ? [{ to: "/app/plano", label: "Plano de sala", icon: "🟢" }] : []),
        { to: "/app/agenda", label: "Agenda", icon: "🗓️" },
        { to: "/app/nueva", label: "Nueva reserva", icon: "➕" },
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        ...(isPsicologo ? [{ to: "/app/seguimiento", label: "Seguimiento", icon: "🩺" }] : []),
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
        {isAsesoria ? (
          <>
            <Route index element={<ResumenAsesoria />} />
            <Route path="clientes" element={<ClientesAsesoria />} />
            <Route path="clientes/:id" element={<FichaCliente />} />
            <Route path="sin-clasificar" element={<SinClasificar />} />
            <Route path="config" element={<ConfiguracionAsesoria />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : isAutonomo ? (
          <>
            <Route index element={<ResumenAutonomo />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="agenda" element={<AgendaInterna />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="presupuestos" element={<Presupuestos />} />
            <Route path="facturas" element={<Facturas />} />
            <Route path="config" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : (
          <>
            <Route index element={<Dashboard />} />
            <Route path="plano" element={<PlanoSala />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="nueva" element={<NuevaReserva />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="seguimiento" element={<Seguimiento />} />
            <Route path="servicios" element={<Servicios />} />
            <Route path="franjas" element={<Franjas />} />
            <Route path="mesas" element={<Mesas />} />
            <Route path="bloqueos" element={<Bloqueos />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="config" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}
