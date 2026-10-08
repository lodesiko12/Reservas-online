import type { BeatMapJson, TrackSpec } from "../lib/beats";
import placeholder from "./placeholder-120.beats.json";

/**
 * Pista activa de las piezas. Para cambiar de canción:
 *   1. déjala en `public/music/` y corre `npm run beats -- public/music`;
 *   2. apunta `src`, `map` y `bpm` a la nueva pista;
 *   3. fija `startSec` = segundo de la pista donde cae un PRIMER TIEMPO de compás (el analizador
 *      acierta el pulso, pero el compás hay que confirmarlo a oído) y comprueba el corte del giro.
 */
export const TRACK: TrackSpec = {
  /** Provisional sintética (`npm run track`), sin licencia que gestionar. */
  src: "music/placeholder-120.wav",
  bpm: (placeholder as BeatMapJson).bpm,
  startSec: 0,
  volume: 0.7,
};

/** Misma pista provisional con el drop en el beat 16 (`npm run track -- 16`), para piezas con giro en el 16. */
export const TRACK_DROP16: TrackSpec = { ...TRACK, src: "music/placeholder-120-drop16.wav" };

/** Drop en el beat 4 (`npm run track -- 4`): el título se construye sobre el riser y la acción arranca en el drop. */
export const TRACK_DROP4: TrackSpec = { ...TRACK, src: "music/placeholder-120-drop4.wav" };

/** Drop en el beat 28 (`npm run track -- 28`): tres bloques oscuros de "problema" y el giro claro al final (P14). */
export const TRACK_DROP28: TrackSpec = { ...TRACK, src: "music/placeholder-120-drop28.wav" };
