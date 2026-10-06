import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug") ?? "";
const initialView = params.get("view") === "mi-reserva" ? "lookup" : "booking";
const initialLocator = params.get("locator") ?? "";

// Personalización opcional desde la web anfitriona (embed.js: data-theme / data-accent).
// Sin estos parámetros el widget se ve exactamente igual que antes.
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
const accentParam = (params.get("accent") ?? "").replace(/^#/, "");
if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentParam)) {
  // Solo hex válido: evita inyectar CSS arbitrario por la URL.
  document.documentElement.style.setProperty("--primary", "#" + accentParam);
  document.documentElement.dataset.accent = "1";
}

// Tipografías y radio de la web anfitriona (data-font-heading / data-font-body / data-radius).
// Solo nombres de fuente alfanuméricos (Google Fonts) y radio numérico: nada de CSS arbitrario por la URL.
function hostFont(param: string, cssVar: string): string | null {
  const name = (params.get(param) ?? "").trim();
  if (!/^[A-Za-z0-9 ]{1,40}$/.test(name)) return null;
  document.documentElement.style.setProperty(cssVar, `"${name}"`);
  return name;
}
const hostFonts = [hostFont("font-heading", "--font-heading"), hostFont("font-body", "--font-body")]
  .filter((n): n is string => !!n);
if (hostFonts.length) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?" +
    hostFonts.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&") +
    "&display=swap";
  document.head.appendChild(link);
}
const radiusParam = params.get("radius") ?? "";
if (/^\d{1,2}$/.test(radiusParam)) document.documentElement.style.setProperty("--radius", radiusParam + "px");

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App slug={slug} initialView={initialView} initialLocator={initialLocator} />
  </React.StrictMode>
);

// Comunica la altura al documento anfitrión para que embed.js redimensione el iframe.
// Se mide el alto del contenido (body), no documentElement.scrollHeight: este último nunca baja del
// alto del propio iframe, así que el iframe no podía encogerse y dejaba un hueco bajo el contenido.
function postHeight() {
  const h = Math.ceil(document.body.getBoundingClientRect().height);
  window.parent?.postMessage({ type: "reservas-widget:height", height: h }, "*");
}
const ro = new ResizeObserver(postHeight);
ro.observe(document.body);
ro.observe(document.documentElement); // cambios de ancho (re-maquetación) también reportan
window.addEventListener("load", postHeight);
setTimeout(postHeight, 300);
