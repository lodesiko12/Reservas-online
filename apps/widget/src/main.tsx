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

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App slug={slug} initialView={initialView} initialLocator={initialLocator} />
  </React.StrictMode>
);

// Comunica la altura al documento anfitrión para que embed.js redimensione el iframe.
function postHeight() {
  const h = document.documentElement.scrollHeight;
  window.parent?.postMessage({ type: "reservas-widget:height", height: h }, "*");
}
const ro = new ResizeObserver(postHeight);
ro.observe(document.documentElement);
window.addEventListener("load", postHeight);
setTimeout(postHeight, 300);
