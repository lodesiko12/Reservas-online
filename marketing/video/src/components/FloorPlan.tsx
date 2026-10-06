import type React from "react";
import { interpolate, interpolateColors, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, fadeOut, pop, pulse } from "../lib/anim";
import { COLORS, FONT, STATUS, type StatusKey, statusInk } from "../theme";

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
  /** Cambios de estado a lo largo del tiempo (frames relativos al plano). */
  changes?: { at: number; to: StatusKey }[];
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

const HEADER_H = 96;
const LEGEND_H = 86;
const CHAIR = { w: 40, h: 22, gap: 10, color: "#C6CCD8" };

/** Estado vigente en `frame` y progreso (0→1) del último cambio. */
const statusAt = (t: TableSpec, frame: number) => {
  const changes = [...(t.changes ?? [])].sort((a, b) => a.at - b.at);
  let prev: StatusKey = t.status;
  let curr: StatusKey = t.status;
  let lastAt = -Infinity;
  for (const c of changes) {
    if (frame >= c.at) {
      prev = curr;
      curr = c.to;
      lastAt = c.at;
    }
  }
  if (lastAt === -Infinity) return { status: curr, color: STATUS[curr].color, pulseScale: 1 };
  const color = interpolateColors(
    interpolate(frame, [lastAt, lastAt + 8], [0, 1], clamp),
    [0, 1],
    [STATUS[prev].color, STATUS[curr].color],
  );
  return { status: curr, color, pulseScale: pulse(frame, lastAt) };
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
 * Plano de sala sobre tarjeta clara. Las mesas cambian de color con `changes`,
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

  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: 44,
        background: COLORS.card,
        boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
        fontFamily: FONT,
        color: COLORS.ink,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          height: HEADER_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          borderBottom: `2px solid ${COLORS.cardBorder}`,
        }}
      >
        <span style={{ fontSize: 34, fontWeight: 800 }}>{title}</span>
        {subtitle ? (
          <span style={{ fontSize: 28, fontWeight: 600, color: COLORS.inkMuted }}>{subtitle}</span>
        ) : null}
      </div>

      {/* Área del plano */}
      <div
        style={{
          position: "absolute",
          top: HEADER_H,
          left: 0,
          right: 0,
          bottom: legend ? LEGEND_H : 0,
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
              borderRadius: 16,
              background: "#E4E7EF",
              border: `2px solid ${COLORS.cardBorder}`,
              display: "grid",
              placeItems: "center",
              color: COLORS.inkMuted,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            {f.label ? (
              <span style={{ rotate: f.vertical ? "-90deg" : "0deg", whiteSpace: "nowrap" }}>{f.label}</span>
            ) : null}
          </div>
        ))}

        {tables.map((t) => {
          const { status, color, pulseScale } = statusAt(t, frame);
          const w = t.w;
          const h = t.shape === "rect" ? (t.h ?? t.w * 0.6) : t.w;
          const blinking = t.blink && frame >= t.blink.from && frame < t.blink.to;
          const wave = blinking ? (Math.sin(((frame - t.blink!.from) / fps) * Math.PI * 2 * 2.2) + 1) / 2 : 0;
          const dimmed = dimExcept && !dimExcept.includes(t.id) ? dimAmount : 0;

          return (
            <div
              key={t.id}
              style={{
                position: "absolute",
                left: t.x,
                top: t.y,
                width: 0,
                height: 0,
                opacity: 1 - dimmed * 0.65,
              }}
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
                    borderRadius: 10,
                    background: CHAIR.color,
                    rotate: `${c.rot}deg`,
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  left: -w / 2,
                  top: -h / 2,
                  width: w,
                  height: h,
                  borderRadius: t.shape === "round" ? "50%" : 22,
                  background: color,
                  color: statusInk(status),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  scale: pulseScale,
                  opacity: 1 - wave * 0.35,
                  boxShadow: blinking
                    ? `0 0 0 ${8 + wave * 14}px ${STATUS.noShow.color}${Math.round(40 + wave * 60).toString(16)}`
                    : status === "free"
                      ? `inset 0 0 0 3px #C2C8D4`
                      : "0 6px 16px rgba(17,20,27,0.18)",
                }}
              >
                <span style={{ fontSize: w >= 120 ? 40 : 34, fontWeight: 800, lineHeight: 1 }}>{t.label}</span>
                {w >= 120 && status !== "free" ? (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginTop: 6,
                      opacity: 0.92,
                    }}
                  >
                    {STATUS[status].label}
                  </span>
                ) : null}
              </div>

              {(t.tags ?? [])
                .filter((tag) => frame >= tag.from && (tag.to === undefined || frame < tag.to + 8))
                .map((tag, i) => {
                  const p = pop(frame, fps, tag.from);
                  const out = tag.to === undefined ? 1 : fadeOut(frame, tag.to, 8);
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: h / 2 + CHAIR.gap + CHAIR.h + 18,
                        translate: "-50% 0",
                        transformOrigin: "50% 100%",
                        scale: interpolate(p, [0, 1], [0.6, 1]),
                        opacity: Math.min(interpolate(p, [0, 0.4], [0, 1], clamp), out),
                        background: COLORS.ink,
                        color: COLORS.white,
                        fontSize: 26,
                        fontWeight: 700,
                        padding: "12px 22px",
                        borderRadius: 18,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                        zIndex: 5,
                      }}
                    >
                      {tag.dot ? (
                        <span
                          style={{ width: 16, height: 16, borderRadius: "50%", background: STATUS[tag.dot].color }}
                        />
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
            height: LEGEND_H,
            borderTop: `2px solid ${COLORS.cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-evenly",
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.inkMuted,
          }}
        >
          {legend.map((k) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: STATUS[k].color }} />
              {STATUS[k].label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const FLOOR_PLAN_CHROME = { header: HEADER_H, legend: LEGEND_H };
