/**
 * Genera una pista PROVISIONAL de 120 BPM por síntesis pura (sin descargas ni licencias):
 *   npm run track          →   public/music/placeholder-120.wav           (drop en el beat 12, P01)
 *   npm run track -- 16    →   public/music/placeholder-120-drop16.wav    (drop en el beat 16)
 *
 * Sirve para desarrollar las plantillas con cortes sobre golpes mientras no hay canción definitiva.
 * Estructura pensada para las piezas T1 (S40):
 *   beats  0-11  oscuro (La menor, filtrado, kick + hats + caja desde el beat 4)
 *   beats  8-12  riser + redoble de caja, y un hueco de silencio justo antes del giro
 *   beat  12     DROP: crash + kick + bajo + acordes en Do mayor (brillante)
 *   beats 12-87  bucle de 4 compases: Do | Sol | La m | Fa
 * Cada beat dura 0,5 s (120 BPM) y el primer golpe cae en t = 0.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SR = 44100;
const BPM = 120;
const SPB = (SR * 60) / BPM; // muestras por beat
const BARS = 22;
const BEATS = BARS * 4;
const N = Math.round(BEATS * SPB) + SR; // + 1 s de cola

const drums = new Float32Array(N);
const harm = new Float32Array(N);
const fx = new Float32Array(N);

let seed = 7;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1; // ≈ [-1, 1)
};
const at = (beat: number) => Math.round(beat * SPB);
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

// ───────────── Batería ─────────────

function kick(beat: number, gain = 1) {
  const s0 = at(beat);
  let ph = 0;
  for (let i = 0; i < 0.32 * SR; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (48 + 120 * Math.exp(-t * 32))) / SR;
    drums[s0 + i] += gain * (Math.sin(ph) * Math.exp(-t * 8.5) + (i < 130 ? rnd() * 0.35 * (1 - i / 130) : 0));
  }
}

function clap(beat: number, gain = 1) {
  const s0 = at(beat);
  let prev = 0;
  for (let i = 0; i < 0.24 * SR; i++) {
    const t = i / SR;
    let env = 0;
    for (const k of [0, 0.01, 0.021]) if (t >= k) env += Math.exp(-(t - k) * (k === 0.021 ? 17 : 150));
    const n = rnd();
    const hp = n - prev;
    prev = n;
    drums[s0 + i] += gain * 0.42 * hp * env + gain * 0.16 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30);
  }
}

function hat(beat: number, gain = 1, open = false) {
  const s0 = at(beat);
  let prev = 0;
  const len = open ? 0.28 : 0.07;
  for (let i = 0; i < len * SR; i++) {
    const t = i / SR;
    const n = rnd();
    const hp = n - prev;
    prev = n;
    drums[s0 + i] += gain * 0.2 * hp * Math.exp(-t * (open ? 16 : 75));
  }
}

// ───────────── Armonía ─────────────

/** Suma de armónicos con envolvente y filtro paso bajo de un polo; escribe en `bus`. */
function voice(
  bus: Float32Array,
  beat: number,
  durBeats: number,
  midis: number[],
  opts: { harmonics: number; cutoff: number; gain: number; attack?: number; decay?: number },
) {
  const s0 = at(beat);
  const len = Math.round(durBeats * SPB);
  const a = Math.exp((-2 * Math.PI * opts.cutoff) / SR);
  const atk = opts.attack ?? 0.01;
  let y = 0;
  for (let i = 0; i < len + 2000; i++) {
    const t = i / SR;
    let x = 0;
    for (const m of midis) {
      const f = mtof(m);
      for (let k = 1; k <= opts.harmonics; k++) x += Math.sin(2 * Math.PI * f * k * t + m) / k;
    }
    x /= midis.length;
    const rel = i < len ? 1 : Math.max(0, 1 - (i - len) / 2000);
    const env = Math.min(1, t / atk) * (opts.decay ? Math.exp(-t * opts.decay) : 1) * rel;
    y = (1 - a) * x * env + a * y;
    bus[s0 + i] += y * opts.gain;
  }
}

// ───────────── Arreglo ─────────────

const AM = { bass: 45, chord: [57, 60, 64] };
const F = { bass: 41, chord: [53, 57, 60] };
const DM = { bass: 38, chord: [50, 53, 57] };
const E = { bass: 40, chord: [52, 56, 59] }; // tensión antes del drop
const BRIGHT = [
  { bass: 48, chord: [60, 64, 67] }, // C
  { bass: 43, chord: [59, 62, 67] }, // G
  { bass: 45, chord: [57, 60, 64] }, // Am
  { bass: 41, chord: [57, 60, 65] }, // F
];
/** Beat del drop (múltiplo de 4, ≥ 4): primer argumento de la línea de comandos. */
const DROP = Number(process.argv[2] ?? 12);
if (!(DROP >= 4 && DROP % 4 === 0)) throw new Error("El drop debe ser un múltiplo de 4 y ≥ 4");
const darkBars = DROP / 4;
const DARK = Array.from({ length: darkBars }, (_, i) => (i === darkBars - 1 ? E : [AM, F, DM][i % 3]));

for (let b = 0; b < BEATS; b++) {
  const bright = b >= DROP;
  const bar = Math.floor(b / 4);

  kick(b, b < 4 ? 0.85 : 1);
  if (b >= 4 && b % 4 !== 0 && b % 2 === 1 && !(b > DROP - 3 && b < DROP)) clap(b, bright ? 1 : 0.6);
  hat(b + 0.5, bright ? 0.7 : 0.5);
  if (bright) {
    hat(b + 0.25, 0.28);
    hat(b + 0.75, 0.28);
    hat(b + 0.5, 0.35, true);
  }

  if (!bright) {
    const p = DARK[Math.min(bar, darkBars - 1)];
    if (b % 4 === 0) voice(harm, b, 4, p.chord, { harmonics: 6, cutoff: 650, gain: 0.34, attack: 0.05 });
    voice(harm, b, 0.45, [p.bass], { harmonics: 3, cutoff: 900, gain: 0.5, decay: 3 });
  } else {
    const p = BRIGHT[Math.floor((b - DROP) / 4) % 4];
    voice(harm, b + 0.5, 0.42, [p.bass], { harmonics: 3, cutoff: 1200, gain: 0.62, decay: 2.5 });
    voice(harm, b + 0.5, 0.3, p.chord, { harmonics: 6, cutoff: 3600, gain: 0.3, decay: 7 });
    if (b >= DROP + 2) {
      const lead = [0, 1, 2, 1];
      for (let h = 0; h < 2; h++) {
        const n = p.chord[lead[(b * 2 + h) % 4]] + 12;
        voice(harm, b + h * 0.5, 0.4, [n], { harmonics: 4, cutoff: 4500, gain: 0.26, decay: 9, attack: 0.003 });
      }
    }
  }
}

// Redoble de caja (2 beats antes del drop) y riser (4 beats antes).
for (let k = 0; k < 4; k++) clap(DROP - 2 + k * 0.25, 0.28 + k * 0.05);
for (let k = 0; k < 12; k++) clap(DROP - 1 + k * 0.0625, 0.35 + k * 0.05);
{
  const s0 = at(DROP - 4);
  const len = at(DROP) - s0;
  let prev = 0;
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const n = rnd();
    const hp = n - prev;
    prev = n;
    ph += (2 * Math.PI * (220 + 1900 * p * p)) / SR;
    fx[s0 + i] += (hp * 0.22 + Math.sin(ph) * 0.12) * p * p;
  }
}
// Crash en el drop.
{
  const s0 = at(DROP);
  let prev = 0;
  for (let i = 0; i < 1.6 * SR; i++) {
    const n = rnd();
    const hp = n - prev;
    prev = n;
    fx[s0 + i] += hp * 0.55 * Math.exp((-i / SR) * 2.4);
  }
}

// Sidechain (el bajo y los acordes "respiran" con cada kick) y hueco antes del giro.
for (let i = 0; i < N; i++) {
  const sc = 1 - 0.55 * Math.exp(-((i % SPB) / SR) * 9);
  harm[i] *= sc;
}
const gapA = at(DROP - 0.25);
const gapB = at(DROP);
for (let i = gapA - 220; i < gapB; i++) {
  const g = i < gapA ? 1 - (i - (gapA - 220)) / 220 : 0;
  drums[i] *= i < at(DROP - 0.25) ? g : 0;
  harm[i] *= i < gapA ? g : 0;
}

// Mezcla y normalización.
const out = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  out[i] = drums[i] * 0.85 + harm[i] * 0.7 + fx[i] * 0.6;
  peak = Math.max(peak, Math.abs(out[i]));
}
const norm = 0.9 / peak;

const pcm = Buffer.alloc(44 + N * 2);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + N * 2, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); // PCM
pcm.writeUInt16LE(1, 22); // mono
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * norm)) * 32767), 44 + i * 2);

const dir = path.resolve(__dirname, "..", "public", "music");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, DROP === 12 ? "placeholder-120.wav" : `placeholder-120-drop${DROP}.wav`);
writeFileSync(file, pcm);
console.log(`${file}  (${(N / SR).toFixed(1)} s, ${BPM} BPM, ${BEATS} beats)`);
