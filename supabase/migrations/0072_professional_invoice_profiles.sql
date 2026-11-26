-- 0072_professional_invoice_profiles.sql
-- Datos de factura propios por profesional. Si la profesional responsable de un paciente tiene
-- ficha aquí, su factura sale con sus datos y su formato; si no, sale la del centro.
-- Los datos (NIF, cuenta, logo) se rellenan desde el panel: nunca van en el repo ni en el código.

create table public.professional_invoice_profiles (
  professional_id uuid primary key references public.professionals(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  issuer_name     text not null check (length(btrim(issuer_name)) between 1 and 120),
  issuer_title    text check (length(issuer_title) <= 120),
  registration    text check (length(registration) <= 60),
  tax_id          text not null check (length(btrim(tax_id)) between 1 and 30),
  address         text check (length(address) <= 300),
  bank_name       text check (length(bank_name) <= 80),
  account_holder  text check (length(account_holder) <= 120),
  iban            text check (length(iban) <= 50),
  due_days        int check (due_days between 0 and 365),
  footnote        text check (length(footnote) <= 500),
  logo_data       text check (logo_data is null or (logo_data like 'data:image/png;base64,%' and length(logo_data) <= 400000)),
  updated_at      timestamptz not null default now()
);
create index idx_professional_invoice_profiles_business on public.professional_invoice_profiles(business_id);

alter table public.professional_invoice_profiles enable row level security;

-- Cualquier miembro del negocio puede leerlos (hacen falta para generar la factura).
create policy pip_select on public.professional_invoice_profiles for select to authenticated
  using (public.is_business_member(business_id));
-- Solo el propietario los crea o cambia, y la profesional tiene que ser de ese negocio.
create policy pip_insert on public.professional_invoice_profiles for insert to authenticated
  with check (public.is_business_owner(business_id) and exists (
    select 1 from public.professionals p where p.id = professional_id and p.business_id = professional_invoice_profiles.business_id));
create policy pip_update on public.professional_invoice_profiles for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id) and exists (
    select 1 from public.professionals p where p.id = professional_id and p.business_id = professional_invoice_profiles.business_id));
create policy pip_delete on public.professional_invoice_profiles for delete to authenticated
  using (public.is_business_owner(business_id));

revoke all on public.professional_invoice_profiles from anon;
