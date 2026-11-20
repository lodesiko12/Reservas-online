import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { Smartphone } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ se identifica como Mac con pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// `beforeinstallprompt` se dispara una sola vez al cargar: se captura a nivel de módulo para que
// los botones que se montan después (menú móvil, cabecera) lo encuentren.
let deferred: InstallPromptEvent | null = null;
let wasInstalled = typeof window !== "undefined" && isStandalone();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    wasInstalled = true;
    deferred = null;
    notify();
  });
}

/** Botón "Instalar app": diálogo nativo en Android/Chrome, instrucciones en iOS. Oculto si ya está instalada. */
export function InstallAppButton({ className = "btn-ghost w-full justify-start", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [, force] = useState(0);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);

  const promptEvent = deferred;
  const installed = wasInstalled;

  if (installed) return null;
  const ios = isIos();
  if (!promptEvent && !ios) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      deferred = null;
      notify();
    } else {
      setShowIos(true);
    }
  }

  return (
    <>
      <button className={className} onClick={install} title="Instalar app" aria-label="Instalar app">
        <Smartphone size={iconOnly ? 18 : 16} strokeWidth={1.75} aria-hidden="true" />{!iconOnly && " Instalar app"}
      </button>
      <Modal open={showIos} onClose={() => setShowIos(false)} title="Instalar Turnigo en tu iPhone">
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <li>Abre esta página en <strong>Safari</strong> (no funciona desde otros navegadores ni desde dentro de otras apps).</li>
          <li>Pulsa el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
          <li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma con <strong>Añadir</strong>.</li>
        </ol>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={() => setShowIos(false)}>Entendido</button>
        </div>
      </Modal>
    </>
  );
}
