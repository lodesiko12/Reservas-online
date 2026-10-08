# Sonido y música

Sin voz, el sonido es **la mitad del ritmo**. La música marca los cortes; los efectos (SFX) confirman cada acción.

## 1. Música

### Requisitos de la pista
- **Instrumental**, sin letra ni voz.
- **110-130 BPM** (ideal ≈ 120-124: la referencia late a ~122). Batería marcada con **kick y caja nítidos**.
- Pulso **constante** (sin cambios de tempo ni rubato): el sistema de beats asume tempo fijo.
- Estructura clara: intro corta (1 compás), **bucle de 8 compases**, subida/"drop" hacia los 8 s (ahí cae «Hay otra forma.»).
- Tono **alegre, limpio, ligero** (pop electrónico suave, funk ligero, lo-fi con ritmo). Evitar épico, dramático o muy agresivo.
- Duración ≥ 45 s (para cubrir hasta 22 s y tener margen de recorte).
- **Licencia comercial** verificada y **guardada**; sin Content ID que silencie el vídeo.

### Licencia: la regla que no se salta
La cuenta de TikTok es de **empresa**: solo se permite la *Commercial Music Library*. Como la música va **dentro del vídeo renderizado**,
usa pistas que digan expresamente **"uso comercial permitido"**: Pixabay Music (Licencia de contenido), YouTube Audio Library (comprobar
"sin atribución"), Uppbeat/Artlist (con suscripción activa en el momento de publicar). **Nunca** música de una canción comercial.
Cada pista que se use se apunta en `licencias-musica.csv` (esta carpeta) **con enlace y captura de la licencia** guardada junto al archivo.

### Proceso para elegir (antes de producir nada)
1. El usuario deja **3-5 candidatas** en `../video/public/music/` (o pasa enlaces; el asistente **no descarga sin permiso explícito**, indicando archivo, origen y tamaño).
2. `cd ../video && npm run beats -- public/music` → BPM, 1.er golpe, regularidad, kicks nítidos, estabilidad y **aptitud /100**; genera `src/music/<nombre>.beats.json`.
3. **Escuchar** las 2 mejores y confirmar a oído que los golpes detectados coinciden (la detección puede fallar con swing o pistas muy "orgánicas").
4. Elegir y montar **P04** (plano de sala en vivo) como prueba de cortes sobre golpes. Ajustar.
5. Tener **2-3 pistas** en rotación para no cansar al seguidor, todas dentro del rango de BPM.

### `beats.json` (lo que genera `npm run beats`)
```jsonc
{
  "file": "cancion.mp3", "durationSec": 62.4,
  "bpm": 122.0, "beatSec": 0.4918, "firstBeatSec": 0.221,
  "regularity": 0.96, "kickClarity": 0.88, "tempoStability": 1,
  "beats": [ { "t": 0.221, "frame": 7, "bar": 0, "beatInBar": 0, "strength": 0.91, "strong": true }, … ]
}
```
`beatInBar` 0 = **primer tiempo del compás (downbeat)**; `strong` = golpe fuerte (kick destacado). `frame` ya está a 30 fps.
La música debe **empezar en el primer golpe**: recortar `firstBeatSec` al principio del audio (`<Audio trimBefore>` en Remotion) o desplazar
todas las escenas esa cantidad. Probar a oído.

## 2. Efectos de sonido (SFX)
Existentes en `../video/public/sfx/` (generados por `npm run sfx`): `ding`, `pop`, `tick`, `chime`, `thud`, `whoosh`.

| Evento visual | SFX | Notas |
|---|---|---|
| Sticker que cae | `pop` corto, tono ligeramente distinto en cada uno | -10 dB; sincronizado con el beat |
| Tachón | `tick` seco o "swipe" corto | uno por tachón |
| «Hay otra forma.» / giro | `thud` grave + `whoosh` | **en el kick más fuerte**; es el golpe de la pieza |
| Cambio de escena (downbeat) | `whoosh` corto | volumen bajo; si el corte es seco, solo un `tick` |
| Móvil que entra | `whoosh` ascendente corto | |
| Toque (tap) | `pop` suave | |
| Notificación / mensaje | `ding` / `chime` | el mismo para todas las notificaciones de una pieza |
| Contador sube | `tick` por cada beat | termina con `ding` |
| Mesa cambia a verde / ✓ | `chime` agudo breve | |
| No-show / error | `thud` bajo | |
| Sello / cierre | `thud` + confeti `pop`s | |
| EndCard (logo) | `pop` + pequeño `chime` | CTA en el último beat |

**Por crear si hacen falta** (tras `scripts/make-sfx.ts`): papel que se rasga, swipe, clic de cámara, caja registradora (solo "cuenta"),
"ding" de campanilla de bar. Generarlos sintéticamente o con un banco libre con licencia comercial (anotarlo igual que la música).

## 3. Mezcla
- **Objetivo final:** ≈ **-14 LUFS integrados**, pico real ≤ **-1 dBTP** (TikTok normaliza; así no se aplasta ni se corta).
- La música es el "lecho": en Remotion `volume` ≈ **0,6-0,8** (no el 0,12 de las pruebas con voz). Los SFX **por encima** de la música pero sin tapar el kick: 0,5-0,9 según el SFX.
- **Ducking:** no hay voz, pero hay que bajar la música 2-3 dB **en el momento del `thud`** para que el golpe se note.
- Ventanas de silencio: **nada de silencio**; ni siquiera un instante: el espectador se va. Sí **un golpe de silencio de 1 beat antes del giro** puede funcionar (probar).
- Fundido de salida de la música en el último compás (no corte seco).
- Comprobar con auriculares **y** con el altavoz del móvil: en TikTok se escucha por altavoz.

## 4. Sincronía imagen-sonido (comprobación)
Tras renderizar: `ffmpeg -i out/pNN.mp4 -vf "select='eq(n,<frame_de_un_beat>)'" -frames:v 1 check.png` y comprobar que ese fotograma es
justo el de un corte/entrada; un desfase de ≥ 2 frames (66 ms) se nota. Tolerancia: **≤ 1 frame**.

## 5. Plantilla de registro de licencias
Ver `licencias-musica.csv`. Una fila por pista usada: título, autor, origen, URL, licencia, fecha de descarga, BPM, piezas donde se usa.
