---
name: feedback-edge-function-fetch-timeout
description: Todo fetch a una API externa dentro de una Edge Function necesita su propio timeout (AbortController), por debajo del límite de la plataforma
metadata:
  type: feedback
---

Un `fetch()` sin timeout a una API externa que se cuelga (ni éxito ni error) hace que la
plataforma de Edge Functions mate la función (~75s medidos en vivo) antes de que el `try/catch`
pueda devolver una respuesta limpia. El cliente recibe un "Edge Function returned a non-2xx
status code" genérico sin cuerpo, así que cualquier reintento que inspeccione el cuerpo no se dispara.

**Cómo aplicar** (implementación de referencia: `supabase/functions/generate-client-ai-report/index.ts`):

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25_000);
try {
  resp = await fetch(url, { ...opts, signal: controller.signal });
} catch (e) {
  if ((e as Error).name === "AbortError") { /* tratar como el error reintentable de esa API (p.ej. 503) */ }
  throw e;
} finally {
  clearTimeout(timeoutId);
}
```

El timeout debe quedar claramente por debajo del límite real de la plataforma.

**Relacionado**: al desplegar una Edge Function con el MCP, generar el contenido leyendo el archivo
real de disco (nunca retipeándolo): una vez se omitió un `return` dentro de un `.map()` al copiarlo a mano.
