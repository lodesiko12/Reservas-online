/**
 * Analiza una canción y genera el mapa de golpes (beats) para sincronizar los cortes.
 *   npm run beats -- public/music/mi-cancion.mp3          → analiza un archivo
 *   npm run beats -- public/music                         → analiza todos y los compara
 *
 * Salida (por canción): src/music/<nombre>.beats.json con BPM, golpes, compases y fuerza de cada
 * golpe, más una tabla de aptitud en consola. Asume tempo constante (música electrónica/pop de
 * producción): si el pulso deriva, la "regularidad" lo delata.
 * Necesita ffmpeg en el PATH.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const SR = 22050;
const N = 1024;
const HOP = 256;
const FPS = 30;
const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;

type BeatInfo = {
  t: number;
  frame: number;
  bar: number;
  beatInBar: number;
  strength: number;
  strong: boolean;
};

type Analysis = {
  file: string;
  durationSec: number;
  bpm: number;
  beatSec: number;
  firstBeatSec: number;
  regularity: number;
  kickClarity: number;
  tempoStability: number;
  beats: BeatInfo[];
};

function decode(file: string): Float32Array {
  const buf = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Flujo espectral con compresión logarítmica: total y solo graves (bombo, < ~150 Hz). */
function onsetEnvelopes(samples: Float32Array) {
  const frames = Math.floor((samples.length - N) / HOP);
  const hann = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const bins = N / 2;
  const lowBin = Math.round((150 / (SR / 2)) * bins);
  const prev = new Float64Array(bins);
  const total = new Float64Array(frames);
  const low = new Float64Array(frames);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) {
      re[i] = samples[f * HOP + i] * hann[i];
      im[i] = 0;
    }
    fft(re, im);
    let sumAll = 0;
    let sumLow = 0;
    for (let b = 0; b < bins; b++) {
      const mag = Math.log1p(100 * Math.hypot(re[b], im[b]) / N);
      const d = mag - prev[b];
      prev[b] = mag;
      if (d > 0) {
        sumAll += d;
        if (b <= lowBin) sumLow += d;
      }
    }
    total[f] = sumAll;
    low[f] = sumLow;
  }
  const normalize = (a: Float64Array) => {
    // quita la media local para que solo queden los picos
    const out = new Float64Array(a.length);
    const w = Math.round(1 / (HOP / SR)); // ~1 s
    let acc = 0;
    for (let i = 0; i < a.length; i++) {
      acc += a[i];
      if (i >= 2 * w) acc -= a[i - 2 * w];
      const mean = acc / Math.min(i + 1, 2 * w);
      out[i] = Math.max(0, a[i] - mean);
    }
    const max = out.reduce((m, v) => Math.max(m, v), 1e-9);
    return out.map((v) => v / max);
  };
  return { total: normalize(total), low: normalize(low) };
}

/** Puntuación de una rejilla (periodo y fase en frames) sobre la envolvente. */
function combScore(env: Float64Array, period: number, phase: number) {
  let s = 0;
  let n = 0;
  for (let t = phase; t < env.length - 1; t += period) {
    const i = Math.round(t);
    s += Math.max(env[i - 1] ?? 0, env[i] ?? 0, env[i + 1] ?? 0);
    n++;
  }
  return n ? s / n : 0;
}

function bestGrid(env: Float64Array, framesPerSec: number, lo = 80, hi = 180) {
  let best = { bpm: 0, phase: 0, score: -1 };
  for (let bpm = lo; bpm <= hi; bpm += 0.1) {
    const period = (framesPerSec * 60) / bpm;
    // sesgo suave hacia 100-140 BPM para no confundir el pulso con su doble o su mitad
    const prior = bpm >= 100 && bpm <= 140 ? 1 : 0.9;
    for (let phase = 0; phase < period; phase += 1) {
      const score = combScore(env, period, phase) * prior;
      if (score > best.score) best = { bpm, phase, score };
    }
  }
  return best;
}

function analyze(file: string): Analysis {
  const samples = decode(file);
  const durationSec = samples.length / SR;
  const fps = SR / HOP;
  const { total, low } = onsetEnvelopes(samples);
  const env = total.map((v, i) => 0.6 * v + 0.4 * low[i]);

  const grid = bestGrid(env, fps);
  // afinado: ±0,6 BPM con pasos de 0,02
  let { bpm, phase } = grid;
  let bestScore = grid.score;
  for (let b = grid.bpm - 0.6; b <= grid.bpm + 0.6; b += 0.02) {
    const period = (fps * 60) / b;
    for (let p = Math.max(0, grid.phase - 3); p < grid.phase + 3; p += 0.25) {
      const sc = combScore(env, period, p);
      if (sc > bestScore) {
        bestScore = sc;
        bpm = b;
        phase = p;
      }
    }
  }
  const period = (fps * 60) / bpm;

  // estabilidad: BPM de cada mitad de la canción
  const half = Math.floor(env.length / 2);
  const h1 = bestGrid(env.slice(0, half), fps, bpm - 4, bpm + 4).bpm;
  const h2 = bestGrid(env.slice(half), fps, bpm - 4, bpm + 4).bpm;
  const tempoStability = Math.max(0, 1 - Math.abs(h1 - h2) / 2);

  // golpes y su fuerza (el kick manda)
  const beatFrames: number[] = [];
  for (let t = phase; t < env.length - 2; t += period) beatFrames.push(t);
  const strengths = beatFrames.map((t) => {
    const i = Math.round(t);
    let m = 0;
    for (let k = -2; k <= 2; k++) m = Math.max(m, low[i + k] ?? 0, 0.6 * (total[i + k] ?? 0));
    return m;
  });

  // primer tiempo del compás: el desfase 0-3 cuyos golpes suman más energía grave
  const barSums = [0, 0, 0, 0];
  strengths.forEach((s, i) => (barSums[i % 4] += s));
  const downbeatOffset = barSums.indexOf(Math.max(...barSums));

  // el instante del golpe es el centro de la ventana de análisis
  const sec = (f: number) => (f * HOP + N / 2) / SR;
  const median = [...strengths].sort((a, b) => a - b)[Math.floor(strengths.length / 2)] ?? 0;
  const beats: BeatInfo[] = beatFrames.map((t, i) => {
    const rel = i - downbeatOffset;
    return {
      t: +sec(t).toFixed(3),
      frame: Math.round(sec(t) * FPS),
      bar: Math.floor(rel / 4),
      beatInBar: ((rel % 4) + 4) % 4,
      strength: +strengths[i].toFixed(3),
      strong: strengths[i] >= Math.max(median * 1.3, 0.35),
    };
  });

  const hits = strengths.filter((s) => s > 0.25).length;
  const meanAll = env.reduce((a, b) => a + b, 0) / env.length;
  const meanBeat = strengths.reduce((a, b) => a + b, 0) / strengths.length;

  return {
    file: path.basename(file),
    durationSec: +durationSec.toFixed(1),
    bpm: +bpm.toFixed(2),
    beatSec: +(60 / bpm).toFixed(4),
    firstBeatSec: beats[0]?.t ?? 0,
    regularity: +(hits / strengths.length).toFixed(2),
    kickClarity: +Math.min(1, meanBeat / (meanAll * 4 + 1e-9)).toFixed(2),
    tempoStability: +tempoStability.toFixed(2),
    beats,
  };
}

/** 0-100: tempo en rango 110-130, pulso regular, kicks nítidos, tempo estable y duración útil. */
function fitness(a: Analysis) {
  const bpmFit = a.bpm >= 110 && a.bpm <= 130 ? 1 : a.bpm >= 100 && a.bpm <= 140 ? 0.7 : 0.35;
  const lenFit = a.durationSec >= 45 ? 1 : a.durationSec >= 25 ? 0.8 : 0.4;
  return Math.round(
    100 * (0.3 * bpmFit + 0.25 * a.regularity + 0.2 * a.kickClarity + 0.15 * a.tempoStability + 0.1 * lenFit),
  );
}

function collect(target: string): string[] {
  if (statSync(target).isDirectory()) {
    return readdirSync(target)
      .filter((f) => AUDIO_EXT.test(f))
      .map((f) => path.join(target, f));
  }
  return [target];
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Uso: npm run beats -- <archivo|carpeta>");
    process.exit(1);
  }
  const files = collect(target);
  if (!files.length) {
    console.error("No hay audio (mp3/wav/m4a/ogg/flac) en", target);
    process.exit(1);
  }
  const outDir = path.resolve(__dirname, "..", "src", "music");
  mkdirSync(outDir, { recursive: true });
  const rows = files.map((f) => {
    const a = analyze(f);
    const out = path.join(outDir, `${path.parse(f).name}.beats.json`);
    writeFileSync(out, JSON.stringify(a, null, 1));
    return { a, score: fitness(a) };
  });
  rows.sort((x, y) => y.score - x.score);
  console.table(
    rows.map(({ a, score }) => ({
      archivo: a.file,
      "dur (s)": a.durationSec,
      BPM: a.bpm,
      "1.er golpe (s)": a.firstBeatSec,
      regularidad: a.regularity,
      "kicks nítidos": a.kickClarity,
      "tempo estable": a.tempoStability,
      "golpes fuertes": a.beats.filter((b) => b.strong).length,
      "aptitud /100": score,
    })),
  );
  console.log(`Mapas de golpes en ${path.relative(process.cwd(), outDir)}${path.sep}<nombre>.beats.json`);
}

export { analyze, fitness };
export type { Analysis, BeatInfo };
