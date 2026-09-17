import { useEffect, useState } from "react";
import { lookupBooking, cancelBooking, type BookingLookup } from "./api";
import { formatDate, formatTime, STATUS_LABEL, STATUS_COLOR } from "@reservas/shared";

export function Lookup({ initialLocator, onBack }: { initialLocator: string; onBack: () => void }) {
  const [code, setCode] = useState(initialLocator);
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(c: string) {
    setError(null); setLoading(true); setBooking(null);
    try {
      const b = await lookupBooking(c);
      setBooking(b);
      if (!b) setError("No encontramos ninguna reserva con ese código.");
    } catch (e: any) {
      setError(e.message ?? "Error al buscar la reserva.");
    } finally {
      setLoading(false); setSearched(true);
    }
  }

  useEffect(() => { if (initialLocator) search(initialLocator); /* eslint-disable-next-line */ }, []);

  async function doCancel() {
    if (!booking) return;
    if (!confirm("¿Seguro que quieres cancelar esta reserva?")) return;
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
        {loading ? "Buscando…" : "Buscar reserva"}
      </button>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {booking && (
        <div style={{ marginTop: 16 }}>
          <div className="summary">
            <div className="line">
              <span className="k">Estado</span>
              <span className="badge" style={{ background: STATUS_COLOR[booking.status] }}>
                {STATUS_LABEL[booking.status]}
              </span>
            </div>
            <div className="line"><span className="k">Negocio</span><span>{booking.business_name}</span></div>
            {booking.service_name && <div className="line"><span className="k">Servicio</span><span>{booking.service_name}</span></div>}
            <div className="line"><span className="k">Fecha</span><span>{formatDate(booking.starts_at, booking.timezone)}</span></div>
            <div className="line"><span className="k">Hora</span><span>{formatTime(booking.starts_at, booking.timezone)}</span></div>
            <div className="line"><span className="k">A nombre de</span><span>{booking.customer_name}</span></div>
          </div>
          {canCancel && (
            <button className="btn danger" disabled={cancelling} onClick={doCancel}>
              {cancelling ? "Cancelando…" : "Cancelar reserva"}
            </button>
          )}
          {booking.status === "cancelada" && <p className="hint center">Esta reserva está cancelada.</p>}
        </div>
      )}

      <div className="footer-link">
        <button onClick={onBack}>← Volver a reservar</button>
      </div>
    </>
  );
}
