-- Estado "sentada" (el cliente ha llegado y está en la mesa). En su propia
-- migración: un valor de enum no puede usarse en la misma transacción en
-- que se crea.
alter type public.booking_status add value if not exists 'sentada';
