/** Genera capturas/INDICE.md con todas las capturas existentes. npm run indice */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "capturas";
const lines: string[] = ["# Índice de capturas", "", "Generado con `npm run indice`. Rutas relativas a `capturas/`.", ""];

function walk(dir: string, depth = 0) {
  const entries = readdirSync(dir).sort();
  const pngs = entries.filter((e) => e.endsWith(".png"));
  if (pngs.length) {
    lines.push(`### ${path.relative(ROOT, dir).replaceAll("\\", "/")} (${pngs.length})`, "");
    lines.push(pngs.map((p) => `\`${p}\``).join(" · "), "");
  }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) walk(full, depth + 1);
  }
}
walk(ROOT);
writeFileSync(path.join(ROOT, "INDICE.md"), lines.join("\n"));
console.log("capturas/INDICE.md");
