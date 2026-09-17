-- Nuevo estado del ciclo de vida de la reserva: 'pendiente' (esperando
-- confirmación manual del restaurante). Se añade en su propia migración
-- porque un valor de enum recién creado no puede usarse en la misma
-- transacción (las funciones que lo usan van en la siguiente migración).
alter type public.booking_status add value if not exists 'pendiente';
