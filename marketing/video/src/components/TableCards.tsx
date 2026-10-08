import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { BRAND } from "../brand";
import { clamp, pulse } from "../lib/anim";
import { FONT } from "../theme";
import { Burst } from "./Burst";

/**
 * Plano de sala REAL del panel (apps/dashboard/src/business/PlanoSala.tsx): cuadrícula de tarjetas
 * por zona, con los mismos estados, colores (Tailwind) y botones que la app.
 */
export type TableHealth = "libre" | "reservada" | "llegar" | "retrasada" | "sentada";

export const HEALTH: Record<TableHealth, { bg: string; border: string; text: string; label: string }> = {
  libre: { bg: "#FFFFFF", border: "#E2E8F0", text: "#94A3B8", label: "Libre" },
  reservada: { bg: "#F0F9FF", border: "#7DD3FC", text: "#0369A1", label: "Reservada" },
  llegar: { bg: "#EFF6FF", border: "#60A5FA", text: "#1D4ED8", label: "Debería llegar" },
  retrasada: { bg: "#FEF2F2", border: "#F87171", text: "#B91C1C", label: "Retrasada" },
  sentada: { bg: "#ECFDF5", border: "#34D399", text: "#047857", label: "Sentada" },
};

export type TableState = {
  /** Frame (relativo al plano) desde el que rige este estado. */
  at: number;
  health: TableHealth;
  booking?: { who: string; time: string };
  /** Texto de la tarjeta libre ("Sin reservas próximas" / "Próxima reserva a las 21:30"). */
  next?: string;
};

export type CardSpec = { name: string; cap: string; states: TableState[] };
export type ZoneSpec = { name: string; tables: CardSpec[] };

/** Toque sobre un botón de una tarjeta: zona, nº de mesa en la zona, botón (0 = primero) y frame. */
export type CardTap = { zone: number; table: number; button: number; at: number };

export const PLAN = {
  width: 960,
  pad: 32,
  header: 128,
  zoneLabel: 56,
  cardH: 252,
  gap: 18,
  cols: 3,
} as const;
const CARD_W = (PLAN.width - 2 * PLAN.pad - (PLAN.cols - 1) * PLAN.gap) / PLAN.cols;

/** Posición (x, y, w, h) de una tarjeta en coordenadas del plano. Útil para mover la cámara. */
export const cardRect = (zones: ZoneSpec[], zone: number, table: number) => {
  let y = PLAN.header;
  for (let z = 0; z < zone; z++) {
    y += PLAN.zoneLabel + Math.ceil(zones[z].tables.length / PLAN.cols) * (PLAN.cardH + PLAN.gap);
  }
  y += PLAN.zoneLabel;
  const row = Math.floor(table / PLAN.cols);
  const col = table % PLAN.cols;
  return { x: PLAN.pad + col * (CARD_W + PLAN.gap), y: y + row * (PLAN.cardH + PLAN.gap), w: CARD_W, h: PLAN.cardH };
};

export const planHeight = (zones: ZoneSpec[]) => {
  const last = zones.length - 1;
  const r = cardRect(zones, last, zones[last].tables.length - 1);
  return r.y + r.h + PLAN.pad;
};

const BTN_H = 50;
const BTN_Y = PLAN.cardH - 24 - BTN_H;

const buttonsFor = (s: TableState) => {
  if (s.health === "libre") return [{ label: "Sentar clientes", primary: true, w: 214 }];
  if (s.health === "sentada") return [{ label: "Liberar mesa", primary: false, w: 168 }];
  return [
    { label: "Sentar", primary: false, w: 100 },
    { label: "No-show", primary: false, w: 118 },
  ];
};

/** Centro de un botón dentro de la tarjeta (para el círculo del toque). */
const buttonCenter = (s: TableState, button: number) => {
  const btns = buttonsFor(s);
  let x = 24;
  for (let i = 0; i < button; i++) x += btns[i].w + 10;
  return { x: x + btns[button].w / 2, y: BTN_Y + BTN_H / 2 };
};

const stateAt = (states: TableState[], frame: number) => {
  let curr = states[0];
  let prev = states[0];
  for (const s of states) {
    if (frame >= s.at) {
      prev = curr;
      curr = s;
    }
  }
  return { curr, prev };
};

const Card: React.FC<{ spec: CardSpec; taps: { button: number; at: number }[] }> = ({ spec, taps }) => {
  const frame = useCurrentFrame();
  const { curr, prev } = stateAt(spec.states, frame);
  const h = HEALTH[curr.health];
  const changed = curr !== spec.states[0] || spec.states[0].at > 0;
  const p = changed ? interpolate(frame, [curr.at, curr.at + 6], [0, 1], clamp) : 1;
  const ph = HEALTH[prev.health];
  const bg = interpolateColors(p, [0, 1], [ph.bg, h.bg]);
  const border = interpolateColors(p, [0, 1], [ph.border, h.border]);
  const scale = changed ? pulse(frame, curr.at, 1.07, 12) : 1;
  const btns = buttonsFor(curr);

  return (
    <div
      style={{
        position: "relative",
        width: CARD_W,
        height: PLAN.cardH,
        boxSizing: "border-box",
        borderRadius: 24,
        border: `4px solid ${border}`,
        background: bg,
        padding: "20px 18px",
        scale: String(scale),
        boxShadow: changed && frame - curr.at < 14 ? `0 0 0 ${8 * (1 - (frame - curr.at) / 14)}px ${h.border}66` : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 31, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", flexShrink: 0 }}>{spec.name}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: h.text, marginTop: 8, whiteSpace: "nowrap", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{h.label}</div>
      </div>
      <div style={{ fontSize: 23, color: "#64748B", marginTop: 2 }}>{spec.cap} pers.</div>
      {curr.booking ? (
        <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.25 }}>
          <div style={{ fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {curr.booking.who}
          </div>
          <div style={{ color: "#64748B" }}>{curr.booking.time}</div>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 22, color: "#94A3B8", lineHeight: 1.25 }}>{curr.next ?? "Sin reservas próximas"}</div>
      )}
      <div style={{ position: "absolute", left: 24, top: BTN_Y, display: "flex", gap: 10 }}>
        {btns.map((b, i) => {
          const tap = taps.find((t) => t.button === i && frame >= t.at - 2 && frame < t.at + 6);
          const press = tap ? interpolate(frame, [tap.at - 2, tap.at, tap.at + 6], [1, 0.9, 1], clamp) : 1;
          return (
            <div
              key={b.label}
              style={{
                width: b.w,
                height: BTN_H,
                boxSizing: "border-box",
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                fontWeight: 800,
                background: b.primary ? BRAND.color : "#FFFFFF",
                color: b.primary ? "#FFFFFF" : "#0F2A2A",
                border: b.primary ? "none" : "2px solid #D9E4E2",
                scale: String(press),
              }}
            >
              {b.label}
            </div>
          );
        })}
      </div>
      {changed ? <Burst at={curr.at} color={h.border} size={60} spread={150} x={CARD_W / 2} y={PLAN.cardH / 2} /> : null}
    </div>
  );
};

/** Círculo de toque (borde de acento que se expande) en coordenadas del plano. */
const TapRipple: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -4 || t > 16) return null;
  // El "dedo" (punto) aparece justo antes y el anillo se abre al tocar.
  const dot = interpolate(t, [-4, 0, 6, 12], [0, 1, 1, 0], clamp);
  const ring = interpolate(t, [0, 16], [0.4, 1.8], clamp);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 34,
          top: y - 34,
          width: 68,
          height: 68,
          borderRadius: 999,
          background: "rgba(255,107,74,0.35)",
          border: `4px solid ${BRAND.accent}`,
          opacity: dot,
          scale: String(interpolate(t, [-4, 0, 3], [1.4, 0.9, 1], clamp)),
        }}
      />
      {t >= 0 ? (
        <div
          style={{
            position: "absolute",
            left: x - 60,
            top: y - 60,
            width: 120,
            height: 120,
            borderRadius: 999,
            border: `6px solid ${BRAND.accent}`,
            scale: String(ring),
            opacity: interpolate(t, [0, 16], [0.9, 0], clamp),
          }}
        />
      ) : null}
    </>
  );
};

type TableCardsProps = {
  zones: ZoneSpec[];
  business: string;
  shift: string;
  taps?: CardTap[];
  style?: React.CSSProperties;
};

/** Panel "Plano de sala" con tarjetas por zona. Las coordenadas internas son las de `cardRect`. */
export const TableCards: React.FC<TableCardsProps> = ({ zones, business, shift, taps = [], style }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        width: PLAN.width,
        height: planHeight(zones),
        borderRadius: 36,
        background: "#F3F7F6",
        fontFamily: FONT,
        boxShadow: "0 2px 4px rgba(15,42,42,0.12), 0 40px 100px rgba(0,0,0,0.45)",
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: PLAN.pad, top: 26, right: PLAN.pad }}>
        <div style={{ fontSize: 50, fontWeight: 900, color: "#0F2A2A", letterSpacing: -0.5 }}>Plano de sala</div>
        <div style={{ fontSize: 27, color: "#4A6362", display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#1F8A4C",
              opacity: interpolate(Math.sin(frame / 5), [-1, 1], [0.35, 1]),
            }}
          />
          Estado en vivo · {shift}
          <span style={{ marginLeft: "auto", fontWeight: 800, color: "#0F2A2A" }}>{business}</span>
        </div>
      </div>
      {zones.map((z, zi) => {
        const first = cardRect(zones, zi, 0);
        return (
          <div key={z.name}>
            <div
              style={{ position: "absolute", left: PLAN.pad, top: first.y - PLAN.zoneLabel + 10, fontSize: 27, fontWeight: 700, color: "#64748B" }}
            >
              {z.name}
            </div>
            {z.tables.map((t, ti) => {
              const r = cardRect(zones, zi, ti);
              return (
                <div key={t.name} style={{ position: "absolute", left: r.x, top: r.y }}>
                  <Card spec={t} taps={taps.filter((tp) => tp.zone === zi && tp.table === ti)} />
                </div>
              );
            })}
          </div>
        );
      })}
      {taps.map((tp, i) => {
        const r = cardRect(zones, tp.zone, tp.table);
        const { curr } = stateAt(zones[tp.zone].tables[tp.table].states, tp.at - 1);
        const c = buttonCenter(curr, tp.button);
        return <TapRipple key={i} x={r.x + c.x} y={r.y + c.y} at={tp.at} />;
      })}
    </div>
  );
};
