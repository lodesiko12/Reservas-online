# Producto: qué es Turnigo y qué puede (y no puede) enseñarse en un vídeo

Documento autónomo. Resume el producto tal y como estaba el **6-oct-2026**. Si algo no está aquí o en
`../referencia-app/`, **no lo inventes**: pregunta al usuario.

## 1. Qué es, en una frase
**Turnigo** es una app de **reservas online para negocios locales**: el cliente reserva desde la web
del negocio (sin cuenta ni contraseña) y el negocio lleva su agenda o su sala desde el móvil o el
ordenador. Marca: verde azulado `#0B6E6A` + coral `#FF6B4A`, tipografía Nunito.

Tres piezas:
| Pieza | Quién | Qué es | Dónde se ve |
|---|---|---|---|
| **Widget de reservas** | el cliente final | formulario por pasos que se pega en la web con **una línea de código** (o enlace suelto) | `referencia-app/capturas/widget/` |
| **Panel del negocio** | dueño y equipo | agenda, plano de sala, clientes, servicios, bloqueos, reportes, configuración | `referencia-app/capturas/panel/` |
| **Panel super-admin** | solo nosotros | alta de negocios y usuarios | **nunca en vídeos** |

## 2. Tipos de negocio
| Tipo | Ejemplos | Reserva del cliente | Pantallas propias |
|---|---|---|---|
| **Restaurante** | restaurantes, bares | mesa para N personas en una *franja* (comida/cena) | Plano de sala, Franjas y aforo, Mesas y zonas, lista de espera, walk-ins |
| **Citas** | peluquería, estética, fisio, clínica | un servicio con duración y (opcional) profesional | Servicios y profesionales, agenda con color por profesional |
| **Psicólogo** | consultas | como citas | Seguimiento, ficha con historial de sesiones, Pagos |
| **Autónomo** | fontanería, electricidad, reformas | **sin reserva online**: mini-CRM | Pipeline, Presupuestos, Facturas, agenda interna |

Existen también los tipos *asesoría* y *agencia* (una agrupación de comparsas): **fuera del alcance
de los vídeos** por ahora.

## 3. Funciones y cómo se ven

### Comunes (todos los tipos con reserva)
- **Widget:** el cliente elige, ve **solo los días con hueco**, rellena nombre, apellidos, teléfono, email y notas,
  y recibe un **localizador** (`AB-12CD…`). "¿Ya tienes una reserva? Consúltala aquí" → ver o **cancelar** sin llamar.
  Barra de progreso de 3 pasos. Colores y logo propios de cada negocio.
- **Agenda** en vistas **Día / Semana / Mes**; clic en una reserva para cambiar estado, reprogramar o reasignar.
  Etiquetas **web** / **manual** y estados *Confirmada, Pendiente, Sentada, Completada, Ausente, Cancelada*.
- **Nueva reserva manual** desde el panel (por teléfono o en persona).
- **Clientes:** lista, ficha con notas privadas e historial, alta manual, **importación CSV**; se agrupan por teléfono (sin duplicados).
- **Bloqueos:** cierres puntuales, vacaciones, por negocio o por profesional.
- **Reportes:** reservas hoy, comensales hoy, % reservas por web, ausentismo (30 días) y gráfico de próximos 7 días.
- **Modo claro y oscuro**, responsive (en móvil el menú es un cajón con hamburguesa).
- **Email de confirmación** al reservar (Resend), reenviable desde el panel; texto personalizable.

### Automatizaciones (sin pantalla propia: se animan como mensajes/notificaciones)
- **Recordatorio por WhatsApp 24 h antes** (plantilla aprobada por Meta con cliente, negocio, fecha, hora). *Requiere que el negocio tenga conectado su WhatsApp Business.*
- **Petición de reseña 1-3 h después de la visita, por email** (no por WhatsApp), con el enlace de reseña del negocio. *Solo si el negocio ha puesto su enlace.*
- **Lista de espera (restaurante):** el cliente se apunta; al liberarse una mesa el panel avisa por WhatsApp y el equipo pulsa "Sentar".

### Restaurante
- **Plano de sala en tiempo real:** **no es un dibujo en planta**: es una cuadrícula de **tarjetas de mesa por zona**
  (*Interior, Barra, Terraza*), cada una con nombre, capacidad ("2-4 pers."), próxima reserva y botón **"Sentar clientes"**.
  Una mesa con reserva retrasada se tiñe de rojo ("Retrasada") con **Sentar / No-show**. Debajo, **Lista de espera**.
- **Walk-ins:** clientes sin reserva; el mismo motor les busca mesa.
- **Asignación de mesa automática** (la que menos desperdicia; combina mesas para grupos grandes) con cambio manual.
- **Franjas y aforo:** horario de *Comida* y *Cena*, aforo por franja, duración por nº de comensales, última hora de reserva, **tope de reservas online** (p. ej. "Online: 32"), tiempo de limpieza (p. ej. 10 min).
- **Reglas:** antelación mínima/máxima, mín./máx. de comensales online, **confirmación manual** (las reservas web quedan *pendientes* hasta confirmarlas).

### Citas
- **Agenda por colores:** cada profesional tiene su color; la **leyenda filtra con un clic** (se pueden combinar). Canceladas tachadas, ausentes atenuadas.
- Servicios con duración, precio y profesionales asignadas; si hay varias, el cliente elige una o **"Cualquiera disponible"**.

### Psicólogo
- **Seguimiento:** "En curso" y "Siguiente"; **Empezar cita** abre el formulario de sesión (*Objetivo, Notas de sesión, Seguimiento, Tareas/Pautas*) que queda en el historial del paciente.
- **Ficha del paciente:** pestañas Historial (sesiones, la más reciente arriba), Editar, Informe (IA — **no mostrar**) y Recibo (**no mostrar**: lleva los datos fiscales fijos de Ana Sánchez).
- **Pagos:** *Pendientes* (sesiones sin cobrar, nº de pacientes, total, "Pagada" / "Marcar todas pagadas") y *Cobradas (30 días)*.

### Autónomo (no hay capturas aún)
- **Pipeline** kanban (Nuevo → Visita → Presupuesto enviado → Aceptado…), tarjetas arrastrables, etapas editables.
- **Presupuestos** con líneas libres, IVA y total automáticos, numeración correlativa `P-2026-001`; **al aceptarlo, la tarjeta salta sola de columna**.
- **Facturas** `F-2026-001` desde el presupuesto: **documento informativo** (no Verifactu).
- Agenda interna (visitas/llamadas/trabajos), clientes, perfil fiscal.

## 4. Lo que NO existe o no se puede afirmar
| No mostrar / no decir | Motivo |
|---|---|
| Informe con IA del psicólogo | La IA (Gemini) falla con frecuencia; no se ha visto una generación completa |
| Pestaña Recibo / factura PDF del psicólogo | Datos fiscales de Ana Sánchez fijos en el código |
| Google Calendar, horario desde Google Business Profile | Desplegado pero sin ningún negocio conectado |
| Cobro/prepago/huella con tarjeta (Stripe) | No existe |
| Reseñas resumidas con IA | Bloqueado por aprobación de Google |
| API pública, multi-idioma | No existe |
| Verifactu / "factura homologada" | No: las facturas son informativas |
| Precios de Turnigo, % de mejora, "garantizado" | No hay precios publicados; nunca prometer cifras ("ayuda a reducir", no "reduce un 40 %") |
| Datos de clientes reales (Ana Sánchez, La Taberna del Herrero, Mímate por su nombre) | Privacidad y confianza |

## 5. Requisitos reales para que una función "funcione sola" (honestidad)
- Reservas online: el negocio pega la línea de código en su web o usa el enlace.
- WhatsApp: el negocio necesita su WhatsApp Business y la plantilla aprobada por Meta.
- Reseñas: necesita su enlace de reseña de Google.
- Email: clave de Resend del negocio (o la global de la plataforma).
Si un vídeo dice "automático", que sea cierto **una vez configurado**; el CTA "Comenta DEMO" lleva a una demo donde se explica.

## 6. Glosario (vocabulario del cliente, úsalo en los textos)
*Franja* (turno de comida/cena) · *aforo* · *walk-in* (cliente sin reserva) · *no-show / ausente / "plantón"* · *mesa combinada* ·
*localizador* · *lista de espera* · *pacing* (límite de reservas por tramo; no usar la palabra en vídeos) · *pipeline* · *presupuesto* · *ficha*.

## 7. URLs y demos (para capturas y demos comerciales)
- Widget: `https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug>` · Panel: `https://turnigo-panel.lodesiko12.workers.dev/`
- Demos ficticias en producción: `restaurante-la-plaza` (*Los Cuchillos*, restaurante), `mimate` (*Mímate*, citas — demo de un cliente potencial),
  `consulta-demo-psicologia` (*Consulta Clara Montes*, psicólogo). Ver `../demo-datos/LEEME.md`.
- Línea de código para la web: `<div id="reservas-widget" data-slug="…"></div><script src="https://turnigo-widget.lodesiko12.workers.dev/embed.js" async></script>`

## 8. Mapa pantalla → captura
Todas en `../referencia-app/capturas/` (índice en `INDICE.md`). Para copiar el aspecto exacto de la app:
colores y formas en `../referencia-app/diseno/turnigo-tokens.css`; logos en `../referencia-app/diseno/brand/`.
