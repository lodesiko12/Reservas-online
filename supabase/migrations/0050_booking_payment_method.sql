-- Método de pago de las sesiones cobradas (psicólogos): bizum o efectivo.
-- Columna aditiva y nullable: las sesiones ya cobradas antes de esta migración
-- se quedan sin método (paid_at con fecha y payment_method null). El panel exige
-- el método al marcar una sesión como pagada. El check impide un método sin pago
-- y valores fuera de la lista; para añadir otro método basta ampliar el check.
alter table public.bookings add column if not exists payment_method text;

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method is null or (payment_method in ('bizum', 'efectivo') and paid_at is not null));
