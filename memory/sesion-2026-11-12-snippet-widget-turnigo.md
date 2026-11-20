# Sesión 2026-11-11/12 — Snippet del widget para el negocio Turnigo

Sesión corta, solo consulta: no se tocó código, ni BD, ni se hizo commit/push.

## Qué se pidió y qué se hizo

1. **Slug del widget del negocio Turnigo** → consulta SQL a `businesses`:
   `name='Turnigo'`, `slug='turnigo'`, `type='autonomo'`, `is_active=true`.
2. **Código para pegar en la web** → leído de `apps/widget/public/embed.js` (la cabecera documenta todas las
   opciones `data-*`). No se probó en una web real.

## Snippet correcto (usar este)

```html
<div id="reservas-widget" data-slug="turnigo"></div>
<script src="https://widget.turnigo.es/embed.js" async></script>
```

Comprobado el 2026-11-12: `https://widget.turnigo.es/embed.js` responde 200 `text/javascript`.

## Error a corregir

En la sesión se entregó el snippet con `https://turnigo-widget.lodesiko12.workers.dev/embed.js` (dominio
antiguo). Funciona, pero `CLAUDE.md` (releído al cerrar) dice que las **webs nuevas deben usar
`widget.turnigo.es`**; la URL `workers.dev` se mantiene viva solo por compatibilidad con webs de clientes ya
publicadas. Si el usuario ya pegó el snippet antiguo en alguna web, conviene cambiarlo (no urgente: sigue
funcionando). Enlace directo a pantalla completa: `https://widget.turnigo.es/?slug=turnigo`.

## Opciones útiles de `embed.js` (atributos `data-*` en el `<div>`)

`data-theme="dark"`, `data-accent`, `data-max-width` (320-1200, def. 520), `data-radius`,
`data-control-radius` (999 = píldora), `data-font-heading`, `data-font-body`, `data-bg`, `data-text`,
`data-muted`, `data-surface`, `data-field`, `data-border`, `data-chrome="none"` (sin cabecera/pie/emojis, para
webs con su propio título), `data-view="mi-reserva"`. Ejemplo oscuro sin marco:
`data-theme="dark" data-chrome="none" data-max-width="720"`.

## Contexto útil para la próxima sesión

- El negocio `turnigo` es de tipo `autonomo`: sus reservas van a Pipeline/Agenda del mini-CRM y avisan al
  dueño (ver `memory` del asistente: widget autónomo). La clave de Resend de Turnigo daba 401, así que los
  emails pueden no salir.
- Antes de dar URLs al usuario, mirar `CLAUDE.md`: los dominios cambiaron a `app.turnigo.es` (panel) y
  `widget.turnigo.es` (widget). No usar de memoria las `workers.dev`.
- Estado de git al empezar: sin commitear `marketing/referencia-app/package.json`,
  `supabase/demo/psicologo_demo_seed.sql`, `marketing/capturas-web/`, `marketing/referencia-app/capture-demos-web.ts`,
  `supabase/demo/demo_{aura_estetica,casa_olivar,dulce_mora}.sql` y
  `memory/sesion-2026-11-10-pecado-carnal-burguer-chin.md` (trabajo de sesiones anteriores).

## Preferencias del usuario (observadas / ya conocidas)

- Pide lo mínimo y directo (primero el slug, luego solo "la parte de código"): responder con el dato o el
  snippet listo para pegar, sin rodeos.
- Habla en español.
