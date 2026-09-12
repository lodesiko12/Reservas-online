-- =====================================================================
-- 0005_storage_logos.sql
-- Bucket público para logos de negocio. Ruta de objeto: <business_id>/<archivo>.
-- Lectura pública; escritura solo para miembros de ese negocio (o super-admin).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos public read" on storage.objects;
create policy "logos public read" on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "logos member write" on storage.objects;
create policy "logos member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_business_member((split_part(name, '/', 1))::uuid));

drop policy if exists "logos member update" on storage.objects;
create policy "logos member update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_business_member((split_part(name, '/', 1))::uuid));

drop policy if exists "logos member delete" on storage.objects;
create policy "logos member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_business_member((split_part(name, '/', 1))::uuid));
