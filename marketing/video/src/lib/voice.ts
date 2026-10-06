import type { Caption } from "@remotion/captions";

/** Guion de un vídeo: lo que se locuta y lo que se ve en cada escena. */
export type VideoScript = {
  /** Voz de Edge TTS (es-ES-AlvaroNeural, es-ES-ElviraNeural, es-ES-XimenaNeural). */
  voice: string;
  /** Velocidad relativa, p. ej. "+10%". */
  rate: string;
  scenes: readonly SceneScript[];
};

export type SceneScript = {
  id: string;
  /** Texto que se locuta (puede incluir el CTA de `BRAND`). */
  voice: string;
  /** Titular grande de la escena (vacío si la escena tiene su propio texto, p. ej. el cierre). */
  onScreen: string;
  /** Duración mínima de la escena aunque la locución sea más corta. */
  minSeconds: number;
  /** Frames de silencio antes de que empiece a hablar (deja sitio a un efecto o a la entrada). */
  leadFrames?: number;
  /** Frames que se mantiene la escena después de la última palabra. */
  tailFrames?: number;
};

/** Lo que escribe `npm run voice` en `voice.json`, junto al guion de cada vídeo. */
export type VoiceTrack = {
  voice: string;
  rate: string;
  scenes: VoiceScene[];
};

export type VoiceScene = {
  id: string;
  /** Ruta dentro de `public/`. */
  file: string;
  /** Duración del archivo de audio. */
  durationMs: number;
  /** Fin de la última palabra (el archivo trae silencio detrás). */
  speechEndMs: number;
  /** Palabra a palabra, relativo al inicio del archivo. */
  words: { text: string; startMs: number; endMs: number }[];
  /** Texto con el que se generó, para detectar guiones cambiados sin regenerar. */
  sourceText: string;
};

export type SceneTiming = {
  id: string;
  from: number;
  durationInFrames: number;
  /** Frame (relativo a la escena) en el que empieza el audio. */
  voiceFrom: number;
  /** Frame (relativo a la escena) en el que acaba de hablar. */
  speechEnd: number;
  audio: string;
  onScreen: string;
};

const DEFAULT_LEAD = 4;
const DEFAULT_TAIL = 6;

/**
 * Convierte guion + voz generada en tiempos de escena (frames) y subtítulos
 * absolutos. Cada escena dura lo que su locución, con un mínimo por escena.
 */
export const buildTimeline = (script: VideoScript, track: VoiceTrack, fps: number) => {
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

    const lead = scene.leadFrames ?? DEFAULT_LEAD;
    const speechFrames = Math.ceil((voice.speechEndMs / 1000) * fps);
    const durationInFrames = Math.max(
      Math.round(scene.minSeconds * fps),
      lead + speechFrames + (scene.tailFrames ?? DEFAULT_TAIL),
    );

    const offsetMs = ((cursor + lead) / fps) * 1000;
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
    voiceRanges.push([cursor + lead, cursor + lead + speechFrames]);

    scenes.push({
      id: scene.id,
      from: cursor,
      durationInFrames,
      voiceFrom: lead,
      speechEnd: lead + speechFrames,
      audio: voice.file,
      onScreen: scene.onScreen,
    });
    cursor += durationInFrames;
  }

  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  return { scenes, byId, captions, voiceRanges, durationInFrames: cursor };
};
