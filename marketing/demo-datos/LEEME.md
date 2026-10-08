# Datos de demostración (copias de referencia)

Estos scripts SQL **son copias** de los que viven en la app (`supabase/demo/`) y sirven para entender cómo están montadas las demos
y para volver a cargarlas antes de capturar pantallas o de una demo comercial. **Ejecutarlos es una escritura en la base de datos de
producción** (no hay entorno de pruebas): **pide confirmación al usuario antes de ejecutar nada.**

| Negocio demo | Slug | Tipo | Cómo se creó / se recarga |
|---|---|---|---|
| **Los Cuchillos** (restaurante) | `restaurante-la-plaza` | restaurante | `refresh_la_plaza_demo.sql` (parametrizado por slug): regenera reservas y lista de espera relativas a hoy. Usuario `staff@restaurante.test` |
| **Mímate** (centro de estética) | `mimate` | citas | demo comercial de un **cliente potencial**: 48 clientes y 821 reservas ficticias; **no usar el nombre en vídeos publicados**. Usuario `mimate@estetica.com` |
| **Consulta Clara Montes** (psicólogo) | `consulta-demo-psicologia` | psicólogo | `psicologo_demo_seed.sql` (una vez) + `refresh_psicologo_demo.sql` (antes de cada captura). Usuario `psicologa@psicologo.test` |

- **Contraseñas:** las de prueba de la demo de psicólogo están en la variable `v_pw` de `psicologo_demo_seed.sql`; las demás, en la memoria local del
  asistente del usuario. **Nunca escribas una contraseña en un formulario de login: el usuario inicia sesión él mismo** (en la ventana de Chrome que
  abre `referencia-app`), el asistente solo captura.
- La cita **"en curso"** del psicólogo solo lo está ~50 min: ejecutar `refresh_psicologo_demo.sql` justo antes de capturar Seguimiento.
- Los nombres de pacientes/clientes y teléfonos (`6000010NN`, `paciente7@ejemplo.com`) son **inventados**. Aun así, recorta/tapa la barra lateral con el email de la cuenta.
- **No hay demo de autónomo** ni plano de sala con gente sentada/lista de espera cargados: crearlos es una escritura en producción (pedir confirmación).
- Nunca usar para vídeos los negocios reales: *Ana Sánchez Psicóloga*, *TJ La Taberna del Herrero*, *Bassalo*, ni el negocio `turnigo` (autónomo).

## Dónde están los originales
En el repositorio de la app: `supabase/demo/` (también `agencia_demo_seed.sql` y `clone_restaurant_business.sql`, que no se usan aquí).
Si se actualiza uno allí, **actualiza también esta copia**.
