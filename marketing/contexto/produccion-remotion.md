# Producción con Remotion: cómo construir y renderizar las piezas

Proyecto en `../video/` (Remotion **4.0.533**, React 19, TypeScript, Rspack). Independiente de la app.
Lee antes: `estilo-visual-y-movimiento.md` (qué construir) y `sonido-y-musica.md` (beats).
Usa las skills de Remotion al construir (`remotion-best-practices`, `remotion-docs`, `remotion-render`).

## 1. Comandos
```bash
cd marketing/video
npm i
npm run dev                                   # Remotion Studio (previsualizar)
npm run beats -- public/music                 # analiza canciones → src/music/*.beats.json
npm run sfx                                   # regenera efectos de sonido (public/sfx)
npx remotion render <ComposiciónId> out/<archivo>.mp4 --codec h264 --crf 18 --pixel-format yuv420p --audio-codec aac --audio-bitrate 192k
npx remotion render <Id> out/draft.mp4 --scale 0.5 --crf 28        # borrador rápido para revisar ritmo
npx remotion still  <Id> out/<archivo>.png --frame 45              # un fotograma (también para carruseles)
npm run lint                                  # eslint + tsc: debe pasar antes de dar nada por terminado
```
`npm run voice` existe solo para el vídeo 1 antiguo (con locución): **las piezas nuevas no usan voz**.
`out/` está ignorado por git. Entorno: Windows 11; ffmpeg y Chrome instalados (Remotion descarga su propio Chrome si hace falta).

## 2. Estructura de carpetas (objetivo)
```
video/src/
  brand.ts, theme.ts            marca, colores, zona segura, estados  (ya existen)
  lib/anim.ts                   springIn, pop, fadeOut, whip, EASE_*   (ya existe)
  lib/beats.ts                  ← CREAR: useBeats(), conversión beats→frames
  music/<pista>.beats.json      mapa de golpes generado por `npm run beats`
  components/                   piezas reutilizables (PhoneFrame, FloorPlan, Notification, EndCard…)
  templates/                    ← CREAR: T1Chaos, T2Split, T3Counter, T4Kinetic, T5Tour, T6List, T7Reveal, T9Chat, T10Stopwatch, CarouselSlide
  videos/pNN-slug/
    script.ts                   ← los DATOS de la pieza (textos y beats); sin lógica
    PNN.tsx                     composición fina que llama a la plantilla con el script
  Root.tsx                      registra todas las composiciones (carpeta "TikTok" y "Carruseles")
```
**Regla:** una pieza nueva = **un `script.ts` + una composición de 10 líneas**. Si necesitas un componente nuevo, va a `components/` o
`templates/` y se reutiliza. Nada de duplicar carpetas enteras (el vídeo 1 antiguo `v01-mesa-vacia` es el único que sigue el patrón viejo).

## 3. El sistema de beats (a construir: `src/lib/beats.ts`)
```ts
import beats from "../music/<pista>.beats.json";

export type BeatMap = typeof beats;
export const FPS = 30;

/** Frame (entero) del beat n-ésimo (0 = primer golpe). Más allá del mapa, extrapola con beatSec. */
export const beatFrame = (map: BeatMap, n: number): number =>
  Math.round((map.firstBeatSec + n * map.beatSec) * FPS);

export const barFrame = (map: BeatMap, bar: number) => beatFrame(map, bar * 4);
export const isDownbeat = (n: number) => n % 4 === 0;
/** Beats fuertes (kicks destacados) dentro del rango [from, to). */
export const strongBeats = (map: BeatMap, from: number, to: number): number[] =>
  map.beats.flatMap((b, i) => (i >= from && i < to && b.strong ? [i] : []));
export const durationFrames = (map: BeatMap, totalBeats: number) => beatFrame(map, totalBeats);
```
- Todas las escenas se definen como **`beats: N`** y se acumulan; `Sequence from={beatFrame(map, startBeat)} durationInFrames={beatFrame(map, startBeat+N) - beatFrame(map, startBeat)}`.
- Dentro de una escena, cada elemento entra en `beatFrame(map, startBeat + k)` con `pop`/`springIn`.
- El **énfasis** (`thud`, zoom, sacudida) cae en un `strong` beat; si el compás no tiene ninguno marcado, usar el downbeat.
- Para desfase de audio: la música se recorta al principio `firstBeatSec` (o se suma a todas las escenas). Verificar a oído y con `ffmpeg` (ver `sonido-y-musica.md` §4).
- **Probar con dos canciones distintas** para comprobar que el guion en beats no depende de una pista concreta.

### `script.ts` de una pieza (formato)
```ts
import type { PieceScript } from "../../templates/types";

export const SCRIPT: PieceScript = {
  id: "P04", slug: "plano-en-vivo", template: "T5", totalBeats: 32,
  hook: { beats: 4, title: ["Así se ve tu sala", "un viernes."] },
  scenes: [
    { beats: 8, kind: "tour", headline: ["Las reservas", "entran solas."], screen: "plano-reservas", action: "reservas-entran" },
    { beats: 6, kind: "tour", headline: ["Toca una mesa:", "sentados."],  screen: "plano-sentar",   action: "tap-sentar" },
    { beats: 6, kind: "tour", headline: ["¿No vino?", "Liberada."],        screen: "plano-noshow",   action: "noshow-libera" },
  ],
  end: { beats: 8, line: "Todo tu servicio, de un vistazo." },   // + CTA fijo de BRAND.cta
};
```
(Los tipos exactos se definen al construir las plantillas; mantenerlos simples y serializables.)

## 4. Construcción de pantallas de la app (componentes)
- Reconstruir la UI real con los tokens de `../referencia-app/diseno/turnigo-tokens.css`. Fuente única de colores/formas: `src/theme.ts` (`COLORS`, `STATUS`, `RADIUS`, `SHADOW_CARD`).
- Pantallas a tener como componentes (en orden de uso): **TarjetaMesa/PlanoSala**, **AgendaDia / AgendaSemana (con colores de profesional)**, **BurbujaWhatsApp**,
  **WidgetReserva (pasos)**, **Kanban**, **DocPresupuesto**, **ListaPagos**, **FormularioSesion**, **TarjetaResumen (KPIs)**.
- Datos de las pantallas: **ficticios**, en un solo fichero `src/data/demo.ts` (nombres, mesas, horas) para no repetir ni mezclar.
- Comparar visualmente con `../referencia-app/capturas/` (mismo color, mismo radio, mismos textos).
- Si una captura sirve tal cual, se importa desde `public/capturas/` copiándola allí (no apuntar fuera de `video/`) y se **recorta** la barra lateral.

## 5. Carruseles
Una composición `CarouselXX` con **5 fotogramas = 5 diapositivas** (duración 5 frames) y se exportan con `remotion still … --frame N` (N = 0…4) a `out/cNN-1.png`…`-5.png`.
Misma fuente/colores que los vídeos. 1080×1920. Última diapositiva: logo + «Comenta "DEMO"».

## 6. Renderizado y entrega
- **Vídeo:** MP4 h264, 1080×1920, 30 fps, yuv420p, AAC 192 kbps, ≤ 60 s (las nuestras 12-22 s). Peso típico 3-12 MB.
- **Nombre de archivo:** `out/P04-plano-en-vivo_v1.mp4` (ID de la pieza + slug + versión). Carrusel: `out/C03-widget-4-pasos_1.png`…`_5.png`.
- Revisar **siempre** en el reproductor del propio TikTok (subiendo como borrador privado) o en un móvil: la zona segura se comprueba a ojo.
- Guardar el **proyecto de la pieza** (script.ts) bajo control de versiones; no subir `out/`.
- **Cola de renders:** si hay muchas piezas, un script que recorra las composiciones y renderice con `--concurrency` ≈ mitad de los núcleos.

## 7. Orden de trabajo recomendado
1. Elegir canción → `npm run beats` → escuchar → fijar la pista (`sonido-y-musica.md` §1).
2. Construir **`beats.ts`** y la plantilla **T4** (cubre ~10 piezas, la más barata) y probarla con un guion corto.
3. Construir **P04** (T5, plano de sala) como vídeo de prueba; revisar cortes frente a golpes (tolerancia ≤ 1 frame).
4. Plantillas **T1**, **T2**, **T3**, **T6**, **T7**, **T9**, **T10**, **C**, por ese orden.
5. **Lotes por plantilla**: producir todas las piezas de una plantilla seguidas (misma lógica, solo cambian los datos).
6. **Rehacer P01** sin voz con el sistema nuevo.
7. Pasar `checklist-calidad.md` a cada pieza **antes** de dar por buena.

## 8. Trampas conocidas (ya nos han mordido)
- **No uses `confirm()`/`alert()`** ni diálogos nativos del navegador en nada que se renderice o previsualice.
- En Windows, las rutas con espacios o `\`: usa rutas con `/` en los scripts; el nombre de carpeta del repo tiene espacios.
- El audio de Remotion se **recorta/desplaza por frames**: un offset fraccionario no se aplica; redondea y comprueba.
- `position: sticky/fixed` o `100vh` no existen en el lienzo de Remotion: todo es absoluto en 1080×1920.
- Los `Sequence` anidados **reinician `useCurrentFrame()`** (frame local): calcula los beats en frame **global** y resta el inicio de la secuencia.
- Fuentes: carga Nunito con `@remotion/google-fonts` en `theme.ts` (ya hecho); no dependas de fuentes del sistema.
- No uses animaciones CSS ni `setTimeout`: todo se deriva de `useCurrentFrame()`.
- Renderiza con la composición ya registrada en `Root.tsx` (la carpeta `TikTok`); el ID debe coincidir exactamente.
- Si Chrome de Remotion no abre: `npx remotion browser ensure`.
- Peso de capturas PNG de 2880 px: reduce a 1080-1440 px de ancho antes de meterlas (`ffmpeg -vf scale`).
