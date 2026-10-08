import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { clamp, fadeOut, pop, pulse } from "../lib/anim";
import { COLORS, FONT, RADIUS, SHADOW_CARD, STATUS, type StatusKey } from "../theme";
import { Burst } from "./Burst";

export type TableShape = "round" | "square" | "rect";

export type TableSpec = {
  id: string;
  /** Número o nombre corto que se pinta en la mesa. */
  label: string;
  shape: TableShape;
  /** Centro de la mesa en px, relativo al área del plano (debajo de la cabecera). */
  x: number;
  y: number;
  w: number;
  /** Solo para `rect`; en redondas/cuadradas el alto es `w`. */
  h?: number;
  seats: number;
  /** Estado inicial. */
  status: StatusKey;
  /** Cambios de estado a lo largo del tiempo (frames relativos al plano). `burst` = anillo + chispas. */
  changes?: { at: number; to: StatusKey; burst?: boolean }[];
  /** Parpadeo de alerta entre dos frames. */
  blink?: { from: number; to: number };
  /** Etiquetas flotantes sobre la mesa ("Marta · 4 pers · 21:00"). */
  tags?: { text: string; from: number; to?: number; dot?: StatusKey }[];
};

export type Fixture = { x: number; y: number; w: number; h: number; label?: string; vertical?: boolean };

type FloorPlanProps = {
  width: number;
  height: number;
  tables: TableSpec[];
  title?: string;
  /** Chip a la derecha de la cabecera ("Viernes · 21:00"). */
  subtitle?: string;
  /** Barra, cocina, entrada… (rectángulos de decorado, coordenadas del área del plano). */
  fixtures?: Fixture[];
  /** Leyenda de estados al pie; `false` para ocultarla. */
  legend?: StatusKey[] | false;
  /** Atenúa todas las mesas salvo estas (0 = nada, 1 = máximo). */
  dimExcept?: string[];
  dimAmount?: number;
  style?: React.CSSProperties;
};

export const FLOOR_PLAN_CHROME = { header: 100, legend: 88 } as const;
const CHAIR = { w: 42, h: 22, gap: 10, color: "#D9E4E2" };
const BORDER = 6;

/** Estado vigente en `frame` con colores interpolados durante el último cambio. */
const statusAt = (t: TableSpec, frame: number) => {
  const changes = [...(t.changes ?? [])].sort((a, b) => a.at - b.at);
  let prev: StatusKey = t.status;
  let curr: StatusKey = t.status;
  let last: (typeof changes)[number] | null = null;
  for (const c of changes) {
    if (frame >= c.at) {
      prev = curr;
      curr = c.to;
      last = c;
    }
  }
  const s = STATUS[curr];
  if (!last) return { status: curr, solid: s.solid, tint: s.tint, ink: s.ink, pulseScale: 1, last };
  const p = interpolate(frame, [last.at, last.at + 6], [0, 1], clamp);
  const mix = (k: "solid" | "tint" | "ink") => interpolateColors(p, [0, 1], [STATUS[prev][k], s[k]]);
  // Al cambiar, la mesa se "llena" del color fuerte un instante y vuelve al tinte.
  const flash = interpolate(frame, [last.at, last.at + 3, last.at + 12], [0, 1, 0], clamp);
  return {
    status: curr,
    solid: mix("solid"),
    tint: interpolateColors(flash, [0, 1], [mix("tint"), s.solid]),
    ink: interpolateColors(flash, [0, 1], [mix("ink"), "#FFFFFF"]),
    pulseScale: pulse(frame, last.at, 1.18, 12),
    last,
  };
};

/** Posiciones de las sillas (centro y rotación) alrededor de una mesa. */
const chairPositions = (t: TableSpec) => {
  const w = t.w;
  const h = t.shape === "rect" ? (t.h ?? t.w * 0.6) : t.w;
  const out: { x: number; y: number; rot: number }[] = [];
  const off = CHAIR.gap + CHAIR.h / 2;

  if (t.shape === "round") {
    for (let i = 0; i < t.seats; i++) {
      const a = (i / t.seats) * Math.PI * 2 - Math.PI / 2;
      const r = w / 2 + off;
      out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, rot: (a * 180) / Math.PI + 90 });
    }
    return out;
  }
  if (t.shape === "square" && t.seats === 4) {
    out.push({ x: 0, y: -h / 2 - off, rot: 0 }, { x: 0, y: h / 2 + off, rot: 0 });
    out.push({ x: -w / 2 - off, y: 0, rot: 90 }, { x: w / 2 + off, y: 0, rot: 90 });
    return out;
  }
  const top = Math.ceil(t.seats / 2);
  const bottom = t.seats - top;
  const row = (n: number, y: number) => {
    for (let i = 0; i < n; i++) out.push({ x: ((i + 0.5) / n - 0.5) * w, y, rot: 0 });
  };
  row(top, -h / 2 - off);
  row(bottom, h / 2 + off);
  return out;
};

/**
 * Plano de sala con el estilo del panel de Turnigo: mesas con fondo suave y
 * borde del color de estado. Cambian con `changes` (con destello y estallido),
 * parpadean con `blink` y muestran etiquetas flotantes con `tags`.
 */
export const FloorPlan: React.FC<FloorPlanProps> = ({
  width,
  height,
  tables,
  title = "Sala principal",
  subtitle,
  fixtures = [],
  legend = ["confirmed", "pending", "seated", "noShow"],
  dimExcept,
  dimAmount = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { header, legend: legendH } = FLOOR_PLAN_CHROME;

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: RADIUS.lg,
        background: COLORS.card,
        border: `2px solid ${COLORS.cardBorder}`,
        boxShadow: SHADOW_CARD,
        fontFamily: FONT,
        color: COLORS.ink,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          height: header,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 36px",
          borderBottom: `2px solid ${COLORS.cardBorder}`,
        }}
      >
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: -0.5 }}>{title}</span>
        {subtitle ? (
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: BRAND.color,
              background: "#E8F4F3",
              padding: "8px 20px",
              borderRadius: RADIUS.pill,
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>

      {/* Área del plano */}
      <div
        style={{
          position: "absolute",
          top: header,
          left: 0,
          right: 0,
          bottom: legend ? legendH : 0,
          background: COLORS.cardAlt,
          backgroundImage: `radial-gradient(${COLORS.cardBorder} 2px, transparent 2px)`,
          backgroundSize: "36px 36px",
        }}
      >
        {fixtures.map((f, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              width: f.w,
              height: f.h,
              borderRadius: RADIUS.md,
              background: "#E8F0EF",
              border: `2px solid ${COLORS.cardBorder}`,
              display: "grid",
              placeItems: "center",
              color: COLORS.textMuted,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 4,
            }}
          >
            {f.label ? (
              <span style={{ rotate: f.vertical ? "-90deg" : "0deg", whiteSpace: "nowrap" }}>{f.label}</span>
            ) : null}
          </div>
        ))}

        {tables.map((t) => {
          const st = statusAt(t, frame);
          const w = t.w;
          const h = t.shape === "rect" ? (t.h ?? t.w * 0.6) : t.w;
          const blinking = t.blink && frame >= t.blink.from && frame < t.blink.to;
          const wave = blinking ? (Math.sin(((frame - t.blink!.from) / fps) * Math.PI * 2 * 2.4) + 1) / 2 : 0;
          const dimmed = dimExcept && !dimExcept.includes(t.id) ? dimAmount : 0;

          return (
            <div
              key={t.id}
              style={{ position: "absolute", left: t.x, top: t.y, width: 0, height: 0, opacity: 1 - dimmed * 0.7 }}
            >
              {chairPositions(t).map((c, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: c.x - CHAIR.w / 2,
                    top: c.y - CHAIR.h / 2,
                    width: CHAIR.w,
                    height: CHAIR.h,
                    borderRadius: 11,
                    background: CHAIR.color,
                    rotate: `${c.rot}deg`,
                  }}
                />
              ))}
              {(t.changes ?? [])
                .filter((c) => c.burst)
                .map((c, i) => (
                  <Burst key={i} at={c.at} color={STATUS[c.to].solid} size={Math.max(w, h)} />
                ))}
              <div
                style={{
                  position: "absolute",
                  left: -w / 2,
                  top: -h / 2,
                  width: w,
                  height: h,
                  boxSizing: "border-box",
                  borderRadius: t.shape === "round" ? "50%" : RADIUS.md,
                  background: st.tint,
                  border: `${BORDER}px solid ${st.solid}`,
                  color: st.ink,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  scale: String(st.pulseScale),
                  boxShadow: blinking
                    ? `0 0 0 ${6 + wave * 16}px color-mix(in srgb, ${STATUS.noShow.solid} ${Math.round(20 + wave * 45)}%, transparent)`
                    : "0 4px 12px rgba(15,42,42,0.10)",
                }}
              >
                <span style={{ fontSize: w >= 120 ? 44 : 36, fontWeight: 900, lineHeight: 1 }}>{t.label}</span>
                {w >= 120 && st.status !== "free" ? (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginTop: 6,
                    }}
                  >
                    {STATUS[st.status].label}
                  </span>
                ) : null}
              </div>

              {(t.tags ?? [])
                .filter((tag) => frame >= tag.from && (tag.to === undefined || frame < tag.to + 6))
                .map((tag, i) => {
                  const p = pop(frame, fps, tag.from);
                  const out = tag.to === undefined ? 1 : fadeOut(frame, tag.to, 6);
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: h / 2 + CHAIR.gap + CHAIR.h + 16,
                        translate: "-50% 0",
                        transformOrigin: "50% 100%",
                        scale: String(interpolate(p, [0, 1], [0.5, 1])),
                        opacity: Math.min(interpolate(p, [0, 0.4], [0, 1], clamp), out),
                        background: COLORS.ink,
                        color: COLORS.white,
                        fontSize: 28,
                        fontWeight: 800,
                        padding: "12px 24px",
                        borderRadius: RADIUS.pill,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                        zIndex: 5,
                      }}
                    >
                      {tag.dot ? (
                        <span style={{ width: 16, height: 16, borderRadius: "50%", background: STATUS[tag.dot].solid }} />
                      ) : null}
                      {tag.text}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      {legend ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: legendH,
            borderTop: `2px solid ${COLORS.cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-evenly",
            fontSize: 23,
            fontWeight: 800,
          }}
        >
          {legend.map((k) => (
            <span
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: RADIUS.pill,
                background: STATUS[k].tint,
                color: STATUS[k].ink,
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: STATUS[k].solid }} />
              {STATUS[k].label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
