-- =====================================================================
-- 0024_email_custom_messages.sql
-- Permite personalizar, por negocio, el párrafo principal del email de
-- confirmación de reserva y del email de petición de reseña post-visita.
-- Si se deja vacío (NULL), se usa el texto por defecto ya existente en
-- supabase/functions/_shared/email.ts.
--
-- Placeholders admitidos (sustituidos por el propio código, no por SQL):
--   confirmation_email_message: {cliente} {negocio} {servicio} {fecha} {hora}
--   review_email_message:       {cliente} {negocio}
-- =====================================================================

alter table public.businesses
  add column if not exists confirmation_email_message text,
  add column if not exists review_email_message text;
