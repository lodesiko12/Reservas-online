/**
 * Captura el panel de negocio (producción) tras iniciar sesión TÚ en la ventana de Chrome que se abre
 * (el script nunca escribe contraseñas). Solo lee: no crea, edita ni borra nada.
 *   npm run panel -- restaurante      → capturas/panel/restaurante/{desktop,movil}[-oscuro]/*.png
 *   npm run panel -- citas
 *   npm run panel -- psicologo
 *   npm run panel -- autonomo
 * La sesión se guarda en un perfil temporal fuera del repo (no se sube a git). Con la sesión ya iniciada,
 * HEADLESS=1 repite la captura sin ventana (más fiable: una ventana tapada hace que Chrome no pueda capturar).
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Page } from "puppeteer-core";
import { DESKTOP, MOBILE, PANEL, clickText, launch, shot, sleep } from "./lib";

type Kind = "restaurante" | "citas" | "psicologo" | "autonomo";
type Step = { file: string; route: string; views?: string[]; ficha?: boolean; extra?: "empezar-cita" | "cobradas" };

const COMMON_END: Step[] = [
  { file: "reportes", route: "/app/reportes" },
  { file: "config", route: "/app/config" },
];

const ROUTES: Record<Kind, Step[]> = {
  restaurante: [
    { file: "resumen", route: "/app" },
    { file: "plano-de-sala", route: "/app/plano" },
    { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"] },
    { file: "nueva-reserva", route: "/app/nueva" },
    { file: "clientes", route: "/app/clientes", ficha: true },
    { file: "franjas", route: "/app/franjas" },
    { file: "mesas", route: "/app/mesas" },
    { file: "bloqueos", route: "/app/bloqueos" },
    ...COMMON_END,
  ],
  citas: [
    { file: "resumen", route: "/app" },
    { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"] },
    { file: "nueva-reserva", route: "/app/nueva" },
    { file: "clientes", route: "/app/clientes", ficha: true },
    { file: "servicios", route: "/app/servicios" },
    { file: "bloqueos", route: "/app/bloqueos" },
    ...COMMON_END,
  ],
  psicologo: [
    { file: "resumen", route: "/app" },
    { file: "agenda", route: "/app/agenda", views: ["Día", "Semana"] },
    { file: "seguimiento", route: "/app/seguimiento", extra: "empezar-cita" },
    { file: "clientes", route: "/app/clientes", ficha: true },
    { file: "pagos", route: "/app/pagos", extra: "cobradas" },
    ...COMMON_END,
  ],
  autonomo: [
    { file: "resumen", route: "/app" },
    { file: "pipeline", route: "/app/pipeline" },
    { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"] },
    { file: "clientes", route: "/app/clientes", ficha: true },
    { file: "presupuestos", route: "/app/presupuestos" },
    { file: "facturas", route: "/app/facturas" },
    { file: "config", route: "/app/config" },
  ],
};

async function waitForLogin(page: Page) {
  console.log("\n👉 Inicia sesión en la ventana de Chrome que se ha abierto (tienes 10 min).");
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const ok = await page
      .evaluate(() => location.pathname.startsWith("/app") && !!document.querySelector("nav, aside"))
      .catch(() => false);
    if (ok) {
      await sleep(2500);
      return;
    }
    await sleep(1500);
  }
  throw new Error("No se detectó el inicio de sesión.");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => localStorage.setItem("turnigo:theme", t), theme);
}

async function go(page: Page, route: string) {
  await page.goto(`${PANEL}${route}`, { waitUntil: "networkidle2" });
  await sleep(1800); // gráficos, realtime
}

async function capture(page: Page, dir: string, step: Step, kind: Kind) {
  await go(page, step.route);
  await shot(page, `${dir}/${step.file}.png`);
  for (const v of step.views ?? []) {
    if (await clickText(page, v, "button")) {
      await sleep(900);
      await shot(page, `${dir}/${step.file}-${v.toLowerCase().replace("í", "i")}.png`);
    }
  }
  if (step.ficha) {
    // abre la ficha del primer cliente de la lista (si la hay)
    const opened = await page.evaluate(() => {
      // la celda del nombre lleva el onClick (no la fila); se salta el 1.º por ser "Walk-in" en restaurantes
      const cell =
        document.querySelector<HTMLElement>("tbody tr:nth-child(3) td") ??
        document.querySelector<HTMLElement>("tbody tr td") ??
        document.querySelector<HTMLElement>("main a[href*='clientes/']");
      if (!cell) return false;
      cell.click();
      return true;
    });
    if (opened) {
      await sleep(1500);
      await shot(page, `${dir}/${step.file}-ficha.png`);
      if (kind === "psicologo") {
        // pestaña Recibo (el Informe de IA no se captura: no está verificado)
        if (await clickText(page, "Recibo", "button")) {
          await sleep(900);
          await shot(page, `${dir}/${step.file}-ficha-recibo.png`);
        }
      }
    }
  }
  if (step.extra === "empezar-cita" && (await clickText(page, "Empezar cita", "button"))) {
    await sleep(1000);
    await shot(page, `${dir}/${step.file}-empezar-cita.png`); // formulario de sesión; NO se guarda
    await page.keyboard.press("Escape");
  }
  if (step.extra === "cobradas" && (await clickText(page, "Cobradas", "button"))) {
    await sleep(1000);
    await shot(page, `${dir}/${step.file}-cobradas.png`);
  }
}

(async () => {
  const kind = process.argv[2] as Kind;
  const filter = process.argv[3]?.split(","); // p. ej. "clientes,agenda": repite solo esas pantallas
  if (!ROUTES[kind]) {
    console.error("Uso: npm run panel -- restaurante|citas|psicologo|autonomo");
    process.exit(1);
  }
  const profile = path.join(tmpdir(), `turnigo-capture-${kind}`);
  const browser = await launch({ headless: process.env.HEADLESS === "1", userDataDir: profile });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.setViewport(DESKTOP);
  await page.goto(`${PANEL}/app`, { waitUntil: "networkidle2" });
  await waitForLogin(page);

  const base = `capturas/panel/${kind}`;
  const sets: { name: string; vp: typeof DESKTOP | typeof MOBILE; theme: "light" | "dark"; only?: string[] }[] = [
    { name: "desktop", vp: DESKTOP, theme: "light" },
    { name: "movil", vp: MOBILE, theme: "light" },
    { name: "desktop-oscuro", vp: DESKTOP, theme: "dark", only: ["resumen", "plano-de-sala", "agenda", "pipeline"] },
  ];
  for (const s of sets) {
    const dir = `${base}/${s.name}`;
    mkdirSync(dir, { recursive: true });
    await page.setViewport(s.vp);
    await setTheme(page, s.theme);
    console.log(`\n== ${kind} · ${s.name}`);
    for (const step of ROUTES[kind]) {
      if (s.only && !s.only.includes(step.file)) continue;
      if (filter && !filter.includes(step.file)) continue;
      try {
        await capture(page, dir, step, kind);
      } catch (e) {
        console.log("  ✗", step.file, (e as Error).message);
      }
    }
  }
  await setTheme(page, "light");
  await browser.close();
  console.log("\nListo →", path.resolve(base));
})();
