-- Lista de espera: zona preferida del cliente (null = "cualquiera").
-- Solo informativa para el personal; no afecta a la asignación de mesas.
alter table public.waitlist
  add column if not exists zone_id uuid references public.dining_zones(id) on delete set null;
