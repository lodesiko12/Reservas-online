-- =====================================================================
-- 0017_service_professionals.sql
-- Relación muchos-a-muchos entre servicios y profesionales (antes 1-a-1
-- vía services.professional_id) + color por profesional para el calendario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Color de profesional (para el calendario y el selector del widget)
-- ---------------------------------------------------------------------
alter table public.professionals add column if not exists color text not null default '#3b82f6';

-- Backfill: asigna colores distintos a los profesionales existentes de cada
-- negocio a partir de una paleta fija, para que no salgan todos iguales.
with palette as (
  select unnest(array[
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
  ]) as color, generate_series(0, 9) as idx
),
ranked as (
  select id, row_number() over (partition by business_id order by created_at) - 1 as rn
  from public.professionals
)
update public.professionals p
set color = palette.color
from ranked, palette
where p.id = ranked.id and palette.idx = ranked.rn % 10;

-- ---------------------------------------------------------------------
-- Tabla puente service_professionals
-- ---------------------------------------------------------------------
create table public.service_professionals (
  service_id      uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (service_id, professional_id)
);

create index service_professionals_professional_idx on public.service_professionals(professional_id);

-- Migra la relación 1-a-1 existente antes de eliminar la columna vieja.
insert into public.service_professionals (service_id, professional_id)
select id, professional_id from public.services where professional_id is not null
on conflict do nothing;

alter table public.services drop column professional_id;

-- ---------------------------------------------------------------------
-- RLS: mismo patrón que service_availability (0002_rls_policies.sql)
-- ---------------------------------------------------------------------
alter table public.service_professionals enable row level security;

create policy service_professionals_all on public.service_professionals for all to authenticated
  using (exists (select 1 from public.services s where s.id = service_id and public.is_business_member(s.business_id)))
  with check (
    exists (select 1 from public.services s where s.id = service_id and public.is_business_member(s.business_id))
    and exists (select 1 from public.professionals p where p.id = professional_id and public.is_business_member(p.business_id))
  );
