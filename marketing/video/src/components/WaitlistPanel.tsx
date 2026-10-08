import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";
import { EASE_OUT, clamp, pop } from "../lib/anim";
import { COLORS, FONT, STATUS } from "../theme";
import { Burst } from "./Burst";

/**
 * "Lista de espera" del Plano de sala, reconstruida del código real
 * (apps/dashboard/src/business/PlanoSala.tsx → WaitlistSection): título, subtítulo, botón "+ Añadir",
 * filas "Nombre · N pers." con "Zona: … · teléfono", insignia Esperando/Avisado y botones Avisar · Sentar · Cancelar.
 * No hay capturas de esta pantalla: los textos son los del código.
 */

export type WaitlistRow = {
  name: string;
  party: number;
  zone?: string;
  phone: string;
  /** Frame en el que se añade (abre hueco y entra). Sin él, ya estaba. */
  addAt?: number;
  /** Frame en el que pasa a "Avisado" (tras tocar Avisar). */
  notifyAt?: number;
  /** Frame en el que se sienta: la fila se cierra y sale de la lista. */
  seatAt?: number;
};

export type WaitlistTap = {
  row: number;
  button: "add" | "avisar" | "sentar";
  at: number;
};

const ROW_H = 180;

const Ripple: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -4 || t > 16) return null;
  const dot = interpolate(t, [-4, 0, 6, 12], [0, 1, 1, 0], clamp);
  return (
    <>
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 64,
          height: 64,
          margin: "-32px 0 0 -32px",
          borderRadius: 999,
          background: "rgba(255,107,74,0.35)",
          border: `4px solid ${BRAND.accent}`,
          opacity: dot,
        }}
      />
      {t >= 0 ? (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            margin: "-60px 0 0 -60px",
            borderRadius: 999,
            border: `6px solid ${BRAND.accent}`,
            scale: String(interpolate(t, [0, 16], [0.4, 1.8], clamp)),
            opacity: interpolate(t, [0, 16], [0.9, 0], clamp),
          }}
        />
      ) : null}
    </>
  );
};

const Btn: React.FC<{ label: string; primary?: boolean; tapAt?: number }> = ({
  label,
  primary,
  tapAt,
}) => {
  const frame = useCurrentFrame();
  const press =
    tapAt === undefined
      ? 1
      : interpolate(frame, [tapAt - 2, tapAt, tapAt + 6], [1, 0.9, 1], clamp);
  return (
    <span
      style={{
        position: "relative",
        padding: primary ? "14px 26px" : "10px 18px",
        borderRadius: 14,
        fontSize: primary ? 30 : 25,
        fontWeight: 800,
        background: primary ? BRAND.color : "#FFFFFF",
        color: primary ? "#FFFFFF" : COLORS.ink,
        border: primary ? "none" : "2px solid #D9E4E2",
        scale: String(press),
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {tapAt !== undefined ? <Ripple at={tapAt} /> : null}
    </span>
  );
};

export const WaitlistPanel: React.FC<{
  rows: WaitlistRow[];
  taps?: WaitlistTap[];
  width: number;
  style?: React.CSSProperties;
}> = ({ rows, taps = [], width, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tapFor = (row: number, button: WaitlistTap["button"]) =>
    taps.find((t) => t.row === row && t.button === button)?.at;

  return (
    <div
      style={{
        position: "absolute",
        width,
        fontFamily: FONT,
        color: COLORS.ink,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -0.5 }}>
            Lista de espera
          </div>
          <div
            style={{ fontSize: 29, fontWeight: 600, color: COLORS.inkMuted }}
          >
            Clientes sin mesa libre ahora mismo
          </div>
        </div>
        <Btn label="+ Añadir" primary tapAt={tapFor(-1, "add")} />
      </div>
      <div
        style={{
          borderRadius: 32,
          background: COLORS.card,
          border: `2px solid ${COLORS.cardBorder}`,
          boxShadow:
            "0 2px 4px rgba(15,42,42,0.10), 0 30px 70px rgba(15,42,42,0.22)",
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => {
          const open =
            (r.addAt === undefined
              ? 1
              : interpolate(frame, [r.addAt, r.addAt + 7], [0, 1], {
                  ...clamp,
                  easing: EASE_OUT,
                })) *
            (r.seatAt === undefined
              ? 1
              : interpolate(
                  frame,
                  [r.seatAt + 8, r.seatAt + 16],
                  [1, 0],
                  clamp,
                ));
          const p = r.addAt === undefined ? 1 : pop(frame, fps, r.addAt + 2);
          const notified = r.notifyAt !== undefined && frame >= r.notifyAt;
          const glow =
            r.addAt === undefined
              ? 0
              : interpolate(
                  frame,
                  [r.addAt + 2, r.addAt + 8, r.addAt + 40],
                  [0, 1, 0.3],
                  clamp,
                );
          const seated = r.seatAt !== undefined && frame >= r.seatAt;
          return (
            <div
              key={i}
              style={{
                position: "relative",
                height: ROW_H * open,
                overflow: "hidden",
                borderTop: i === 0 ? undefined : `2px solid #EEF3F2`,
                background: seated
                  ? STATUS.confirmed.tint
                  : `color-mix(in srgb, ${BRAND.accent} ${Math.round(glow * 12)}%, white)`,
              }}
            >
              <div
                style={{
                  height: ROW_H,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 30px",
                  opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
                  scale: String(interpolate(p, [0, 1], [0.85, 1])),
                }}
              >
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 38, fontWeight: 900 }}>
                    {r.name} · {r.party} pers.
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 600,
                      color: COLORS.inkMuted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Zona: {r.zone ?? "cualquiera"} · {r.phone}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      padding: "6px 16px",
                      borderRadius: 999,
                      background: notified ? "#FEF3C7" : "#F1F5F9",
                      color: notified ? "#B45309" : "#64748B",
                      scale: String(
                        r.notifyAt === undefined
                          ? 1
                          : interpolate(
                              frame,
                              [r.notifyAt, r.notifyAt + 4, r.notifyAt + 10],
                              [1, 1.25, 1],
                              clamp,
                            ),
                      ),
                    }}
                  >
                    {notified ? "Avisado" : "Esperando"}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!notified ? (
                      <Btn label="Avisar" tapAt={tapFor(i, "avisar")} />
                    ) : null}
                    <Btn label="Sentar" tapAt={tapFor(i, "sentar")} />
                    <Btn label="Cancelar" />
                  </div>
                </div>
              </div>
              {r.seatAt !== undefined ? (
                <Burst
                  at={r.seatAt}
                  color={STATUS.confirmed.solid}
                  size={80}
                  spread={140}
                  x={width - 220}
                  y={ROW_H / 2}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
