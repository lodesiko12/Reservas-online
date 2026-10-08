import { loadFont } from "@remotion/google-fonts/Nunito";
import { BRAND } from "./brand";

/** Nunito, la tipografía de la app (900 para titulares y cifras, como el wordmark). */
export const { fontFamily: FONT } = loadFont("normal", {
  weights: ["600", "700", "800", "900"],
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

/** Colores de la app (turnigo-tokens.css + modo oscuro del panel). */
export const COLORS = {
  /** Fondo oscuro: neutros verde azulado del modo oscuro del panel. */
  bg: "#0A1D1D",
  bgGlow: BRAND.colorDark,
  /** Tarjetas claras (--tg-surface / --tg-bg / --tg-border). */
  card: "#FFFFFF",
  cardAlt: "#F3F7F6",
  cardBorder: "#D9E4E2",
  ink: "#0F2A2A",
  inkMuted: "#4A6362",
  white: "#FFFFFF",
  textMuted: "#8CA3A1",
  /** Resaltado de la palabra activa en los subtítulos: coral de marca. */
  captionHighlight: BRAND.accent,
} as const;

/**
 * Estados de reserva con la paleta de estados de la app (verde/ámbar/azul/rojo).
 * `solid` = color fuerte, `tint` = fondo suave y `ink` = texto, igual que el plano de sala del panel.
 */
export const STATUS = {
  confirmed: { solid: "#1F8A4C", tint: "#EAF6EF", ink: "#186B3B", label: "Confirmada" },
  pending: { solid: "#B7791F", tint: "#FBF3E3", ink: "#8F5E18", label: "Pendiente" },
  seated: { solid: "#2563A8", tint: "#EAF1F9", ink: "#1D4F86", label: "Sentada" },
  noShow: { solid: "#C0392B", tint: "#FBEDEB", ink: "#992E22", label: "No-show" },
  cancelled: { solid: "#C0392B", tint: "#FBEDEB", ink: "#992E22", label: "Cancelada" },
  free: { solid: "#BFD0CD", tint: "#FFFFFF", ink: "#8CA3A1", label: "Libre" },
} as const;

export type StatusKey = keyof typeof STATUS;

/** Radios de la app (el icono tiene esquinas muy redondeadas), escalados a vídeo. */
export const RADIUS = { md: 24, lg: 40, pill: 999 } as const;

/** Sombra suave teñida de verde, como `--tg-shadow-card`, más marcada para vídeo. */
export const SHADOW_CARD = "0 2px 4px rgba(15,42,42,0.12), 0 24px 70px rgba(0,0,0,0.45)";

/** Música de fondo opcional (ruta en `public/`). Sin pista, no suena nada. */
export const MUSIC = {
  src: null as string | null,
  volume: 0.12,
  /** Volumen mientras habla la locución (ducking). */
  duckedVolume: 0.05,
} as const;
