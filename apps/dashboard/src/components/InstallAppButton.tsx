import { useEffect, useState } from "react";
import { Modal } from "./ui";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ se identifica como Mac con pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Botón "Instalar app": diálogo nativo en Android/Chrome, instrucciones en iOS. Oculto si ya está instalada. */
export function InstallAppButton({ className = "btn-ghost w-full justify-start" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  const ios = isIos();
  if (!promptEvent && !ios) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
    } else {
      setShowIos(true);
    }
  }

  return (
    <>
      <button className={className} onClick={install}>
        <span>📲</span> Instalar app
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
