import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Camera } from "../../components/Camera";
import { FloorPlan } from "../../components/FloorPlan";
import { Notification } from "../../components/Notification";
import { EASE_IN, clamp, whip } from "../../lib/anim";
import { FIXTURES, PLAN_BOX, TABLES, tableCenter } from "./layout";

/** Punto del lienzo donde se coloca lo enfocado (a la izquierda de la miniatura del móvil). */
const CENTER = { x: 470, y: 1010 };

type Props = {
  /** La mesa 4 pasa a confirmada (cuando la voz dice "confirma"). */
  confirmAt: number;
  /** Inicio de la escena 5: la cámara viaja a la mesa 6. */
  rebookAt: number;
  /** "cancela" → mesa 6 cancelada. */
  cancelAt: number;
  /** "libre" → mesa 6 libre. */
  freeAt: number;
  /** "otro" → entra una reserva nueva en la mesa 6. */
  bookedAt: number;
  /** Salida (zoom hacia dentro) para dar paso al cierre. */
  exitAt: number;
};

/**
 * Escenas 4-5: el plano de mañana. La mesa de Marta se confirma; la 6 se
 * cancela, queda libre y entra una reserva nueva.
 */
export const TomorrowPart: React.FC<Props> = ({ confirmAt, rebookAt, cancelAt, freeAt, bookedAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t4 = tableCenter("T4");
  const t6 = tableCenter("T6");
  const exit = interpolate(frame, [exitAt, exitAt + 7], [0, 1], { ...clamp, easing: EASE_IN });

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, scale: String(1 + exit * 0.5) }}>
      <AbsoluteFill style={whip(frame, 0, "in", "down", 10, 1400)}>
        <Camera
          keys={[
            { at: 0, scale: 1.3, focus: t4 },
            { at: rebookAt, scale: 1.3, focus: t4 },
            { at: rebookAt + 10, scale: 1.35, focus: t6 },
            { at: bookedAt + 6, scale: 1.35, focus: t6 },
            { at: bookedAt + 22, scale: 1, focus: CENTER }, // encuadre completo
          ]}
          center={CENTER}
          fadeTop={430}
          shakes={[
            { at: confirmAt, intensity: 10 },
            { at: cancelAt, intensity: 16 },
          ]}
        >
          <FloorPlan
            width={PLAN_BOX.width}
            height={PLAN_BOX.height}
            subtitle="Mañana · 21:00"
            fixtures={FIXTURES}
            style={{ left: PLAN_BOX.left, top: PLAN_BOX.top }}
            tables={[
              { ...TABLES.T1, status: "confirmed" },
              { ...TABLES.T2, status: "free" },
              { ...TABLES.T3, status: "pending" },
              {
                ...TABLES.T4,
                status: "pending",
                changes: [{ at: confirmAt, to: "confirmed", burst: true }],
                tags: [
                  { text: "Marta · 4 pers · 21:00", dot: "pending", from: 4, to: confirmAt },
                  { text: "Marta · Confirmada ✓", dot: "confirmed", from: confirmAt + 1, to: rebookAt + 4 },
                ],
              },
              { ...TABLES.T5, status: "confirmed" },
              {
                ...TABLES.T6,
                status: "confirmed",
                changes: [
                  { at: cancelAt, to: "cancelled", burst: true },
                  { at: freeAt, to: "free" },
                  { at: bookedAt, to: "confirmed", burst: true },
                ],
                tags: [
                  { text: "Cancelada", dot: "cancelled", from: cancelAt + 1, to: freeAt },
                  { text: "¡Libre otra vez!", from: freeAt + 1, to: bookedAt },
                  { text: "Lucía · 2 pers · 21:30", dot: "confirmed", from: bookedAt + 1 },
                ],
              },
              { ...TABLES.T7, status: "confirmed" },
              { ...TABLES.T8, status: "free" },
              { ...TABLES.T9, status: "pending" },
            ]}
          />
        </Camera>
      </AbsoluteFill>
      <Notification
        title="Reserva cancelada"
        body="Mesa 6 · mañana 21:30 · 2 pers."
        status="cancelled"
        at={cancelAt - 3}
        hideAt={freeAt}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
      <Notification
        title="Nueva reserva"
        body="Lucía · Mesa 6 · mañana 21:30 · 2 pers."
        status="confirmed"
        at={bookedAt - 4}
        hideAt={exitAt - 4}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
    </AbsoluteFill>
  );
};
