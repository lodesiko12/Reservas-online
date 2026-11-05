import { useEffect, useMemo, useState } from "react";
import {
  fetchServices, fetchOptions, fetchSlots, fetchAvailableDays, createBooking,
  type PublicBusiness, type PublicService, type PublicOption, type Slot, type BookingResult,
} from "./api";
import {
  formatCurrency, formatDate, formatTime, WEEKDAYS_SHORT_ES, ymdInTz, weekdayInTz,
  validateOrderContact, NAME_MAX, PHONE_MAX, NOTES_MAX,
} from "@reservas/shared";

// Días hacia delante que se ofrecen (los sin hueco se ocultan con get_available_days).
const DAYS_AHEAD = 45;

type Step = "choose" | "when" | "form" | "done";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Flujo de encargo: tamaño + sabor → día → hora de recogida → datos → localizador. */
export function OrderFlow({ business, onLookup }: { business: PublicBusiness; onLookup: () => void }) {
  const tz = business.timezone;
  const [step, setStep] = useState<Step>("choose");
  const [services, setServices] = useState<PublicService[] | null>(null);
  const [options, setOptions] = useState<PublicOption[] | null>(null);
  const [sizeKey, setSizeKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [option, setOption] = useState<PublicOption | null>(null);
  const [date, setDate] = useState("");
  const [availableDays, setAvailableDays] = useState<Set<string> | null>(null);
  const [daysLoading, setDaysLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchServices(business.id), fetchOptions(business.id)])
      .then(([s, o]) => {
        setServices(s);
        setOptions(o);
        setSizeKey(s.find((x) => x.size_key)?.size_key ?? null);
      })
      .catch((e) => setError(e.message ?? "No se pudo cargar la carta."));
  }, [business.id]);

  // Tamaños disponibles (en el orden de los servicios) con el precio más bajo de cada uno.
  const sizes = useMemo(() => {
    const m = new Map<string, { key: string; label: string; from: number | null }>();
    for (const s of services ?? []) {
      if (!s.size_key) continue;
      const cur = m.get(s.size_key);
      const price = s.price;
      if (!cur) m.set(s.size_key, { key: s.size_key, label: s.size_label ?? s.size_key, from: price });
      else if (price != null && (cur.from == null || price < cur.from)) cur.from = price;
    }
    return [...m.values()];
  }, [services]);

  const serviceFor = (size: string | null, group: string): PublicService | undefined =>
    (services ?? []).find((s) => s.size_key === size && s.option_group === group);

  const service = option ? serviceFor(sizeKey, option.option_group) ?? null : null;

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; items: PublicOption[] }>();
    for (const o of options ?? []) {
      if (!m.has(o.option_group)) m.set(o.option_group, { key: o.option_group, label: o.group_label, items: [] });
      m.get(o.option_group)!.items.push(o);
    }
    return [...m.values()];
  }, [options]);

  const q = norm(query.trim());

  const dates = useMemo(() => {
    const out: { ymd: string; d: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      out.push({ ymd: ymdInTz(d, tz), d });
    }
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.ymd) ? false : (seen.add(o.ymd), true)));
  }, [tz]);

  // Días con algún hueco al elegir la tarta.
  useEffect(() => {
    if (!service || step !== "when") return;
    setAvailableDays(null);
    setDaysLoading(true);
    fetchAvailableDays(business.id, service.id, dates[0].ymd, dates[dates.length - 1].ymd)
      .then((days) => { setAvailableDays(days); if (date && !days.has(date)) setDate(""); })
      .catch((e) => setError(e.message))
      .finally(() => setDaysLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, step, business.id]);

  useEffect(() => {
    if (!service || !date) return;
    setSlotsLoading(true);
    setSlot(null);
    fetchSlots(business.id, service.id, date)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [service?.id, date, business.id]);

  const visibleDates = availableDays ? dates.filter((d) => availableDays.has(d.ymd)) : dates;
  const stepIndex = { choose: 0, when: 1, form: 2, done: 3 }[step];

  return (
    <>
      <div className="steps">
        {[0, 1, 2].map((i) => <div key={i} className={`dot ${i <= stepIndex ? "active" : ""}`} />)}
      </div>

      {error && <div className="error">{error}</div>}

      {step === "choose" && (
        <>
          {!services || !options ? (
            <div className="empty"><span className="spinner" /></div>
          ) : sizes.length === 0 || groups.length === 0 ? (
            <div className="empty">De momento no hay nada disponible para encargar online.</div>
          ) : (
            <>
              <p className="section-title">1. Elige el tamaño</p>
              <div className="seg">
                {sizes.map((s) => (
                  <button key={s.key} className={sizeKey === s.key ? "selected" : ""} onClick={() => setSizeKey(s.key)}>
                    <div className="t">{s.label}</div>
                    {s.from != null && <div className="n">desde {formatCurrency(s.from)}</div>}
                  </button>
                ))}
              </div>

              <p className="section-title">2. Elige el sabor</p>
              <input
                className="search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar sabor (Oreo, pistacho…)"
                aria-label="Buscar sabor"
              />
              {groups.map((g) => {
                const matches = q ? g.items.filter((o) => norm(o.name).includes(q)) : g.items;
                if (q && matches.length === 0) return null;
                const expanded = q ? true : openGroup === g.key;
                const price = serviceFor(sizeKey, g.key)?.price ?? null;
                return (
                  <div key={g.key} className="group">
                    <button
                      className="group-head"
                      aria-expanded={expanded}
                      onClick={() => !q && setOpenGroup(expanded ? null : g.key)}
                    >
                      <span>
                        <span className="gl">{g.label}</span>
                        <span className="gm"> · {matches.length} {matches.length === 1 ? "sabor" : "sabores"}</span>
                      </span>
                      <span className="gp">{price != null ? formatCurrency(price) : ""}{!q && <span className="chev">{expanded ? "▴" : "▾"}</span>}</span>
                    </button>
                    {expanded && (
                      <div className="list" style={{ margin: "8px 0 4px" }}>
                        {matches.map((o) => {
                          const svc = serviceFor(sizeKey, o.option_group);
                          const disabled = !o.is_available || !svc;
                          return (
                            <button
                              key={o.id}
                              className={`card-btn ${option?.id === o.id ? "selected" : ""} ${disabled ? "unavailable" : ""}`}
                              disabled={disabled}
                              onClick={() => { setOption(o); setError(null); setStep("when"); }}
                            >
                              <div>
                                <div className="name">{o.name}</div>
                                {!o.is_available && <div className="meta">No disponible esta semana</div>}
                              </div>
                              {svc?.price != null && o.is_available && <div className="price">{formatCurrency(svc.price)}</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {q && groups.every((g) => g.items.every((o) => !norm(o.name).includes(q))) && (
                <div className="empty">No encontramos ese sabor. Prueba con otra palabra.</div>
              )}
            </>
          )}
        </>
      )}

      {step === "when" && service && option && (
        <>
          <button className="back" onClick={() => setStep("choose")}>← Cambiar sabor o tamaño</button>
          <p className="section-title">
            {option.name} · {service.size_label}{service.price != null ? ` · ${formatCurrency(service.price)}` : ""}
          </p>
          <p className="section-title" style={{ marginTop: 14 }}>3. ¿Qué día lo recoges?</p>
          {daysLoading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : visibleDates.length === 0 ? (
            <div className="empty">No hay días disponibles en las próximas semanas. Escríbenos y lo vemos.</div>
          ) : (
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
          )}

          {daysLoading || visibleDates.length === 0 ? null : !date ? (
            <p className="hint" style={{ marginTop: 14 }}>Elige un día para ver las horas de recogida.</p>
          ) : slotsLoading ? (
            <div className="empty"><span className="spinner" /></div>
          ) : slots.length === 0 ? (
            <div className="empty">No quedan horas ese día. Prueba con otro.</div>
          ) : (
            <>
              <p className="section-title" style={{ marginTop: 14 }}>4. ¿A qué hora?</p>
              <div className="slots" style={{ marginTop: 0 }}>
                {slots.map((s) => (
                  <button
                    key={s.slot_start}
                    className={`slot ${slot?.slot_start === s.slot_start ? "selected" : ""}`}
                    onClick={() => { setSlot(s); setStep("form"); }}
                  >
                    {formatTime(s.slot_start, tz)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {step === "form" && service && option && slot && (
        <OrderForm
          business={business}
          service={service}
          option={option}
          slot={slot}
          onBack={() => setStep("when")}
          onError={setError}
          onDone={(r) => { setResult(r); setStep("done"); }}
        />
      )}

      {step === "done" && result && (
        <div className="center">
          <div className="ok-icon">{result.status === "pendiente" ? "⏳" : "✅"}</div>
          <p className="section-title" style={{ marginTop: 8 }}>
            {result.status === "pendiente" ? "¡Encargo recibido!" : "¡Encargo confirmado!"}
          </p>
          <p className="hint">
            {result.status === "pendiente"
              ? "Lo revisaremos y te lo confirmaremos en breve."
              : "Ya está apuntado."}
          </p>
          <div className="locator">{result.locator}</div>
          <div className="summary" style={{ textAlign: "left" }}>
            {result.option_label && <div className="line"><span className="k">Sabor</span><span>{result.option_label}</span></div>}
            {result.size_label && <div className="line"><span className="k">Tamaño</span><span>{result.size_label}</span></div>}
            <div className="line"><span className="k">Día de recogida</span><span>{formatDate(result.starts_at, tz)}</span></div>
            <div className="line"><span className="k">Hora de recogida</span><span>{formatTime(result.starts_at, tz)}</span></div>
          </div>
          <p className="hint">Guarda tu código localizador para consultar o cancelar tu encargo.</p>
        </div>
      )}

      {step !== "done" && (
        <div className="footer-link">
          <button onClick={onLookup}>¿Ya tienes un encargo? Consúltalo aquí</button>
        </div>
      )}
    </>
  );
}

function OrderForm({
  business, service, option, slot, onBack, onDone, onError,
}: {
  business: PublicBusiness;
  service: PublicService;
  option: PublicOption;
  slot: Slot;
  onBack: () => void;
  onDone: (r: BookingResult) => void;
  onError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const validation = validateOrderContact({ name, lastName, phone, email, notes });

  async function submit() {
    onError(null);
    if (!validation.success) {
      onError(validation.error.issues[0]?.message ?? "Revisa los datos del formulario.");
      return;
    }
    setSaving(true);
    try {
      const c = validation.data;
      const r = await createBooking({
        business_id: business.id,
        service_id: service.id,
        option_id: option.id,
        starts_at: slot.slot_start,
        name: c.name,
        last_name: c.lastName,
        phone: c.phone,
        email: c.email,
        notes: c.notes || undefined,
      });
      onDone(r);
    } catch (e: any) {
      onError(e.message ?? "No se pudo completar el encargo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="back" onClick={onBack}>← Cambiar hora</button>
      <div className="summary">
        <div className="line"><span className="k">Sabor</span><span>{option.name}</span></div>
        <div className="line"><span className="k">Tamaño</span><span>{service.size_label}</span></div>
        {service.price != null && <div className="line"><span className="k">Precio</span><span>{formatCurrency(service.price)}</span></div>}
        <div className="line"><span className="k">Día de recogida</span><span>{formatDate(slot.slot_start, business.timezone)}</span></div>
        <div className="line"><span className="k">Hora de recogida</span><span>{formatTime(slot.slot_start, business.timezone)}</span></div>
      </div>

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
        <label>Teléfono / WhatsApp *</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" inputMode="tel" maxLength={PHONE_MAX} />
      </div>
      <div className="field">
        <label>Email (opcional)</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Para enviarte la confirmación" inputMode="email" />
      </div>
      <div className="field">
        <label>Dedicatoria, mensaje o alergias (opcional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ej.: «Feliz cumpleaños, Marta». Alérgico a los frutos secos." maxLength={NOTES_MAX} />
      </div>

      <button className="btn" disabled={!validation.success || saving} onClick={submit}>
        {saving ? "Enviando…" : "Confirmar encargo"}
      </button>
    </>
  );
}
