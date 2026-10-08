import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE_OUT, clamp, pulse } from "../lib/anim";

/**
 * Widget público de reservas de restaurante, imitado de las capturas reales
 * (`referencia-app/capturas/widget/restaurante/`): ① comensales → ② día y hora → ③ formulario.
 * Las medidas están en "pt" de un móvil de 390 de ancho y se escalan con `s`.
 * Usa la tipografía del sistema y el color propio del negocio (`brand`), como el widget real.
 */

const W = {
  ink: "#0F172A",
  muted: "#64748B",
  faint: "#CBD5E1",
  chip: "#F8FAFC",
  border: "#E2E8F0",
  track: "#E2E8F0",
};
const FONT_SYS = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

export type WidgetDay = { dow: string; day: number; month: string };

export type BookingWidgetProps = {
  /** Escala pt → px (ancho de pantalla / 390). */
  s: number;
  business: string;
  brand: string;
  guests: number;
  days: WidgetDay[];
  /** Índice del día elegido en `days`. */
  dayIndex: number;
  times: string[];
  time: string;
  /** Texto de la fecha en el resumen del paso 3. */
  dateLong: string;
  form: { name: string; surname: string; phone: string; email: string };
  /** Frames (relativos al padre) de cada acción. */
  at: {
    tapGuests: number;
    tapContinue: number;
    step2: number;
    tapDay: number;
    tapTime: number;
    step3: number;
    typeName: number;
    typePhone: number;
    typeEmail: number;
    tapConfirm: number;
  };
  /** Desplaza todo el contenido hacia arriba (como si el usuario hiciera scroll) a partir de `at`. */
  scroll?: { at: number; px: number };
};

/** Onda de toque: círculo que se expande desde el centro del elemento. */
const Ripple: React.FC<{ at: number; s: number; color?: string }> = ({ at, s, color = "rgba(15,23,42,0.22)" }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 14) return null;
  const p = interpolate(t, [0, 14], [0, 1], { ...clamp, easing: EASE_OUT });
  const r = (14 + p * 44) * s;
  return (
    <span
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: r * 2,
        height: r * 2,
        marginLeft: -r,
        marginTop: -r,
        borderRadius: "50%",
        background: color,
        opacity: 1 - p,
        pointerEvents: "none",
      }}
    />
  );
};

/** Texto que se "teclea" a 1 carácter por frame, con cursor mientras escribe. */
const typed = (frame: number, at: number, text: string) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - at) * 1.6)));
  return { value: text.slice(0, n), typing: frame >= at && n < text.length + 4 && frame < at + text.length / 1.6 + 6 };
};

export const BookingWidget: React.FC<BookingWidgetProps> = (p) => {
  const frame = useCurrentFrame();
  const { s, brand, at } = p;
  const step = frame >= at.step3 ? 3 : frame >= at.step2 ? 2 : 1;
  const stepStart = step === 3 ? at.step3 : step === 2 ? at.step2 : -100;
  // Cada paso entra deslizando desde la derecha.
  const slide = interpolate(frame, [stepStart, stepStart + 7], [1, 0], { ...clamp, easing: EASE_OUT });

  const btn = (selected: boolean, tapAt?: number): React.CSSProperties => ({
    position: "relative",
    overflow: "hidden",
    height: 40 * s,
    borderRadius: 8 * s,
    display: "grid",
    placeItems: "center",
    background: selected ? brand : W.chip,
    color: selected ? "#FFFFFF" : W.ink,
    border: `${1 * s}px solid ${selected ? brand : W.border}`,
    fontSize: 15 * s,
    fontWeight: 600,
    scale: tapAt === undefined ? undefined : String(1 / pulse(frame, tapAt, 1.06, 8)),
  });

  const primary = (tapAt: number): React.CSSProperties => ({
    position: "relative",
    overflow: "hidden",
    height: 44 * s,
    borderRadius: 8 * s,
    background: brand,
    color: "#FFFFFF",
    display: "grid",
    placeItems: "center",
    fontSize: 15 * s,
    fontWeight: 700,
    marginTop: 16 * s,
    scale: String(1 / pulse(frame, tapAt, 1.05, 8)),
  });

  const footer = (
    <>
      <div style={{ textAlign: "center", marginTop: 20 * s, fontSize: 12 * s, color: W.muted, textDecoration: "underline" }}>
        ¿Ya tienes una reserva? Consúltala aquí
      </div>
      <div style={{ textAlign: "center", marginTop: 14 * s, fontSize: 10 * s, color: W.faint }}>Reservas · Turnigo</div>
    </>
  );

  const label: React.CSSProperties = { fontSize: 12 * s, fontWeight: 600, color: W.ink, marginBottom: 6 * s };
  const input = (focused: boolean): React.CSSProperties => ({
    height: 40 * s,
    borderRadius: 8 * s,
    border: `${1 * s}px solid ${focused ? brand : W.border}`,
    boxShadow: focused ? `0 0 0 ${3 * s}px color-mix(in srgb, ${brand} 25%, transparent)` : undefined,
    display: "flex",
    alignItems: "center",
    padding: `0 ${12 * s}px`,
    fontSize: 15 * s,
    color: W.ink,
  });
  const field = (lbl: string, text: string, typeAt: number, required = true) => {
    const t = typed(frame, typeAt, text);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={label}>
          {lbl}
          {required ? " *" : ""}
        </div>
        <div style={input(t.typing)}>
          {t.value}
          {t.typing && Math.floor(frame / 8) % 2 === 0 ? (
            <span style={{ width: 2 * s, height: 18 * s, background: W.ink, marginLeft: 1 * s }} />
          ) : null}
        </div>
      </div>
    );
  };

  let body: React.ReactNode;
  if (step === 1) {
    const chosen = frame >= at.tapGuests;
    body = (
      <>
        <div style={{ fontSize: 14 * s, fontWeight: 600, color: W.ink, marginBottom: 12 * s }}>¿Cuántos comensales?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 * s }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <div key={n} style={btn(chosen && n === p.guests, n === p.guests ? at.tapGuests : undefined)}>
              {n}
              {n === p.guests ? <Ripple at={at.tapGuests} s={s} /> : null}
            </div>
          ))}
        </div>
        <div
          style={{
            ...primary(at.tapContinue),
            opacity: chosen ? 1 : 0.45,
          }}
        >
          Continuar con {p.guests} personas
          <Ripple at={at.tapContinue} s={s} color="rgba(255,255,255,0.35)" />
        </div>
        {footer}
      </>
    );
  } else if (step === 2) {
    const dayOn = frame >= at.tapDay;
    const timeOn = frame >= at.tapTime;
    body = (
      <>
        <div style={{ fontSize: 14 * s, color: W.muted, marginBottom: 8 * s }}>← {p.guests} comensales</div>
        <div style={{ fontSize: 14 * s, fontWeight: 600, color: W.ink, marginBottom: 12 * s }}>Elige día y hora</div>
        <div style={{ display: "flex", gap: 8 * s, overflow: "hidden" }}>
          {p.days.map((d, i) => {
            const sel = dayOn ? i === p.dayIndex : i === 0;
            return (
              <div
                key={i}
                style={{
                  ...btn(sel, i === p.dayIndex ? at.tapDay : undefined),
                  flexShrink: 0,
                  width: 58 * s,
                  height: 72 * s,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1 * s,
                  fontWeight: 400,
                }}
              >
                <span style={{ fontSize: 10.5 * s, opacity: sel ? 0.85 : 1 }}>{d.dow}</span>
                <span style={{ fontSize: 18 * s, fontWeight: 700, lineHeight: 1.1 }}>{d.day}</span>
                <span style={{ fontSize: 10 * s }}>{d.month}</span>
                {i === p.dayIndex ? <Ripple at={at.tapDay} s={s} /> : null}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12 * s, fontWeight: 600, color: W.muted, margin: `${18 * s}px 0 ${10 * s}px` }}>Cena</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 * s }}>
          {p.times.map((t) => (
            <div key={t} style={btn(timeOn && t === p.time, t === p.time ? at.tapTime : undefined)}>
              {t}
              {t === p.time ? <Ripple at={at.tapTime} s={s} /> : null}
            </div>
          ))}
        </div>
        {footer}
      </>
    );
  } else {
    const rows: [string, string][] = [
      ["Comensales", String(p.guests)],
      ["Franja", "Cena"],
      ["Fecha", p.dateLong],
      ["Hora", p.time],
    ];
    body = (
      <>
        <div style={{ fontSize: 14 * s, color: W.muted, marginBottom: 8 * s }}>← Cambiar hora</div>
        <div
          style={{
            background: W.chip,
            border: `${1 * s}px solid ${W.border}`,
            borderRadius: 12 * s,
            padding: `${12 * s}px ${14 * s}px`,
            display: "flex",
            flexDirection: "column",
            gap: 6 * s,
            fontSize: 12.5 * s,
            marginBottom: 14 * s,
          }}
        >
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: W.muted }}>{k}</span>
              <span style={{ color: W.ink }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 * s }}>
          {field("Nombre", p.form.name, at.typeName)}
          {field("Apellidos", p.form.surname, at.typeName + 6, false)}
        </div>
        <div style={{ marginTop: 12 * s }}>{field("Teléfono", p.form.phone, at.typePhone)}</div>
        <div style={{ marginTop: 12 * s }}>{field("Email", p.form.email, at.typeEmail)}</div>
        <div style={{ marginTop: 12 * s }}>
          <div style={label}>Notas (opcional)</div>
          <div style={{ ...input(false), height: 52 * s, alignItems: "flex-start", paddingTop: 10 * s, color: "#94A3B8" }}>
            Alergias, trona, celebración…
          </div>
        </div>
        <div style={primary(at.tapConfirm)}>
          Confirmar reserva
          <Ripple at={at.tapConfirm} s={s} color="rgba(255,255,255,0.35)" />
        </div>
      </>
    );
  }

  const scrollY = p.scroll ? interpolate(frame, [p.scroll.at, p.scroll.at + 8], [0, p.scroll.px], { ...clamp, easing: EASE_OUT }) : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#FFFFFF",
        fontFamily: FONT_SYS,
        color: W.ink,
        padding: `${14 * s}px ${18 * s}px`,
        translate: `0px ${-scrollY}px`,
      }}
    >
      <div style={{ fontSize: 19 * s, fontWeight: 700 }}>{p.business}</div>
      <div style={{ fontSize: 12.5 * s, color: W.muted, marginTop: 2 * s }}>Reserva online</div>
      <div style={{ display: "flex", gap: 6 * s, margin: `${12 * s}px 0 ${18 * s}px` }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 3 * s, borderRadius: 3 * s, background: i <= step ? brand : W.track }} />
        ))}
      </div>
      <div style={{ translate: `${slide * 420 * s}px 0`, opacity: interpolate(slide, [0, 0.8], [1, 0], clamp) }}>{body}</div>
    </div>
  );
};
