/**
 * Mensaje de error legible de una llamada a `supabase.functions.invoke`.
 * Cuando la Edge Function responde con un código no-2xx, supabase-js solo da el texto genérico
 * "Edge Function returned a non-2xx status code" y deja el motivo real en el cuerpo de la respuesta
 * (`error.context`), que aquí se lee.
 */
export async function fnError(error: unknown, data?: unknown): Promise<string> {
  const d = data as { error?: unknown } | null | undefined;
  if (d?.error) return String(d.error);
  try {
    const j = await (error as { context?: { json?: () => Promise<{ error?: unknown }> } } | null)?.context?.json?.();
    if (j?.error) return String(j.error);
  } catch { /* el cuerpo no era JSON */ }
  return (error as { message?: string } | null)?.message ?? "Error desconocido";
}
