// ─────────────────────────────────────────────────────────────────────────────
//  MARCA — identidad de Turnigo (apps/dashboard/src/styles/turnigo-tokens.css).
//  Todos los vídeos leen de aquí. Tras cambiar `cta`, regenera la voz
//  (`npm run voice -- <video>`) porque el CTA también se locuta.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  name: "Turnigo",

  /** Verde azulado del logo (color principal de la app). */
  color: "#0B6E6A",
  colorLight: "#3F9A93",
  colorDark: "#07403E",
  /** Coral del logo: acento para resaltar (nunca texto pequeño). */
  accent: "#FF6B4A",

  /** Icono (cuadrado) y logo completo para fondo oscuro, en `public/`. */
  icon: "brand/turnigo-icono.svg",
  logoOnDark: "brand/turnigo-logo-negativo.svg",

  /** Llamada a la acción común a todas las piezas (EndCard y comentario fijado). */
  cta: "Comenta DEMO y te lo enseño",

  /** Frase corta bajo el logo en el cierre. */
  tagline: "Reservas online para tu negocio",
};
