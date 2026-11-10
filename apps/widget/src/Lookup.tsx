import { useEffect, useState } from "react";
import { lookupBooking, cancelBooking, lookupOrder, cancelOrder, type BookingLookup, type OrderLookup } from "./api";
import { formatDate, formatTime, formatCurrency, STATUS_LABEL, STATUS_COLOR, ORDER_STATUS_LABEL } from "@reservas/shared";

const TAKEAWAY_LABEL: Record<OrderLookup["status"], string> = {
  nuevo: "Recibido", preparando: "En preparación", listo: "Listo para recoger", entregado: "Entregado", cancelado: "Cancelado",
};
const TAKEAWAY_COLOR: Record<OrderLookup["status"], string> = {
  nuevo: "#d97706", preparando: "#2563eb", listo: "#7c3aed", entregado: "#16a34a", cancelado: "#64748b",
};

export function Lookup({ initialLocator, onBack, orderMode = false, takeaway = false }: { initialLocator: string; onBack: () => void; orderMode?: boolean; takeaway?: boolean }) {
  const [code, setCode] = useState(initialLocator);
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [order, setOrder] = useState<OrderLookup | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(c: string) {
    setError(null); setLoading(true); setBooking(null); setOrder(null); setConfirmingCancel(false);
    try {
      const b = await lookupBooking(c);
      setBooking(b);
      if (!b && takeaway) {
        const o = await lookupOrder(c);
        setOrder(o);
        if (!o) setError("No encontramos ninguna reserva ni pedido con ese código.");
      } else if (!b) {
        setError(orderMode ? "No encontramos ningún encargo con ese código." : "No encontramos ninguna reserva con ese código.");
      }
    } catch (e: any) {
      setError(e.message ?? (orderMode ? "Error al buscar el encargo." : "Error al buscar la reserva."));
    } finally {
      setLoading(false); setSearched(true);
    }
  }

  useEffect(() => { if (initialLocator) search(initialLocator); /* eslint-disable-next-line */ }, []);

  async function doCancelOrder() {
    if (!order) return;
    setCancelling(true); setError(null);
    try {
      await cancelOrder(order.locator);
      await search(order.locator);
    } catch (e: any) {
      setError(e.message ?? "No se pudo cancelar el pedido.");
      setConfirmingCancel(false);
    } finally {
      setCancelling(false);
    }
  }

  async function doCancel() {
    if (!booking) return;
    if (!confirm(orderMode ? "¿Seguro que quieres cancelar este encargo?" : "¿Seguro que quieres cancelar esta reserva?")) return;
    setCancelling(true); setError(null);
    try {
      await cancelBooking(booking.locator);
      await search(booking.locator);
    } catch (e: any) {
      setError(e.message ?? "No se pudo cancelar.");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = booking && (booking.status === "confirmada" || booking.status === "pendiente") && new Date(booking.starts_at) > new Date();

  return (
    <>
      <div className="field">
        <label>Código localizador</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="AB-XXXXXX"
          onKeyDown={(e) => e.key === "Enter" && code.trim() && search(code)}
        />
      </div>
      <button className="btn" disabled={!code.trim() || loading} onClick={() => search(code)}>
        {loading ? "Buscando…" : orderMode ? "Buscar encargo" : takeaway ? "Buscar reserva o pedido" : "Buscar reserva"}
      </button>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {booking && (
        <div style={{ marginTop: 16 }}>
          <div className="summary">
            <div className="line">
              <span className="k">Estado</span>
              <span className="badge" style={{ background: STATUS_COLOR[booking.status] }}>
                {(orderMode || booking.order_mode ? ORDER_STATUS_LABEL : STATUS_LABEL)[booking.status] ?? booking.status}
              </span>
            </div>
            <div className="line"><span className="k">Negocio</span><span>{booking.business_name}</span></div>
            {booking.order_mode ? (
              <>
                {booking.option_label && <div className="line"><span className="k">Sabor</span><span>{booking.option_label}</span></div>}
                {booking.size_label && <div className="line"><span className="k">Tamaño</span><span>{booking.size_label}</span></div>}
              </>
            ) : (
              booking.service_name && <div className="line"><span className="k">Servicio</span><span>{booking.service_name}</span></div>
            )}
            <div className="line"><span className="k">{booking.order_mode ? "Día de recogida" : "Fecha"}</span><span>{formatDate(booking.starts_at, booking.timezone)}</span></div>
            <div className="line"><span className="k">{booking.order_mode ? "Hora de recogida" : "Hora"}</span><span>{formatTime(booking.starts_at, booking.timezone)}</span></div>
            <div className="line"><span className="k">A nombre de</span><span>{booking.customer_name}</span></div>
          </div>
          {canCancel && (
            <button className="btn danger" disabled={cancelling} onClick={doCancel}>
              {cancelling ? "Cancelando…" : orderMode ? "Cancelar encargo" : "Cancelar reserva"}
            </button>
          )}
          {booking.status === "cancelada" && <p className="hint center">{orderMode ? "Este encargo está cancelado." : "Esta reserva está cancelada."}</p>}
          {booking.status === "listo" && <p className="hint center">¡Tu encargo está listo! Puedes pasar a recogerlo.</p>}
        </div>
      )}

      {order && (
        <div style={{ marginTop: 16 }}>
          <div className="summary">
            <div className="line">
              <span className="k">Estado</span>
              <span className="badge" style={{ background: TAKEAWAY_COLOR[order.status] }}>{TAKEAWAY_LABEL[order.status] ?? order.status}</span>
            </div>
            <div className="line"><span className="k">Negocio</span><span>{order.business_name}</span></div>
            <div className="line"><span className="k">Día de recogida</span><span>{formatDate(order.pickup_at, order.timezone)}</span></div>
            <div className="line"><span className="k">Hora de recogida</span><span>{formatTime(order.pickup_at, order.timezone)}</span></div>
            <div className="line"><span className="k">A nombre de</span><span>{order.customer_name}</span></div>
          </div>
          <div className="summary">
            {order.items.map((i, n) => (
              <div key={n} className="cart-line">
                <div className="cl-main">
                  <div className="cl-name">{i.quantity}× {i.name}</div>
                  {i.modifiers.length > 0 && <div className="cl-meta">{i.modifiers.map((m) => m.name).join(" · ")}</div>}
                  {i.notes && <div className="cl-meta">“{i.notes}”</div>}
                </div>
                <div className="cl-price">{formatCurrency(i.line_total)}</div>
              </div>
            ))}
            <div className="line cart-total"><span className="k">Total (pago en el local)</span><span><strong>{formatCurrency(order.total)}</strong></span></div>
          </div>
          {order.status === "nuevo" && !confirmingCancel && (
            <button className="btn danger" onClick={() => setConfirmingCancel(true)}>Cancelar pedido</button>
          )}
          {order.status === "nuevo" && confirmingCancel && (
            <>
              <p className="hint center">¿Seguro que quieres cancelar este pedido?</p>
              <div className="btn-row">
                <button className="btn secondary" disabled={cancelling} onClick={() => setConfirmingCancel(false)}>No, mantenerlo</button>
                <button className="btn danger" disabled={cancelling} onClick={doCancelOrder}>{cancelling ? "Cancelando…" : "Sí, cancelar"}</button>
              </div>
            </>
          )}
          {order.status === "preparando" && <p className="hint center">Tu pedido ya se está preparando. Si necesitas cambiarlo, llama al local.</p>}
          {order.status === "listo" && <p className="hint center">¡Tu pedido está listo! Puedes pasar a recogerlo.</p>}
          {order.status === "cancelado" && <p className="hint center">Este pedido está cancelado.</p>}
        </div>
      )}

      <div className="footer-link">
        <button onClick={onBack}>{orderMode ? "← Volver a encargar" : takeaway ? "← Volver" : "← Volver a reservar"}</button>
      </div>
    </>
  );
}
