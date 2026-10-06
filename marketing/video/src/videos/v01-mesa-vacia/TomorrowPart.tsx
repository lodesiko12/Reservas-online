import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FloorPlan } from "../../components/FloorPlan";
import { Notification } from "../../components/Notification";
import { EASE_IN, clamp, springIn } from "../../lib/anim";
import { FIXTURES, PLAN_BOX, TABLES } from "./layout";

type Props = {
  /** Frame en el que la mesa 4 pasa de pendiente a confirmada. */
  confirmAt: number;
  /** Inicio de la escena 5 (cancelación y nueva reserva). */
  rebookAt: number;
  /** Frame en el que sale para dar paso al cierre. */
  exitAt: number;
};

/**
 * Escenas 4 (segunda mitad) y 5: el plano de mañana. La mesa de Marta se
 * confirma; la 6 se cancela, queda libre y entra una reserva nueva.
 */
export const TomorrowPart: React.FC<Props> = ({ confirmAt, rebookAt, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const enter = springIn(frame, fps, 0, { damping: 17, stiffness: 130 });
  const exit = interpolate(frame, [exitAt, exitAt + 8], [0, 1], { ...clamp, easing: EASE_IN });

  const cancelAt = rebookAt + 8;
  const freeAt = rebookAt + 38;
  const newBookingAt = rebookAt + 52;
  const bookedAt = rebookAt + 62;

  return (
    <>
      <FloorPlan
        width={PLAN_BOX.width}
        height={PLAN_BOX.height}
        subtitle="Mañana · 21:00"
        fixtures={FIXTURES}
        style={{
          left: PLAN_BOX.left,
          top: PLAN_BOX.top,
          translate: `0px ${interpolate(enter, [0, 1], [1400, 0])}px`,
          scale: 1 - exit * 0.1,
          opacity: 1 - exit,
        }}
        tables={[
          { ...TABLES.T1, status: "confirmed" },
          { ...TABLES.T2, status: "free" },
          { ...TABLES.T3, status: "pending" },
          {
            ...TABLES.T4,
            status: "pending",
            changes: [{ at: confirmAt, to: "confirmed" }],
            tags: [
              { text: "Marta · 4 pers · 21:00", dot: "pending", from: 6, to: confirmAt },
              { text: "Marta · Confirmada ✓", dot: "confirmed", from: confirmAt + 2, to: rebookAt },
            ],
          },
          { ...TABLES.T5, status: "confirmed" },
          {
            ...TABLES.T6,
            status: "confirmed",
            changes: [
              { at: cancelAt, to: "cancelled" },
              { at: freeAt, to: "free" },
              { at: bookedAt, to: "confirmed" },
            ],
            tags: [
              { text: "Cancelada", dot: "cancelled", from: cancelAt + 2, to: freeAt },
              { text: "Libre de nuevo", from: freeAt + 2, to: bookedAt },
              { text: "Lucía · 2 pers · 21:30", dot: "confirmed", from: bookedAt + 2 },
            ],
          },
          { ...TABLES.T7, status: "confirmed" },
          { ...TABLES.T8, status: "free" },
          { ...TABLES.T9, status: "pending" },
        ]}
      />
      <Notification
        title="Reserva cancelada"
        body="Mesa 6 · mañana 21:30 · 2 pers."
        status="cancelled"
        at={rebookAt + 2}
        hideAt={freeAt + 4}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
      <Notification
        title="Nueva reserva"
        body="Lucía · Mesa 6 · mañana 21:30 · 2 pers."
        status="confirmed"
        at={newBookingAt}
        hideAt={exitAt - 2}
        width={920}
        style={{ left: (width - 920) / 2, top: PLAN_BOX.top - 90 }}
      />
    </>
  );
};
