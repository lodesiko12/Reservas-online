-- =====================================================================
-- 0032_rate_limiting.sql
-- Contador de rate limiting (ventana fija) para las Edge Functions.
-- Una fila por clave lógica (función + IP, o función + user_id); se
-- reescribe in-place en cada ventana, así que el tamaño de la tabla queda
-- acotado por el número de llamantes distintos que ha visto cada función,
-- no crece con el tiempo. Solo la usan las Edge Functions vía
-- service_role — no expuesta a anon/authenticated (RLS activo, sin
-- políticas => bloqueado por defecto para esos roles; PostgREST tampoco
-- la expone porque no está en ningún `select`/`grant` de esos roles).
-- =====================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        int not null default 1
);

alter table public.rate_limits enable row level security;
-- Sin políticas: authenticated/anon no pueden leer ni escribir esta
-- tabla en absoluto vía PostgREST. Solo service_role (usa la clave
-- de servicio, que ignora RLS) puede tocarla, y solo lo hace desde
-- dentro de las Edge Functions.

revoke all on public.rate_limits from anon, authenticated;

-- rate_limit_hit: incrementa el contador de `p_key` y devuelve true si
-- la petición cabe dentro del límite (false = hay que devolver 429).
-- Atómico vía INSERT ... ON CONFLICT para evitar condiciones de carrera
-- entre peticiones concurrentes del mismo llamante.
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
