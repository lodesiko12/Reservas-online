# Sesión 2026-11-10/11 — Contraseña por email y alta de usuarios solo con correo

Resumen para retomar sin partir de cero. Todo lo descrito está **desplegado en producción**
(Supabase + Cloudflare), salvo lo marcado como pendiente.

## Qué se pidió
1. En el login, opción para **crear/cambiar contraseña**.
2. Al **añadir un usuario** desde Admin, meter **solo el correo**; el propio usuario crea su contraseña
   la primera vez que accede.

## Qué se construyó (commits `82c2cd2`, `c80e634`, `2242ecc`; panel actual `index-CX9u67u6.js`)
- **Login** ([Login.tsx](../apps/dashboard/src/pages/Login.tsx)): enlace «Primera vez o contraseña olvidada» →
  pide el email → llama a la Edge Function pública `password-setup`.
- **Pantalla «Elige tu contraseña»** ([SetPassword.tsx](../apps/dashboard/src/pages/SetPassword.tsx)): se activa
  con `/?token_hash=…&type=recovery`; tiene prioridad sobre cualquier sesión (gate en `App.tsx`).
  El token se canjea con `verifyOtp` **al pulsar Guardar**, no al abrir la página (los antivirus/clientes
  de correo que precargan enlaces no lo gastan), y luego `updateUser({password})` + recarga en `/`.
  Enlace caducado/usado → pantalla con aviso y botón a «Ir a acceder».
- **Edge Functions** (todas con el helper [`_shared/passwordSetup.ts`](../supabase/functions/_shared/passwordSetup.ts)):
  - `password-setup` (nueva, `verify_jwt=false`, v3): rate limit 10/h por IP y 3/h por email. Si el email
    **no** es super-admin ni miembro de algún negocio → **404** «Ese email no está dado de alta…» y no envía.
    Si está dado de alta → genera enlace con `auth.admin.generateLink({type:'recovery'})` y lo envía por Resend.
    Errores: 503 si ningún Resend disponible, 502 si Resend falla.
  - `admin-business-users` (v13) y `admin-create-business` (v17): la contraseña pasa a ser **opcional**.
    Sin contraseña: se crea la cuenta sin ella y se envía invitación (`invite: "sent" | "not_sent" | "none"`
    en la respuesta; el panel muestra aviso verde o de fallo).
- **Orden de credenciales de Resend**: primero la clave de cada negocio del usuario
  (`business_integrations.resend_api_key` / `email_from`), en orden, y al final la global
  (`RESEND_API_KEY` / `EMAIL_FROM`). `resendCandidates()` + bucle en `sendPasswordSetupLink`.
- Validación zod: `adminNewBusinessSchema.staff_password` opcional ([validation.ts](../packages/shared/src/validation.ts)).
- Formularios: [BusinessDetail.tsx](../apps/dashboard/src/admin/BusinessDetail.tsx) (Añadir usuario) y
  [Businesses.tsx](../apps/dashboard/src/admin/Businesses.tsx) (Nuevo negocio) con la contraseña opcional.
- [`lib/functionError.ts`](../apps/dashboard/src/lib/functionError.ts) (`fnError`): lee el cuerpo real de una
  respuesta no-2xx de una Edge Function. Aplicado solo en `BusinessDetail.tsx`; el resto de pantallas
  que usan `functions.invoke` siguen enseñando el genérico «Edge Function returned a non-2xx status code».
- **Agencia → Miembros no se tocó**: ahí la contraseña la sigue poniendo el dueño de la agencia.

## Decisiones del usuario
- Elegida la **opción A** (correo propio por Resend + enlace al panel) frente a usar el correo de Supabase Auth
  (límite de unos pocos correos/hora en Free y suele caer en spam).
- Quiere que se use **la cuenta de Resend del negocio** al que pertenece el email, y que un email
  **no registrado dé error y no envíe nada** (aunque eso permite averiguar qué emails tienen acceso;
  se mitiga con el rate limit). Decisión suya, no volver a plantearla.
- Probar el envío real «**más tarde**»: el usuario pondrá `RESEND_API_KEY` global él mismo.

## Errores detectados y corregidos
- `listUsers()` sin paginar solo miraba los primeros 50 usuarios → `findUserByEmail` recorre páginas de 1000.
- El `action_link` de Supabase se consume al abrirlo (prefetch de correo) → enlace propio con `token_hash`
  canjeado al guardar.
- La detección de «email ya registrado» usaba `/already registered/`, pero GoTrue ahora dice
  «has already been registered» (`code: email_exists`) → daba 400 al añadir un email con cuenta existente.
  Caso real: `anasanchezpsicologa@gmail.com` (cuenta del 2026-10-23, nunca ha entrado, sin negocio).
  Corregido en `admin-business-users` (v13).
- `BusinessDetail` ocultaba el motivo real tras «Edge Function returned a non-2xx status code» → `fnError`.
- Mi primera versión de `password-setup` respondía siempre `{ok:true}` (anti-enumeración); se cambió por
  petición del usuario.

## Estado de producción y datos
- Producción **no tiene `RESEND_API_KEY` global**: el log lo confirma («[email] Sin credencial de Resend…»).
  Con `onboarding@resend.dev` Resend solo entrega al correo dueño de la cuenta de Resend; para el resto hace
  falta dominio verificado + `EMAIL_FROM`.
- Negocios con clave de Resend propia: `centrodepsicologia-anasanchez` (remitente en su dominio, debería
  funcionar) y `turnigo` (remitente `javierciti02@gmail.com`, Resend probablemente lo rechace).
  Sin clave: `cheesecake-ando`, `pecado-carnal-tudela`, `pecado-carnal-ejea`, `burguer-chin`, `agrupacion-demo`.
- El 2026-11-11 el usuario dio de alta (con contraseña) en `centrodepsicologia-anasanchez`, rol staff:
  `soledadesposito@gmail.com` y `cmgarciapsicologa@gmail.com`. Su tercer intento
  (`anasanchezpsicologa@gmail.com`) falló por el bug del regex; tras el deploy debería vincularse
  (**no verificado en vivo**).
- Las Edge Functions que importan `_shared/*` se despliegan con nombres `../_shared/x.ts`; hay que incluir
  `cors.ts`, `rateLimit.ts`, `passwordSetup.ts` y `email.ts` en cada despliegue.

## Verificado en vivo
- Login → «Primera vez…» → email inexistente: muestra «Ese email no está dado de alta…» y no envía.
- `/?token_hash=…&type=recovery` renderiza «Elige tu contraseña» con los dos campos.
- `password-setup` responde 400 a emails mal formados y 404 a no registrados.
- Los logs de `password-setup` con el correo del super-admin generaron `user_recovery_requested` pero **no
  se envió** (sin credencial de Resend).

## Pendiente (en este orden)
1. **El usuario** crea la API key en Resend y la pone como `RESEND_API_KEY` en Supabase → Edge Functions →
   Manage secrets (y `EMAIL_FROM` si hay dominio verificado). Es el único bloqueo.
2. Repetir la prueba de punta a punta con la cuenta de super-admin: pedir el enlace desde el login, abrir el
   correo, **elegir la contraseña el propio usuario** (el asistente no puede teclear contraseñas), entrar.
   Probar también el aviso de enlace caducado/usado.
3. Probar «Añadir usuario» **sin contraseña** con un usuario de prueba y «Nuevo negocio» sin contraseña;
   borrar los datos de prueba al terminar.
4. Confirmar que `anasanchezpsicologa@gmail.com` se vincula bien al centro (pasar de nuevo por Añadir usuario
   con contraseña).
5. Decidir qué hacer con el remitente de Gmail de `turnigo` y con los negocios sin clave (Cheesecake,
   Pecado Carnal…): Resend global o clave propia por negocio.
6. Opcional: aplicar `fnError` al resto de pantallas con `functions.invoke`
   (`GoogleBusinessProfileSection`, `GoogleCalendarBusinessSection`, `Servicios`).
7. Opcional: el enlace caduca en 1 h (OTP por defecto de Supabase Auth); si se quiere más, cambiarlo en
   Supabase Auth y el texto «1 hora» del correo en `passwordSetup.ts`.

## Cómo prefiere trabajar el usuario (visto en esta sesión)
- Quiere **opciones en el chat antes de implementar** una funcionalidad con decisiones de diseño, y responde
  con una frase corta («Sí, opción A», «Más tarde»).
- Confirma **cada despliegue de Edge Function + push** expresamente («Sí, despliega y push»); se le pide de
  nuevo cada vez que hay código nuevo, aunque sea un arreglo pequeño.
- Corrige el diseño sobre la marcha con preguntas directas («¿no puede usar la cuenta de Resend del
  negocio?»); conviene comprobar los datos reales (`business_integrations`) antes de responder.
- Si ve un error genérico en pantalla, lo pega tal cual: investigar logs (`function_edge_logs`) y base de
  datos para dar el motivo concreto en vez de suponer.
- Escribe en español; respuestas con qué está hecho, qué se verificó y qué no.
