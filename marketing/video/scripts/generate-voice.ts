/**
 * Genera la locución de un vídeo con Edge TTS (voces neuronales de Microsoft,
 * gratis y sin cuenta) y guarda los tiempos palabra a palabra.
 *
 *   npm run voice -- v01-mesa-vacia
 *
 * Lee   src/videos/<video>/script.ts
 * Crea  public/audio/<video>/<escena>.mp3
 *       src/videos/<video>/voice.json   (duraciones + palabras, lo usa el vídeo)
 *
 * Para cambiar de servicio (ElevenLabs, Azure F0…) basta con reescribir
 * `synthesize()`: el resto del proyecto solo depende de voice.json.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { VideoScript, VoiceScene, VoiceTrack } from "../src/lib/voice";

const ROOT = path.resolve(__dirname, "..");

type Word = { text: string; startMs: number; endMs: number };

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function synthesize(text: string, voice: string, rate: string, outMp3: string) {
  const dir = path.join(tmpdir(), `turnigo-tts-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
  });
  const { audioFilePath, metadataFilePath } = await tts.toFile(dir, escapeXml(text), { rate });
  tts.close();

  copyFileSync(audioFilePath, outMp3);
  const meta = JSON.parse(readFileSync(metadataFilePath!, "utf8")) as {
    Metadata: { Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }[];
  };
  rmSync(dir, { recursive: true, force: true });

  // Offset/Duration vienen en unidades de 100 ns.
  const words: Word[] = meta.Metadata.filter((m) => m.Type === "WordBoundary").map((m) => ({
    text: m.Data.text.Text,
    startMs: Math.round(m.Data.Offset / 10_000),
    endMs: Math.round((m.Data.Offset + m.Data.Duration) / 10_000),
  }));
  return words;
}

const probeDurationMs = (file: string) =>
  Math.round(
    Number(
      execFileSync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
      ]).toString().trim(),
    ) * 1000,
  );

async function main() {
  const video = process.argv[2];
  if (!video) {
    console.error("Uso: npm run voice -- <carpeta-del-video>   (p. ej. v01-mesa-vacia)");
    process.exit(1);
  }
  const videoDir = path.join(ROOT, "src", "videos", video);
  const { SCRIPT } = (await import(pathToFileURL(path.join(videoDir, "script.ts")).href)) as { SCRIPT: VideoScript };

  const audioDir = path.join(ROOT, "public", "audio", video);
  mkdirSync(audioDir, { recursive: true });

  const scenes: VoiceScene[] = [];
  for (const scene of SCRIPT.scenes) {
    const outMp3 = path.join(audioDir, `${scene.id}.mp3`);
    const words = await synthesize(scene.voice, SCRIPT.voice, SCRIPT.rate, outMp3);
    if (words.length === 0) throw new Error(`Sin marcas de tiempo en la escena ${scene.id}`);
    const durationMs = probeDurationMs(outMp3);
    scenes.push({
      id: scene.id,
      file: `audio/${video}/${scene.id}.mp3`,
      durationMs,
      speechEndMs: words[words.length - 1].endMs,
      words,
      sourceText: scene.voice,
    });
    console.log(
      `${scene.id}  ${(durationMs / 1000).toFixed(2)} s  (habla hasta ${(words[words.length - 1].endMs / 1000).toFixed(2)} s)  ${scene.voice}`,
    );
  }

  const track: VoiceTrack = { voice: SCRIPT.voice, rate: SCRIPT.rate, scenes };
  writeFileSync(path.join(videoDir, "voice.json"), JSON.stringify(track, null, 2) + "\n");
  console.log(`\nvoice.json escrito en src/videos/${video}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
