-- Control de pagos de sesiones (psicólogos): null = pendiente de cobro,
-- con fecha = pagada. Columna aditiva; no cambia ninguna RPC ni política.
alter table public.bookings add column if not exists paid_at timestamptz;
