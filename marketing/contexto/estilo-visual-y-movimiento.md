# Estilo visual y lenguaje de movimiento

Manual de estilo de los vídeos. Está derivado del análisis fotograma a fotograma de la referencia
`../referencia-estilo/promo-pasacalles.mp4` (28 s, 1080×1920, 30 fps, sin voz), cuyas capturas a 1 fps están
en `../referencia-estilo/frames/` y `hoja-contacto-1fps.png`. **Esa es la vara de medir de calidad:** rápido,
fluido, animado, cada cosa que entra lo hace con intención y en el momento justo.

> Pasacalles es **otra marca** (crema, marrón oscuro, serif, rojo/azul/mostaza). Copiamos la **estructura y el movimiento**,
> no la paleta ni la tipografía: Turnigo usa la suya (§4).

## 1. Anatomía de la referencia (qué pasa y cuándo)

| t (s) | Escena | Qué ocurre | Técnica |
|---|---|---|---|
| 0-2 | **Caos** (fondo marrón oscuro) | Titular fijo «Organizar una fiesta no debería ser esto.» y **6 stickers** que caen uno tras otro (≈ 1 cada 0,25 s) con ligera rotación: «Excel de socios», «WhatsApp: 247 mensajes», «Listas en papel», «¿Quién ha pagado?», «¿Plazo de invitados?», «PDF_final_v3.pdf» | Sticker = tarjeta blanca con borde de color a la izquierda, sombra, rotación ±3-6°, entra con muelle y rebote |
| 2-3 | **Tachado + giro** | Cada sticker recibe una **línea roja que se dibuja** de izquierda a derecha; el titular se sustituye por **«Hay otra forma.»** (2.ª línea en rojo) | Línea animada 0→100 % de ancho en ~6 frames; titular cambia con corte seco; barrido diagonal hacia el fondo claro |
| 3-5 | **Marca** (fondo crema) | Un arco se dibuja, **caen las banderitas** y estalla confeti; el nombre se **escribe letra a letra** («Pasa…calles»); aparece el lema «Tu asociación festiva, en el móvil.»; el móvil asoma desde abajo | Stagger de letras (≈ 2 frames por letra); partículas con gravedad |
| 5,9-9,8 | **Beneficio 1: «Todo en un solo sitio.»** | Titular 2 líneas (2.ª en acento) + subtexto; **móvil entra desde abajo** con giro leve; un **círculo rojo de toque** (tap) sobre «Agenda» | Muelle de entrada ~0,6 s; ripple escala 0,4→1,6 y se desvanece |
| 9,8-13,8 | **Beneficio 2: «La barra, sin papeles.»** | Móvil inclinado entra; **QR** con **línea de escaneo** que lo recorre; contador **27/40 → 28/40** y barra verde «Consumición registrada» | Número que sube con un pequeño salto; barra con relleno; aviso verde que aparece |
| 13,8-17,7 | **Beneficio 3: «Que nadie se pierda un desfile.»** | Agenda; una **estrella se activa** (dorada) y cae una **notificación** arriba: «Desfile de gala en 30 min» | Toggle con pop; banner que cae y rebota |
| 17,7-21,6 | **Beneficio 4: «Y mucho más.»** | El fondo vira a **beige**; **7 tarjetas de función** (icono + título + 1 línea) **caen en cuadrícula** una a una con ligera rotación y se enderezan | Stagger ≈ 1 tarjeta por beat; sombra; rotación aleatoria ±4° → 0° |
| 21,6-24,5 | **Beneficio 5: «Cada asociación, su identidad.»** | **3 móviles con temas de color distintos** entran deslizando; al final aparece la insignia «Datos 100 % aislados en cada asociación» con un escudo | Entrada escalonada lateral; insignia con fade+pop |
| 24,5-28 | **Cierre** (vuelve el fondo oscuro) | El arco/banderas se reconstruyen, el nombre se escribe de nuevo, **lema en cursiva dorada** y un **botón-pastilla rojo con CTA** («Prueba Pasacalles») que hace pop en el último segundo | Mismo gesto de marca que al principio (simetría) |

### Ideas clave que hacen que se vea "profesional"
1. **Cadencia constante:** las escenas de beneficio duran ≈ **3,93 s** cada una → ≈ **8 beats a ~122 BPM** (2 compases). Es lo que
   da la sensación de ritmo aunque no suene música en el archivo. Nuestros cortes caen **exactamente** en los golpes.
2. **Todo entra con muelle, nada aparece de golpe.** Rebote pequeño, nunca excesivo.
3. **Una micro-acción por escena** que demuestra la función (toque, escaneo, contador, estrella, notificación). Sin acción, la escena sobra.
4. **Contraste de mundos:** oscuro = problema, claro = solución. El cambio se hace **una sola vez** y es un golpe visual.
5. **Titular grande en 2 líneas** con la **2.ª línea en color de acento** y un **subtexto** pequeño; se lee en < 1,5 s.
6. **Simetría de apertura/cierre:** el gesto de marca del inicio se repite al final.
7. **Elemento de marca persistente** (las banderitas arriba) que da continuidad entre escenas.
8. **Cero relleno:** no hay planos de transición "bonitos" sin información.

## 2. Catálogo de movimientos (receta Remotion)
Valores de partida; afinar viendo el resultado a 30 fps. Los helpers ya existen en `video/src/lib/anim.ts`
(`springIn`, `pop`, `fadeOut`, `whip`, `EASE_OUT = bezier(0.16,1,0.3,1)`, `EASE_IN = bezier(0.7,0,0.84,0)`).

| Movimiento | Receta |
|---|---|
| **Sticker que cae** | `translateY: -260 → 0`, `rotate: ±6° → ±3°`, `spring({damping: 9, stiffness: 170, mass: .7})`; sombra `SHADOW_CARD` |
| **Tachón** | línea 8 px color peligro (`#C0392B`), `scaleX: 0→1` con `transform-origin: left`, 6 frames, `EASE_OUT`; ligero ángulo −2° |
| **Pop** (chips, burbujas, estrella) | `pop(frame, fps, at)` (damping 11, stiffness 220, mass .6) |
| **Móvil que entra** | `translateY: 900 → 0`, `rotate: 8° → 0°`, `spring({damping: 15, stiffness: 120})`, ~18 frames; sombra grande |
| **Tap (círculo de toque)** | círculo borde 6 px color acento: `scale .4→1.6`, `opacity .9→0`, 14 frames; el elemento tocado hace `scale 1→.96→1` |
| **Titular** | línea 1 y 2 entran con `translateY: 40→0` + `opacity 0→1`, 2.ª línea +3 frames de retraso; salida `fadeOut` 8 frames |
| **Escritura letra a letra** (marca) | `clip-path`/opacidad por letra, 2 frames por letra, `pop` suave |
| **Contador** | `interpolate` con `EASE_OUT`, termina en el beat; `tabular-nums`; salto `scale 1→1.12→1` al llegar |
| **Línea de escaneo** | barra translúcida acento que cruza el elemento de arriba abajo en 12 frames |
| **Notificación** | banner (`Notification.tsx`) cae `translateY: -220→0` con rebote y se mantiene 1 s |
| **Cuadrícula de tarjetas** | stagger 1 tarjeta/beat, `rotate: ±4°→0`, `translateY: -120→0`, `spring damping 12` |
| **Confeti / partículas** | `Burst.tsx`: 24-40 partículas, gravedad, 20-30 frames |
| **Corte de escena** | **corte seco en el downbeat** + `whoosh`; o barrido (`whip`) de 6-9 frames; nunca fundidos largos |
| **Énfasis en kick** | `scale 1→1.06` + sacudida 3 frames (±6 px), `thud` |
| **Cámara** | `Camera.tsx`: zoom lento 1→1.05 durante la escena para que nunca esté "quieta" |

## 3. Composición en el lienzo 1080×1920
- **Zona segura:** nada importante en los **150 px superiores** ni en los **380 px inferiores** (`SAFE` en `video/src/theme.ts`).
- **Titular:** arriba, a ~`y=190` (`LAYOUT.headlineTop`), ancho máx. 920 px, texto centrado, 2 líneas, tamaño 92-110 px (Nunito 900), interlineado 1,05.
- **Subtexto:** 38-44 px, color atenuado, bajo el titular.
- **Escenario:** desde `y≈500` (`LAYOUT.stageTop`) hasta `y≈1540`. Móvil de **560-640 px de ancho**, centrado; pantalla del móvil con la **UI real** (ver §6).
- **Margen lateral:** 80 px mínimo. Jerarquía: titular > móvil/visual > subtexto.
- **Un solo foco por pantalla.** Si hay dos cosas que animar, que sea en beats distintos.

## 4. Paleta y tipografía de Turnigo (adaptación de la referencia)
| Rol | Referencia (Pasacalles) | **Turnigo** | Código |
|---|---|---|---|
| Fondo "caos" | marrón oscuro | verde-negro | `#0A1D1D` (`COLORS.bg`) con resplandor `#07403E` |
| Fondo "solución" | crema | gris-verdoso claro | `#F3F7F6` (alt. `#E8F4F3`) |
| Fondo de relieve/"Y mucho más" | beige | teal muy claro | `#CFE6E3` |
| Texto | marrón | tinta | `#0F2A2A` (secundario `#4A6362`) |
| **Acento** (2.ª línea del titular) | rojo | **coral** | `#FF6B4A` en formas; **`#C8401F` si es texto pequeño sobre claro** |
| Color de marca / botones | — | teal | `#0B6E6A` (hover `#095A57`) |
| Tachón / negativo | rojo | rojo estado | `#C0392B` |
| Éxito | verde | verde estado | `#1F8A4C` |
| Pendiente | ámbar | ámbar estado | `#B7791F` |
| Sentada / info | azul | azul estado | `#2563A8` |
| Tarjetas | blanco | blanco | `#FFFFFF`, borde `#D9E4E2`, radio 24-40 px |

- **Tipografía:** **Nunito** (la de la app): 900 para titulares y cifras, 800 para rótulos, 700 para subtextos. Cargada en `video/src/theme.ts`.
  El serif de la referencia es de su marca; **no lo usamos**.
- **Texto sobre fondo oscuro:** blanco; acento coral `#FF6B4A` (cumple contraste). **Sobre claro:** tinta `#0F2A2A` y acento `#C8401F`.
- **Contraste mínimo 4,5:1** para cualquier texto; en vídeo se ve en pantalla pequeña, no bajes de 36 px.
- **Elemento de marca persistente** (equivalente a las banderitas): una **banda superior fina** con el icono de Turnigo pequeño a la izquierda
  y/o una línea teal que se "dibuja" al entrar cada escena de solución. Sencillo, siempre igual.
- **Iconos:** vectoriales y simples (relleno plano). Los emojis solo como acento puntual.

## 5. Diseño de los stickers
Tarjeta blanca `#FFFFFF`, radio 14 px, borde izquierdo de 6 px (teal `#0B6E6A` o coral), sombra suave, texto Nunito 800 de 42-48 px
en tinta `#0F2A2A`. 1-6 palabras. Rotación distinta en cada uno. Al tacharse: línea coral/roja encima y el texto se atenúa al 55 %.

## 6. Cómo mostrar la app (pantallas dentro del móvil)
**Orden de preferencia:**
1. **Reconstruir la pantalla como componente React** con los tokens de `../referencia-app/diseno/turnigo-tokens.css` → permite
   animar cada elemento (mesa que cambia de color, fila que aparece, contador que sube). Es lo que hace la referencia (UI propia, no una captura).
2. **Captura recortada** de `../referencia-app/capturas/` solo para fondos estáticos o planos rápidos (recortar la barra lateral y el email de la cuenta demo).
3. **Nunca** una grabación de pantalla "cruda".

Reglas de fidelidad:
- La UI debe **parecerse a la real**: mismos colores, esquinas (12/20 px), tipografía Nunito, textos exactos ("Sentar clientes", "Empezar cita", "Marcar todas pagadas").
- El **plano de sala real son tarjetas por zona**, no un plano redondo. Hacerlo redondo es licencia creativa y se decide a propósito.
- Móvil: marco negro con *dynamic island*, hora **9:41**, barra de estado coherente, esquinas proporcionales al ancho (ya resuelto en `PhoneFrame.tsx`: `radius = width × 0.15`, proporción 2,05).
- Datos de demo siempre ficticios; teléfonos/emails inventados; **recortar** `psicologa@psicologo.test` etc. de la barra lateral.
- Los números de las tarjetas (reservas hoy: 9, etc.) pueden ser los de la demo; cualquier otra cifra, "(ejemplo)".

## 6b. Carruseles
5 diapositivas 1080×1920: **(1) portada-gancho** titular enorme + 1 icono; **(2-4) una idea por diapositiva** con titular de 2 líneas y
un visual (UI, tarjeta, número); **(5) cierre** con logo + «Comenta "DEMO"». Mismo fondo/colores que los vídeos, flecha sutil «→» en
la esquina derecha de las 1-4 para invitar a deslizar. Exportar cada una como PNG (`renderStill`). Misma música que los vídeos.

## 7. Qué NO hacer (se nota que es "genérico")
- Fundidos largos, zooms constantes sin motivo, transiciones de plantilla (cubo 3D, giros).
- Texto que aparece de golpe sin animar, o animaciones sin rebote (suenan "baratas").
- Más de 6 palabras por pantalla, más de 2 líneas de titular, texto pequeño (< 36 px).
- Fotos de stock, personas generadas, manos reales; todo vector.
- Estilo "plantilla de PowerPoint": tarjetas idénticas alineadas sin ritmo; variar rotación, retardo y tamaño.
- Rótulos que tapan el móvil o salen de la zona segura.
- Demasiados colores a la vez: **un acento por escena**.
- Animar algo que no aporta información (si se puede quitar sin perder el mensaje, se quita).

## 8. Plantillas (T1…T10, C): resumen visual
Detalle de duración y beats en `../calendario-tiktok-oct-2026.md` (§1). Todas comparten: ① gancho en 4 beats, ② una micro-acción por función,
③ corte en downbeat, ④ cierre simétrico con EndCard (logo + «Comenta "DEMO"»). T1 es la copia estructural de la referencia.
