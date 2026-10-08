/** Capturas extra de la agenda de citas: filtro por profesional. Reutiliza la sesión de `npm run panel -- citas`. */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DESKTOP, MOBILE, PANEL, clickText, launch, shot, sleep } from "./lib";

(async () => {
  const dir = "capturas/panel/citas/filtro-profesional";
  mkdirSync(dir, { recursive: true });
  const b = await launch({ headless: true, userDataDir: path.join(tmpdir(), "turnigo-capture-citas") });
  const p = (await b.pages())[0] ?? (await b.newPage());
  for (const [name, vp] of [["desktop", DESKTOP], ["movil", MOBILE]] as const) {
    await p.setViewport(vp);
    await p.goto(`${PANEL}/app/agenda`, { waitUntil: "networkidle2" });
    await sleep(1500);
    await clickText(p, "Día", "button");
    await shot(p, `${dir}/${name}-dia-todas.png`);
    await clickText(p, "Gema", "button");
    await shot(p, `${dir}/${name}-dia-solo-gema.png`);
    await clickText(p, "Semana", "button");
    await shot(p, `${dir}/${name}-semana-solo-gema.png`);
  }
  await b.close();
})();
