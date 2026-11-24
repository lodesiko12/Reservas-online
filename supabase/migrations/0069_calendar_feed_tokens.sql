-- =====================================================================
-- 0069_calendar_feed_tokens.sql
-- Enlace de suscripcion (ICS) por profesional: Turnigo -> Google Calendar,
-- solo lectura, sin OAuth. El enlace lleva un token aleatorio (256 bits)
-- que solo conoce el panel; la Edge Function `calendar-feed` (publica) lo
-- usa para servir las citas del profesional. La tabla no tiene politicas
-- RLS: solo se toca con service_role o con las RPC de abajo.
-- =====================================================================

create table if not exists public.professional_calendar_feeds (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.professional_calendar_feeds enable row level security;
revoke all on public.professional_calendar_feeds from anon, authenticated;

-- Devuelve el token del profesional (lo crea si no existe).
create or replace function public.get_professional_calendar_feed_token(p_professional_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_business uuid; v_token text;
begin
  select business_id into v_business from public.professionals where id = p_professional_id;
  if v_business is null or not public.is_business_member(v_business) then raise exception 'No autorizado'; end if;
  insert into public.professional_calendar_feeds(professional_id) values (p_professional_id)
    on conflict (professional_id) do nothing;
  select token into v_token from public.professional_calendar_feeds where professional_id = p_professional_id;
  return v_token;
end $$;

-- Genera un token nuevo (invalida el enlace anterior).
create or replace function public.regenerate_professional_calendar_feed_token(p_professional_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_business uuid; v_token text;
begin
  select business_id into v_business from public.professionals where id = p_professional_id;
  if v_business is null or not public.is_business_member(v_business) then raise exception 'No autorizado'; end if;
  insert into public.professional_calendar_feeds(professional_id) values (p_professional_id)
    on conflict (professional_id) do update set token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), created_at = now();
  select token into v_token from public.professional_calendar_feeds where professional_id = p_professional_id;
  return v_token;
end $$;

revoke execute on function public.get_professional_calendar_feed_token(uuid) from public, anon;
revoke execute on function public.regenerate_professional_calendar_feed_token(uuid) from public, anon;
grant execute on function public.get_professional_calendar_feed_token(uuid) to authenticated;
grant execute on function public.regenerate_professional_calendar_feed_token(uuid) to authenticated;
