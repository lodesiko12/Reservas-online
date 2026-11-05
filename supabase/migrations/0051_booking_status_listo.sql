-- Nuevo estado del ciclo de vida de una reserva: 'listo' (el encargo ya está preparado
-- y esperando a que lo recojan). Solo lo usan los negocios en modo encargo (0052).
-- Va en su propia migración porque un valor de enum recién creado no puede usarse en
-- la misma transacción (las funciones que lo mencionan van en la 0052).
alter type public.booking_status add value if not exists 'listo';
