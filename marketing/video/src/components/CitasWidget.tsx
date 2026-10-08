import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_IN, EASE_OUT, clamp, pop, pulse } from "../lib/anim";
import { STATUS } from "../theme";
import { Ripple } from "./PsyScreens";

/**
 * Paso "Elige día y hora" del widget público de citas, imitado de `capturas/widget/citas/03-dia-y-hora.png`:
 * tira de días (solo los días con hueco) y rejilla de horas. Medidas en pt de un móvil de 390, escaladas con `s`.
 * Tipografía del sistema y color propio del negocio (`brand`), como el widget real.
 */

const W = { ink: "#0F172A", muted: "#64748B", faint: "#CBD5E1", chip: "#F8FAFC", border: "#E2E8F0", track: "#E2E8F0" };
const FONT_SYS = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

export type CitasDay = { dow: string; day: number; month: string };

type CitasWidgetProps = {
  s: number;
  business: string;
  brand: string;
  /** "Elige día y hora · Servicio · Profesional". */
  subtitle: string;
  days: readonly CitasDay[];
  /** Día que se marca en rojo (`markAt`) y luego sale de la tira (`removeAt`) cerrando el hueco. */
  remove?: { index: number; markAt: number; removeAt: number };
  /** Día que pulsa el cliente. */
  pick?: { index: number; at: number };
  times: readonly string[];
  /** Frame en el que aparecen las horas (en cascada). Sin él, no se ven. */
  timesAt?: number;
};

const DAY_W = 58;
const GAP = 8;

export const CitasWidget: React.FC<CitasWidgetProps> = ({ s, business, brand, subtitle, days, remove, pick, times, timesAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", fontFamily: FONT_SYS, color: W.ink, padding: `${14 * s}px ${18 * s}px` }}>
      <div style={{ fontSize: 19 * s, fontWeight: 700 }}>{business}</div>
      <div style={{ fontSize: 12.5 * s, color: W.muted, marginTop: 2 * s }}>Reserva online</div>
      <div style={{ display: "flex", gap: 6 * s, margin: `${12 * s}px 0 ${18 * s}px` }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 3 * s, borderRadius: 3 * s, background: i <= 2 ? brand : W.track }} />
        ))}
      </div>
      <div style={{ fontSize: 14 * s, color: W.muted, marginBottom: 8 * s }}>← Cambiar profesional</div>
      <div style={{ fontSize: 13 * s, fontWeight: 600, marginBottom: 12 * s, whiteSpace: "nowrap" }}>{subtitle}</div>

      {/* Tira de días */}
      <div style={{ display: "flex", overflow: "visible", height: 72 * s }}>
        {days.map((d, i) => {
          const isRemoved = remove?.index === i;
          const mark = isRemoved ? interpolate(frame, [remove.markAt, remove.markAt + 5], [0, 1], clamp) : 0;
          // Al salir: se encoge, se va hacia arriba y el hueco se cierra.
          const gone = isRemoved ? interpolate(frame, [remove.removeAt, remove.removeAt + 9], [0, 1], { ...clamp, easing: EASE_IN }) : 0;
          const close = isRemoved ? interpolate(frame, [remove.removeAt + 3, remove.removeAt + 13], [1, 0], { ...clamp, easing: EASE_OUT }) : 1;
          const sel = pick !== undefined && pick.index === i && frame >= pick.at;
          const shake = isRemoved && frame >= remove.markAt && frame < remove.removeAt ? Math.sin(frame * 2.2) * 2.4 * s : 0;
          return (
            <div key={i} style={{ width: (DAY_W + GAP) * s * close, flexShrink: 0, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: DAY_W * s,
                  height: 72 * s,
                  borderRadius: 8 * s,
                  background: sel ? brand : mark > 0 ? `color-mix(in srgb, ${STATUS.noShow.solid} ${Math.round(mark * 12)}%, ${W.chip})` : W.chip,
                  color: sel ? "#FFFFFF" : W.ink,
                  border: `${(1 + mark * 1.5) * s}px solid ${sel ? brand : mark > 0 ? STATUS.noShow.solid : W.border}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1 * s,
                  translate: `${shake}px ${-gone * 60 * s}px`,
                  scale: String((1 - gone * 0.7) * (pick?.index === i ? 1 / pulse(frame, pick.at, 1.08, 8) : 1)),
                  rotate: `${gone * -18}deg`,
                  opacity: 1 - gone,
                }}
              >
                <span style={{ fontSize: 10.5 * s }}>{d.dow}</span>
                <span style={{ fontSize: 18 * s, fontWeight: 700, lineHeight: 1.1 }}>{d.day}</span>
                <span style={{ fontSize: 10 * s }}>{d.month}</span>
                {pick?.index === i ? <Ripple t={frame - pick.at} /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Horas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 * s, marginTop: 16 * s }}>
        {times.map((t, i) => {
          const p = timesAt === undefined ? 0 : pop(frame, fps, timesAt + i * 1.5);
          return (
            <div
              key={t}
              style={{
                height: 40 * s,
                borderRadius: 8 * s,
                background: W.chip,
                border: `${1 * s}px solid ${W.border}`,
                display: "grid",
                placeItems: "center",
                fontSize: 15 * s,
                fontWeight: 600,
                opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
                scale: String(interpolate(p, [0, 1], [0.6, 1])),
              }}
            >
              {t}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 20 * s, fontSize: 12 * s, color: W.muted, textDecoration: "underline" }}>
        ¿Ya tienes una reserva? Consúltala aquí
      </div>
      <div style={{ textAlign: "center", marginTop: 14 * s, fontSize: 10 * s, color: W.faint }}>Reservas · Turnigo</div>
    </div>
  );
};
