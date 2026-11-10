import { useEffect, useMemo, useState } from "react";
import {
  fetchMenu, fetchTakeawayDays, fetchTakeawaySlots, createOrder,
  type PublicBusiness, type PublicMenu, type MenuItem, type MenuModifier, type OrderResult,
} from "./api";
import {
  formatCurrency, formatDate, formatTime, WEEKDAYS_SHORT_ES, ymdInTz, weekdayInTz,
  validateOrderContact, NAME_MAX, PHONE_MAX, NOTES_MAX,
} from "@reservas/shared";

type Step = "menu" | "item" | "checkout" | "done";

type CartLine = {
  key: string;
  item: MenuItem;
  qty: number;
  mods: MenuModifier[];
  notes: string;
};

const unitPrice = (l: { item: MenuItem; mods: MenuModifier[] }) =>
  l.item.price + l.mods.reduce((s, m) => s + m.price_delta, 0);

const lineKey = (itemId: string, mods: MenuModifier[], notes: string) =>
  `${itemId}|${mods.map((m) => m.id).sort().join(",")}|${notes.trim().toLowerCase()}`;

/** Flujo de pedido para llevar: carta → (extras) → resumen, hora de recogida y datos → localizador. */
export function TakeawayFlow({ business, onLookup }: { business: PublicBusiness; onLookup: () => void }) {
  const tz = business.timezone;
  const [step, setStep] = useState<Step>("menu");
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined); // undefined = cargando
  const [cart, setCart] = useState<CartLine[]>([]);
  const [current, setCurrent] = useState<MenuItem | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMenu(business.id).then(setMenu).catch((e) => { setMenu(null); setError(e.message ?? "No se pudo cargar la carta."); });
  }, [business.id]);

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0);

  function addLine(item: MenuItem, mods: MenuModifier[], qty: number, notes: string) {
    const key = lineKey(item.id, mods, notes);
    setCart((c) => {
      const i = c.findIndex((l) => l.key === key);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
      return [...c, { key, item, qty, mods, notes: notes.trim() }];
    });
  }
  const setQty = (key: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l))));

  const stepIndex = { menu: 0, item: 0, checkout: 1, done: 2 }[step];

  if (menu === undefined) return <div className="empty"><span className="spinner" /></div>;
  if (menu === null || menu.categories.every((c) => c.items.length === 0)) {
    return (
      <>
        {error && <div className="error">{error}</div>}
        <div className="empty">De momento no hay nada disponible para pedir online.</div>
        <div className="footer-link"><button onClick={onLookup}>¿Ya tienes un pedido? Consúltalo aquí</button></div>
      </>
    );
  }

  return (
    <>
      <div className="steps">
        {[0, 1, 2].map((i) => <div key={i} className={`dot ${i <= stepIndex ? "active" : ""}`} />)}
      </div>
      {error && <div className="error">{error}</div>}

      {step === "menu" && (
        <MenuStep
          menu={menu}
          cart={cart}
          count={count}
          total={total}
          onOpen={(item) => { setCurrent(item); setError(null); setStep("item"); }}
          onQuickAdd={(item) => addLine(item, [], 1, "")}
          onCheckout={() => { setError(null); setStep("checkout"); }}
          onLookup={onLookup}
        />
      )}

      {step === "item" && current && (
        <ItemStep
          item={current}
          onBack={() => setStep("menu")}
          onAdd={(mods, qty, notes) => { addLine(current, mods, qty, notes); setStep("menu"); }}
        />
      )}

      {step === "checkout" && (
        <CheckoutStep
          business={business}
          menu={menu}
          cart={cart}
          total={total}
          tz={tz}
          onQty={setQty}
          onBack={() => setStep("menu")}
          onError={setError}
          onDone={(r) => { setResult(r); setCart([]); setStep("done"); }}
        />
      )}

      {step === "done" && result && (
        <div className="center">
          <div className="ok-icon">✅</div>
          <p className="section-title" style={{ marginTop: 8 }}>¡Pedido recibido!</p>
          <p className="hint">Lo recogerás el {formatDate(result.pickup_at, tz)} a las {formatTime(result.pickup_at, tz)}.</p>
          <div className="locator">{result.locator}</div>
          <div className="summary" style={{ textAlign: "left" }}>
            <div className="line"><span className="k">Total</span><span><strong>{formatCurrency(result.total)}</strong></span></div>
            <div className="line"><span className="k">Pago</span><span>En el local, al recoger</span></div>
          </div>
          <p className="hint">Guarda tu código localizador para consultar o cancelar tu pedido (mientras no esté en preparación).</p>
        </div>
      )}

      {step !== "done" && step !== "menu" && (
        <div className="footer-link">
          <button onClick={onLookup}>¿Ya tienes un pedido? Consúltalo aquí</button>
        </div>
      )}
    </>
  );
}

function allergenText(item: MenuItem) {
  return item.allergens.length ? `Alérgenos: ${item.allergens.join(", ")}` : "";
}

function MenuStep({ menu, cart, count, total, onOpen, onQuickAdd, onCheckout, onLookup }: {
  menu: PublicMenu;
  cart: CartLine[];
  count: number;
  total: number;
  onOpen: (i: MenuItem) => void;
  onQuickAdd: (i: MenuItem) => void;
  onCheckout: () => void;
  onLookup: () => void;
}) {
  const cats = menu.categories.filter((c) => c.items.length > 0);
  const qtyOf = (id: string) => cart.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  return (
    <>
      {!menu.accepting && (
        <div className="error">Ahora mismo no estamos aceptando pedidos online. Vuelve a intentarlo más tarde.</div>
      )}
      {menu.accepting && menu.min_order_amount > 0 && (
        <p className="hint">Pedido mínimo: {formatCurrency(menu.min_order_amount)}. Pago en el local al recoger.</p>
      )}
      {cats.length > 1 && (
        <div className="cats">
          {cats.map((c) => (
            <button key={c.id} onClick={() => document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {cats.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="menu-cat">
          <p className="section-title">{c.name}</p>
          <div className="list">
            {c.items.map((it) => {
              const disabled = !it.is_available || !menu.accepting;
              const inCart = qtyOf(it.id);
              const needsChoice = it.groups.length > 0;
              return (
                <div key={it.id} className={`card-btn menu-item ${disabled ? "unavailable" : ""}`}>
                  <button className="menu-main" disabled={disabled} onClick={() => (needsChoice ? onOpen(it) : onQuickAdd(it))}>
                    <div className="name">{it.name}</div>
                    {it.description && <div className="meta">{it.description}</div>}
                    {allergenText(it) && <div className="meta allergens">{allergenText(it)}</div>}
                    {!it.is_available && <div className="meta">Agotado</div>}
                  </button>
                  <div className="menu-side">
                    <div className="price">{formatCurrency(it.price)}</div>
                    <button
                      className="add"
                      disabled={disabled}
                      aria-label={`Añadir ${it.name}`}
                      onClick={() => (needsChoice ? onOpen(it) : onQuickAdd(it))}
                    >
                      {inCart > 0 ? inCart : "+"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="footer-link"><button onClick={onLookup}>¿Ya tienes un pedido? Consúltalo aquí</button></div>

      {count > 0 && (
        <div className="cart-bar">
          <button className="btn" onClick={onCheckout}>
            <span>Ver pedido · {count} {count === 1 ? "artículo" : "artículos"}</span>
            <span>{formatCurrency(total)}</span>
          </button>
        </div>
      )}
    </>
  );
}

function ItemStep({ item, onBack, onAdd }: {
  item: MenuItem;
  onBack: () => void;
  onAdd: (mods: MenuModifier[], qty: number, notes: string) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({}); // group_id -> modifier ids
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const toggle = (gid: string, mid: string, max: number) =>
    setPicked((p) => {
      const cur = p[gid] ?? [];
      if (cur.includes(mid)) return { ...p, [gid]: cur.filter((x) => x !== mid) };
      if (max === 1) return { ...p, [gid]: [mid] };
      if (cur.length >= max) return p;
      return { ...p, [gid]: [...cur, mid] };
    });

  const mods = item.groups.flatMap((g) => g.modifiers.filter((m) => (picked[g.id] ?? []).includes(m.id)));
  const missing = item.groups.find((g) => (picked[g.id] ?? []).length < g.min_choices);
  const unit = unitPrice({ item, mods });

  return (
    <>
      <button className="back" onClick={onBack}>← Volver a la carta</button>
      <p className="section-title">{item.name}</p>
      {item.description && <p className="hint" style={{ marginBottom: 6 }}>{item.description}</p>}
      {allergenText(item) && <p className="hint">{allergenText(item)}</p>}

      {item.groups.map((g) => {
        const sel = picked[g.id] ?? [];
        const rule = g.min_choices >= 1
          ? (g.max_choices === 1 ? "Elige 1" : `Elige entre ${g.min_choices} y ${g.max_choices}`)
          : (g.max_choices === 1 ? "Opcional" : `Opcional · hasta ${g.max_choices}`);
        return (
          <div key={g.id} className="opt-group">
            <div className="opt-head"><span className="gl">{g.name}</span><span className="gm">{rule}</span></div>
            <div className="list">
              {g.modifiers.map((m) => {
                const on = sel.includes(m.id);
                const blocked = !m.is_available || (!on && g.max_choices > 1 && sel.length >= g.max_choices);
                return (
                  <button
                    key={m.id}
                    className={`card-btn opt ${on ? "selected" : ""} ${blocked ? "unavailable" : ""}`}
                    disabled={blocked}
                    onClick={() => toggle(g.id, m.id, g.max_choices)}
                  >
                    <div>
                      <div className="name">{m.name}</div>
                      {!m.is_available && <div className="meta">No disponible</div>}
                    </div>
                    {m.price_delta > 0 && <div className="price">+{formatCurrency(m.price_delta)}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="field">
        <label>Notas para la cocina (opcional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="Sin cebolla, alergia a…" />
      </div>

      <div className="qty-row">
        <div className="qty">
          <button aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span>{qty}</span>
          <button aria-label="Más" onClick={() => setQty((q) => Math.min(50, q + 1))}>+</button>
        </div>
        <button className="btn" disabled={!!missing} onClick={() => onAdd(mods, qty, notes)}>
          {missing ? `Elige «${missing.name}»` : `Añadir · ${formatCurrency(unit * qty)}`}
        </button>
      </div>
    </>
  );
}

function CheckoutStep({ business, menu, cart, total, tz, onQty, onBack, onError, onDone }: {
  business: PublicBusiness;
  menu: PublicMenu;
  cart: CartLine[];
  total: number;
  tz: string;
  onQty: (key: string, qty: number) => void;
  onBack: () => void;
  onError: (m: string | null) => void;
  onDone: (r: OrderResult) => void;
}) {
  const [days, setDays] = useState<Set<string> | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const dates = useMemo(() => {
    const out: { ymd: string; d: Date }[] = [];
    const now = new Date();
    for (let i = 0; i <= Math.min(menu.max_advance_days, 14); i++) {
      const d = new Date(now.getTime() + i * 86400000);
      out.push({ ymd: ymdInTz(d, tz), d });
    }
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.ymd) ? false : (seen.add(o.ymd), true)));
  }, [tz, menu.max_advance_days]);

  useEffect(() => {
    fetchTakeawayDays(business.id, dates[0].ymd, dates[dates.length - 1].ymd)
      .then((d) => { setDays(d); setDate((cur) => (cur && d.has(cur) ? cur : [...d].sort()[0] ?? "")); })
      .catch((e) => onError(e.message ?? "No se pudieron cargar los días."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlot(null);
    fetchTakeawaySlots(business.id, date)
      .then(setSlots)
      .catch((e) => onError(e.message ?? "No se pudieron cargar las horas."))
      .finally(() => setSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, date]);

  const visibleDates = days ? dates.filter((d) => days.has(d.ymd)) : [];
  const belowMin = total < menu.min_order_amount;
  const validation = validateOrderContact({ name, lastName, phone, email, notes });
  const canSubmit = cart.length > 0 && !!slot && validation.success && !belowMin && menu.accepting;

  async function submit() {
    onError(null);
    if (!validation.success) { onError(validation.error.issues[0]?.message ?? "Revisa los datos del formulario."); return; }
    if (!slot) return;
    setSaving(true);
    try {
      const c = validation.data;
      const r = await createOrder({
        business_id: business.id,
        pickup_at: slot,
        items: cart.map((l) => ({
          item_id: l.item.id,
          quantity: l.qty,
          modifier_ids: l.mods.map((m) => m.id),
          notes: l.notes || undefined,
        })),
        name: c.name,
        last_name: c.lastName,
        phone: c.phone,
        email: c.email,
        notes: c.notes || undefined,
      });
      onDone(r);
    } catch (e: any) {
      onError(e.message ?? "No se pudo completar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="back" onClick={onBack}>← Seguir pidiendo</button>
      <p className="section-title">Tu pedido</p>
      {cart.length === 0 ? (
        <div className="empty">Tu pedido está vacío.</div>
      ) : (
        <div className="summary">
          {cart.map((l) => (
            <div key={l.key} className="cart-line">
              <div className="cl-main">
                <div className="cl-name">{l.item.name}</div>
                {l.mods.length > 0 && <div className="cl-meta">{l.mods.map((m) => m.name).join(" · ")}</div>}
                {l.notes && <div className="cl-meta">“{l.notes}”</div>}
              </div>
              <div className="qty small">
                <button aria-label="Menos" onClick={() => onQty(l.key, l.qty - 1)}>−</button>
                <span>{l.qty}</span>
                <button aria-label="Más" onClick={() => onQty(l.key, l.qty + 1)}>+</button>
              </div>
              <div className="cl-price">{formatCurrency(unitPrice(l) * l.qty)}</div>
            </div>
          ))}
          <div className="line cart-total"><span className="k">Total</span><span><strong>{formatCurrency(total)}</strong></span></div>
        </div>
      )}
      {belowMin && cart.length > 0 && (
        <div className="error">El pedido mínimo es de {formatCurrency(menu.min_order_amount)}. Te faltan {formatCurrency(menu.min_order_amount - total)}.</div>
      )}

      <p className="section-title" style={{ marginTop: 18 }}>¿Cuándo lo recoges?</p>
      {days === null ? (
        <div className="empty"><span className="spinner" /></div>
      ) : visibleDates.length === 0 ? (
        <div className="empty">No hay horas de recogida disponibles en los próximos días.</div>
      ) : (
        <>
          <div className="dates">
            {visibleDates.map(({ ymd, d }) => {
              const wd = weekdayInTz(d, tz);
              const dom = new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: tz }).format(d);
              const mon = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: tz }).format(d);
              return (
                <button key={ymd} className={`date-pill ${date === ymd ? "selected" : ""}`} onClick={() => setDate(ymd)}>
                  <div className="dow">{WEEKDAYS_SHORT_ES[wd]}</div>
                  <div className="dom">{dom}</div>
                  <div className="mon">{mon}</div>
                </button>
              );
            })}
          </div>
          {slotsLoading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : slots.length === 0 ? (
            <div className="empty">No quedan horas ese día. Prueba otra fecha.</div>
          ) : (
            <div className="slots">
              {slots.map((s) => (
                <button key={s} className={`slot ${slot === s ? "selected" : ""}`} onClick={() => setSlot(s)}>
                  {formatTime(s, tz)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="section-title" style={{ marginTop: 18 }}>Tus datos</p>
      <div className="row2">
        <div className="field">
          <label>Nombre *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" maxLength={NAME_MAX} />
        </div>
        <div className="field">
          <label>Apellidos</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" maxLength={NAME_MAX} />
        </div>
      </div>
      <div className="field">
        <label>Teléfono *</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" inputMode="tel" maxLength={PHONE_MAX} />
      </div>
      <div className="field">
        <label>Email (opcional, para recibir la confirmación)</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" inputMode="email" />
      </div>
      <div className="field">
        <label>Comentarios (opcional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Algo que debamos saber" maxLength={NOTES_MAX} />
      </div>

      <button className="btn" disabled={!canSubmit || saving} onClick={submit}>
        {saving ? "Enviando…" : `Confirmar pedido · ${formatCurrency(total)}`}
      </button>
      <p className="hint center" style={{ marginTop: 8 }}>Pagas en el local al recoger.</p>
    </>
  );
}
