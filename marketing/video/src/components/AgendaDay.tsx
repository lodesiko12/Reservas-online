import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { clamp, pop } from "../lib/anim";
import { COLORS, FONT, RADIUS, SHADOW_CARD, STATUS } from "../theme";
import { Burst } from "./Burst";

export type AgendaRow = {
  start: string;
  end: string;
  name: string;
  /** "Mesa 6 · 4 pers." */
  detail: string;
  source: "web" | "manual";
  /** Frame en el que la fila entra (se inserta abriendo hueco y con destello). Sin él, ya está. */
  insertAt?: number;
};

type AgendaDayProps = {
  title?: string;
  date: string;
  rows: AgendaRow[];
  width: number;
  style?: React.CSSProperties;
};

const ROW_H = 118;

/**
 * Agenda en vista Día del panel (móvil), imitada de `capturas/panel/restaurante/movil/agenda-dia.png`:
 * hora de inicio/fin, cliente, mesa y comensales, etiqueta web/manual y estado.
 */
export const AgendaDay: React.FC<AgendaDayProps> = ({ title = "Agenda", date, rows, width, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: "absolute", width, fontFamily: FONT, color: COLORS.ink, ...style }}>
      <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: -1 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 600, color: COLORS.inkMuted, marginTop: 4, marginBottom: 28 }}>{date}</div>
      <div
        style={{
          borderRadius: RADIUS.lg,
          background: COLORS.card,
          border: `2px solid ${COLORS.cardBorder}`,
          boxShadow: SHADOW_CARD,
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => {
          const isNew = r.insertAt !== undefined;
          const open = isNew ? interpolate(frame, [r.insertAt!, r.insertAt! + 7], [0, 1], clamp) : 1;
          const p = isNew ? pop(frame, fps, r.insertAt! + 3) : 1;
          const glow = isNew ? interpolate(frame, [r.insertAt! + 3, r.insertAt! + 10, r.insertAt! + 40], [0, 1, 0.35], clamp) : 0;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                height: ROW_H * open,
                overflow: "visible",
                borderTop: i === 0 || open < 0.05 ? undefined : `2px solid ${COLORS.cardBorder}`,
                background: `color-mix(in srgb, ${BRAND.accent} ${Math.round(glow * 14)}%, white)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 34px",
                  gap: 26,
                  opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
                  scale: String(interpolate(p, [0, 1], [0.85, 1])),
                }}
              >
                <div style={{ width: 110, display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: BRAND.colorDark }}>{r.start}</span>
                  <span style={{ fontSize: 26, fontWeight: 600, color: COLORS.textMuted }}>{r.end}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  <span style={{ fontSize: 26, fontWeight: 600, color: COLORS.inkMuted }}>{r.detail}</span>
                </div>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    padding: "6px 18px",
                    borderRadius: RADIUS.pill,
                    background: r.source === "web" ? "#E8F4F3" : "#EEF1F1",
                    color: r.source === "web" ? BRAND.colorDark : COLORS.inkMuted,
                  }}
                >
                  {r.source}
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    padding: "6px 18px",
                    borderRadius: RADIUS.pill,
                    background: "#D5ECE8",
                    color: BRAND.colorDark,
                  }}
                >
                  {STATUS.confirmed.label}
                </span>
              </div>
              {isNew ? <Burst at={r.insertAt! + 3} color={STATUS.confirmed.solid} size={60} spread={90} x={width - 120} y={ROW_H / 2} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
