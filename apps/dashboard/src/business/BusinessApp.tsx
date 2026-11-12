import { useEffect, useRef } from "react";
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
import { Pagos } from "./Pagos";
import { Produccion } from "./Produccion";
import { Catalogo } from "./Catalogo";
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
import { Carta } from "./Carta";
import { Pedidos } from "./Pedidos";
import { Mensajes } from "./mensajes/Mensajes";
import { useWhatsappRealtime, useWaUnread } from "./mensajes/hooks";
import { useNewOrdersCount } from "./hooks";
import { isOrderSoundOn, playOrderBeep } from "../lib/orderAlert";

export function BusinessApp() {
  const { business } = useAuth();
  const isRestaurant = business?.type === "restaurante";
  const isPsicologo = business?.type === "psicologo";
  const isAutonomo = business?.type === "autonomo";
  const isAsesoria = business?.type === "asesoria";
  const isOrder = !!business?.order_mode && !isRestaurant && !isPsicologo;
  // Restaurante con pedidos online para llevar: sección Pedidos (con globo de nuevos) y Carta.
  const takeaway = isRestaurant && !!business?.online_orders;
  const newOrders = useNewOrdersCount(takeaway);
  const prevNew = useRef<number | null>(null);
  useEffect(() => {
    if (!takeaway) { prevNew.current = null; return; }
    if (prevNew.current !== null && newOrders > prevNew.current && isOrderSoundOn()) playOrderBeep();
    prevNew.current = newOrders;
  }, [newOrders, takeaway]);
  // Buzón de WhatsApp (módulo opcional por negocio): globo de no leídos y actualización en vivo.
  const inbox = !!business?.whatsapp_inbox_enabled && business?.type !== "agencia";
  useWhatsappRealtime(inbox);
  const waUnread = useWaUnread(inbox);
  const mensajesNav: NavItem[] = inbox ? [{ to: "/app/mensajes", label: "Mensajes", icon: "💬", badge: waUnread }] : [];
  if (business?.type === "agencia") return <AgenciaApp />;

  const nav: NavItem[] = isAsesoria
    ? [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        { to: "/app/sin-clasificar", label: "Sin clasificar", icon: "📥" },
        ...mensajesNav,
        { to: "/app/config", label: "Configuración", icon: "⚙️" },
      ]
    : isAutonomo
    ? [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        { to: "/app/pipeline", label: "Pipeline", icon: "🗂️" },
        { to: "/app/agenda", label: "Agenda", icon: "🗓️" },
        ...mensajesNav,
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        { to: "/app/presupuestos", label: "Presupuestos", icon: "📝" },
        { to: "/app/facturas", label: "Facturas", icon: "🧾" },
        { to: "/app/config", label: "Configuración", icon: "⚙️" },
      ]
    : [
        { to: "/app", label: "Resumen", icon: "📊", end: true },
        ...(isRestaurant ? [{ to: "/app/plano", label: "Plano de sala", icon: "🟢" }] : []),
        ...(takeaway ? [{ to: "/app/pedidos", label: "Pedidos", icon: "🛍️", badge: newOrders }] : []),
        { to: "/app/agenda", label: "Agenda", icon: "🗓️" },
        ...mensajesNav,
        { to: "/app/nueva", label: isOrder ? "Nuevo encargo" : "Nueva reserva", icon: "➕" },
        ...(isOrder ? [{ to: "/app/produccion", label: "Producción", icon: "🍰" }] : []),
        { to: "/app/clientes", label: "Clientes", icon: "👤" },
        ...(isPsicologo ? [{ to: "/app/seguimiento", label: "Seguimiento", icon: "🩺" }, { to: "/app/pagos", label: "Pagos", icon: "💶" }] : []),
        isRestaurant
          ? { to: "/app/franjas", label: "Franjas y aforo", icon: "🍽️" }
          : isOrder
          ? { to: "/app/catalogo", label: "Catálogo", icon: "📒" }
          : { to: "/app/servicios", label: "Servicios", icon: "✂️" },
        ...(isRestaurant ? [{ to: "/app/mesas", label: "Mesas y zonas", icon: "🪑" }] : []),
        ...(takeaway ? [{ to: "/app/carta", label: "Carta", icon: "📖" }] : []),
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
            {inbox && <Route path="mensajes" element={<Mensajes />} />}
            <Route path="config" element={<ConfiguracionAsesoria />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </>
        ) : isAutonomo ? (
          <>
            <Route index element={<ResumenAutonomo />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="agenda" element={<AgendaInterna />} />
            {inbox && <Route path="mensajes" element={<Mensajes />} />}
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
            {inbox && <Route path="mensajes" element={<Mensajes />} />}
            <Route path="nueva" element={<NuevaReserva />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="seguimiento" element={<Seguimiento />} />
            {isPsicologo && <Route path="pagos" element={<Pagos />} />}
            <Route path="servicios" element={<Servicios />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="produccion" element={<Produccion />} />
            <Route path="franjas" element={<Franjas />} />
            <Route path="mesas" element={<Mesas />} />
            {takeaway && <Route path="pedidos" element={<Pedidos />} />}
            {takeaway && <Route path="carta" element={<Carta />} />}
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
