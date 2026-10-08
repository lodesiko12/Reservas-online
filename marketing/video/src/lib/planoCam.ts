import { interpolate } from "remotion";
import { cardRect, type ZoneSpec } from "../components/TableCards";
import { EASE_OUT, clamp } from "./anim";

/** Cámara sobre el plano de sala: escala `z` con origen arriba-izquierda del plano y desplazamiento (tx, ty). */
export type Cam = { z: number; tx: number; ty: number };

export const OVERVIEW: Cam = { z: 1, tx: 0, ty: 0 };

/** Encuadra una tarjeta: la lleva al punto `focus` del lienzo con zoom `z` (el plano está en `plan`). */
export const focusOn = (
  zones: ZoneSpec[],
  zone: number,
  table: number,
  plan: { x: number; y: number },
  focus: { x: number; y: number },
  z = 2.25,
): Cam => {
  const r = cardRect(zones, zone, table);
  return { z, tx: focus.x - plan.x - (r.x + r.w / 2) * z, ty: focus.y - plan.y - (r.y + r.h / 2) * z };
};

/** Interpola la cámara entre fotogramas clave (cada movimiento dura `dur` frames con EASE_OUT). */
export const camAt = (frame: number, keys: { at: number; cam: Cam }[], dur = 12): Cam => {
  let cam = keys[0].cam;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (frame < k.at) break;
    const p = interpolate(frame, [k.at, k.at + dur], [0, 1], { ...clamp, easing: EASE_OUT });
    cam = { z: cam.z + (k.cam.z - cam.z) * p, tx: cam.tx + (k.cam.tx - cam.tx) * p, ty: cam.ty + (k.cam.ty - cam.ty) * p };
  }
  return cam;
};
