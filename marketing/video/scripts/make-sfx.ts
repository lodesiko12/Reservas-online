/**
 * Genera los efectos de sonido con ffmpeg (síntesis pura, sin descargas ni licencias).
 *   npm run sfx   →   public/sfx/*.wav
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(__dirname, "..", "public", "sfx");
mkdirSync(OUT, { recursive: true });

const SFX: Record<string, { seconds: number; expr: string }> = {
  // "Ding" seco: dos parciales de campana con caída rápida.
  ding: {
    seconds: 0.9,
    expr: "0.55*sin(2*PI*1320*t)*exp(-6*t)+0.25*sin(2*PI*2640*t)*exp(-11*t)+0.12*sin(2*PI*3960*t)*exp(-16*t)",
  },
  // "Pop" de burbuja: barrido descendente muy corto.
  pop: {
    seconds: 0.12,
    expr: "0.6*sin(2*PI*(900*t-2600*t*t))*exp(-38*t)",
  },
  // Aviso de notificación: dos notas ascendentes.
  chime: {
    seconds: 0.7,
    expr: "0.4*sin(2*PI*988*t)*exp(-9*t)*lt(t,0.12)+0.45*sin(2*PI*1319*(t-0.12))*exp(-7*(t-0.12))*gte(t,0.12)",
  },
  // Cambio de estado: "tic" suave.
  tick: {
    seconds: 0.08,
    expr: "0.35*sin(2*PI*2200*t)*exp(-60*t)",
  },
};

for (const [name, { seconds, expr }] of Object.entries(SFX)) {
  const file = path.join(OUT, `${name}.wav`);
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    // Las comas de la expresión se escapan: en un filtergraph separan filtros.
    "-f", "lavfi", "-i", `aevalsrc=${expr.replace(/,/g, "\\,")}:s=44100:d=${seconds}`,
    "-ac", "1", file,
  ]);
  console.log(`sfx/${name}.wav`);
}
