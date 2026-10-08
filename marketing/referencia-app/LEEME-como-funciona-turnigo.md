# Turnigo — cómo funciona (referencia para crear vídeos)

Documento autónomo: está pensado para usarse **sin el resto del repositorio**. Resume qué hace la
app, cómo se ve y qué flujos existen, con las capturas reales de producción de la carpeta
`capturas/`. Si una animación necesita imitar la app, copia el aspecto de las capturas y los
colores de `diseno/`.

> Las capturas son de negocios **demo/ficticios** (restaurante *Los Cuchillos*, centro de estética
> *Mímate*). Mímate es la demo de un cliente potencial: úsala como referencia visual, pero en
> vídeos publicados pon nombres inventados (Bar La Esquina, Estudio Nerea…).

## 1. Qué es

SaaS de **reservas online para negocios locales**. Tres piezas:

| Pieza | Quién la usa | Qué es |
|---|---|---|
| **Widget** | El cliente final del negocio | Formulario de reserva por pasos, embebido en la web del negocio con una línea de código `<script>` (o como página suelta, enlace de reservas). Sin cuenta ni contraseña |
| **Panel de negocio** | El dueño y su equipo | Agenda, plano de sala, clientes, servicios, bloqueos, reportes, configuración |
| **Panel super-admin** | Nosotros | Alta de negocios y usuarios (no sale en vídeos) |

Cada negocio tiene su **branding** en el widget (color y logo propios). El panel es siempre
Turnigo (verde azulado + coral).

## 2. Tipos de negocio y qué ve cada uno

| Tipo | Ejemplos | Qué reserva el cliente | Pantallas propias del panel |
|---|---|---|---|
| **Restaurante** | restaurantes, bares | Mesa para N personas en una *franja* (comida/cena) | **Plano de sala** en tiempo real, Franjas, Mesas, lista de espera, walk-ins |
| **Citas** | peluquería, estética, fisio, clínicas | Un servicio con duración y (opcional) una profesional | Servicios, agenda con **color por profesional** |
| **Psicólogo** | consultas | Igual que citas | **Seguimiento** (cita en curso/siguiente), ficha con historial de sesiones, **Pagos** |
| **Autónomo** | fontanería, electricidad, reformas | No hay reserva online: es un mini-CRM | **Pipeline** kanban, agenda interna, **Presupuestos** y **Facturas** |

Pantallas comunes a todos los tipos con reserva: Resumen, Agenda (Día/Semana/Mes), Nueva reserva
(manual), Clientes (+ ficha), Bloqueos, Reportes, Configuración.

## 3. Flujos clave (lo que se puede animar)

### Reserva del cliente (widget) — `capturas/widget/`
- **Restaurante:** ① elige comensales (1-12) → ② elige día y hora (solo aparecen los días con
  hueco; cada franja, *Cena*, muestra sus horas de 15 en 15 min) → ③ formulario (nombre, apellidos,
  teléfono, email, notas) → "Confirmar reserva". Recibe email de confirmación y un **localizador**.
- **Citas:** ① elige servicio → ② elige profesional (o "Cualquiera disponible") → ③ día y hora →
  ④ formulario → confirmar.
- **"Mi reserva":** el enlace "¿Ya tienes una reserva? Consúltala aquí" permite ver o **cancelar**
  la reserva con su localizador, sin llamar al negocio.
- La barra de progreso de 3 pasos arriba va rellenándose.

### Automatizaciones (no tienen pantalla propia; se animan como mensajes)
- **Email de confirmación** al reservar (reenviable desde el panel).
- **Recordatorio por WhatsApp 24 h antes** (plantilla con cliente, negocio, fecha y hora).
- **Petición de reseña** 1-3 h después de la visita (si el negocio tiene enlace de reseña).
- **Lista de espera (restaurante):** si no hay mesa, el cliente se apunta; al liberarse una, el panel
  avisa por WhatsApp y el staff pulsa "Sentar".

### Panel — restaurante
- **Plano de sala** (tiempo real). **Ojo, no es un dibujo en planta:** es una cuadrícula de
  **tarjetas de mesa agrupadas por zona** (*Interior*, *Barra*, *Terraza*). Cada tarjeta muestra
  nombre, capacidad ("2-4 pers."), próxima reserva ("Próxima reserva a las 20:45") y un botón
  **"Sentar clientes"**; una mesa con reserva retrasada se tiñe de rojo con "Retrasada" y botones
  **Sentar / No-show**. Debajo hay una **Lista de espera**. Si en un vídeo se dibuja un plano
  redondo, es licencia creativa: la app real son estas tarjetas (ver `capturas/panel/restaurante/`).
  Cada mesa cambia de estado — libre, reservada, **sentada**,
  **no-show** (ausente) — con un toque. **Walk-ins** (clientes sin reserva) buscan mesa con el mismo
  motor. Estados de reserva: confirmada / pendiente / sentada / completada / ausente / cancelada.
- **Asignación de mesa automática** (la que menos desperdicia; combina mesas para grupos grandes) y
  asignación manual posible.
- **Franjas y aforo:** horario, aforo por franja, duración por nº de comensales, tope de reservas
  online, tiempo de limpieza.

### Panel — citas
- **Agenda por colores:** cada profesional tiene su color; la leyenda filtra con un clic (se pueden
  combinar). Canceladas tachadas, ausentes atenuadas.
- Servicios con duración, precio y profesionales asignadas.

### Panel — psicólogo
- **Seguimiento:** cita en curso y siguiente; "Empezar cita" abre el formulario de sesión
  (objetivo, notas, seguimiento, tareas/pautas), que se guarda en el historial del paciente.
- **Pagos:** sesiones pendientes de cobro (total, por paciente, "Pagada" / "Marcar todas pagadas") y cobradas de los últimos 30 días.
- La pestaña **Recibo** (factura PDF) **NO se muestra en vídeos**: hoy lleva los datos fiscales fijos de Ana Sánchez.

### Panel — autónomo
- **Pipeline** kanban (Nuevo → Visita → Presupuesto enviado → Aceptado…), tarjetas arrastrables.
- **Presupuestos** con líneas libres, IVA y total automáticos, numeración `P-2026-001`; al aceptarlo
  la tarjeta salta de columna. **Facturas** `F-2026-001` desde el presupuesto (documento informativo).

## 4. Diseño (copiar estos valores en las animaciones)

Fuente única de verdad: `diseno/turnigo-tokens.css` (+ `tailwind.config.js`, logos en `diseno/brand/`).

| Token | Valor | Uso |
|---|---|---|
| Teal (principal) | `#0B6E6A` (hover `#095A57`, oscuro `#07403E`, claro `#E8F4F3`) | botones, marca |
| Coral (acento) | `#FF6B4A` (texto sobre blanco `#C8401F`) | detalles, nunca texto pequeño |
| Fondo panel | `#F3F7F6` · tarjetas `#FFFFFF` · borde `#D9E4E2` | |
| Texto | `#0F2A2A` · secundario `#4A6362` | |
| Estados | éxito `#1F8A4C` · aviso/pendiente `#B7791F` · peligro/no-show `#C0392B` · info `#2563A8` | |
| Tipografía | **Nunito** (400 / 700 / 800 / 900 para cifras y wordmark) | |
| Formas | botones/inputs 12 px · tarjetas 20 px · chips 999 px · icono con esquinas ~23 % | |
| Sombra | `0 1px 2px rgba(15,42,42,.06), 0 4px 16px rgba(15,42,42,.05)` | tarjetas |
| Modo oscuro | existe (clase `dark`, fondo `#0A1D1D`/`#0F2A2A`) | |

El **widget** usa tipografía del sistema (Inter-like) y el color propio de cada negocio (en las
capturas: índigo en *Los Cuchillos*, turquesa en *Mímate*); fuentes y radio configurables por la web
anfitriona.

## 5. Lo que NO existe todavía (no mostrarlo en vídeos)
Informe de IA para psicólogos (no verificado), sincronización con Google Calendar, horario desde
Google Business Profile, cobros/prepago con Stripe, API pública, multi-idioma. Facturas: documento
informativo, **no** Verifactu. Sin precios publicados ni porcentajes de mejora.

## 6. Capturas — qué hay y cómo usarlas

Lista completa en `capturas/INDICE.md` (108 PNG). Todas son de producción, capturadas el
6-oct-2026 con datos demo.

| Carpeta | Contenido | Tamaño |
|---|---|---|
| `capturas/widget/restaurante/` | 6 pasos: comensales → día y hora → formulario (vacío y relleno) → "Mi reserva" | 1170×2532 (móvil @3x) |
| `capturas/widget/citas/` | 5 pasos: servicio → profesional → día y hora → formulario | 1170×2532 |
| `capturas/panel/restaurante/desktop/` | resumen, plano de sala, agenda (día/semana/mes), nueva reserva, clientes + ficha, franjas, mesas, bloqueos, reportes, config | 2880×1800 (1440×900 @2x) |
| `capturas/panel/restaurante/movil/` | las mismas en móvil (menú hamburguesa) | 1170×2532 |
| `capturas/panel/restaurante/desktop-oscuro/` | resumen, plano, agenda en modo oscuro | 2880×1800 |
| `capturas/panel/citas/{desktop,movil}/` | resumen, agenda, nueva reserva, clientes + ficha, **servicios y profesionales**, bloqueos, reportes, config | igual |
| `capturas/panel/citas/filtro-profesional/` | agenda en Día con todas vs solo una profesional (clic en la leyenda), y Semana filtrada | igual |

**Para animar:** en móvil, recorta el panel dentro de un marco de teléfono; la agenda en vista Día
(móvil) es la más legible. Para el resumen, el gráfico "Próximos 7 días" y las 4 tarjetas
(Reservas hoy, Comensales hoy, Reservas por web, Ausentismo) son lo más fotogénico.

**Notas sobre los datos demo (importante al imitar la app):**
- La **semana de Mímate** sale muy densa (muchas citas solapadas por ser demo cargada con 800
  reservas); en un vídeo conviene mostrar una versión limpia con pocos bloques de color.
- Cada profesional de Mímate tiene su color: Elvia verde, Gema azul, Nerea morado, Soraya rojo,
  Victoria ámbar. Las reservas muestran las etiquetas **web** / **manual** y el estado
  (**Confirmada**…).
- Las capturas del panel muestran el email de la cuenta demo en la barra lateral
  (`staff@restaurante.test`, `mimate@estetica.com`): recórtalo o tápalo.

**Psicólogo** (`capturas/panel/psicologo/`, negocio demo *Consulta Clara Montes*, creado el 6-oct-2026
con `demo-datos/psicologo_demo_seed.sql`): resumen, agenda, **Seguimiento** (cita en curso +
siguiente, y el formulario de sesión "Empezar cita": Objetivo / Notas / Seguimiento / Tareas-Pautas),
**clientes + ficha con Historial de sesiones**, **Pagos** (pendientes y cobradas), reportes, config;
escritorio, móvil y algo en oscuro. **Se borró a propósito la captura de la pestaña Recibo** (lleva el
nombre y datos fiscales de Ana Sánchez). Los pacientes salen con nombre completo, teléfono y email
ficticios; la barra lateral muestra `psicologa@psicologo.test`: recórtalo.
La cita "en curso" solo lo está ~50 min: para volver a capturar Seguimiento, ejecutar antes
`demo-datos/refresh_psicologo_demo.sql` (es un cambio en producción: pedir confirmación).

**Lo que falta:** **autónomo** (Pipeline, Presupuestos, Facturas; el negocio `turnigo` de tipo autónomo
existente no se ha tocado) y **plano de sala con reservas sentadas / no-show / lista de espera con
gente**. Para tenerlas habría que crear datos demo en producción (pedir confirmación).

## 7. Regenerar las capturas
Requiere Chrome instalado. Desde `marketing/referencia-app`:
```bash
npm i
npm run widget                    # widget público (sin sesión)
npm run panel -- restaurante      # abre Chrome: inicia sesión TÚ; luego captura solo
npm run panel -- citas            # idem con la cuenta de citas (psicologo / autonomo también existen)
npm run panel -- restaurante clientes   # repite solo esas pantallas
npm run indice                    # regenera capturas/INDICE.md
```
Los scripts solo leen: no crean, editan ni borran datos, y nunca escriben contraseñas.
