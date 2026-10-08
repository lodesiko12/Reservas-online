import { FLOOR_PLAN_CHROME, type Fixture, type TableSpec } from "../../components/FloorPlan";
import { LAYOUT } from "../../theme";

/** Posición y tamaño del plano de sala en este vídeo. */
export const PLAN_BOX = { left: 80, top: LAYOUT.stageTop, width: 920, height: 780 } as const;

export const FIXTURES: Fixture[] = [{ x: 790, y: 40, w: 90, h: 500, label: "BARRA", vertical: true }];

type Base = Pick<TableSpec, "id" | "label" | "shape" | "x" | "y" | "w" | "h" | "seats">;

/** Distribución de mesas (la misma sala en todas las escenas). */
export const TABLES: Record<string, Base> = {
  T1: { id: "T1", label: "1", shape: "round", x: 130, y: 115, w: 100, seats: 2 },
  T2: { id: "T2", label: "2", shape: "round", x: 310, y: 115, w: 100, seats: 2 },
  T3: { id: "T3", label: "3", shape: "square", x: 500, y: 120, w: 110, seats: 4 },
  T4: { id: "T4", label: "4", shape: "rect", x: 200, y: 320, w: 230, h: 130, seats: 4 },
  T5: { id: "T5", label: "5", shape: "square", x: 470, y: 320, w: 120, seats: 4 },
  T6: { id: "T6", label: "6", shape: "round", x: 655, y: 310, w: 130, seats: 4 },
  T7: { id: "T7", label: "7", shape: "rect", x: 230, y: 492, w: 260, h: 96, seats: 6 },
  T8: { id: "T8", label: "8", shape: "round", x: 480, y: 495, w: 96, seats: 2 },
  T9: { id: "T9", label: "9", shape: "square", x: 655, y: 495, w: 96, seats: 2 },
};

/** Centro de una mesa en coordenadas del lienzo (para apuntar la cámara). */
export const tableCenter = (id: keyof typeof TABLES) => ({
  x: PLAN_BOX.left + TABLES[id].x,
  y: PLAN_BOX.top + FLOOR_PLAN_CHROME.header + TABLES[id].y,
});
