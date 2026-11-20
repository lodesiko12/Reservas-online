// Copia el audio de una pieza a public/<pieza>/ y escribe durations.json (segundos por frase).
// Uso: node scripts/sync-audio.mjs p01-reservan-y-no-vienen p01
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const [piezaDir, publicName] = process.argv.slice(2);
if (!piezaDir || !publicName) {
  console.error('Uso: node scripts/sync-audio.mjs <carpeta-pieza> <nombre-public>');
  process.exit(1);
}
const src = resolve('..', 'piezas', piezaDir);
const dst = resolve('public', publicName);
mkdirSync(dst, {recursive: true});
const guion = JSON.parse(readFileSync(join(src, 'guion.json'), 'utf8'));

const durations = {};
for (const f of guion.frases) {
  const wav = join(src, 'audio', `${f.id}.wav`);
  if (!existsSync(wav)) {
    console.warn(`Falta ${f.id}.wav, se mantiene la estimación`);
    continue;
  }
  // mismo volumen en todas las frases (-16 LUFS) para que no salten entre escenas
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7', '-ar', '44100', join(dst, `${f.id}.wav`)]);
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim();
  durations[f.id] = Math.round(parseFloat(out) * 1000) / 1000;
}
const file = join(dst, 'durations.json');
const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
// _audio = true solo cuando están TODOS los wav: hasta entonces la composición se previsualiza sin voz.
const todo = guion.frases.every((f) => durations[f.id] !== undefined);
const merged = {...previous, ...durations, _audio: todo};
writeFileSync(file, JSON.stringify(merged, null, 2));
console.log('durations.json', merged);
