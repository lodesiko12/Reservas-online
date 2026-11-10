import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ymdInTz, addDaysYmd, zonedDayRange, formatTime, formatCurrency } from "@reservas/shared";
import { useOrders, useTakeawaySettings, type OrderRow } from "./hooks";
import { PageHeader, Spinner, ConfirmDialog, EmptyState } from "../components/ui";
import { isOrderSoundOn, setOrderSoundOn, playOrderBeep } from "../lib/orderAlert";

type Status = OrderRow["status"];
type Range = "hoy" | "proximos" | "dia";

const STATUS_TEXT: Record<string, string> = {
  nuevo: "Nuevo", preparando: "En preparación", listo: "Listo", entregado: "Entregado", cancelado: "Cancelado",
};
const STATUS_STYLE: Record<string, string> = {
  nuevo: "bg-amber-100 text-amber-700",
  preparando: "bg-sky-100 text-sky-700",
  listo: "bg-purple-100 text-purple-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-slate-100 text-slate-500",
};

function waLink(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 9) return null;
  return `https://wa.me/${d.length === 9 ? "34" + d : d}`;
}

/** Pedidos para llevar en tiempo real: aceptar → preparando → listo → entregado. */
export function Pedidos() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  const tz = business?.timezone ?? "Europe/Madrid";
  const qc = useQueryClient();
  const today = ymdInTz(new Date(), tz);
  const [range, setRange] = useState<Range>("hoy");
  const [day, setDay] = useState(today);
  const [sound, setSound] = useState(isOrderSoundOn());
  const [toast, setToast] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OrderRow | null>(null);
  const [printing, setPrinting] = useState<OrderRow | null>(null);

  const [from, to] = useMemo(() => {
    if (range === "hoy") return zonedDayRange(today, tz);
    if (range === "proximos") return [zonedDayRange(today, tz)[0], zonedDayRange(addDaysYmd(today, 14), tz)[1]] as [string, string];
    return zonedDayRange(day, tz);
  }, [range, day, today, tz]);

  const { data: orders, isLoading } = useOrders(from, to);
  const { data: settings } = useTakeawaySettings();

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2400); }
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["orders", bid] });
    qc.invalidateQueries({ queryKey: ["orders-new", bid] });
  };

  async function setStatus(o: OrderRow, status: Status) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) flash(error.message); else refresh();
  }
  async function toggleAccepting(v: boolean) {
    const { error } = await supabase.from("takeaway_settings").update({ accepting: v }).eq("business_id", bid);
    if (error) flash(error.message);
    else { qc.invalidateQueries({ queryKey: ["takeaway_settings", bid] }); flash(v ? "Pedidos online activados" : "Pedidos online en pausa"); }
  }

  // Imprime la comanda en cuanto se monta el ticket.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printing]);

  const list = orders ?? [];
  const by = (s: Status) => list.filter((o) => o.status === s);
  const closed = list.filter((o) => o.status === "entregado" || o.status === "cancelado");
  const multiDay = range === "proximos";

  const whenLabel = (o: OrderRow) => {
    const t = formatTime(o.pickup_at, tz);
    const ymd = ymdInTz(new Date(o.pickup_at), tz);
    if (!multiDay || ymd === today) return t;
    const d = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(o.pickup_at));
    return `${d} · ${t}`;
  };

  function Card({ o }: { o: OrderRow }) {
    const wa = waLink(o.customer_phone);
    return (
      <div className="card p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold tabular-nums">{whenLabel(o)}</div>
            <div className="font-semibold">{o.customer_name} {o.customer_last_name ?? ""}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-3 flex-wrap">
              <a className="hover:underline" href={`tel:${o.customer_phone}`}>📞 {o.customer_phone}</a>
              {wa && <a className="hover:underline" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
              <span>{o.locator}</span>
            </div>
          </div>
          <span className={`badge ${STATUS_STYLE[o.status]}`}>{STATUS_TEXT[o.status]}</span>
        </div>

        <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800">
          {o.order_items.map((i) => {
            const mods = (i.modifiers as unknown as { name: string }[]) ?? [];
            return (
              <li key={i.id} className="py-1.5 flex justify-between gap-3">
                <div>
                  <span className="font-semibold">{i.quantity}×</span> {i.name}
                  {mods.length > 0 && <div className="text-xs text-slate-500 dark:text-slate-400">{mods.map((m) => m.name).join(" · ")}</div>}
                  {i.notes && <div className="text-xs text-amber-700 dark:text-amber-400">“{i.notes}”</div>}
                </div>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">{formatCurrency(i.line_total)}</span>
              </li>
            );
          })}
        </ul>
        {o.notes && <div className="text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-1.5">💬 {o.notes}</div>}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-bold">Total {formatCurrency(o.total)} <span className="text-xs font-normal text-slate-400">· pago en el local</span></div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost text-xs py-1" onClick={() => setPrinting(o)}>🖨 Comanda</button>
            {o.status === "nuevo" && (
              <>
                <button className="btn-ghost text-xs py-1" onClick={() => setRejecting(o)}>Rechazar</button>
                <button className="btn-primary text-xs py-1" onClick={() => setStatus(o, "preparando")}>Aceptar y preparar</button>
              </>
            )}
            {o.status === "preparando" && <button className="btn-primary text-xs py-1" onClick={() => setStatus(o, "listo")}>Marcar listo</button>}
            {o.status === "listo" && <button className="btn-primary text-xs py-1" onClick={() => setStatus(o, "entregado")}>Entregado</button>}
            {(o.status === "entregado" || o.status === "cancelado") && (
              <button className="btn-ghost text-xs py-1" onClick={() => setStatus(o, "nuevo")}>Reabrir</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const Section = ({ title, items, accent }: { title: string; items: OrderRow[]; accent?: string }) =>
    items.length === 0 ? null : (
      <section className="space-y-3">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${accent ?? "text-slate-500 dark:text-slate-400"}`}>{title} <span className="font-normal">({items.length})</span></h2>
        <div className="grid gap-3 lg:grid-cols-2">{items.map((o) => <Card key={o.id} o={o} />)}</div>
      </section>
    );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle="Pedidos para llevar, en tiempo real"
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() => { const v = !sound; setSound(v); setOrderSoundOn(v); if (v) playOrderBeep(); }}
              title="Aviso sonoro al llegar un pedido nuevo"
            >
              {sound ? "🔔 Sonido activado" : "🔕 Sonido apagado"}
            </button>
            {settings && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <span className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.accepting} onChange={(e) => toggleAccepting(e.target.checked)} />
                  <span className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-brand-500 transition" />
                  <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-4" />
                </span>
                Aceptando pedidos
              </label>
            )}
          </>
        }
      />
      {toast && <div className="fixed top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
      {!settings && (
        <div className="card p-4 text-sm bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
          Aún no has configurado los pedidos online: ve a <strong>Carta → Ajustes de pedidos</strong> para elegir el horario de recogida.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {(["hoy", "proximos", "dia"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${range === r ? "bg-brand-500 text-white border-brand-500" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
          >
            {r === "hoy" ? "Hoy" : r === "proximos" ? "Próximos 15 días" : "Otro día"}
          </button>
        ))}
        {range === "dia" && (
          <input type="date" className="input w-44 py-1.5" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <EmptyState title="No hay pedidos" hint="Cuando un cliente pida para llevar, aparecerá aquí al instante." />
      ) : (
        <div className="space-y-7">
          <Section title="Nuevos" items={by("nuevo")} accent="text-amber-600" />
          <Section title="En preparación" items={by("preparando")} accent="text-sky-600" />
          <Section title="Listos para recoger" items={by("listo")} accent="text-purple-600" />
          <Section title="Cerrados" items={closed} />
        </div>
      )}

      <ConfirmDialog
        open={!!rejecting}
        title="Rechazar pedido"
        message={`¿Cancelar el pedido de ${rejecting?.customer_name ?? ""}? El cliente verá el pedido como cancelado; avísale por teléfono o WhatsApp si hace falta.`}
        confirmLabel="Rechazar pedido"
        onConfirm={() => { if (rejecting) setStatus(rejecting, "cancelado"); setRejecting(null); }}
        onCancel={() => setRejecting(null)}
      />

      {printing && <Ticket order={printing} businessName={business?.name ?? ""} tz={tz} />}
    </div>
  );
}

/** Comanda para cocina; solo visible al imprimir. */
function Ticket({ order, businessName, tz }: { order: OrderRow; businessName: string; tz: string }) {
  const date = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(order.pickup_at));
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #order-ticket, #order-ticket * { visibility: visible; }
          #order-ticket { position: absolute; left: 0; top: 0; width: 76mm; color: #000; background: #fff; font-family: ui-monospace, monospace; font-size: 12px; }
        }
      `}</style>
      <div id="order-ticket" className="hidden print:block">
        <div style={{ textAlign: "center", fontWeight: 700 }}>{businessName}</div>
        <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, margin: "4px 0" }}>{formatTime(order.pickup_at, tz)}</div>
        <div style={{ textAlign: "center" }}>{date} · {order.locator}</div>
        <hr style={{ margin: "6px 0" }} />
        <div style={{ fontWeight: 700 }}>{order.customer_name} {order.customer_last_name ?? ""}</div>
        <div>{order.customer_phone}</div>
        <hr style={{ margin: "6px 0" }} />
        {order.order_items.map((i) => {
          const mods = (i.modifiers as unknown as { name: string }[]) ?? [];
          return (
            <div key={i.id} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>{i.quantity}× {i.name}</div>
              {mods.map((m, n) => <div key={n} style={{ paddingLeft: 10 }}>+ {m.name}</div>)}
              {i.notes && <div style={{ paddingLeft: 10 }}>» {i.notes}</div>}
            </div>
          );
        })}
        {order.notes && (<><hr style={{ margin: "6px 0" }} /><div>Nota: {order.notes}</div></>)}
        <hr style={{ margin: "6px 0" }} />
        <div style={{ fontWeight: 700 }}>TOTAL {formatCurrency(order.total)} (pago en local)</div>
      </div>
    </>
  );
}
