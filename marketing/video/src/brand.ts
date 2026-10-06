// ─────────────────────────────────────────────────────────────────────────────
//  MARCA — lo único que hay que tocar cuando estén definidos logo, color y CTA.
//  Todos los vídeos leen de aquí. Tras cambiar `cta`, regenera la voz
//  (`npm run voice -- <video>`) porque el CTA también se locuta.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  name: "Turnigo",

  /** Color de marca (provisional). Evita verde/ámbar/azul/rojo: son los colores de estado. */
  color: "#7C5CFF",

  /**
   * Logo: ruta dentro de `public/` (p. ej. "brand/logo.svg") o `null`.
   * Con `null` se dibuja un logotipo provisional (cuadrado con la inicial).
   */
  logo: null as string | null,

  /** Llamada a la acción común a los 10 vídeos (se muestra y se locuta). */
  cta: "Comenta DEMO y te la enseño",

  /** Frase corta bajo el nombre en el cierre. */
  tagline: "Reservas online para tu negocio",
};
