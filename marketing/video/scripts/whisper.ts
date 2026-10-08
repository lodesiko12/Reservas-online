/**
 * Whisper local (whisper.cpp, CPU) para sacar los tiempos de cada palabra de la locución.
 *   npm run whisper:install   → descarga binario + modelo "small" (~470 MB) en ./whisper (no se sube a git)
 */
import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp } from "@remotion/install-whisper-cpp";

export const WHISPER_DIR = path.resolve(__dirname, "..", "whisper");
export const WHISPER_VERSION = "1.7.6";
export const WHISPER_MODEL = "small" as const;

async function installWhisper() {
  try {
    await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  } catch (err) {
    // En Windows el zip de la release trae los binarios en Release/, pero la
    // librería los busca en build/bin/.
    const release = path.join(WHISPER_DIR, "Release");
    if (!existsSync(release)) throw err;
  }
  const release = path.join(WHISPER_DIR, "Release");
  if (existsSync(release)) {
    mkdirSync(path.join(WHISPER_DIR, "build"), { recursive: true });
    renameSync(release, path.join(WHISPER_DIR, "build", "bin"));
  }
  await downloadWhisperModel({ folder: WHISPER_DIR, model: WHISPER_MODEL });
}

if (require.main === module) {
  installWhisper().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
