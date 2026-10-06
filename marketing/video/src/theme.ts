import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily: FONT } = loadFont("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});

/** Formato común de los vídeos de TikTok. */
export const VIDEO = { width: 1080, height: 1920, fps: 30 } as const;

/**
 * Zona segura de TikTok: arriba tapa la barra de pestañas y abajo el usuario,
 * la descripción y los botones. Nada importante fuera de este rectángulo.
 */
export const SAFE = { top: 150, bottom: 380, side: 80 } as const;

/** Franjas verticales que comparten todos los vídeos (en px del lienzo). */
export const LAYOUT = {
  /** Titular de la escena (`OnScreenText`). */
  headlineTop: SAFE.top + 40,
  /** Inicio de la zona del visual principal. */
  stageTop: 500,
  /** Centro vertical de los subtítulos (`Caption`), justo encima de la zona segura inferior. */
  captionCenterY: VIDEO.height - SAFE.bottom - 120,
} as const;

export const COLORS = {
  bg: "#0B0D12",
  bgGlow: "#1A2030",
  card: "#F5F6FA",
  cardBorder: "#E2E5EE",
  ink: "#11141B",
  inkMuted: "#6B7385",
  white: "#FFFFFF",
  textMuted: "#A3ACBD",
  /** Resaltado de la palabra activa en los subtítulos. */
  captionHighlight: "#FFD84D",
} as const;

/** Colores de estado reutilizables en todos los vídeos. */
export const STATUS = {
  confirmed: { color: "#22C55E", label: "Confirmada" },
  pending: { color: "#F59E0B", label: "Pendiente" },
  seated: { color: "#3B82F6", label: "Sentada" },
  noShow: { color: "#EF4444", label: "No-show" },
  cancelled: { color: "#EF4444", label: "Cancelada" },
  /** Mesa libre: neutro, para que destaquen las que tienen reserva. */
  free: { color: "#D9DDE7", label: "Libre" },
} as const;

export type StatusKey = keyof typeof STATUS;

/** Texto legible encima de un color de estado. */
export const statusInk = (status: StatusKey) =>
  status === "free" ? COLORS.inkMuted : COLORS.white;

/** Música de fondo opcional (ruta en `public/`). Sin pista, no suena nada. */
export const MUSIC = {
  src: null as string | null,
  volume: 0.12,
  /** Volumen mientras habla la locución (ducking). */
  duckedVolume: 0.05,
} as const;
