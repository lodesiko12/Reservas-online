import { BRAND } from "../../brand";
import type { VideoScript } from "../../lib/voice";

/**
 * Guion 1 — "Tu mesa vacía te cuesta dinero" (marketing/guiones-tiktok.md).
 * Si cambias el texto o la voz, regenera: npm run voice -- v01-mesa-vacia
 */
export const SCRIPT = {
  tts: {
    provider: "gemini",
    voice: "Puck",
    style:
      "Eres el locutor de un vídeo de TikTok para dueños de restaurantes. Habla en español de España, " +
      "con acento castellano peninsular (nada de acento latinoamericano). Tono cercano y con energía, " +
      "como un colega que sabe de lo que habla y te cuenta un truco. Ritmo rápido, pausas muy cortas " +
      "entre frases. Las dos primeras frases, con un punto de drama; el final, con entusiasmo.",
    tempo: 1.05,
  },
  scenes: [
    {
      id: "s1",
      voice: "Reservó para cuatro. Y no vino.",
      onScreen: "Reservó… y no vino.",
      leadFrames: 6, // primero suena el "ding"
    },
    {
      id: "s2",
      voice: "Mesa vacía toda la noche. Cena perdida.",
      onScreen: "Mesa vacía. Cena perdida.",
    },
    {
      id: "s3",
      voice: "Con Turnigo, el cliente recibe un WhatsApp el día antes. Solo.",
      onScreen: "24 h antes. Automático.",
    },
    {
      id: "s4",
      voice: "Se acuerda, confirma o cancela a tiempo.",
      onScreen: "Cliente avisado ✓",
      minSeconds: 2.4,
    },
    {
      id: "s5",
      voice: "Y si cancela, tu mesa vuelve a estar libre para otro.",
      onScreen: "Y si cancela, tu mesa vuelve a venderse.",
      minSeconds: 3,
    },
    {
      id: "s6",
      voice: `Menos mesas vacías sin llamar a nadie. ${BRAND.cta}.`,
      onScreen: "",
      tailFrames: 24, // el cierre se queda en pantalla tras el CTA
    },
  ],
} satisfies VideoScript;
