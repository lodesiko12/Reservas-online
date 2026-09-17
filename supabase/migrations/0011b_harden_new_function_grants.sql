-- Postgres concede EXECUTE a PUBLIC por defecto al crear una función;
-- hay que revocarlo explícitamente en las que no deben ser públicas
-- (dining_table_busy es un helper interno; get_dining_table_options es
-- solo para el panel autenticado, nunca para anon).
revoke execute on function public.dining_table_busy(uuid, uuid, text, date, timestamptz, timestamptz, boolean, int, uuid)
  from public, anon, authenticated;
revoke execute on function public.get_dining_table_options(uuid, uuid, timestamptz, timestamptz, int, uuid)
  from public, anon;
