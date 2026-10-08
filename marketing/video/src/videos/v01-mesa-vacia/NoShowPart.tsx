import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Camera } from "../../components/Camera";
import { FloorPlan } from "../../components/FloorPlan";
import { whip } from "../../lib/anim";
import { FIXTURES, PLAN_BOX, TABLES, tableCenter } from "./layout";
import { WallClock } from "./WallClock";

/** Con `center` en este punto, enfocarlo a escala 1 deja el plano en su sitio. */
const STAGE = { x: 540, y: 1010 };

type Props = {
  /** Cuando la voz dice "no (vino)": golpe de cámara. */
  noAt: number;
  /** Inicio de la escena 2: la cámara se abre y aparece el reloj. */
  revealAt: number;
  /** Cuando la voz dice "perdida". */
  lostAt: number;
  /** Salida rápida hacia la izquierda. */
  exitAt: number;
};

/**
 * Escenas 1-2: primer plano de la mesa 4 en rojo (no-show); la cámara se abre
 * y el resto de la sala está llena mientras el reloj corre.
 */
export const NoShowPart: React.FC<Props> = ({ noAt, revealAt, lostAt, exitAt }) => {
  const frame = useCurrentFrame();
  const t4 = tableCenter("T4");

  return (
    <AbsoluteFill style={whip(frame, exitAt, "out", "left")}>
      <Camera
        keys={[
          { at: 0, scale: 1.5, focus: t4 },
          { at: noAt, scale: 1.55, focus: t4 },
          { at: noAt + 5, scale: 1.75, focus: t4 },
          { at: revealAt, scale: 1.75, focus: t4 },
          { at: revealAt + 12, scale: 1, focus: STAGE },
          { at: lostAt, scale: 1, focus: STAGE },
          { at: lostAt + 8, scale: 1.08, focus: t4 },
        ]}
        center={STAGE}
        fadeTop={420}
        shakes={[
          { at: noAt, intensity: 26 },
          { at: lostAt, intensity: 14 },
        ]}
      >
        <FloorPlan
          width={PLAN_BOX.width}
          height={PLAN_BOX.height}
          subtitle="Viernes · 21:00"
          fixtures={FIXTURES}
          style={{ left: PLAN_BOX.left, top: PLAN_BOX.top }}
          tables={[
            { ...TABLES.T1, status: "seated" },
            { ...TABLES.T2, status: "seated" },
            { ...TABLES.T3, status: "seated" },
            {
              ...TABLES.T4,
              status: "noShow",
              blink: { from: 0, to: lostAt + 30 },
              tags: [
                { text: "Marta · 4 pers · 21:00", dot: "noShow", from: 3, to: revealAt + 6 },
                { text: "Vacía toda la noche", dot: "noShow", from: revealAt + 10 },
              ],
            },
            { ...TABLES.T5, status: "confirmed", changes: [{ at: revealAt + 10, to: "seated" }] },
            { ...TABLES.T6, status: "seated" },
            { ...TABLES.T7, status: "seated" },
            { ...TABLES.T8, status: "free", changes: [{ at: revealAt + 18, to: "seated" }] },
            { ...TABLES.T9, status: "confirmed", changes: [{ at: revealAt + 14, to: "seated" }] },
          ]}
        />
        <WallClock
          size={200}
          at={revealAt + 4}
          fromMinutes={21 * 60}
          toMinutes={22 * 60}
          runFrom={revealAt + 8}
          runTo={lostAt + 4}
          style={{ left: PLAN_BOX.left + PLAN_BOX.width - 165, top: PLAN_BOX.top + 125 }}
        />
      </Camera>
    </AbsoluteFill>
  );
};
