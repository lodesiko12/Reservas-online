# Turnigo · Marketing (TikTok) — instrucciones del proyecto

Proyecto **independiente** de la app (se puede mover a su propia carpeta). Contiene los guiones, el
sistema de vídeo (Remotion) y las capturas de referencia de la app. Este archivo reúne las reglas de
trabajo y las decisiones tomadas; léelo entero antes de producir nada.

## Mapa de archivos

**Orden de lectura al empezar una sesión:** este archivo → `sesion-2026-10-06.md` → `contexto/producto-turnigo.md` → `contexto/estilo-visual-y-movimiento.md` →
`calendario-tiktok-oct-2026.md` (la pieza concreta) → el resto según la tarea.

| Ruta | Qué es |
|---|---|
| `sesion-2026-10-06.md` | **Resumen de la última sesión**: decisiones, errores corregidos, cambios en producción y pendientes. Léelo al empezar |
| `calendario-tiktok-oct-2026.md` | **Plan de 60 piezas** (48 vídeos + 12 carruseles) del 7 al 31 oct 2026, escritas en *beats* |
| `guiones-tiktok.md` | 10 guiones largos originales (con locución). El vídeo 1 ya está hecho; el resto se reaprovecha en el calendario |
| `contexto/producto-turnigo.md` | Qué es Turnigo, qué hace cada tipo de negocio, qué se puede y **no** se puede enseñar/afirmar |
| `contexto/publico-y-mensajes.md` | Perfiles de cliente, dolores, objeciones, tono, pilares de mensaje, embudo "DEMO" |
| `contexto/banco-de-ganchos-y-textos.md` | Ganchos, stickers de "caos", titulares, cierres, descripciones, comentario fijado, respuestas a DM |
| `contexto/estilo-visual-y-movimiento.md` | **Manual de estilo**: desglose de la referencia, catálogo de movimientos con recetas Remotion, paleta, composición |
| `contexto/sonido-y-musica.md` | Requisitos de música y licencia, SFX por evento, mezcla, formato de `beats.json` |
| `contexto/produccion-remotion.md` | Comandos, estructura de carpetas, sistema de beats, render y trampas conocidas |
| `contexto/checklist-calidad.md` | Lista que se pasa a CADA pieza antes de publicar |
| `contexto/analitica-y-publicacion.md` | Qué medir, reglas de decisión, rutina semanal, horarios |
| `contexto/*.csv` | Plantillas: `seguimiento-publicaciones`, `demos-recibidas`, `licencias-musica` |
| `referencia-estilo/` | Vídeo de referencia (`promo-pasacalles.mp4`), fotogramas a 1 fps y hoja de contacto |
| `referencia-app/` | **Capturas reales de la app** (108 PNG) + `LEEME-como-funciona-turnigo.md` + tokens de diseño + scripts para regenerarlas |
| `demo-datos/` | Copias de los SQL de las demos (psicólogo, restaurante) y qué cuenta es cada una |
| `video/` | Proyecto Remotion (`npm run dev`, `npm run beats`, `npm run sfx`). Ver `video/README.md` |

Antes de dibujar cualquier pantalla de Turnigo en un vídeo, mira `referencia-app/capturas/` y lee
`referencia-app/LEEME-como-funciona-turnigo.md`. No inventes pantallas.

## Decisiones cerradas (no volver a preguntar)

- **Sin voz.** Estilo de la referencia (`Promo Pasacalles.mp4`): rápido, fluido, animado, solo
  música y efectos. Todo el mensaje va en texto en pantalla.
- **CTA único:** **Comenta "DEMO" y te lo enseño.** En la EndCard de todas las piezas (en
  carruseles, en la última diapositiva), y comentario fijado en cada vídeo: "Comenta DEMO y te
  enseño cómo quedaría en tu negocio 👇". A quien comente se le responde por DM con una demo real
  de su tipo de negocio.
- **P01 se rehace sin voz** (el vídeo 1 existente con locución queda como archivo).
- **Cadencia:** 2-3 piezas al día del 7 al 31 de octubre (≥ 50; el calendario tiene 60).
- **Cada corte cae en un golpe de la canción** (ver "Ritmo").

## Formato

- **Vídeo:** 1080×1920, 30 fps, 12-22 s (texto cinético 10-14 s).
- **Carrusel:** 5 diapositivas 1080×1920, PNG (`renderStill`), última = CTA; con la misma música.
- **Zona segura:** nada importante en los 150 px superiores ni en los 380 px inferiores.
- **Texto:** máx. 6 palabras por pantalla, 2 líneas, la 2.ª en color de acento, legible en ≤ 1,5 s.
- **Primer segundo:** el problema o el resultado, nunca el logo. El logo solo en el cierre.
- **Estructura de referencia (S40):** gancho `4` · caos con stickers `8` · giro "Hay otra forma."
  `2` (en el kick) · 3 funciones `3×6` · resultado `2` · EndCard `6`. Fondo oscuro = caos, fondo claro
  = solución.
- **Paleta/marca:** `referencia-app/diseno/` (teal `#0B6E6A`, coral `#FF6B4A`, Nunito, esquinas 12/20 px).
  Estados: verde confirmada/libre · ámbar pendiente · azul sentada · rojo cancelada/no-show.

## Ritmo: un corte por golpe

Todo se escribe en **beats, no en segundos**; con la canción elegida se genera `beats.json`.

| Evento | Cae en | Efecto |
|---|---|---|
| Cambio de escena | beat 1 del compás | corte seco + `whoosh` o wipe de 4 frames |
| Entrada de cada elemento | cada beat | pop con rebote (spring) |
| Énfasis (número final, sello, "Hay otra forma.") | kick más fuerte | zoom +6 % + shake 3 frames + `thud` |
| Cuentas numéricas | rampa que acaba en un beat | `tick` por beat |
| EndCard | último compás | logo con pop; CTA en el último beat |

Duraciones: S24 = 24 beats (12 s a 120 BPM), S32 = 16 s, S40 = 20 s. Elegir canciones de **110-130 BPM**.

### Elegir la canción — **ANTES de producir** (paso pendiente)
Requisitos: instrumental, batería marcada con kick nítido, 110-130 BPM, estructura clara (intro de 1
compás, bucle de 8, subida a los ~8 s), tono alegre/limpio, **licencia comercial** guardada.
La cuenta de TikTok es de empresa: solo vale la *Commercial Music Library*, y como la música va
dentro del vídeo renderizado hay que usar pistas con licencia (Pixabay Music, YouTube Audio
Library, Uppbeat…). Descargar solo las que digan expresamente "uso comercial"; **guardar el enlace
y la licencia** junto al archivo. Evitar pistas con Content ID. Tener 2-3 pistas en rotación.

Proceso:
1. El usuario deja 3-5 candidatas en `video/public/music/` (o pasa enlaces; el asistente no
   descarga sin pedir permiso explícito, indicando archivo, origen y tamaño).
2. `cd video && npm run beats -- public/music` → BPM, golpes, compases y puntuación de aptitud
   (0-100); escribe `video/src/music/<nombre>.beats.json`. Asume tempo constante; una regularidad
   baja delata deriva. Revisar a oído si el resultado sorprende.
3. Elegir la mejor y montar **P04 (plano de sala en vivo) como vídeo de prueba** con cortes sobre
   los golpes; ajustar.
4. Solo entonces producir el resto.

## Plantillas Remotion

T1 caos→solución · T2 VS pantalla partida · T3 la cuenta · T4 texto cinético/POV · T5 tour de
toques · T6 lista numerada · T7 antes→después · T9 chat · T10 cronómetro · C carrusel.
Cada pieza = un fichero de datos (`script.ts` en beats), **no un componente nuevo**.
**Orden de construcción:** T4 (cubre ~10 piezas) → T1 → T5 → T2 → T3/T6/T7/T9/T10 → C. Faltan por
crear: `Sticker`, `Strike` (tachón), `Counter`, `Kanban`, `CalendarWeek`, `DocSheet`, `Stopwatch` y
el hook `useBeats()` (lee `beats.json`). Los componentes existentes están en
`video/src/components/` (`PhoneFrame`, `FloorPlan`, `Notification`, `OnScreenText`, `EndCard`,
`Burst`, `Camera`…). Usar las skills de Remotion (`remotion-best-practices`) al construir.

## Reglas de contenido (obligatorias)

- **Datos 100 % ficticios.** Nunca clientes reales (Ana Sánchez, La Taberna del Herrero) ni
  *Mímate* por su nombre (es la demo de un cliente potencial). Nombres inventados: Marta, Lola,
  Sr. Pérez, "Bar La Esquina", "Estudio Nerea".
- **Sin precios** de Turnigo y **sin porcentajes** de mejora: "ayuda a reducir", nunca "reduce un 40 %".
- Cifras de "la cuenta" siempre con **(ejemplo)** en pantalla.
- **No mostrar** (no operativo o no verificado): Informe de IA de psicólogos, Google Calendar,
  horario desde Google Business Profile, cobros/prepago Stripe, asesorías, agencia.
- Facturas = "documento informativo", nunca "factura legal" ni "Verifactu".
- **No mostrar la pestaña Recibo ni el PDF del psicólogo**: usa los datos fiscales fijos de Ana Sánchez
  (real) hasta que la app lo generalice. Usar la pestaña Pagos en su lugar.
- Sin logos reales de Google, WhatsApp ni Instagram: burbujas y fichas de reseñas genéricas.
- Psicólogos: paciente ficticio, sin diagnósticos.
- Si una pantalla de la app se imita, que se parezca a la real: **el plano de sala real es una
  cuadrícula de tarjetas por zona (Interior/Barra/Terraza) con botón "Sentar clientes"**, no un
  dibujo en planta con mesas redondas. Si el vídeo dibuja mesas redondas es licencia creativa y
  se hace a propósito.
- **El panel no avisa al negocio de una reserva nueva** (no hay notificación ni banner de "Nueva reserva"):
  las reservas se enseñan apareciendo en la Agenda o pintando la tarjeta del plano. Estados reales del plano
  (`PlanoSala.tsx`): Libre blanco · Reservada celeste · Debería llegar azul · **Sentada verde** · Retrasada rojo ·
  A punto de terminar ámbar; botones "Sentar", "No-show", "Liberar mesa", "Sentar clientes"; un walk-in sin nombre sale como "Walk-in".
- Las capturas del panel muestran el email de la cuenta demo en la barra lateral
  (`staff@restaurante.test`, `mimate@estetica.com`): **recortarlo o taparlo**.
- La semana de la demo de citas sale muy densa (800 reservas de demo): en un vídeo, reconstruir una
  versión limpia con pocos bloques de color; la vista Día (móvil) es la más legible.

## Publicación

- **Horarios (hipótesis a validar con la analítica de la 1.ª semana):** hostelería 15:30 y 00:00;
  autónomos y consultas 08:30 y 21:30. Con 2 piezas/día: 15:30 + 21:30; con 3: + 09:00.
- **Hashtags base:** #turnigo #negociolocal #reservasonline #emprendedores #digitalizacion + 3 del
  nicho (#hosteleria #restaurantes · #peluqueria #esteticaavanzada · #psicologia #psicologos ·
  #autonomos #fontanero).
- **A/B:** repetir 5-6 ideas con otro gancho en los 3 primeros segundos (P46, P47, P55, P56, P57 ya
  están planteadas así) y comparar retención a los 3 s antes de producir más.
- Fechas con gancho: puente del Pilar (vie 9-lun 12), Día de la Salud Mental (sáb 10), cambio de hora
  (dom 25), Halloween (sáb 31).
- Con la analítica de la semana 1-2, **reajustar el calendario** (más de lo que retiene, menos de
  lo que no). P60 (noviembre) se rellena el 31 con lo que haya funcionado.

## Referencias visuales de la app (`referencia-app/`)

108 capturas de producción (6-oct-2026): widget restaurante y citas, panel restaurante y psicólogo (escritorio,
móvil, oscuro), panel citas (+ filtro por profesional), índice en `capturas/INDICE.md`.
**Psicólogo ya capturado** (negocio demo ficticio *Consulta Clara Montes*, slug
`consulta-demo-psicologia`, usuario `psicologa@psicologo.test`; scripts en la app:
`demo-datos/psicologo_demo_seed.sql` y `refresh_psicologo_demo.sql`; copia de los de la app en `supabase/demo/`). Para recapturar
Seguimiento hay que re-ejecutar el refresh justo antes (la cita "en curso" dura ~50 min) = escritura
en producción: **pedir confirmación**. Usar `HEADLESS=1 npm run panel -- psicologo` con la sesión ya
iniciada (una ventana de Chrome tapada hace que las capturas den timeout).
**Faltan** autónomo (Pipeline, Presupuestos, Facturas) y el plano de sala con gente
sentada/no-show/lista de espera: no hay datos demo ficticios de eso. Crearlos = **cambio en la BD de
producción: pedir confirmación**, y nunca capturar el negocio real de Ana ni el `turnigo` de autónomo.

Regenerar (requiere Chrome): ver `referencia-app/LEEME-como-funciona-turnigo.md` §7
(`npm run widget`, `npm run panel -- <tipo>`, `npm run indice`). Los scripts solo leen.

## Cómo trabajar con el usuario

- **Iniciar sesión en el panel de la app lo hace el usuario**, en la ventana de Chrome que abre el
  script; el asistente **no teclea contraseñas** nunca (restricción fija). Credenciales de las demo
  en la memoria local del asistente, jamás en archivos de este proyecto.
- Pide tandas de varios cambios con commits por tanda. Si pide "otra forma de hacer X", dar
  opciones en el chat antes de tocar nada.
- **Pedir confirmación antes de:** `git push`, cualquier cambio en la BD o en la app, descargar
  archivos (música), publicar contenido.
- Suele probar lo entregado y pedir un ajuste fino: es la misma feature, mismo flujo.
- Los vídeos deben **verse en el reproductor de Remotion Studio y renderizarse** antes de darlos por
  buenos (`npx remotion render <Id> out/<archivo>.mp4`); revisar fotogramas clave, no solo el código.
- No subir al repo `node_modules`, perfiles de sesión ni renders pesados (`video/out/`).

## Pendientes (en orden)

0. **P01 montado (6-oct, sin commitear)** con una pista provisional sintética de 120 BPM: `video/out/p01-reservo-y-no-vino.mp4` (20 s, -17 LUFS, pico -0,8 dBFS). Falta revisión del usuario y decidir canción real.
1. **Elegir la canción** (el usuario deja candidatas en `video/public/music/`) → `npm run beats`.
2. Montar **P04** como prueba de cortes sobre golpes y ajustar el sistema de beats.
3. Construir `useBeats()` y las plantillas por orden (T4 → T1 → T5 → T2 → resto → carrusel).
4. Rehacer **P01** sin voz con el nuevo sistema.
5. ~~Demo de psicólogo~~ hecha (6-oct). Decidir si se crea un **negocio demo de autónomo** y datos
   demo de plano de sala con gente (necesita confirmación del usuario; afecta a producción).
   Además, **la app tiene datos fiscales de Ana Sánchez fijos** en la pestaña Recibo del psicólogo
   (`apps/dashboard/src/business/ficha/ReciboTab.tsx` y `ReciboPdf.ts`): hasta generalizarlo no se
   muestra en vídeos.
6. Decidir si los vídeos imitan el plano de sala en tarjetas tal cual o con licencia creativa.
7. Producir siguiendo `calendario-tiktok-oct-2026.md` desde el 7 de octubre y reajustarlo con la
   analítica.
