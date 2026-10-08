import type { Caption } from "@remotion/captions";

/** Servicio de voz. Gemini = voz natural con instrucciones de estilo; Edge = respaldo sin clave. */
export type TtsConfig = {
  provider: "gemini" | "edge";
  /** Gemini: Puck, Fenrir, Achird… · Edge: es-ES-AlvaroNeural… */
  voice: string;
  /** Instrucciones de interpretación (solo Gemini): acento, tono, ritmo. */
  style?: string;
  /** Acelera/frena el audio final sin cambiar el tono (1 = tal cual, 1.1 = 10 % más rápido). */
  tempo?: number;
};

/** Guion de un vídeo: lo que se locuta y lo que se ve en cada escena. */
export type VideoScript = {
  tts: TtsConfig;
  scenes: readonly SceneScript[];
};

export type SceneScript = {
  id: string;
  /** Texto que se locuta (puede incluir el CTA de `BRAND`). */
  voice: string;
  /** Titular grande de la escena (vacío si la escena tiene su propio texto, p. ej. el cierre). */
  onScreen: string;
  /** Duración mínima de la escena aunque la locución sea más corta. */
  minSeconds?: number;
  /** Frames de silencio antes de que empiece a hablar (deja sitio a un efecto o a la entrada). */
  leadFrames?: number;
  /** Frames que se mantiene la escena después de su última palabra. */
  tailFrames?: number;
};

export type VoiceWord = { text: string; startMs: number; endMs: number };

/**
 * Lo que escribe `npm run voice` en `voice.json`: una sola toma de audio y, por
 * escena, el tramo del archivo que le corresponde y sus palabras (ms absolutos del archivo).
 */
export type VoiceTrack = {
  provider: string;
  voice: string;
  model?: string;
  /** Ruta dentro de `public/`. */
  file: string;
  durationMs: number;
  scenes: {
    id: string;
    /** Texto con el que se generó, para detectar guiones cambiados sin regenerar. */
    sourceText: string;
    segStartMs: number;
    segEndMs: number;
    words: VoiceWord[];
  }[];
};

export type SceneTiming = {
  id: string;
  from: number;
  durationInFrames: number;
  onScreen: string;
  /** Tramo de la toma de voz que suena en esta escena. */
  audio: { src: string; from: number; trimBefore: number; durationInFrames: number };
  /** Frame (relativo a la escena) en el que acaba de hablar. */
  speechEnd: number;
  /** Palabras con su frame de inicio relativo a la escena (para sincronizar golpes visuales). */
  words: { text: string; frame: number }[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Frame (relativo a la escena) en el que se dice `word` (la n-ésima aparición).
 * Si no la encuentra devuelve `fallback`, para que un cambio de guion no rompa el vídeo.
 */
export const wordFrame = (scene: SceneTiming, word: string, fallback = 0, nth = 0) => {
  const hits = scene.words.filter((w) => norm(w.text) === norm(word));
  return hits[nth]?.frame ?? fallback;
};

/**
 * Convierte guion + voz generada en tiempos de escena (frames) y subtítulos
 * absolutos. Cada escena dura lo que su tramo de locución, con un mínimo opcional.
 */
export const buildTimeline = (script: VideoScript, track: VoiceTrack, fps: number) => {
  const toFrames = (ms: number) => Math.round((ms / 1000) * fps);
  let cursor = 0;
  const scenes: SceneTiming[] = [];
  const captions: Caption[] = [];
  const voiceRanges: [number, number][] = [];

  for (const scene of script.scenes) {
    const voice = track.scenes.find((s) => s.id === scene.id);
    if (!voice) {
      throw new Error(`Falta la voz de la escena "${scene.id}". Ejecuta: npm run voice`);
    }
    if (voice.sourceText !== scene.voice) {
      console.warn(`La locución de "${scene.id}" no coincide con el guion. Ejecuta: npm run voice`);
    }

    const lead = scene.leadFrames ?? 0;
    const trimBefore = toFrames(voice.segStartMs);
    const segFrames = toFrames(voice.segEndMs) - trimBefore;
    const durationInFrames = Math.max(
      Math.round((scene.minSeconds ?? 0) * fps),
      lead + segFrames + (scene.tailFrames ?? 0),
    );

    // ms del archivo → ms de la composición
    const offsetMs = ((cursor + lead - trimBefore) / fps) * 1000;
    voice.words.forEach((w, i) => {
      captions.push({
        text: (i === 0 ? "" : " ") + w.text,
        startMs: offsetMs + w.startMs,
        endMs: offsetMs + w.endMs,
        timestampMs: offsetMs + (w.startMs + w.endMs) / 2,
        confidence: null,
        pageBreakAfter: i === voice.words.length - 1,
      });
    });

    const lastEnd = voice.words[voice.words.length - 1]?.endMs ?? voice.segEndMs;
    const speechEnd = lead + toFrames(lastEnd) - trimBefore;
    voiceRanges.push([cursor + lead, cursor + speechEnd]);

    scenes.push({
      id: scene.id,
      from: cursor,
      durationInFrames,
      onScreen: scene.onScreen,
      audio: { src: track.file, from: cursor + lead, trimBefore, durationInFrames: segFrames },
      speechEnd,
      words: voice.words.map((w) => ({ text: w.text, frame: lead + toFrames(w.startMs) - trimBefore })),
    });
    cursor += durationInFrames;
  }

  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  return { scenes, byId, captions, voiceRanges, durationInFrames: cursor };
};
