# marketing/ — vídeos y carruseles de TikTok de Turnigo

Carpeta **autosuficiente**: contiene el plan, el contexto de producto y de público, el manual de estilo, las capturas de la app, los datos de
demo y el proyecto Remotion. Se puede mover a su propio repositorio sin perder nada.

**Empieza por `CLAUDE.md`** (reglas, decisiones cerradas, orden de lectura, pendientes) y `sesion-2026-10-06.md` (estado exacto donde lo dejamos).

```
CLAUDE.md                          instrucciones de trabajo y decisiones
calendario-tiktok-oct-2026.md      60 piezas del 7 al 31 de octubre, en beats
contexto/                          producto, público, textos, estilo, sonido, producción, calidad, analítica (+ CSV)
referencia-estilo/                 vídeo de referencia y sus fotogramas
referencia-app/                    capturas de la app, tokens de diseño y scripts para regenerarlas
demo-datos/                        SQL de las demos y qué cuenta es cada una
video/                             proyecto Remotion
```

## Arranque rápido
```bash
cd video && npm i && npm run dev          # previsualizar
cd ../referencia-app && npm i             # solo si hay que regenerar capturas (requiere Chrome)
```
Primer paso pendiente: **elegir canción** (`contexto/sonido-y-musica.md`) y probar el sistema de cortes con la pieza **P04**.

## Mover la carpeta
Excluye `**/node_modules` (≈ 100 MB) y `video/out/`. Tras moverla: `npm i` en `video/` y en `referencia-app/`.
El proyecto no depende del código de la app: todo lo necesario de ella está copiado (tokens, logos, capturas, SQL).
Lo único externo son las **credenciales de las cuentas demo**, que no están en ningún archivo (las tiene el usuario).
