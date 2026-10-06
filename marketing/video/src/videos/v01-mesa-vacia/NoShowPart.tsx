import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FloorPlan } from "../../components/FloorPlan";
import { EASE_IN, EASE_OUT, clamp } from "../../lib/anim";
import { FIXTURES, PLAN_BOX, TABLES } from "./layout";
import { WallClock } from "./WallClock";

type Props = {
  /** Inicio de la escena 2 (reloj), relativo a esta parte. */
  clockAt: number;
  /** Frame en el que la parte sale para dejar paso al móvil. */
  exitAt: number;
};

/** Escenas 1-2: la mesa 4 no se presenta y se queda vacía toda la noche. */
export const NoShowPart: React.FC<Props> = ({ clockAt, exitAt }) => {
  const frame = useCurrentFrame();

  return (
    <>
      <FloorPlan
        width={PLAN_BOX.width}
        height={PLAN_BOX.height}
        subtitle="Viernes · 21:00"
        fixtures={FIXTURES}
        style={{
          left: PLAN_BOX.left,
          top: PLAN_BOX.top,
          scale:
            interpolate(frame, [0, 12], [1.06, 1], { ...clamp, easing: EASE_OUT }) *
            interpolate(frame, [exitAt, exitAt + 10], [1, 0.9], { ...clamp, easing: EASE_IN }),
          opacity: interpolate(frame, [exitAt, exitAt + 10], [1, 0], clamp),
        }}
        tables={[
          { ...TABLES.T1, status: "seated" },
          { ...TABLES.T2, status: "seated" },
          { ...TABLES.T3, status: "seated" },
          {
            ...TABLES.T4,
            status: "noShow",
            blink: { from: 0, to: clockAt },
            tags: [
              { text: "Marta · 4 pers · 21:00", dot: "noShow", from: 6, to: clockAt },
              { text: "Vacía toda la noche", dot: "noShow", from: clockAt + 4 },
            ],
          },
          { ...TABLES.T5, status: "confirmed", changes: [{ at: clockAt + 14, to: "seated" }] },
          { ...TABLES.T6, status: "seated" },
          { ...TABLES.T7, status: "seated" },
          { ...TABLES.T8, status: "free", changes: [{ at: clockAt + 46, to: "seated" }] },
          { ...TABLES.T9, status: "confirmed", changes: [{ at: clockAt + 30, to: "seated" }] },
        ]}
      />
      <WallClock
        size={210}
        at={clockAt}
        fromMinutes={21 * 60}
        toMinutes={22 * 60}
        runFrom={clockAt + 6}
        runTo={clockAt + 80}
        style={{
          left: PLAN_BOX.left + PLAN_BOX.width - 170,
          top: PLAN_BOX.top + 120,
          opacity: interpolate(frame, [exitAt, exitAt + 8], [1, 0], clamp),
        }}
      />
    </>
  );
};
