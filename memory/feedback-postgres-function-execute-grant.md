---
name: feedback-postgres-function-execute-grant
description: Postgres concede EXECUTE a PUBLIC por defecto al crear una función nueva; revocarlo explícitamente en toda función security definer sensible
metadata:
  type: feedback
---

Al crear una función con `create or replace function`, Postgres concede `EXECUTE` a `PUBLIC`
(que incluye `anon` y `authenticated` en Supabase) por defecto, salvo que se revoque a mano.
El 2026-09-28, de doce RPC `security definer` nuevas del mini-CRM de autónomos, solo una
(`crm_next_document_number`) tenía el `revoke ... from public, anon` correspondiente; las otras
once quedaron técnicamente invocables por `anon` (detectado por el advisor de seguridad del MCP
de Supabase, `get_advisors` tipo `security`, lint `anon_security_definer_function_executable`).

**Por qué no era crítico pero sí incorrecto:** todas comprueban `is_business_member(business_id)`
internamente y `auth.uid()` es `null` sin JWT, así que `anon` recibía "No autorizado" igualmente
— pero es defensa en profundidad rota, y varias funciones *ya existentes* del repo
(`set_business_integration`, `disconnect_business_google_profile`...) tienen el mismo patrón sin
corregir, así que no es un caso aislado.

**Cómo aplicarlo:** después de cualquier migración que cree funciones nuevas con
`security definer`, correr `get_advisors(type: "security")` del MCP de Supabase y revisar los
lints `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`
generados por esa migración. Para cada función pensada solo para `authenticated`, añadir:
```sql
revoke all on function public.nombre_funcion(tipos...) from public, anon;
grant execute on function public.nombre_funcion(tipos...) to authenticated;
```
en la misma migración que la crea (no como parche aparte, salvo que ya se haya desplegado sin
ello, como pasó aquí en `0037_crm_rpc_grants_harden.sql`).
