-- dining_duration_for es un helper interno usado por otras funciones
-- SECURITY DEFINER; no necesita ser invocable directamente por anon/authenticated.
revoke execute on function public.dining_duration_for(uuid, int) from anon, authenticated, public;
