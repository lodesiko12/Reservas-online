---
name: feedback-supabase-rpc-overloads
description: Nunca añadir un parámetro a una función RPC de Postgres/Supabase ya expuesta sin eliminar antes la firma vieja
metadata:
  type: feedback
---

Al añadir un parámetro nuevo (aunque tenga `default`) a una función Postgres ya expuesta vía RPC de Supabase, hay que hacer `drop function` de la firma antigua antes o en la misma migración — `create or replace function` con una lista de argumentos distinta crea una SEGUNDA sobrecarga en vez de sustituir la existente.

**Why:** Postgres permite function overloading por firma de tipos. Un `create or replace` que cambia el número de parámetros no reemplaza la función vieja: coexisten las dos. PostgREST entonces no sabe cuál elegir cuando la petición no incluye el parámetro nuevo (p.ej. porque `JSON.stringify` en el cliente elimina claves con valor `undefined`), y falla con `Could not choose the best candidate function`. Esto pasó en [[project-reservas-saas]] al añadir `p_table_id` a `create_public_dining_booking` en la migración 0009: quedó una versión de 10 argumentos y otra de 11 hasta que se hizo `drop function` explícito de la vieja (migración 0009c).

**How to apply:** cualquier vez que se modifique la firma de una función ya usada por RPC (`supabase.rpc(...)`), comprobar con `select oid::regprocedure from pg_proc where proname='...'` tras aplicar la migración que solo existe UNA signature. Si hay más de una, `drop function` de las obsoletas en la misma migración o en una de limpieza inmediatamente después.
