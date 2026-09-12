import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug") ?? "";
const initialView = params.get("view") === "mi-reserva" ? "lookup" : "booking";
const initialLocator = params.get("locator") ?? "";

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
