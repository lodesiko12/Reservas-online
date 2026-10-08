/**
 * Captura el widget público (producción) paso a paso. Sin sesión y SIN enviar ninguna reserva:
 * el formulario se rellena con datos ficticios pero nunca se pulsa "Confirmar".
 *   npm run widget
 */
import { mkdirSync } from "node:fs";
import { MOBILE, WIDGET, clickRegex, clickText, launch, shot, typeInto } from "./lib";

const OUT = "capturas/widget";

async function restaurante() {
  const dir = `${OUT}/restaurante`;
  mkdirSync(dir, { recursive: true });
  const b = await launch();
  const p = await b.newPage();
  await p.setViewport(MOBILE);
  await p.goto(`${WIDGET}/?slug=restaurante-la-plaza`, { waitUntil: "networkidle2" });
  await shot(p, `${dir}/01-comensales.png`);
  await clickText(p, "4", "button");
  await shot(p, `${dir}/02-comensales-elegido.png`);
  await clickText(p, "Continuar con 4", "button");
  await shot(p, `${dir}/03-dia-y-hora.png`);
  await clickText(p, "21:00", "button");
  await shot(p, `${dir}/04-formulario-vacio.png`);
  await typeInto(p, "Nombre", "Marta");
  await typeInto(p, "Apellidos", "López");
  await typeInto(p, "+34", "600123123");
  await typeInto(p, "tu@email", "marta@ejemplo.com");
  await shot(p, `${dir}/05-formulario-relleno.png`);
  await p.goto(`${WIDGET}/?slug=restaurante-la-plaza`, { waitUntil: "networkidle2" });
  await clickText(p, "Consúltala aquí", "button");
  await shot(p, `${dir}/06-mi-reserva.png`);
  await b.close();
}

async function citas() {
  const dir = `${OUT}/citas`;
  mkdirSync(dir, { recursive: true });
  const b = await launch();
  const p = await b.newPage();
  await p.setViewport(MOBILE);
  await p.goto(`${WIDGET}/?slug=mimate`, { waitUntil: "networkidle2" });
  await shot(p, `${dir}/01-servicios.png`);
  await clickText(p, "Estética facial", "button");
  await shot(p, `${dir}/02-profesional.png`);
  await clickText(p, "Elvia", "button");
  await clickRegex(p, /^(LUN|MAR|MIÉ|JUE|VIE|SÁB|DOM)\s/i, 1);
  await shot(p, `${dir}/03-dia-y-hora.png`);
  await clickRegex(p, /^\d{2}:\d{2}$/);
  await shot(p, `${dir}/04-formulario-vacio.png`);
  await typeInto(p, "Nombre", "Nerea");
  await typeInto(p, "Apellidos", "Gil");
  await typeInto(p, "+34", "600123123");
  await typeInto(p, "tu@email", "nerea@ejemplo.com");
  await shot(p, `${dir}/05-formulario-relleno.png`);
  await b.close();
}

(async () => {
  if (process.argv[2] !== "citas") await restaurante();
  if (process.argv[2] !== "restaurante") await citas();
})();
