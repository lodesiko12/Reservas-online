# Turnigo — Calendario TikTok 7-31 octubre 2026 (60 piezas)

Estilo de referencia (`Promo Pasacalles.mp4`, analizado frame a frame): 9:16, 28 s, **sin voz**,
un titular serif grande por escena (la 2.ª línea en color de acento), un móvil que entra desde abajo
y hace una micro-acción (toque, QR, notificación), escena nueva cada ~4 s, fondo oscuro de "caos" al
principio → giro "Hay otra forma." → fondo claro y limpio. Todo es movimiento: stickers que caen con
rebote, tachones que se dibujan, confeti, números que suben. Aquí lo llevamos un paso más allá:
**cada corte cae en un golpe de la canción**.

---

## 1. Reglas comunes

### Formato
- **Vídeo:** 1080×1920, 30 fps, 12-22 s (los de "texto cinético" 10-14 s). Sin locución: todo el
  mensaje va en pantalla, así que cada pieza se entiende con el sonido apagado y con música.
- **Carrusel:** 5 diapositivas 1080×1920 (zona segura: 150 px arriba, 380 px abajo), exportadas
  como PNG desde Remotion (`renderStill`). Diapositiva 1 = gancho, última = CTA. TikTok permite
  música en carruseles: usa la misma pista que en los vídeos.
- **Zona segura de texto:** nada importante en los 380 px inferiores (descripción y botones de TikTok).
- **Primer segundo:** el problema o el resultado, nunca el logo. El logo solo en el cierre.
- **Subtítulos:** no hay locución, pero **todo texto en pantalla se lee en ≤ 1,5 s**: máximo 6 palabras
  por pantalla, 2 líneas, la 2.ª en color de acento.

### Ritmo: un corte por golpe de la canción (sistema de beats)
Con la canción elegida generamos un `beats.json` (instante de cada golpe, de cada compás y cuáles
son "kicks" fuertes). Todas las piezas se escriben **en beats, no en segundos**, así cualquier
canción las sirve:

| Evento | Cae en | Efecto |
|---|---|---|
| Cambio de escena | beat 1 de compás (downbeat) | corte seco + `whoosh` o wipe de 4 frames |
| Entrada de cada elemento (sticker, tarjeta, línea de texto) | cada beat | pop con rebote (spring) |
| Golpe de énfasis (número final, sello, "Hay otra forma.") | kick más fuerte del compás | zoom +6 % + shake 3 frames + `thud` |
| Cuenta numérica | rampa que termina exactamente en un beat | `tick` por beat |
| Cierre / EndCard | último compás | logo con pop, CTA aparece en el último beat |

Con ~120 BPM, 1 beat = 0,5 s = 15 frames; un compás (4 beats) = 2 s. Plantillas de duración:

| Plantilla | Beats | A 120 BPM | Uso |
|---|---|---|---|
| **S24** | 24 | 12 s | texto cinético / POV |
| **S32** | 32 | 16 s | vídeos de una función |
| **S40** | 40 | 20 s | "del caos a la solución" |

Estructura de **S40** (la del vídeo de referencia): `4` gancho · `8` caos (3-4 stickers, uno por 2
beats) · `2` giro "Hay otra forma." (kick) · `3×6` tres funciones (titular + móvil + acción) ·
`2` resultado · `6` EndCard. Si la canción es de 100 BPM la pieza dura 24 s; por eso conviene
elegir pistas de **110-130 BPM**.

### Plantillas Remotion (se construyen una vez, se reutilizan en las 60 piezas)
| Código | Plantilla | Qué es |
|---|---|---|
| **T1** | Del caos a la solución | Fondo oscuro con stickers de "problema" que caen y se tachan → "Hay otra forma." → móvil con 3 funciones (la del vídeo de referencia) |
| **T2** | VS pantalla partida | Izquierda papel/caos, derecha Turnigo; un par de escenas por 4 beats |
| **T3** | La cuenta | Contadores en cadena que terminan en un beat; número final rojo y tiembla; siempre "(ejemplo)" |
| **T4** | Texto cinético / POV | Solo tipografía y 1-2 iconos animados; una frase por beat |
| **T5** | Tour de toques | Un móvil en el centro, `TapRipple`, 3 pantallas del panel, titular arriba cambiando |
| **T6** | Lista numerada | "N cosas…": cada ítem entra en un beat con su número gigante |
| **T7** | Antes → después | Wipe vertical que revela la versión Turnigo sobre la de papel |
| **T9** | Chat | Burbujas (WhatsApp genérico) que entran una a una, doble check, respuesta |
| **T10** | Cronómetro | Reloj que corre mientras se completa un flujo; termina en el último beat |
| **C** | Carrusel | 5 diapositivas: gancho · 3 de contenido · cierre/CTA |

Componentes ya existentes en `marketing/video/src/components/` (`PhoneFrame`, `FloorPlan`,
`Notification`, `OnScreenText`, `EndCard`, `Burst`, `Camera`…) cubren casi todo; faltan
`Sticker`, `Strike` (tachón), `Counter`, `Kanban`, `CalendarWeek`, `DocSheet`, `Stopwatch` y el
sistema `useBeats()` (lee `beats.json`). Ver sección 5.

### Paleta
Fondo oscuro (caos) y claro cálido (solución) como en la referencia; 4 estados reutilizables:
verde confirmada/libre · ámbar pendiente · azul sentada/en curso · rojo cancelada/no-show.

### Lo que NO se enseña ni se dice (ya hay reglas en el proyecto)
- **Datos 100 % ficticios.** Nada de Ana Sánchez, La Taberna del Herrero ni Mimate. Nombres
  inventados (Marta, Lola, Sr. Pérez; "Bar La Esquina", "Estudio Nerea").
- **Sin precios** de Turnigo y **sin porcentajes** de mejora: di "ayuda a reducir", nunca "reduce un 40 %".
- Cifras de "la cuenta" siempre con **(ejemplo)** en pantalla.
- **No** se muestra el Informe de IA, Google Calendar ni el horario desde Google Business Profile
  (no están operativos de punta a punta). Tampoco asesorías ni agencia.
- Facturas = "documento informativo", nunca "factura legal / Verifactu".
- Nada de logos reales de Google, WhatsApp o Instagram: burbujas y fichas genéricas.
- Psicólogos: paciente ficticio, sin diagnósticos.
- **No mostrar la pestaña "Recibo" ni el PDF de factura del psicólogo:** hoy usa los datos fiscales fijos de
  Ana Sánchez (texto "en el formato de Ana Sánchez" en pantalla y datos reales en el PDF). Hasta que se
  generalice en la app, el control de pagos (pestaña Pagos) sustituye al recibo en los guiones.

### CTA y publicación
- **CTA único (decidido):** **Comenta "DEMO" y te lo enseño.** Va en la EndCard de todas las piezas
  (en carruseles, en la última diapositiva) y en el texto de la descripción. Comentario fijado en
  cada vídeo: "Comenta DEMO y te enseño cómo quedaría en tu negocio 👇". Responder a cada "DEMO"
  por mensaje directo con enlace a una demo real de su tipo de negocio.
  *(En EndCard se escribe corto: **Comenta "DEMO"** + subtítulo "y te lo enseño".)*
- **P01 se rehace sin voz** con el sistema de beats (el vídeo con voz ya existente queda como archivo).
- **Horarios sugeridos (hipótesis a validar con las analíticas de la 1.ª semana):** hostelería ve el
  móvil entre servicios → **15:30** y de madrugada tras cerrar → **00:00**; autónomos y consultas →
  **8:30** y **21:30**. Con 2 piezas/día: 15:30 + 21:30; con 3: + 09:00.
- **Música (cuenta de empresa):** TikTok solo permite la *Commercial Music Library* en cuentas
  business. Como la música va dentro del vídeo renderizado, usa pistas **con licencia comercial**
  (Pixabay Music, YouTube Audio Library, Uppbeat/Artlist con suscripción…) y guarda la licencia.
  Primero hay que elegirla: ver sección 5.
- **Hashtags base:** #turnigo #negociolocal #reservasonline #emprendedores #digitalizacion + 3 del
  nicho (#hosteleria #restaurantes · #peluqueria #esteticaavanzada · #psicologia #psicologos ·
  #autonomos #fontanero).
- **Prueba A/B:** repite 5-6 ideas con otro gancho en los 3 primeros segundos y compara retención.

---

## 2. Cuadro de semanas

| Semana | Fechas | Foco | Por qué |
|---|---|---|---|
| 1 | mié 7 - dom 11 | **Restaurantes** + presentación de marca + Día de la Salud Mental (sáb 10) | Es el nicho con más gancho visual y el que tiene demo; arrancamos con 3 piezas/día |
| 2 | lun 12 - dom 18 | **Citas** (peluquería, estética, fisio) + widget + reseñas | Amplía público; el festivo del 12 da gancho |
| 3 | lun 19 - dom 25 | **Psicólogos**, **autónomos**, funciones de restaurante en profundidad | Nichos específicos con hashtags propios |
| 4 | lun 26 - sáb 31 | **Halloween** ("pesadillas de la hostelería"), recopilatorios y cierre del mes | Evento con gancho estacional + resumen para quien llega nuevo |

Fechas con gancho: **vie 9/sáb 10-lun 12** puente del Pilar (hostelería llena) · **sáb 10** Día
Mundial de la Salud Mental · **dom 25** cambio de hora (se duerme 1 h más) · **sáb 31** Halloween.

---

## 3. Guiones — calendario día a día

Formato de cada pieza: **ID · formato/plantilla · nicho** → *función*. Después, gancho (texto en
pantalla en el primer beat) y secuencia con el nº de beats entre corchetes. `→` separa escenas.

### Semana 1 — Restaurantes y presentación

#### Mié 7 oct (3 piezas)

**P01 · Vídeo T1 S40 · restaurantes** → recordatorio WhatsApp 24 h *(adaptación sin voz del vídeo 1 ya hecho)*
- Gancho: **"Reservó… y no vino."**
- `[4]` plano de sala, una mesa parpadea en rojo + `thud` → `[8]` stickers que caen: "Llamadas perdidas",
  "Libreta tachada", "¿Quién era la mesa 6?" → `[2]` **"Hay otra forma."** → `[6]` WhatsApp: "Hola Marta,
  tu reserva es mañana 21:00" + doble check azul → `[6]` Marta responde "Ahí estaremos 👍", mesa ámbar→verde →
  `[6]` mesa libre se vuelve a vender (nueva reserva entra) → `[2]` "Ayuda a reducir las mesas vacías" →
  `[6]` EndCard Comenta "DEMO".

**P02 · Vídeo T10 S32 · general** → widget de reservas 24 h
- Gancho: **"03:12 AM"** (reloj digital, luna).
- `[4]` reloj 03:12 sobre cama a oscuras, móvil encendido → `[12]` móvil: web de restaurante → elige
  día (solo los que tienen hueco) → hora → 4 personas → "Reservar" (cronómetro corre, 1 acción por beat) →
  `[4]` en otro móvil cae notificación "Nueva reserva · sáb 21:00 · 4 pers." con "Tú, dormido 😴" →
  `[4]` "Reservas 24 h. Sin llamadas." → `[8]` EndCard.

**P03 · Carrusel C · restaurantes** → reservas online
- **Hecho (v1, `P03-SenalesReservas`)** como **"3 señales"** (el guion solo traía 3): portada "¿Tu restaurante necesita reservas online?"
- 2 "Apuntas reservas en una libreta" · 3 "Contestas llamadas en pleno servicio" · 4 "Cada semana se
  te cuela una mesa dos veces" · 5 "Hay otra forma" + CTA Comenta "DEMO".

#### Jue 8 oct (3 piezas)

**P04 · Vídeo T5 S32 · restaurantes** → plano de sala en vivo
- Gancho: **"Así se ve tu sala un viernes."** (zoom a plano gris con 10 mesas).
- **Hecho (v1, `P04-PlanoEnVivo`)** con las tarjetas reales del plano: `[4]` 9 mesas libres → `[8]` una mesa por beat
  pasa a *Reservada* (celeste) y el contador "Reservas hoy" sube → `[6]` DROP, la cámara entra en la Mesa 2 "Debería
  llegar" → toque en *Sentar* → verde → `[6]` Mesa 5 *Retrasada* (roja) → *No-show* → *Libre* → *Sentar clientes* → walk-in
  sentado → `[2]` **"Todo tu servicio de un vistazo."** → `[6]` EndCard. (Sin notificaciones: la app no las envía.)

**P05 · Vídeo T2 S32 · general** → libreta vs Turnigo
- Gancho: **"Libreta VS Turnigo"** (pantalla partida).
- `[4]` título → `[8]` izq. teléfono con 5 llamadas perdidas / dcha. 5 reservas entran solas →
  `[8]` izq. tachones y nombre repetido / dcha. agenda ordenada → `[6]` izq. cliente que no aparece /
  dcha. WhatsApp de recordatorio → `[2]` la izquierda se desvanece → `[4]` EndCard.

**P06 · Carrusel C · general** → qué es Turnigo
- Título: **"¿Qué es Turnigo? En 5 diapositivas"**
- 2 "Reservas online en tu web (widget)" · 3 "Agenda o plano de sala en vivo" · 4 "Recordatorio por
  WhatsApp y reseñas automáticas" · 5 "Para restaurantes, citas, consultas y autónomos → Comenta "DEMO"".

#### Vie 9 oct (3 piezas) — víspera del puente

**P07 · Vídeo T4 S24 · restaurantes** → aforo en puente
- **Hecho (v1, `P07-PuenteDelPilar`)**: días 9-12 con el lunes festivo · 12 mesas pasan a *Reservada* · contador 148 "(ejemplo)" · drop: 3 mesas "No vino" en rojo · fondo claro con recordatorio de WhatsApp "24 h antes · automático".
- Gancho: **"Puente del Pilar."**
- `[4]` "Puente del Pilar." → `[4]` "Sala llena." (mesas se pintan) → `[4]` "Reservas hasta arriba." (contador sube) →
  `[4]` "¿Y los que no aparecen?" (3 mesas se ponen rojas y tiemblan) → `[4]` "Que no te pille sin
  recordatorios." → `[4]` EndCard.

**P08 · Vídeo T9 S32 · restaurantes** → lista de espera
- Gancho: **"Sábado. Completo."** (cartel COMPLETO).
- `[4]` cartel + pareja se va → `[6]` Con Turnigo: se apuntan a lista de espera "Pareja · 2 pers." →
  `[6]` una reserva se cancela, mesa se libera con destello → `[8]` WhatsApp: "Se ha liberado una mesa.
  ¿La quieres?" → `[2]` botón Sentar → `[6]` EndCard "Ni una mesa libre de más".

**P09 · Carrusel C · restaurantes** → checklist de puente
- **Hecho (v1, `P09-ChecklistPuente`)** como **3 cosas** ("tope online" = campo *Stock online* de la franja, misma pantalla): franjas y aforo · recordatorio 24 h · lista de espera · cierre "Puente sin sorpresas." + CTA.
- Título: **"Antes del puente: 5 cosas que revisar en tu restaurante"**
- 2 "Franjas y aforo al día" · 3 "Tope de reservas online" · 4 "Recordatorio activado" · 5 "Lista de
  espera lista para los 'completo' → Comenta "DEMO"".

#### Sáb 10 oct (3 piezas) — Día Mundial de la Salud Mental

**P10 · Vídeo T4 S24 · psicólogos**
- **Hecho (v1, `P10-CuidasLaMente`)**: corazón que late en cada beat + chip «10 oct · Salud mental» · notas de caos que caen y se tachan · drop (beat 12): panel *Seguimiento* → toque en *Empezar cita* → formulario «Sesión · Marta» que se rellena → *Guardar sesión* → aparece en el *Historial* · EndCard con «Más tiempo para tus pacientes.» (el beat «Más tiempo…» pasó a ser el tagline de la EndCard).
- Gancho: **"Cuidas la mente de los demás."**
- `[4]` frase → `[4]` "¿Quién cuida tu agenda?" → `[4]` panel Seguimiento: cita en curso + siguiente →
  `[4]` sesión guardada en el historial → `[4]` "Más tiempo para tus pacientes." → `[4]` EndCard.

**P11 · Vídeo T5 S32 · restaurantes** → walk-ins
- **Hecho (v1, `P11-EntranSinReserva`)**, **adaptado a la app real**: el plano NO ilumina ninguna mesa; el equipo toca *Sentar clientes* en una mesa libre → modal «Sentar clientes · Mesa 3» → un toque en el nº de comensales (1-12) y quedan sentados («Walk-in»). Las mesas con reserva solo ofrecen *Sentar / No-show* (el walk-in no se les asigna). El escudo sobre la Mesa 6 es anotación del vídeo, no un estado de la app.
- Gancho: **"Entran 2 sin reserva."**
- `[4]` grupo de pie "Walk-in 2 pers." → `[8]` el sistema ilumina una mesa libre → `[6]` toque → sentados
  → `[6]` mesa de 6 ya reservada se queda protegida → `[2]` "Sin reserva también." → `[6]` EndCard.

**P12 · Carrusel C · psicólogos** → consulta sin papeles
- **Hecho (v1, `P12-ConsultaSinPapeles`)**: portada con pila de papeles · Seguimiento · Historial (objetivo/notas/seguimiento/pautas) · Pagos (pendientes, pacientes, total; «Datos de ejemplo») · cierre con *Pagada* → diálogo real «¿Cómo se ha pagado?» (Bizum / Efectivo, obligatorio) + CTA. Sin Recibo ni Informe de IA.
- Título: **"Tu consulta, sin papeles"**
- 2 "Seguimiento: cita en curso y siguiente" · 3 "Historial por sesión: objetivo, notas, pautas" ·
  4 "Pagos: quién te debe sesiones y cuánto" · 5 "Marcar pagada en un toque → Comenta "DEMO"".

#### Dom 11 oct (2 piezas)

**P13 · Vídeo T3 S32 · restaurantes** → la cuenta del no-show
- **Hecho (v1, `P13-HazLaCuenta`)**: calculadora con teclas que se pulsan al ritmo · 3 × 25 € = 75 € · × 26 noches · el total sube y **aterriza en el drop (beat 12)** como «1.950 € /mes (ejemplo)» rojo · fondo claro: 3 ayudas (recordatorio 24 h, lista de espera, reserva online) · «Haz tu propia cuenta» con huecos · EndCard con la variante de CTA «Comenta cuántas mesas pierdes».
- Gancho: **"Haz la cuenta."**
- `[4]` calculadora gigante → `[12]` "3 no-shows/noche × 25 € = 75 €" → "× 26 noches" → número sube y cae en el
  kick: **"1.950 €/mes"** → `[4]` número rojo tiembla, "(ejemplo)" → `[8]` tres iconos: WhatsApp · lista de
  espera · reserva 24 h → `[4]` "Haz tu propia cuenta. Comenta cuántas mesas pierdes."

**P14 · Vídeo T6 S32 · restaurantes** → errores con la libreta
- **Hecho (v1, `P14-ErroresLibreta`)**: 38 beats (19 s) con la pista provisional de drop en el 28 (`TRACK_DROP28`). Título con un «3» enorme · 3 bloques de 8 beats sobre una libreta (Mesa doble con círculo rojo · Cliente sin avisar con reloj de 21:30 a 22:15 y sello · Comensales que cambian y acaban en «?») · giro claro con la agenda ordenada («Una agenda que no tacha.») · EndCard.
- Gancho: **"3 errores de quien reserva en libreta"**
- `[4]` título → `[8]` ❶ "Mesa doble" (mesa con dos nombres) → `[8]` ❷ "Cliente sin avisar" → `[8]` ❸
  "Nadie sabe cuántos son" → `[4]` "Todo se evita con una agenda que no tacha" → EndCard.

---

### Semana 2 — Citas, widget y reseñas

#### Lun 12 oct (2 piezas) — Fiesta Nacional

**P15 · Vídeo T5 S32 · general** → bloqueos
- **Hecho (v1, `P15-FestivoBloqueos`, `video/out/p15-festivo-bloqueos.mp4`)**, **adaptado a la app real**: no existe «Cierre puntual»; el flujo real es *+ Nuevo bloqueo* → Alcance *Todo el negocio* → Desde/Hasta → Motivo «Festivo» → *Crear bloqueo* → «🚫 Bloqueo creado.» y la fila «12 oct, 00:00 → 12 oct, 23:59 · Todo el negocio · Festivo». En el widget de citas el lunes 12 sale de la tira de días en el kick (un día sin huecos no se ofrece) y el cliente reserva el martes · resultado: la hoja del 12 vuelve con sello «BLOQUEADO» · EndCard «Festivos sin sorpresas.» Pista con drop en el beat 4.
- Gancho: **"Festivo. Hoy cierras."**
- `[4]` calendario con el 12 en rojo → `[8]` en Bloqueos: eliges día, "Cierre puntual", guardar →
  `[8]` el widget del cliente: ese día ya no aparece → `[4]` "Cierras en paz." → `[8]` EndCard.

**P16 · Vídeo T2 S32 · citas** → agenda de papel vs por colores
- **Hecho (v1, `P16-AgendaPorColores`, `video/out/p16-agenda-por-colores.mp4`)**: libreta garabateada (tachón y círculo rojo) · drop (beat 4): pantalla partida PAPEL VS TURNIGO · la Semana (JUE 15-SÁB 17) se llena en cascada, un profesional por beat, con la paleta real (Lola #ec4899, Paula #3b82f6, Nerea #22c55e) · zoom al sábado · toque en «Paula»: **en la app las citas de las demás desaparecen (no se atenúan)**, los demás chips se apagan y sale «14 citas» · EndCard «Tu agenda, por colores.» Semana reconstruida con pocos bloques.
- Gancho: **"Tu agenda de papel un sábado."**
- `[4]` cuaderno emborronado → `[2]` whoosh → `[10]` agenda Semana vacía → bloques en cascada, un color por
  profesional (Lola rosa, Paula azul, Nerea verde) → `[8]` pulsa "Paula" en la leyenda, el resto se
  atenúa → `[8]` EndCard.

#### Mar 13 oct (2 piezas)

**P17 · Vídeo T5 S32 · citas** → filtro por profesional
- **Hecho (v1, `P17-FiltroProfesional`, `video/out/p17-filtro-profesional.mp4`)**, **adaptado a la app real**: la vista Día **no tiene columnas**; es una lista de filas teñidas por profesional (chip del profesional + «Confirmada»). Leyenda en grande en el gancho · móvil con la agenda del sábado 17 · el toque en «Paula» cae en el drop (beat 12, pista por defecto): las demás filas se pliegan y quedan sus 3 citas («3 citas») · «Un toque. Cada una, lo suyo.» · EndCard «Cada profesional, su agenda.»
- Gancho: **"¿Solo la agenda de Paula?"**
- `[4]` pregunta → `[8]` vista Día con 3 columnas de color → `[6]` toque en "Paula" → desaparecen las demás →
  `[6]` "Un toque." → `[8]` EndCard.

**P18 · Vídeo T9 S32 · citas** → recordatorio WhatsApp
- **Hecho (v1, `P18-RecordatorioWhatsApp`, `video/out/p18-recordatorio-whatsapp.mp4`)**, **adaptado a la app real**: el recordatorio sale solo ~24 h antes con la plantilla del negocio (cliente, negocio, fecha, hora), pero **la respuesta del cliente no cambia nada en Turnigo** → no se enseña «el hueco pasa a verde». Gancho con tres «Ausente» (texto real del no-show en citas) · chat con Clara (no Nerea: es el nombre del estudio y de una profesional) · «Lo envía Turnigo solo» · «¡Allí estaré! 👍» · «Cliente avisado.» · el sábado siguiente esos huecos salen «Completada»: «Ayuda a reducir los huecos vacíos.» · EndCard «Recordatorios que trabajan solos.»
- Gancho: **"Hoy, 3 huecos vacíos."**
- `[4]` agenda con 3 huecos grises → `[10]` WhatsApp automático: "Hola Nerea, mañana tienes cita a las 17:00"
  ✓✓ → `[8]` Nerea responde "Allí estaré", hueco pasa a verde → `[4]` "Cliente avisado." → `[6]` EndCard.

#### Mié 14 oct (3 piezas)

**P19 · Vídeo T2 S32 · citas** → reservar por DM vs reserva online
- Gancho: **"Reservar por DM: 14 mensajes."**
- `[4]` hilo de chat enorme se desplaza → `[8]` mensajes: "¿Tenéis hueco?" "¿A qué hora?" "¿Y el jueves?"… →
  `[2]` corte → `[10]` Turnigo: servicio → hora → nombre → listo (3 toques) → `[4]` "3 toques." → `[4]` EndCard.

**P20 · Vídeo T5 S32 · general** → widget en tu web
- Gancho: **"1 línea de código."**
- `[4]` editor oscuro, cursor → `[6]` se teclea `<script src=".../embed.js">` (1 carácter-bloque por beat) →
  `[8]` web de ejemplo a la izquierda se llena de widget → `[8]` clic en servicio → días con hueco →
  `[6]` EndCard.

**P21 · Carrusel C · general** → instalar el widget
- Título: **"Reservas online en tu web en 4 pasos"**
- 2 "Pega el código" · 3 "Elige tu color y tu logo" · 4 "Tus clientes ven solo los días con hueco" ·
  5 "Cancelan con su localizador → Comenta "DEMO"".

#### Jue 15 oct (2 piezas)

**P22 · Vídeo T3 S32 · local en general** → reseñas
- Gancho: **"¿Por qué el de enfrente tiene 300 reseñas?"**
- `[4]` dos fichas genéricas: "4,1 ★ (23)" vs "4,8 ★ (310)" → `[6]` "No es mejor. Se lo pide." →
  `[8]` móvil: llega "Gracias por venir, ¿nos dejas tu opinión?" → `[8]` estrellas se llenan, contador
  4,1→4,6 → `[6]` EndCard.

**P23 · Vídeo T6 S32 · general** → qué espera el cliente
- Gancho: **"4 cosas que tu cliente espera al reservar"**
- `[4]` título → `[6]` ❶ ver huecos reales → `[6]` ❷ confirmación al instante (email) → `[6]` ❸ recordatorio →
  `[6]` ❹ cancelar sin llamar → `[4]` "Turnigo hace las 4." → EndCard.

#### Vie 16 oct (2 piezas)

**P24 · Vídeo T4 S24 · general** → "Mi reserva"
- Gancho: **"Cancelar sin llamar."**
- `[4]` cliente con móvil mirando teléfono del negocio → `[4]` "Su localizador." (código `AB12`) →
  `[4]` pantalla "Mi reserva" → botón Cancelar → `[4]` hueco se libera en la agenda → `[8]` "Tú recuperas el
  hueco." + EndCard.

**P25 · Vídeo T1 S40 · autónomos** → presupuestos
- Gancho: **"¿Presupuestos en Word?"**
- `[4]` Word con formato roto → `[8]` stickers: "WhatsApps sin contestar", "¿Cuándo se lo envié?",
  "Sin numerar" → `[2]` **"Hay otra forma."** → `[6]` Kanban "Nuevo · Visita · Presupuesto · Aceptado" → `[6]`
  presupuesto P-2026-001: líneas, base, IVA y total solos → `[6]` aceptado → tarjeta salta de columna →
  `[2]` "Todo en su sitio." → `[6]` EndCard.

#### Sáb 17 oct (3 piezas)

**P26 · Vídeo T5 S32 · autónomos** → pipeline
- Gancho: **"Cada trabajo, una tarjeta."**
- `[4]` tarjeta "Reforma baño — Sr. Pérez" → `[8]` columnas, la tarjeta se arrastra de "Nuevo" a "Visita" →
  `[8]` otra a "Presupuesto enviado" → `[6]` "Aceptado" con confeti → `[6]` EndCard.

**P27 · Vídeo T7 S32 · autónomos** → del presupuesto a la factura
- Gancho: **"Presupuesto → factura."**
- `[4]` hoja de presupuesto → `[8]` líneas se escriben (Alicatado, Fontanería), total calculado →
  `[8]` wipe: la misma hoja se convierte en "Factura F-2026-001" → `[4]` sello PAGADA en el kick →
  `[8]` EndCard "Un toque. Sin Word."

**P28 · Carrusel C · autónomos**
- Título: **"Lo que hace Turnigo por un autónomo"**
- 2 "Pipeline de trabajos" · 3 "Agenda de visitas" · 4 "Presupuestos con IVA y numeración" · 5 "Facturas
  en un toque → Comenta "DEMO"".

#### Dom 18 oct (2 piezas)

**P29 · Vídeo T2 S32 · citas (fisios, estética)** → ausentes
- Gancho: **"El cliente que no vino."**
- `[4]` hueco vacío en agenda de papel → `[8]` ahí lo tachas y no sabes cuántas veces pasa → `[2]` corte →
  `[8]` en Turnigo marcas "Ausente": el bloque se atenúa; en la ficha ves el historial →
  `[4]` "Sabes quién falla." → `[6]` EndCard.

**P30 · Vídeo T4 S24 · citas** → recordatorio vs llamada
- Gancho: **"Llamar uno por uno."**
- `[4]` 20 teléfonos que suenan → `[4]` "A las 8 de la tarde." → `[4]` un WhatsApp automático sale solo →
  `[4]` ✓✓ ×20 → `[4]` "Mientras cenas." → `[4]` EndCard.

---

### Semana 3 — Psicólogos, autónomos y restaurante en profundidad

#### Lun 19 oct (2 piezas)

**P31 · Vídeo T5 S32 · psicólogos** → seguimiento
- Gancho: **"¿Qué toca ahora?"**
- `[4]` pregunta → `[8]` Seguimiento: cita en curso (paciente ficticio "C.M.") y la siguiente →
  `[8]` "Empezar cita" abre el formulario de sesión → `[6]` Objetivo, Notas, Pautas se escriben →
  `[6]` EndCard.

**P32 · Vídeo T5 S32 · psicólogos** → control de pagos *(sustituye al recibo PDF, ver nota en §1)*
- Gancho: **"¿Quién te debe sesiones?"**
- `[4]` pregunta → `[8]` Pagos: tarjetas "Sesiones pendientes · Pacientes · Total pendiente" (cifras ficticias, "(ejemplo)") →
  `[8]` toque en "Pagada": la fila desaparece y el total baja → `[6]` pestaña "Cobradas (30 días)" → `[6]` EndCard.

#### Mar 20 oct (2 piezas)

**P33 · Vídeo T1 S40 · psicólogos**
- Gancho: **"¿Dónde está la nota de la última sesión?"**
- `[4]` montaña de carpetas → `[8]` stickers: "Post-it con nombre", "Libreta A4", "Excel de pagos" →
  `[2]` **"Hay otra forma."** → `[6]` Historial de sesiones → `[6]` Seguimiento → `[6]` Pagos → `[2]` "Más
  tiempo para tus pacientes." → `[6]` EndCard.

**P34 · Vídeo T6 S32 · psicólogos**
- Gancho: **"4 cosas que ahorra una consulta sin papeles"**
- ❶ "Buscar la nota" ❷ "Recordar la próxima pauta" ❸ "Apuntar a mano quién ha pagado" ❹ "Preguntar quién pagó".

#### Mié 21 oct (3 piezas)

**P35 · Vídeo T5 S32 · restaurantes** → aforo y tope online
- Gancho: **"Tú decides cuántas reservas entran."**
- `[4]` → `[8]` franja "Cena 21:00-23:30", aforo 40 → `[8]` stock online: "12 plazas online" → `[6]` el widget
  muestra "Completo" aunque quedan mesas para ti → `[6]` EndCard.

**P36 · Vídeo T4 S24 · restaurantes** → mesas combinadas
- Gancho: **"Grupo de 12."**
- `[4]` grupo en la puerta → `[4]` mesas 4, 5 y 6 → `[4]` se unen con un movimiento → `[4]` "Combinación
  asignada" → `[8]` EndCard.

**P37 · Carrusel C · restaurantes** → configurar franjas
- Título: **"Configura tus franjas de servicio en 5 pasos"**
- 2 "Horario de comida y cena" · 3 "Aforo por franja" · 4 "Mesas y zonas" · 5 "Reglas online → Comenta "DEMO"".

#### Jue 22 oct (2 piezas)

**P38 · Vídeo T4 S24 · restaurantes** → mesa en un segundo
- Gancho: **"¿Mesa para 2?"**
- `[4]` pareja → `[4]` el sistema busca → `[4]` ilumina la mejor mesa → `[4]` toque → `[8]` "En un
  segundo." + EndCard.

**P39 · Vídeo T9 S32 · restaurantes** → confirmación manual
- Gancho: **"Tú decides quién entra."**
- `[4]` reservas pendientes en ámbar → `[10]` revisas y confirmas una a una (cada confirmación en beat) →
  `[8]` cada reserva pasa de ámbar a verde → `[4]` "Control total." → `[6]` EndCard.

#### Vie 23 oct (2 piezas)

**P40 · Vídeo T2 S32 · general** → clientes
- Gancho: **"Tu Excel de clientes."**
- `[4]` Excel con teléfonos duplicados → `[8]` importas el CSV → `[8]` ficha con historial y notas →
  `[6]` "Sin duplicados: se agrupan por teléfono." → `[6]` EndCard.

**P41 · Vídeo T3 S32 · general** → reportes
- Gancho: **"¿Cuántas reservas hiciste este mes?"**
- `[4]` pregunta → `[10]` contadores (ejemplo) sobre las estadísticas ficticias del mes → `[8]` próximas
  reservas → `[4]` "(ejemplo)" → `[6]` EndCard.

#### Sáb 24 oct (3 piezas)

**P42 · Carrusel C · general** → lo que ve tu cliente
- Título: **"Qué ve tu cliente cuando reserva"**
- 2 "Elige el servicio" · 3 "Solo ve días con huecos" · 4 "Confirmación por email" · 5 "Te lo cuenta tu
  agenda → Comenta "DEMO"".

**P43 · Vídeo T10 S32 · citas** → una reserva en 20 s
- Gancho: **"Una cita reservada en 20 segundos."**
- `[4]` cronómetro 0:00 → `[16]` el flujo completo (1 acción cada beat, cronómetro corre) → `[4]` para en
  0:20 → `[8]` EndCard.

**P44 · Vídeo T6 S32 · hostelería**
- Gancho: **"3 cosas que haces en servicio y no deberías"**
- ❶ "Coger el teléfono" ❷ "Anotar a mano" ❸ "Acordarte de quién viene"; cada una se tacha y es
  sustituida.

#### Dom 25 oct (2 piezas) — cambio de hora

**P45 · Vídeo T4 S24 · general**
- Gancho: **"Esta noche se duerme 1 hora más."**
- `[4]` reloj 03:00 → 02:00 → `[4]` "Tú, a dormir." → `[4]` "Tus reservas, a entrar solas." → `[4]` móvil
  con notificaciones → `[8]` EndCard.

**P46 · Vídeo T1 S40 · restaurantes** → sábado completo
- Gancho: **"Sábado. Completo."** (variante de P08 con otro gancho para A/B).
- Mismas escenas que P08 pero empezando por la lista de espera y cartel "Hay otra forma." en el beat 5.

---

### Semana 4 — Halloween y cierre del mes

#### Lun 26 oct (2 piezas)

**P47 · Vídeo T2 S32 · citas** → agenda de papel vs Turnigo (variante A/B de P16 con otro gancho)
- Gancho: **"Esto no es una agenda."** (cuaderno) → mismo desarrollo.

**P48 · Vídeo T4 S24 · restaurantes** → lo que cuesta una mesa vacía
- Gancho: **"Una mesa vacía."**
- `[4]` mesa vacía, reloj → `[4]` 21:00 → `[4]` 22:00 → `[4]` "Cena perdida." → `[8]` recordatorio
  automático + EndCard.

#### Mar 27 oct (2 piezas) — serie "Pesadillas de la hostelería"

**P49 · Vídeo T4 S24 · restaurantes** — *Pesadilla 1: la mesa fantasma*
- Gancho: **"Pesadilla 1: la mesa fantasma."**
- `[4]` título con niebla → `[4]` mesa vacía con vela → `[4]` silueta de reserva que no aparece →
  `[4]` WhatsApp recordatorio la "ahuyenta" (se disuelve) → `[8]` "Recordatorio = exorcismo." + EndCard.

**P50 · Carrusel C · restaurantes**
- Título: **"5 pesadillas de la hostelería (y su cura)"**
- 2 "La mesa fantasma → recordatorio" · 3 "El teléfono que no para → reserva 24 h" · 4 "La libreta
  embrujada → plano de sala" · 5 "El cliente que no avisa → lista de espera → Comenta "DEMO"".

#### Mié 28 oct (3 piezas)

**P51 · Vídeo T4 S24 · hostelería** — *Pesadilla 2: el teléfono que no para*
- Gancho: **"Pesadilla 2: el teléfono."**
- `[4]` teléfono vibra con 12 llamadas → `[4]` camarero sudando (icono) → `[4]` widget aparece →
  `[4]` las llamadas se vuelven reservas → `[8]` "Suena solo cuando importa." + EndCard.

**P52 · Vídeo T4 S24 · hostelería** — *Pesadilla 3: la libreta embrujada*
- Gancho: **"Pesadilla 3: la libreta."**
- `[4]` libreta con tachones → `[4]` nombres que se mueven → `[4]` plano de sala los ordena → `[4]` "Todo
  en su mesa." → `[8]` EndCard.

**P53 · Carrusel C · general** — recopilatorio
- Título: **"Todo lo que hace Turnigo (versión corta)"**
- 2 "Reservas 24 h" · 3 "Agenda o plano de sala" · 4 "WhatsApp + email + reseñas" · 5 "Clientes e informes → Comenta "DEMO"".

#### Jue 29 oct (2 piezas)

**P54 · Vídeo T6 S32 · general** → "5 cosas que hace Turnigo mientras duermes"
- Gancho: **"5 cosas que Turnigo hace mientras duermes."**
- ❶ Recibe reservas ❷ Manda recordatorios ❸ Pide reseñas ❹ Libera huecos ❺ Avisa a la lista de espera.

**P55 · Vídeo T2 S32 · psicólogos / consultas** → papel vs consulta digital (variante de P33)
- Gancho: **"Carpetas vs ficha."**

#### Vie 30 oct (2 piezas)

**P56 · Vídeo T3 S32 · hostelería** → la cuenta (variante de P13 con gancho "Comenta cuántas mesas pierdes")
- Gancho: **"Haz la cuenta. Yo te espero."**
- Igual que P13, pero el número final queda hueco `___ €/mes` y el CTA es "Comenta tu número".

**P57 · Carrusel C · restaurantes** — preparar el finde largo de Halloween/Todos los Santos
- Título: **"Finde de Todos los Santos: 5 cosas para tu restaurante"** (reutiliza P09 con otras fechas).

#### Sáb 31 oct (3 piezas) — Halloween

**P58 · Vídeo T1 S40 · restaurantes** — *Noche de Halloween*
- Gancho: **"Halloween. Sala llena."**
- `[4]` sala con calabazas, todas las mesas verdes → `[8]` stickers terroríficos: "No-show", "Mesa
  doble", "Llamada perdida" → `[2]` **"Hay otra forma."** → `[18]` tres funciones (recordatorio ·
  plano · lista de espera) → `[2]` "Que lo único que dé miedo sea la cuenta del bar." → `[6]` EndCard.

**P59 · Vídeo T4 S24 · general** — resumen del mes
- Gancho: **"En octubre te enseñé…"**
- Montaje relámpago de 6 fragmentos de las piezas anteriores (uno por beat) → `[8]` "¿Cuál te hace más
  falta? Comenta." + EndCard.

**P60 · Carrusel C · general** — "La semana que viene"
- Título: **"Noviembre: qué viene en Turnigo"**
- 2-4 temas de noviembre decididos con las analíticas (más vistos), 5 CTA. **Se rellena el 31** con lo
  que haya funcionado.

---

## 4. Resumen de la tanda

| | |
|---|---|
| Piezas | **60** (48 vídeos + 12 carruseles) |
| Días | 25 (7-31 oct) · 3 piezas los días 7, 8, 9, 10, 14, 17, 21, 24, 28 y 31 · 2 el resto |
| Variantes A/B | P46, P47, P55, P56, P57 reutilizan la plantilla de otra pieza con otro gancho |
| Plantillas a construir | T1, T2, T3, T4, T5, T6, T7, T9, T10, C (10) |

**Producción realista:** con 10 plantillas parametrizadas, cada pieza es solo un fichero de datos
(`script.ts` con textos + beats) y no un componente nuevo. Orden de construcción: **T4** (la más
barata, ya cubre 10 piezas) → **T1** → **T5** → **T2** → **T3/T6/T7/T9/T10** → **C**.

---

## 5. Elegir la canción (antes de producir)

Qué necesitamos de la pista:
- **110-130 BPM**, batería marcada (kick y caja nítidos: son los que dan los cortes).
- Instrumental, sin voz ni letra, **licencia comercial** y que no tenga Content ID (si tiene, el
  vídeo pierde alcance o se silencia).
- Estructura clara: intro de 1 compás, bucle repetitivo de 8 compases, "drop" o subida a los ~8 s
  (ahí cae "Hay otra forma.").
- Un **estilo coherente** con la marca (alegre/limpio, tipo "tech-pop" ligero), y 2-3 pistas
  distintas en rotación para no cansar al seguidor.

Cómo lo hacemos:
1. Tú eliges **3-5 candidatas** de una biblioteca con licencia (Pixabay Music, YouTube Audio
   Library, Uppbeat…) y las dejas en `marketing/video/public/music/` (o me pasas los enlaces).
2. Yo las analizo con un script (`npm run beats -- <archivo>`) que detecta BPM, golpes y compases
   y genera `beats.json`, y te enseño cuáles son más aptas (regularidad del pulso, claridad de los
   kicks, duración).
3. Con la elegida montamos un **vídeo de prueba (P04)** con cortes sobre los golpes, y lo ajustamos.
4. Solo entonces empezamos el resto.
