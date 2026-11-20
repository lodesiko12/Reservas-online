/**
 * Capturas de los 4 negocios demo ficticios (Casa Olivar, Aura Estética, Consulta Clara Montes, Dulce Mora)
 * para la web de promoción de Turnigo. Producción, solo lectura: NUNCA pulsa "Confirmar".
 *
 *   npm run demos -- widget [slug,slug]     → capturas del widget público (sin sesión)
 *   npm run demos -- panel <slug>           → panel del negocio; TÚ inicias sesión en la ventana de Chrome
 *   HEADLESS=1 npm run demos -- panel <slug> [pantalla,pantalla]   → repite con la sesión ya guardada
 *
 * Salida: ../capturas-web/<slug>/{widget,panel/desktop,panel/movil,panel/desktop-oscuro}/*.png
 * El email de la cuenta demo (barra lateral) se oculta antes de cada captura.
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Page } from "puppeteer-core";
import { DESKTOP, MOBILE, PANEL, WIDGET, clickRegex, clickText, launch, shot as baseShot, sleep, typeInto } from "./lib";

const OUT = "../capturas-web";
type Step = { pros?: string[]; file: string; route: string; views?: string[]; ficha?: boolean; extra?: "empezar-cita" | "cobradas" | "subpestanas"; mobile?: boolean; dark?: boolean };

const DEMOS: Record<string, { name: string; steps: Step[] }> = {
  "casa-olivar": {
    name: "Casa Olivar",
    steps: [
      { file: "resumen", route: "/app", mobile: true, dark: true },
      { file: "plano-de-sala", route: "/app/plano", mobile: true, dark: true },
      { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"], mobile: true, dark: true },
      { file: "pedidos-para-llevar", route: "/app/pedidos", mobile: true },
      { file: "carta", route: "/app/carta" },
      { file: "nueva-reserva", route: "/app/nueva" },
      { file: "clientes", route: "/app/clientes", ficha: true },
      { file: "mesas", route: "/app/mesas" },
      { file: "franjas", route: "/app/franjas" },
      { file: "reportes", route: "/app/reportes" },
    ],
  },
  "aura-estetica": {
    name: "Aura Estética",
    steps: [
      { file: "resumen", route: "/app", mobile: true, dark: true },
      { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"], pros: ["Sofía Marín", "Nerea Campos", "Laura Vidal"], mobile: true, dark: true },
      { file: "nueva-reserva", route: "/app/nueva" },
      { file: "clientes", route: "/app/clientes", ficha: true },
      { file: "servicios", route: "/app/servicios" },
      { file: "reportes", route: "/app/reportes" },
    ],
  },
  "consulta-demo-psicologia": {
    name: "Consulta Clara Montes",
    steps: [
      { file: "resumen", route: "/app", mobile: true, dark: true },
      { file: "agenda", route: "/app/agenda", views: ["Día", "Semana"], mobile: true, dark: true },
      { file: "seguimiento", route: "/app/seguimiento", extra: "empezar-cita", mobile: true },
      { file: "clientes", route: "/app/clientes", ficha: true },
      { file: "pagos", route: "/app/pagos", extra: "cobradas" },
      { file: "reportes", route: "/app/reportes" },
    ],
  },
  "dulce-mora": {
    name: "Dulce Mora",
    steps: [
      { file: "resumen", route: "/app", mobile: true, dark: true },
      { file: "agenda", route: "/app/agenda", views: ["Día", "Semana", "Mes"], mobile: true, dark: true },
      { file: "produccion", route: "/app/produccion", mobile: true },
      { file: "catalogo", route: "/app/catalogo" },
      { file: "clientes", route: "/app/clientes", ficha: true },
      { file: "reportes", route: "/app/reportes" },
      { file: "config", route: "/app/config" },
    ],
  },
};

/* ---------------------------------- widget ---------------------------------- */

const FORM = async (p: Page) => {
  await typeInto(p, "Nombre", "Marta");
  await typeInto(p, "Apellidos", "López");
  await typeInto(p, "+34", "600123123");
  await typeInto(p, "tu@email", "marta@example.com");
};

async function widget(slug: string) {
  const dir = `${OUT}/${slug}/widget`;
  mkdirSync(dir, { recursive: true });
  const b = await launch();
  const p = await b.newPage();
  await p.setViewport(MOBILE);
  /** Como `shot`, pero recorta el blanco sobrante bajo el contenido (salvo fullPage). */
  const shot = async (pg: Page, file: string, o: { fullPage?: boolean } = {}) => {
    await sleep(600);
    if (o.fullPage) return baseShot(pg, file, o);
    const h = await pg.evaluate(() => {
      let m = 0;
      document.querySelectorAll<HTMLElement>("body *").forEach((e) => {
        if (e.children.length === 0 && e.offsetParent !== null) m = Math.max(m, e.getBoundingClientRect().bottom);
      });
      return Math.ceil(Math.min(m + 48, window.innerHeight));
    });
    await pg.screenshot({ path: file, clip: { x: 0, y: 0, width: MOBILE.width, height: h } });
    console.log("  ✓", file);
  };
  const day = (n: number) => clickRegex(p, /^(LUN|MAR|MIÉ|JUE|VIE|SÁB|DOM)\s/i, n);
  const open = () => p.goto(`${WIDGET}/?slug=${slug}`, { waitUntil: "networkidle2" });
  await open();
  await shot(p, `${dir}/01-inicio.png`);

  if (slug === "casa-olivar") {
    await clickText(p, "4", "button");
    await clickText(p, "Continuar con 4", "button");
    await shot(p, `${dir}/02-dia-y-hora.png`);
    if (!(await clickText(p, "21:00", "button"))) await clickRegex(p, /^\d{2}:\d{2}$/, 3);
    await shot(p, `${dir}/03-formulario-vacio.png`);
    await FORM(p);
    await shot(p, `${dir}/04-formulario-relleno.png`);
    await open();
    await clickText(p, "Pedir para llevar", "button");
    await shot(p, `${dir}/05-carta-para-llevar.png`);
    await shot(p, `${dir}/05b-carta-completa.png`, { fullPage: true });
  } else if (slug === "aura-estetica") {
    await clickText(p, "Hydrafacial", "button");
    await shot(p, `${dir}/02-profesional.png`);
    await clickText(p, "Sofía", "button");
    await day(5);
    await shot(p, `${dir}/03-dia-y-hora.png`);
    await clickRegex(p, /^\d{2}:\d{2}$/, 4);
    await shot(p, `${dir}/04-formulario-vacio.png`);
    await FORM(p);
    await shot(p, `${dir}/05-formulario-relleno.png`);
  } else if (slug === "consulta-demo-psicologia") {
    await clickText(p, "Terapia individual", "button");
    await shot(p, `${dir}/02-dia-y-hora.png`);
    await day(2);
    await shot(p, `${dir}/02b-horas.png`);
    await clickRegex(p, /^\d{2}:\d{2}$/, 1);
    await shot(p, `${dir}/03-formulario-vacio.png`);
    await FORM(p);
    await shot(p, `${dir}/04-formulario-relleno.png`);
  } else if (slug === "dulce-mora") {
    await clickText(p, "Mediana", "button");
    await shot(p, `${dir}/02-tamano-elegido.png`);
    await clickText(p, "Premium", "button");
    await shot(p, `${dir}/03-sabores.png`);
    await clickText(p, "Pistacho y frambuesa", "button");
    await day(1);
    await shot(p, `${dir}/04-dia-y-hora.png`);
    await clickRegex(p, /^\d{2}:\d{2}$/, 2);
    await shot(p, `${dir}/05-formulario-vacio.png`);
    await FORM(p);
    await shot(p, `${dir}/06-formulario-relleno.png`);
  }
  await b.close();
}

/* ----------------------------------- panel ---------------------------------- */

async function waitForLogin(page: Page) {
  console.log("\n👉 Inicia sesión en la ventana de Chrome que se ha abierto (tienes 10 min).");
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(() => location.pathname.startsWith("/app") && !!document.querySelector("nav, aside")).catch(() => false);
    if (ok) {
      await sleep(2500);
      return;
    }
    await sleep(1500);
  }
  throw new Error("No se detectó el inicio de sesión.");
}

const setTheme = (page: Page, t: "light" | "dark") => page.evaluate((v) => localStorage.setItem("turnigo:theme", v), t);

async function go(page: Page, route: string) {
  await page.goto(`${PANEL}${route}`, { waitUntil: "networkidle2" });
  await sleep(2200);
}

/** Oculta el email de la cuenta demo (aparece en la barra lateral). */
async function hideEmail(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>("body *").forEach((e) => {
      if (e.children.length === 0 && /@[\w.-]+\.test\b/i.test(e.textContent || "")) e.style.visibility = "hidden";
    });
  });
}

async function snap(page: Page, file: string) {
  await hideEmail(page);
  await baseShot(page, file);
}

async function capture(page: Page, dir: string, step: Step) {
  await go(page, step.route);
  await snap(page, `${dir}/${step.file}.png`);
  for (const v of step.views ?? []) {
    if (await clickText(page, v, "button")) {
      await sleep(1200);
      await snap(page, `${dir}/${step.file}-${v.toLowerCase().replace("í", "i")}.png`);
    }
  }
  if (step.pros && (await clickText(page, "Semana", "button"))) {
    // la semana con todos los profesionales se apila: una captura limpia por profesional
    for (const pro of step.pros) {
      if (await clickText(page, pro, "button")) {
        await sleep(1200);
        await snap(page, `${dir}/${step.file}-semana-${pro.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}.png`);
      }
    }
    await clickText(page, "Todas", "button");
  }
  if (step.ficha) {
    const opened = await page.evaluate(() => {
      const cell = document.querySelector<HTMLElement>("tbody tr:nth-child(2) td") ?? document.querySelector<HTMLElement>("tbody tr td");
      if (!cell) return false;
      cell.click();
      return true;
    });
    if (opened) {
      await sleep(1800);
      await snap(page, `${dir}/${step.file}-ficha.png`);
    }
  }
  if (step.extra === "empezar-cita" && (await clickText(page, "Empezar cita", "button"))) {
    await sleep(1000);
    await snap(page, `${dir}/${step.file}-empezar-cita.png`); // formulario de sesión; NO se guarda
    await page.keyboard.press("Escape");
  }
  if (step.extra === "cobradas" && (await clickText(page, "Cobradas", "button"))) {
    await sleep(1000);
    await snap(page, `${dir}/${step.file}-cobradas.png`);
  }
}

async function panel(slug: string, filter?: string[]) {
  const demo = DEMOS[slug];
  const profile = path.join(tmpdir(), `turnigo-demo-${slug}`);
  const browser = await launch({ headless: process.env.HEADLESS === "1", userDataDir: profile });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.setViewport(DESKTOP);
  await page.goto(`${PANEL}/app`, { waitUntil: "networkidle2" });
  await waitForLogin(page);
  if (process.env.LOGIN_ONLY === "1") {
    console.log(`✔ Sesión de ${demo.name} guardada.`);
    await browser.close();
    return;
  }

  const sets = [
    { name: "desktop", vp: DESKTOP, theme: "light" as const, ok: (_s: Step) => true },
    { name: "movil", vp: MOBILE, theme: "light" as const, ok: (s: Step) => !!s.mobile },
    { name: "desktop-oscuro", vp: DESKTOP, theme: "dark" as const, ok: (s: Step) => !!s.dark },
  ];
  for (const s of sets) {
    const dir = `${OUT}/${slug}/panel/${s.name}`;
    mkdirSync(dir, { recursive: true });
    await page.setViewport(s.vp);
    await setTheme(page, s.theme);
    console.log(`\n== ${demo.name} · ${s.name}`);
    for (const step of demo.steps) {
      if (!s.ok(step) || (filter && !filter.includes(step.file))) continue;
      try {
        await capture(page, dir, step);
      } catch (e) {
        console.log("  ✗", step.file, (e as Error).message);
      }
    }
  }
  await setTheme(page, "light");
  await browser.close();
  console.log("\nListo →", path.resolve(`${OUT}/${slug}/panel`));
}

(async () => {
  const [mode, arg, arg2] = process.argv.slice(2);
  if (mode === "widget") {
    for (const slug of arg ? arg.split(",") : Object.keys(DEMOS)) {
      console.log(`\n== widget · ${slug}`);
      await widget(slug);
    }
  } else if (mode === "panel" && DEMOS[arg]) {
    await panel(arg, arg2?.split(","));
  } else {
    console.error(`Uso: npm run demos -- widget [slug] | panel <${Object.keys(DEMOS).join("|")}> [pantallas]`);
    process.exit(1);
  }
})();
