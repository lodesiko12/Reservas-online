# Checklist de calidad (pasar a CADA pieza antes de publicar)

Marca todo. Si algo falla, se corrige y se vuelve a renderizar; no se "publica y ya".

## A. Contenido y veracidad
- [ ] El mensaje es **una idea** y una función principal.
- [ ] Todo lo que se muestra/dice está en `producto-turnigo.md` (nada de la lista "No mostrar").
- [ ] **Datos 100 % ficticios** (nombres, teléfonos, emails). Ni Ana Sánchez, ni La Taberna del Herrero, ni "Mímate".
- [ ] **Sin precios** de Turnigo y **sin porcentajes** de mejora; las cifras llevan "(ejemplo)".
- [ ] Sin "garantizado", "legal", "homologada", "Verifactu". Facturas = "documento informativo".
- [ ] Sin logos de Google/WhatsApp/Instagram/TikTok ni de competidores.
- [ ] (Psicólogos) Paciente ficticio, sin diagnósticos; sin Informe de IA ni Recibo.
- [ ] El CTA es **Comenta "DEMO" y te lo enseño** (o su variante de `banco-de-ganchos-y-textos.md` §4).
- [ ] Capturas usadas: **recortada** la barra lateral/email de la cuenta demo.

## B. Texto
- [ ] **≤ 6 palabras por pantalla**, ≤ 2 líneas de titular, 2.ª línea en color de acento.
- [ ] Cada rótulo se lee en **≤ 1,5 s sin sonido**.
- [ ] Tamaño ≥ **36 px**; contraste ≥ **4,5:1**.
- [ ] Ortografía y tildes revisadas (¿ ? ¡ !), tuteo, español de España, sin jerga ("SaaS", "plataforma").

## C. Imagen y movimiento
- [ ] El **primer fotograma** ya comunica el problema/resultado (nunca el logo).
- [ ] **Nada** importante en los 150 px superiores ni en los 380 px inferiores (zona segura).
- [ ] Todo **entra con muelle**; no hay elementos que aparezcan de golpe sin animar.
- [ ] **Una micro-acción** por función (toque, escaneo, contador, notificación…).
- [ ] La UI de la app **se parece a la real** (colores, radios, textos exactos; plano de sala = tarjetas salvo licencia creativa decidida).
- [ ] Fondos: oscuro = problema, claro = solución, **un solo cambio**.
- [ ] Sin fundidos largos, sin transiciones de plantilla, sin relleno.
- [ ] Hay **movimiento continuo** (cámara/respiración) para que nada esté inmóvil > 1 s.

## D. Ritmo y sonido
- [ ] **Cada corte de escena cae en un downbeat** (tolerancia ≤ 1 frame, comprobado con `ffmpeg`).
- [ ] El énfasis (giro, número final, sello) cae en un **golpe fuerte** con `thud`.
- [ ] Música con **licencia comercial** apuntada en `licencias-musica.csv`; sin silencios; fundido final.
- [ ] Mezcla ≈ **-14 LUFS**, pico ≤ -1 dBTP; se oye bien por el altavoz del móvil.
- [ ] Probada la pieza con **otra canción** (el guion en beats no depende de una pista).

## E. Técnica y entrega
- [ ] `npm run lint` (eslint + tsc) sin errores.
- [ ] Render **1080×1920, 30 fps, h264, yuv420p, AAC**; nombre `PNN-slug_vN.mp4`.
- [ ] Revisados fotogramas clave (gancho, giro, cada función, EndCard) a pantalla completa.
- [ ] Subido como **borrador privado** a TikTok y visto en un móvil real: zona segura, texto, sonido.
- [ ] Carruseles: 5 PNG, misma música, 1.ª = gancho, 5.ª = CTA.

## F. Publicación
- [ ] Descripción con gancho + CTA + 3-5 hashtags; **comentario fijado** preparado.
- [ ] Fila añadida en `seguimiento-publicaciones.csv` (fecha, hora, pieza, plantilla, nicho, gancho, canción).
- [ ] No coincide con otra pieza del mismo nicho y plantilla publicada hoy.
