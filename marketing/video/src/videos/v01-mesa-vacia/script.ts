import { BRAND } from "../../brand";
import type { VideoScript } from "../../lib/voice";

/**
 * Guion 1 — "Tu mesa vacía te cuesta dinero" (marketing/guiones-tiktok.md).
 * Si cambias `voice` de alguna escena, regenera: npm run voice -- v01-mesa-vacia
 */
export const SCRIPT = {
  voice: "es-ES-AlvaroNeural",
  rate: "+15%",
  scenes: [
    {
      id: "s1",
      voice: "Reservó para cuatro. Y no vino.",
      onScreen: "Reservó… y no vino.",
      minSeconds: 2,
      leadFrames: 10, // primero suena el "ding"
    },
    {
      id: "s2",
      voice: "Mesa vacía toda la noche. Cena perdida.",
      onScreen: "Mesa vacía. Cena perdida.",
      minSeconds: 2.6,
    },
    {
      id: "s3",
      voice: "Con Turnigo, el cliente recibe un WhatsApp el día antes. Solo.",
      onScreen: "24 h antes. Automático.",
      minSeconds: 3.5,
      leadFrames: 8, // entra el móvil
    },
    {
      id: "s4",
      voice: "Se acuerda, confirma o cancela a tiempo.",
      onScreen: "Cliente avisado ✓",
      minSeconds: 3.2,
    },
    {
      id: "s5",
      voice: "Y si cancela, tu mesa vuelve a estar libre para otro.",
      onScreen: "Y si cancela, tu mesa vuelve a venderse.",
      minSeconds: 3.6,
    },
    {
      id: "s6",
      voice: `Menos mesas vacías sin llamar a nadie. ${BRAND.cta}.`,
      onScreen: "",
      minSeconds: 3,
      leadFrames: 6,
      tailFrames: 30, // el cierre se queda 1 s en pantalla tras el CTA
    },
  ],
} satisfies VideoScript;
