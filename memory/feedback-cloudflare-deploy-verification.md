---
name: feedback-cloudflare-deploy-verification
description: El hash del bundle de Cloudflare no basta para confirmar que un build terminó; verificar por contenido, y forzar con un commit vacío si el build no arranca
metadata:
  type: feedback
---

Comparar el hash del bundle (`assets/index-XXXXX.js`) antes/después de un push **no distingue**
entre dos situaciones muy distintas:

1. El build corrió bien pero el código que cambió no afecta a esa app (p.ej. cambios solo en
   `packages/shared` que el dashboard no importa, o solo en Edge Functions) → el hash puede salir
   idéntico legítimamente, incluso con un "Version ID" nuevo en el log de Cloudflare.
2. El webhook de GitHub→Cloudflare no disparó ningún build nuevo → el hash sigue siendo el viejo
   porque sigue sirviéndose el build anterior.

Pasó dos veces en la misma sesión (2026-09-26): una vez fue el caso 1 (el panel no había cambiado
de verdad) y otra vez el caso 2 (el build realmente no había arrancado, confirmado por el usuario
mirando el dashboard de Cloudflare). Además el hash real de Vite puede diferir entre un build local
en Windows y el de Cloudflare (Linux) para el mismo código fuente, así que ni siquiera comparar
contra un build local hecho a mano es fiable.

**Cómo verificar de verdad que un cambio concreto llegó a producción:**
```bash
hash=$(curl -s https://turnigo-panel.lodesiko12.workers.dev/ | grep -o 'assets/index-[a-zA-Z0-9_-]*\.js')
curl -s "https://turnigo-panel.lodesiko12.workers.dev/$hash" -o /tmp/bundle.js
grep -aoc "cadena distintiva del cambio (mensaje de error, fragmento de regex...)" /tmp/bundle.js
```
Usar una cadena que solo exista si el cambio está — un mensaje de error nuevo, un fragmento de
regex, el nombre de una función. Ojo con la clase de caracteres del grep del hash: los hashes de
Vite llevan guiones (`C3B-1Jaq`), `[a-zA-Z0-9]` sin el guion los corta a mitad y el hash sale vacío.

**Si el build parece no haber arrancado en absoluto** (sin ningún log nuevo en el dashboard de
Cloudflare, ni siquiera fallido): un `git commit --allow-empty -m "..."` + push suele bastar para
forzar que el webhook dispare un build nuevo. No asumir que "mismo hash = build no corrió": pedir
al usuario que mire el log del build en el dashboard de Cloudflare antes de concluir que algo falló
(el log trae el deploy command, el `Version ID` de wrangler y si hubo "No updated asset files to
upload", que es normal, no un error).
