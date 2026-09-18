# Turnigo — instrucciones del proyecto

## Verificación de cambios: SIEMPRE contra Cloudflare, NUNCA localhost

La app está desplegada en Cloudflare Workers y **eso es lo único que el usuario considera
"la app funcionando"**. Un `npm run dev` en local no cuenta como verificación válida.

- Panel de administración (dashboard + superadmin): **https://turnigo-panel.lodesiko12.workers.dev/**
- Widget de reservas (cliente): **https://turnigo-widget.lodesiko12.workers.dev/?slug=<slug-del-negocio>**

**Despliegue**: Cloudflare Workers Builds está conectado por Git al repo
(`github.com/lodesiko12/Reservas-online`) — cualquier `git push` a `main` dispara el build y
deploy automáticamente en Cloudflare, tanto para `apps/dashboard` (worker `turnigo-panel`) como
para `apps/widget` (worker `turnigo-widget`). No hay que ejecutar `wrangler deploy` a mano.

Flujo de verificación tras cualquier cambio de código:
1. `npm run build` en el/los workspace(s) afectados para detectar errores de tipos.
2. Commit y `git push` a `main` (previa confirmación del usuario, como con cualquier push).
3. Esperar a que Cloudflare termine el build/deploy (unos minutos) antes de verificar — un
   `git push` no es instantáneo en producción.
4. Verificar el cambio abriendo la URL de Cloudflare de arriba en el navegador, **no**
   `localhost:5173` / `localhost:5174`. Esas URLs solo sirven para desarrollo rápido, no como
   prueba de que algo "funciona".

## Infra

- Backend: Supabase, proyecto `reservas-saas` (`project_id` / ref `fjpbruwczuovvynhlnzv`, región
  eu-west-1). URL `https://fjpbruwczuovvynhlnzv.supabase.co`.
- El widget y el dashboard comparten ese mismo proyecto Supabase (ver `.env.production` de cada app).
- Migraciones SQL en `supabase/migrations/`, aplicadas directamente al proyecto de producción de
  arriba (no hay entorno de staging separado). Nunca cambiar la firma de un RPC ya expuesto sin
  `drop function` de la firma vieja primero (si no, PostgREST deja una sobrecarga ambigua).
- Superadmin real: `lodesiko12@gmail.com` (coincide con la cuenta del usuario). No hay credenciales
  de prueba con contraseña conocida para este entorno — para probar flujos de superadmin, pedir al
  usuario que inicie sesión él mismo en el panel.

## Más contexto

Ver `README.md` (sección "## Pendientes" para la lista canónica de tareas pendientes) y
`memory/project-reservas-saas.md` para el historial de decisiones de arquitectura.
