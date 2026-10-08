# Turnigo — 10 guiones de TikTok (motion graphics con Remotion)

Pensados para generarse 100 % por código: nada de grabaciones de pantalla, todo son componentes
React animados. Cada guion lleva escenas con tiempos, qué se ve, texto en pantalla y locución.

## Ajustes comunes

- **Formato:** 1080×1920 (9:16), 30 fps. Zona segura: deja libres 150 px arriba y 380 px abajo
  (la interfaz de TikTok tapa el pie con usuario y descripción).
- **Duración:** 15-25 s. Un vídeo = un problema = una función.
- **Locución:** voz sintética en español de España (ElevenLabs, OpenAI TTS o similar), ritmo rápido,
  tono cercano de "colega que sabe". Genera el audio primero y ajusta las escenas a su duración real.
- **Subtítulos:** palabra a palabra, grandes, con la palabra activa resaltada
  (skill `remotion-captions`). Es obligatorio: mucha gente ve TikTok sin sonido.
- **Música:** pista corta y rítmica sin letra, volumen bajo (~12 %) con ducking bajo la voz.
- **Primer segundo:** el problema o el resultado, nunca el logo. El logo solo en el cierre.
- **CTA final (elige uno y úsalo en los 10):** `[CTA]` = "Prueba gratis, enlace en bio" o
  "Comenta DEMO y te la enseño". Define antes qué ofreces (¿prueba gratis? ¿precio?).
  Los precios no aparecen en los guiones: no los inventes en pantalla.
- **Datos:** todos los nombres, clientes y cifras de los vídeos son ficticios. Nunca uses datos de
  clientes reales (Ana Sánchez, La Taberna del Herrero).

### Kit de componentes Remotion a construir una vez

| Componente | Para qué |
|---|---|
| `PhoneFrame` | Marco de móvil donde se anima casi todo |
| `WhatsAppBubble` / `WhatsAppChat` | Mensajes que entran con "pop" y doble check azul |
| `FloorPlan` | Plano de sala: 8-10 mesas redondas/cuadradas que cambian de color |
| `CalendarDay` / `CalendarWeek` | Agenda con bloques de colores que aparecen |
| `Kanban` | 4 columnas con tarjetas arrastrables (animadas por `interpolate`) |
| `DocSheet` | Hoja de presupuesto/factura con líneas que se escriben |
| `Counter` | Número que sube con easing (euros, reservas) |
| `TapRipple` | Círculo de "toque" sobre el móvil |
| `Notification` | Banner de notificación que cae desde arriba |
| `Caption` | Subtítulos palabra a palabra |
| `EndCard` | Logo + `[CTA]` + enlace en bio, 2 s |

**Paleta:** usa el color de marca de Turnigo y define 4 colores de estado reutilizables:
verde (confirmada/libre), ámbar (pendiente), azul (sentada/en curso), rojo (cancelada/no-show).
Fondo oscuro con tarjetas claras da más contraste en TikTok.

---

## 1. "Tu mesa vacía te cuesta dinero" — recordatorio por WhatsApp

**Público:** restaurantes y bares · **Duración:** 20 s · **Función:** recordatorio WhatsApp 24 h antes

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-2 s | Plano de sala con una mesa que parpadea en rojo; suena un "ding" seco | **"Reservó… y no vino."** | "Reservó para cuatro. Y no vino." |
| 2-5 s | Reloj de pared que pasa de 21:00 a 22:00 con la mesa vacía | "Mesa vacía. Cena perdida." | "Mesa vacía toda la noche. Cena perdida." |
| 5-9 s | Móvil entra desde abajo. Burbuja de WhatsApp: *"Hola Marta, te recordamos tu reserva en La Plaza mañana, 21:00."* Doble check azul | "24 h antes. Automático." | "Con Turnigo, el cliente recibe un WhatsApp el día antes. Solo." |
| 9-13 s | La burbuja del cliente responde "Ahí estaremos 👍"; la mesa pasa de ámbar a verde | "Cliente avisado ✓" | "Se acuerda, confirma o cancela a tiempo." |
| 13-17 s | Mesa libre que se ofrece de nuevo: aparece una nueva reserva entrando | "Y si cancela, tu mesa vuelve a venderse." | "Y si cancela, tu mesa vuelve a estar libre para otro." |
| 17-20 s | `EndCard` | **Turnigo** · `[CTA]` | "Menos mesas vacías sin llamar a nadie. `[CTA]`" |

**Nota legal/precisión:** di "ayuda a reducir", nunca prometas un porcentaje de no-shows.

---

## 2. "El plano de tu sala, en vivo"

**Público:** restaurantes · **Duración:** 22 s · **Función:** plano de sala en tiempo real, sentar, walk-ins

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-2 s | Vista aérea de un plano con 10 mesas, todas grises; zoom rápido | **"Así se ve un viernes noche."** | "Así se ve tu sala un viernes por la noche." |
| 2-6 s | Notificaciones de reserva caen una a una; cada mesa se pinta de verde al asignarse. Contador "Reservas: 12" subiendo | "Reservas entrando solas" | "Las reservas entran solas desde tu web y cada una busca su mesa." |
| 6-10 s | Una mesa pasa a azul con icono de comensales; texto "Sentados" | "Toque → sentados" | "Llegan, tocas una vez, y la mesa pasa a sentados." |
| 10-14 s | Aparece un grupo de pie "Walk-in 2 pers."; el sistema resalta una mesa libre con un brillo | "Sin reserva? También." | "¿Entran sin reserva? Les busca mesa en un segundo." |
| 14-18 s | Una mesa roja "No-show"; se libera y pasa a gris | "No vino → liberada" | "¿No vino? La liberas y vuelve a venderse." |
| 18-22 s | `EndCard` | `[CTA]` | "Todo tu servicio de un vistazo. `[CTA]`" |

---

## 3. "Reserva a las 3 de la mañana" — widget en tu web

**Público:** cualquier negocio con web · **Duración:** 20 s · **Función:** widget embebido con una línea de código

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Reloj digital "03:12 AM", luna, un móvil encendido en una cama a oscuras | **"03:12 AM"** | "Son las tres de la mañana. Tu negocio duerme. Tus clientes no." |
| 3-8 s | Móvil: web de un restaurante; el cliente elige día (solo días con hueco), hora y personas; botón "Reservar" | "Elige día · hora · personas" | "Entra en tu web, elige día y hora —solo ve los huecos libres— y reserva." |
| 8-12 s | Cae una notificación en otro móvil (del dueño): "Nueva reserva · Sáb 21:00 · 4 pers." | "Tú, dormido 😴" | "Y tú te enteras al despertar. Sin una sola llamada." |
| 12-17 s | Editor de código con una sola línea que se escribe: `<script src=".../embed.js">`; la web de la izquierda se llena de un widget | "1 línea de código" | "Se instala pegando una línea en tu web. Funciona en cualquier página." |
| 17-20 s | `EndCard` | `[CTA]` | "Reservas 24 horas, sin cobrar de más por llamadas. `[CTA]`" |

---

## 4. "Tu agenda, por colores" — peluquerías y centros de estética

**Público:** peluquerías, estética, uñas, fisios · **Duración:** 18 s · **Función:** agenda Día/Semana con color por profesional + filtro

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Cuaderno de papel tachado y emborronado, caos de tachones | **"Tu agenda de papel"** | "Esta es tu agenda de papel un sábado." |
| 3-5 s | Corte con "whoosh" a la agenda de Turnigo vacía | "Esta es la de Turnigo" | "Y esta es la de Turnigo." |
| 5-10 s | Vista semana: los bloques aparecen en cascada, un color por profesional (Lola rosa, Paula azul, Nerea verde) | "Una profesional = un color" | "Cada profesional con su color. Ves de un vistazo quién está libre." |
| 10-14 s | Pulsa "Paula" en la leyenda: el resto se atenúa y solo quedan sus citas | "Filtra con un toque" | "¿Quieres solo la agenda de Paula? Un toque." |
| 14-18 s | `EndCard` | `[CTA]` | "Agenda llena y ordenada. `[CTA]`" |

---

## 5. "Cancelan y el siguiente entra" — lista de espera

**Público:** restaurantes (y negocios con huecos llenos) · **Duración:** 18 s · **Función:** lista de espera con aviso por WhatsApp

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Cartel "COMPLETO" sobre el plano de sala; llega una pareja con cara decepcionada | **"Completo."** | "Sábado, completo. Y se te va una pareja." |
| 3-6 s | Con Turnigo: la pareja se apunta en lista de espera (lista animada "Pareja · 2 pers.") | "Lista de espera" | "Con Turnigo se apuntan en la lista de espera." |
| 6-10 s | Una reserva de la sala pasa a "cancelada"; la mesa se libera con un destello | "Cancelan…" | "Alguien cancela…" |
| 10-14 s | Móvil de la pareja: WhatsApp "Se ha liberado una mesa. ¿La quieres?"; botón de sentar en el panel | "…y avisa al siguiente" | "…y el siguiente recibe un WhatsApp. Mesa vendida." |
| 14-18 s | `EndCard` | `[CTA]` | "Ni una mesa libre de más. `[CTA]`" |

---

## 6. "Reseñas de Google sin pedirlas" — petición de reseña automática

**Público:** cualquier negocio local · **Duración:** 20 s · **Función:** petición de reseña 1-3 h tras la visita

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Dos fichas de Google lado a lado: "4,1 ★ (23 reseñas)" vs "4,8 ★ (310 reseñas)" | **"¿Por qué el de enfrente tiene más reseñas?"** | "¿Por qué el de enfrente tiene 300 reseñas y tú 23?" |
| 3-7 s | Texto sobre fondo: "No es porque sea mejor. Es porque se lo pide." | "Se lo pide." | "No es que sea mejor. Es que se lo pide a todo el mundo." |
| 7-12 s | Reloj de tarde; móvil con el cliente que acaba de salir; llega el mensaje: *"Gracias por venir, ¿nos dejas tu opinión?"* con enlace | "1-3 h tras la visita" | "Con Turnigo, unas horas después de la visita, el cliente recibe tu enlace de reseña. Automático." |
| 12-16 s | Las estrellas se llenan una a una y el contador "★ 4,1 → 4,6" sube | "Más reseñas. Cero esfuerzo." | "Tú no haces nada. Las reseñas se acumulan." |
| 16-20 s | `EndCard` | `[CTA]` | "Más reseñas, más clientes nuevos. `[CTA]`" |

**Nota:** las cifras de las fichas son un ejemplo visual ficticio. No uses el logo ni la interfaz
real de Google (marca registrada); haz una ficha de reseñas genérica.

---

## 7. "Del presupuesto a la factura en 30 segundos" — autónomos

**Público:** fontaneros, electricistas, reformas, mantenimiento · **Duración:** 25 s · **Función:** mini-CRM (pipeline, presupuesto, factura)

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Plantilla de Word con cursor parpadeando y formato roto; un pulgar sobre el móvil con 4 WhatsApps sin contestar | **"¿Presupuestos en Word?"** | "Eres autónomo y haces los presupuestos en Word. Para." |
| 3-8 s | `Kanban`: columnas "Nuevo · Visita · Presupuesto enviado · Aceptado". Aparece la tarjeta "Reforma baño — Sr. Pérez" | "Cada trabajo, en su sitio" | "Cada cliente es una tarjeta: nuevo, visita, presupuesto…" |
| 8-14 s | `DocSheet`: "Presupuesto P-2026-001"; se escriben líneas (Alicatado 480 €, Fontanería 320 €); abajo base + IVA + total se calculan solos | "IVA y total: automáticos" | "El presupuesto se hace en el móvil: líneas, IVA y total solos, con numeración correlativa." |
| 14-18 s | Estado "Aceptado" y la tarjeta salta sola a la columna "Aceptado" | "Se mueve solo" | "Cuando te lo aceptan, el trabajo cambia de columna solo." |
| 18-22 s | El presupuesto se convierte en "Factura F-2026-001", sello "PAGADA" | "Factura en un toque" | "Y la factura sale de ese presupuesto en un toque." |
| 22-25 s | `EndCard` | `[CTA]` | "Tu negocio, sin papeles. `[CTA]`" |

**Nota:** las facturas de Turnigo son documento informativo (no verifactu). En el vídeo no digas
"factura legal homologada"; di "factura".

---

## 8. "Tu libreta vs Turnigo" — comparativo

**Público:** general · **Duración:** 15 s · **Función:** visión global, formato de pantalla dividida

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-2 s | Pantalla partida: izquierda libreta tachada, derecha plano/agenda limpia | **"Libreta vs Turnigo"** | "Tu libreta… contra Turnigo." |
| 2-5 s | Izq: teléfono sonando con 5 llamadas perdidas · Dcha: reservas entrando solas | "Llamadas" vs "Reservas online" | "Llamadas perdidas. Contra reservas que entran solas." |
| 5-8 s | Izq: tachones y nombres repetidos · Dcha: agenda ordenada | "Tachones" vs "Orden" | "Tachones, contra todo en orden." |
| 8-11 s | Izq: cliente que no aparece · Dcha: WhatsApp de recordatorio | "Sorpresas" vs "Recordatorio" | "Clientes que no aparecen, contra clientes avisados." |
| 11-15 s | Izq se desvanece; la derecha ocupa toda la pantalla → `EndCard` | `[CTA]` | "Tú decides con cuál trabajas. `[CTA]`" |

---

## 9. "Tu consulta, sin papeles" — psicólogos

**Público:** psicólogos y terapeutas · **Duración:** 22 s · **Función:** seguimiento de cita en curso, notas de sesión, recibo PDF, pagos

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Montaña de carpetas y post-its con nombres de pacientes | **"¿Sabes dónde está la nota de la última sesión?"** | "¿Sabes dónde está la nota de la última sesión de tu paciente?" |
| 3-8 s | Panel: "Seguimiento" muestra la cita en curso y la siguiente; botón "Empezar cita" | "Cita en curso" | "Con Turnigo ves la cita en curso y la siguiente. Empiezas con un toque." |
| 8-13 s | Se abre el formulario de sesión; se rellenan Objetivo, Notas, Tareas/pautas; la sesión aparece arriba del historial | "Cada sesión, en su ficha" | "Escribes la sesión y queda en el historial del paciente: objetivo, notas y pautas." |
| 13-18 s | `DocSheet`: recibo en PDF generado al instante; luego pestaña "Pagos" con ✓ pagado | "Recibo + control de pagos" | "Recibo en PDF al momento, y sabes quién ha pagado y quién no." |
| 18-22 s | `EndCard` | `[CTA]` | "Más tiempo para tus pacientes. `[CTA]`" |

**Actualización 6-oct:** no mostrar el recibo/factura PDF (lleva datos fiscales fijos de Ana Sánchez); sustituir la escena de recibo por la pestaña Pagos.

**Importante:** usa un paciente 100 % ficticio, sin diagnósticos reales. No muestres el Informe de IA
(Gemini sigue dando 503/429 y no se ha visto una generación exitosa).

---

## 10. "¿Cuánto te cuesta no tener esto?" — la cuenta del no-show

**Público:** hostelería · **Duración:** 20 s · **Función:** gancho de números + todo el sistema en una frase

| Tiempo | Visual | Texto en pantalla | Locución |
|---|---|---|---|
| 0-3 s | Calculadora gigante; teclas que se pulsan | **"Haz la cuenta"** | "Haz la cuenta conmigo." |
| 3-8 s | `Counter` en cadena: "3 no-shows/noche × 25 € = 75 €" → "× 26 noches = 1.950 €" | "75 € → 1.950 €/mes" | "Tres mesas vacías por noche, a 25 euros cada una, son casi 2.000 euros al mes." |
| 8-10 s | El número final se tiñe de rojo y tiembla; texto "EJEMPLO" pequeño | "(ejemplo)" | "Dinero que no entra. Y ni lo ves." |
| 10-16 s | Pasa a tres iconos animados: WhatsApp recordatorio · lista de espera · reserva 24 h | "Recordatorio · Lista de espera · Reserva 24 h" | "Turnigo te manda el recordatorio, rellena huecos con lista de espera y recibe reservas a todas horas." |
| 16-20 s | `EndCard` | `[CTA]` | "Haz tu propia cuenta. `[CTA]`" |

**Importante:** deja claro que es un ejemplo ("(ejemplo)") y permite que cada espectador ponga sus
números. Es el mejor candidato para un comentario fijado: "Comenta cuántas mesas pierdes tú".

---

## Orden de publicación recomendado

1. **Semana 1:** #1 (no-shows), #2 (plano en vivo), #3 (3 AM). Son los de mayor gancho visual.
2. **Semana 2:** #5 (lista de espera), #6 (reseñas), #10 (la cuenta).
3. **Semana 3:** #4 (agenda por colores) y #8 (libreta vs Turnigo) para peluquerías y público general.
4. **Después:** #7 (autónomos) y #9 (psicólogos) si abres esos nichos; publícalos con hashtags
   específicos (#autonomos, #psicologia).

**Hashtags base:** #hosteleria #restaurantes #negociolocal #emprendedores #reservasonline
#peluqueria #autonomos #digitalizacion
**Pruebas:** publica la misma idea con 2 ganchos distintos y compara retención a los 3 s antes de
producir más.
