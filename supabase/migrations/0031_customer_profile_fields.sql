-- =====================================================================
-- 0031_customer_profile_fields.sql
-- Campos adicionales de ficha de cliente (fecha de nacimiento, profesión,
-- dirección/ciudad/provincia/CP), pedidos para poder rellenar la factura
-- y el informe del negocio psicólogo Ana Sánchez con la plantilla real
-- que usa fuera de Turnigo. Todos opcionales y editables solo desde la
-- ficha del cliente en el panel (EditarTab) — el widget de reserva no los
-- pide, así que no afectan al flujo de reserva de ningún negocio.
-- =====================================================================

alter table public.customers add column if not exists birth_date date;
alter table public.customers add column if not exists profession text;
alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists province text;
alter table public.customers add column if not exists postal_code text;
