# Turnigo — vídeos de TikTok (Remotion)

Proyecto npm **independiente** de la app: no forma parte de los workspaces (`packages/*`, `apps/*`)
ni de su build. Guiones en [`../guiones-tiktok.md`](../guiones-tiktok.md).

```bash
cd marketing/video
npm i
npm run dev                         # Remotion Studio (vista previa)
npm run voice -- v01-mesa-vacia     # regenera la locución + tiempos
npm run sfx                         # regenera los efectos de sonido
npx remotion render V01-MesaVacia out/v01-mesa-vacia.mp4
```

## Lo que hay que tocar

- **`src/brand.ts`** — nombre, color de marca, logo (`public/brand/...`) y CTA. Tras cambiar el CTA,
  regenera la voz (también se locuta).
- **`src/theme.ts`** — colores de estado, fondo, zona segura de TikTok y música (`MUSIC.src`;
  `null` = sin música; con pista, baja sola bajo la voz).

## Voz

Edge TTS (voces neuronales de Microsoft en español de España, gratis y sin cuenta) vía `msedge-tts`.
Es un endpoint no oficial: si deja de funcionar o se quiere una vía con licencia clara, Azure Speech
tiene un plan gratuito (F0, 500 000 caracteres/mes) con las mismas voces; solo hay que reescribir
`synthesize()` en `scripts/generate-voice.ts`.

Flujo: `script.ts` (texto de cada escena) → `npm run voice` → `public/audio/<video>/*.mp3` +
`voice.json` (duración y palabra a palabra). Cada escena dura lo que su locución (con un mínimo) y los
subtítulos salen de esos tiempos, así que cambiar una frase reajusta solo el vídeo.

Voces disponibles: `es-ES-AlvaroNeural` (actual), `es-ES-ElviraNeural`, `es-ES-XimenaNeural`.

## Estructura

```
src/
  brand.ts, theme.ts         constantes de marca y estilo
  lib/anim.ts                helpers de animación (spring, pop, pulso…)
  lib/voice.ts               guion + voz → tiempos de escena y subtítulos
  components/                kit reutilizable
    PhoneFrame, WhatsAppChat (+ WhatsAppBubble), FloorPlan, Notification,
    Caption, EndCard, OnScreenText, Background, Logo, AudioLayers (Sfx, música)
  videos/v01-mesa-vacia/     guion 1: script.ts, voice.json, partes y composición
scripts/
  generate-voice.ts, make-sfx.ts
```

Para un vídeo nuevo: copia la carpeta `videos/v01-mesa-vacia`, cambia `script.ts`, ejecuta
`npm run voice -- <carpeta>` y registra la composición en `src/Root.tsx`.
