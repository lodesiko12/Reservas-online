---
name: feedback-postgrest-upsert-partial-index
description: supabase-js .upsert() con onConflict no funciona sobre un índice único parcial (WHERE) — hay que pasar por un RPC
metadata:
  type: feedback
---

Cuando una tabla tiene un índice único **parcial** (con `WHERE`, p.ej. `unique index ... (business_id, phone_norm) where phone_norm is not null`), `supabase.from(tabla).upsert(payload, { onConflict: 'col1,col2' })` desde el cliente **falla** con el error de Postgres `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`.

**Why:** PostgREST traduce `onConflict` a `ON CONFLICT (col1, col2)` usando solo la lista de columnas — no puede expresar la cláusula `WHERE` del índice parcial, así que Postgres no encuentra ningún constraint que coincida exactamente. Esto pasó en [[project-reservas-saas]] al construir la importación CSV de clientes: `customers` tiene `uq_customers_business_phone_norm ... where phone_norm is not null`, y el upsert directo desde `Clientes.tsx` fallaba silenciosamente (todas las filas "con error") hasta interceptar el `fetch` para ver el body real del 400.

**How to apply:** si una tabla con índice único parcial necesita upsert desde el cliente (PostgREST/supabase-js), no usar `.upsert()` directo — crear un RPC `security definer` que haga `insert ... on conflict (cols) where <misma condición del índice> do update ...` en SQL plano (Postgres sí soporta condición parcial ahí) y llamarlo vía `supabase.rpc(...)`. Antes de asumir que un `.upsert()` "no hace nada", comprobar primero si el índice de destino es parcial.
