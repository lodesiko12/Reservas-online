/**
 * Genera la locución de un vídeo y los tiempos de cada palabra.
 *
 *   npm run voice -- v01-mesa-vacia
 *   npm run voice -- v01-mesa-vacia --samples Puck,Fenrir,Achird   (muestras para elegir voz)
 *
 * Lee   src/videos/<video>/script.ts   (texto por escena + `tts`)
 * Crea  public/audio/<video>/voice.mp3 (una sola toma, normalizada a -14 LUFS)
 *       src/videos/<video>/voice.json  (tramo y palabras de cada escena)
 *
 * Proveedores:
 *  - gemini: voz natural de Google con instrucciones de estilo. Clave gratuita de
 *    https://aistudio.google.com/apikey en `.env` → GEMINI_API_KEY=...
 *  - edge:   voces neuronales de Microsoft, sin clave (respaldo).
 *
 * Los tiempos de palabra salen de Whisper local (npm run whisper:install) y se
 * emparejan con el texto del guion, así que los subtítulos respetan su ortografía.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transcribe } from "@remotion/install-whisper-cpp";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { TtsConfig, VideoScript, VoiceTrack, VoiceWord } from "../src/lib/voice";
import { WHISPER_DIR, WHISPER_MODEL, WHISPER_VERSION } from "./whisper";

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(tmpdir(), `turnigo-voice-${Date.now()}`);

// ───────────────────────────── utilidades ─────────────────────────────

const loadEnv = () => {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);

const probeMs = (file: string) =>
  Math.round(
    Number(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
        .toString()
        .trim(),
    ) * 1000,
  );

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────── Gemini TTS ─────────────────────────────

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";

async function pickGeminiModel(key: string) {
  if (process.env.GEMINI_TTS_MODEL) return process.env.GEMINI_TTS_MODEL;
  const res = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new Error(`Gemini: no se pudo listar modelos (${res.status}): ${await res.text()}`);
  const { models = [] } = (await res.json()) as { models?: { name: string }[] };
  const tts = models.map((m) => m.name.replace(/^models\//, "")).filter((n) => n.includes("tts"));
  if (tts.length === 0) throw new Error("Gemini: la clave no tiene ningún modelo TTS disponible");
  // Preferimos "flash" (cuota gratuita) y la versión más nueva.
  tts.sort((a, b) => Number(b.includes("flash")) - Number(a.includes("flash")) || b.localeCompare(a));
  return tts[0];
}

async function geminiTts(text: string, cfg: TtsConfig, outWav: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY en marketing/video/.env (https://aistudio.google.com/apikey)");
  const model = await pickGeminiModel(key);
  const prompt = `${cfg.style ?? ""}\n\nLee exactamente este texto, sin añadir ni quitar nada:\n\n${text}`;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voice } } },
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
      };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part) throw new Error(`Gemini no devolvió audio: ${JSON.stringify(json).slice(0, 500)}`);
      const rate = Number(part.mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
      const pcm = path.join(TMP, `gemini-${Date.now()}.pcm`);
      writeFileSync(pcm, Buffer.from(part.data, "base64"));
      ffmpeg(["-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", pcm, outWav]);
      return model;
    }
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 8000 * attempt;
      console.warn(`Gemini ${res.status}, reintento ${attempt}/3 en ${wait / 1000} s…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Gemini ${res.status} con el modelo ${model}: ${body.slice(0, 800)}`);
  }
}

// ───────────────────────────── Edge TTS (respaldo) ─────────────────────────────

async function edgeTts(text: string, cfg: TtsConfig, outWav: string) {
  const dir = path.join(TMP, `edge-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(cfg.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { audioFilePath } = await tts.toFile(dir, escaped);
  tts.close();
  ffmpeg(["-i", audioFilePath, outWav]);
  return "edge-read-aloud";
}

// ───────────────────────────── postproceso ─────────────────────────────

/** Recorta silencios de los extremos, aplica tempo y normaliza a -14 LUFS (volumen típico de TikTok). */
function postprocess(rawWav: string, cfg: TtsConfig, outMp3: string, out16k: string) {
  const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05";
  const filters = [trim, "areverse", trim, "areverse"];
  if (cfg.tempo && cfg.tempo !== 1) filters.push(`atempo=${cfg.tempo}`);
  filters.push("loudnorm=I=-14:TP=-1.5:LRA=11", "apad=pad_dur=0.25");
  const master = path.join(TMP, "master.wav");
  ffmpeg(["-i", rawWav, "-af", filters.join(","), "-ar", "44100", "-ac", "1", master]);
  ffmpeg(["-i", master, "-c:a", "libmp3lame", "-b:a", "160k", outMp3]);
  ffmpeg(["-i", master, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", out16k]);
}

// ───────────────────────────── Whisper + alineado ─────────────────────────────

/** Palabras de Whisper: une los sub-tokens ("Turn" + "igo") en palabras completas. */
async function whisperWords(wav16k: string): Promise<VoiceWord[]> {
  const out = await transcribe({
    inputPath: wav16k,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: WHISPER_MODEL,
    modelFolder: WHISPER_DIR,
    language: "es",
    tokenLevelTimestamps: true,
    printOutput: false,
  });
  const words: VoiceWord[] = [];
  for (const seg of out.transcription) {
    for (const t of seg.tokens) {
      if (t.text.startsWith("[_")) continue;
      const hasAlnum = /[\p{L}\p{N}]/u.test(t.text);
      if (!hasAlnum) continue; // puntuación: no aporta tiempos
      if (t.text.startsWith(" ") || words.length === 0) {
        words.push({ text: t.text.trim(), startMs: t.offsets.from, endMs: t.offsets.to });
      } else {
        const w = words[words.length - 1];
        w.text += t.text;
        w.endMs = t.offsets.to;
      }
    }
  }
  return words;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Palabras del guion tal como se mostrarán en subtítulos (sin puntuación suelta). */
const scriptWords = (text: string) =>
  text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => w.length > 0);

/**
 * Alinea las palabras del guion con las de Whisper (distancia de edición) y
 * devuelve un tiempo para cada palabra del guion. Las que Whisper no reconoce
 * se interpolan entre sus vecinas.
 */
function align(script: string[], heard: VoiceWord[]) {
  const n = script.length;
  const m = heard.length;
  const a = script.map(norm);
  const b = heard.map((w) => norm(w.text));
  const sub = (i: number, j: number) => (a[i] === b[j] ? 0 : a[i].slice(0, 3) === b[j].slice(0, 3) ? 0.4 : 1);
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub(i - 1, j - 1));

  const match: (number | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + sub(i - 1, j - 1)) {
      match[i - 1] = j - 1;
      i--;
      j--;
    } else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }

  const timed: VoiceWord[] = script.map((text, k) =>
    match[k] === null ? { text, startMs: NaN, endMs: NaN } : { text, startMs: heard[match[k]!].startMs, endMs: heard[match[k]!].endMs },
  );
  // Interpola huecos
  for (let k = 0; k < n; k++) {
    if (!Number.isNaN(timed[k].startMs)) continue;
    let e = k;
    while (e < n && Number.isNaN(timed[e].startMs)) e++;
    const t0 = k > 0 ? timed[k - 1].endMs : 0;
    const t1 = e < n ? timed[e].startMs : (heard[m - 1]?.endMs ?? t0 + 400 * (e - k));
    const step = (t1 - t0) / (e - k);
    for (let q = k; q < e; q++) {
      timed[q].startMs = Math.round(t0 + step * (q - k));
      timed[q].endMs = Math.round(t0 + step * (q - k + 1));
    }
    k = e - 1;
  }
  const unmatched = match.filter((x) => x === null).length;
  if (unmatched > 0) console.warn(`Aviso: ${unmatched} palabra(s) del guion no reconocidas por Whisper; tiempos interpolados.`);
  return timed;
}

// ───────────────────────────── main ─────────────────────────────

async function synthesize(text: string, cfg: TtsConfig, outWav: string) {
  return cfg.provider === "gemini" ? geminiTts(text, cfg, outWav) : edgeTts(text, cfg, outWav);
}

async function main() {
  loadEnv();
  const [video, flag, list] = process.argv.slice(2);
  if (!video) {
    console.error("Uso: npm run voice -- <carpeta-del-video> [--samples Voz1,Voz2]");
    process.exit(1);
  }
  mkdirSync(TMP, { recursive: true });
  const videoDir = path.join(ROOT, "src", "videos", video);
  const { SCRIPT } = (await import(pathToFileURL(path.join(videoDir, "script.ts")).href)) as { SCRIPT: VideoScript };
  const audioDir = path.join(ROOT, "public", "audio", video);
  mkdirSync(audioDir, { recursive: true });

  // Muestras: las dos primeras escenas con varias voces, para elegir.
  if (flag === "--samples") {
    const sampleDir = path.join(audioDir, "samples");
    mkdirSync(sampleDir, { recursive: true });
    const text = SCRIPT.scenes.slice(0, 3).map((s) => s.voice).join(" ");
    for (const v of (list ?? "").split(",").filter(Boolean)) {
      const cfg = { ...SCRIPT.tts, voice: v };
      const raw = path.join(TMP, `sample-${v}.wav`);
      await synthesize(text, cfg, raw);
      postprocess(raw, cfg, path.join(sampleDir, `${v}.mp3`), path.join(TMP, `sample-${v}-16k.wav`));
      console.log(`public/audio/${video}/samples/${v}.mp3`);
    }
    return;
  }

  const fullText = SCRIPT.scenes.map((s) => s.voice).join(" ");
  const raw = path.join(TMP, "raw.wav");
  console.log(`Generando voz (${SCRIPT.tts.provider} · ${SCRIPT.tts.voice})…`);
  const model = await synthesize(fullText, SCRIPT.tts, raw);

  // Limpia tomas antiguas (por escena) de versiones anteriores.
  for (const f of readdirSync(audioDir)) if (/^s\d+\.mp3$/.test(f)) rmSync(path.join(audioDir, f));
  const mp3 = path.join(audioDir, "voice.mp3");
  const wav16k = path.join(TMP, "voice-16k.wav");
  postprocess(raw, SCRIPT.tts, mp3, wav16k);
  const durationMs = probeMs(mp3);

  console.log("Sacando tiempos con Whisper…");
  const heard = await whisperWords(wav16k);
  const perScene = SCRIPT.scenes.map((s) => scriptWords(s.voice));
  const timed = align(perScene.flat(), heard);

  // Reparte las palabras por escena y define el tramo de audio de cada una.
  const PRE = 120; // ms de aire antes de la primera palabra de cada escena
  let k = 0;
  const groups = perScene.map((ws) => {
    const g = timed.slice(k, k + ws.length);
    k += ws.length;
    return g;
  });
  const scenes: VoiceTrack["scenes"] = SCRIPT.scenes.map((s, idx) => {
    const words = groups[idx];
    const prevEnd = idx === 0 ? 0 : groups[idx - 1][groups[idx - 1].length - 1].endMs;
    const segStartMs = idx === 0 ? 0 : Math.max(prevEnd, words[0].startMs - PRE);
    return { id: s.id, sourceText: s.voice, segStartMs, segEndMs: 0, words };
  });
  scenes.forEach((s, idx) => {
    s.segEndMs = idx < scenes.length - 1 ? scenes[idx + 1].segStartMs : durationMs;
  });

  const track: VoiceTrack = {
    provider: SCRIPT.tts.provider,
    voice: SCRIPT.tts.voice,
    model,
    file: `audio/${video}/voice.mp3`,
    durationMs,
    scenes,
  };
  writeFileSync(path.join(videoDir, "voice.json"), JSON.stringify(track, null, 2) + "\n");

  for (const s of scenes) {
    console.log(
      `${s.id}  ${((s.segEndMs - s.segStartMs) / 1000).toFixed(2)} s  ${s.words.map((w) => w.text).join(" ")}`,
    );
  }
  console.log(`\nTotal ${(durationMs / 1000).toFixed(2)} s · modelo ${model} · voice.json escrito en src/videos/${video}/`);
  rmSync(TMP, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
