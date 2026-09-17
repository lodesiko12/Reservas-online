---
name: feedback-sql-function-dot-star-side-effects
description: Nunca probar una función Postgres con efectos secundarios usando "select (fn(...)).*" — la invoca una vez por columna
metadata:
  type: feedback
---

Al probar manualmente (por SQL directo) una función que devuelve una fila de tipo tabla (p.ej. `returns public.bookings`) y que tiene efectos secundarios (INSERT, UPDATE), nunca usar `select (fn(...)).*` — usar `select * from fn(...)` (sintaxis de función en el FROM).

**Why:** Postgres evalúa `(fn(...)).*` expandiendo una llamada a la función POR CADA COLUMNA del tipo de retorno. Una tabla con ~20 columnas ejecuta la función ~20 veces en la misma sentencia. Si la función hace un INSERT y además re-consulta el estado (p.ej. un chequeo de aforo acumulativo dentro de la misma transacción), cada invocación ve las inserciones de las anteriores, así que un chequeo que debería pasar limpio va acumulando "reservas fantasma" hasta que revienta un límite y lanza una excepción que aborta toda la sentencia (deja 0 filas, parece que no insertó nada). Esto ocurrió probando `create_walkin_booking` en [[project-reservas-saas]]: con `(fn()).*` reventaba con "No hay aforo suficiente ahora mismo" pese a que la lógica era correcta; con `select * from fn(...)` (invocación única) funcionó a la primera.

**How to apply:** cualquier prueba manual de una función `returns table(...)` o `returns <tabla>` con INSERT/UPDATE dentro: usar siempre `select * from mi_funcion(args)`, nunca `select (mi_funcion(args)).*`. Si el resultado "falla" de forma que no tiene sentido con la lógica leída, sospechar primero de este patrón antes de tocar el código de la función.
