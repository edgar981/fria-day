# BACKLOG — FriaDay

Ideas con **disparador escrito**: no se construyen hasta que el disparador ocurra.
La regla es evitar features especulativas y evitar cualquier cosa que incentive
**tomar más** (ver CLAUDE.md · reglas de dominio). Cada ítem dice *qué* es y *cuándo*
recién vale la pena hacerlo.

## Parches explícitos (entidad Parche con membresía)

- **Qué:** una entidad `Parche` con miembros, para leaderboards separados por grupo
  (ej. "los del trabajo" aparte de "los del barrio").
- **Disparador:** cuando un usuario pida ver el ranking de un **subgrupo específico
  por separado**. Antes de eso, el **círculo derivado** (Pasada C) ya cubre el caso:
  "el parche" es la gente con la que has salido, sin membresía manual.
- **Por qué esperar:** el círculo se deriva de datos que ya existen (etiquetas). Una
  entidad con membresía es peso muerto hasta que alguien necesite cortar el grupo.

## Reacciones y comentarios en salidas

- **Qué:** reaccionar (o comentar) una salida del feed.
- **Disparador:** cuando la gente ya comente las salidas **por fuera** (WhatsApp,
  en persona) sobre lo que ve en el feed, o pida responder dentro. La señal es que
  el feed del círculo (nuevo en Pasada C) genera conversación que hoy se va a otro lado.

## Historia compartible con métricas

- **Qué:** una tarjeta/resumen compartible (tu total, racha, variedad) para mandar
  fuera de la app.
- **Disparador:** cuando un usuario quiera **presumir/compartir** su resumen afuera
  (pida exportar, o se vea que manda screenshots del perfil).

## Ruleta de retos

- **Qué:** retos rotativos para el parche.
- **Restricción dura:** solo metas de **variedad, disciplina o presencia** (probar
  estilos nuevos, registrar seguido, aparecer en salidas) — **NUNCA de cantidad**.
  Un reto de "tomar más" contradice la regla de producto.
- **Disparador:** cuando un usuario pida **retos o metas** para picarse con el parche.

## "Yo también" (check-in propio prellenado)

- **Qué:** desde una salida donde te etiquetaron, un botón para registrar **tu
  propio** check-in prellenado con esas cervezas (sin recrear la salida a mano).
- **Disparador:** cuando un etiquetado registre a mano lo mismo que ya aparece en la
  salida donde lo etiquetaron — la fricción repetida justifica el atajo.
- **Nota de invariante:** sigue siendo un check-in **propio** (acredita al que lo
  registra, no al que etiquetó). Etiquetar no acredita nada.

## Autocompletar lugares usados

- **Qué:** sugerir lugares ya escritos al llenar "Dónde".
- **Disparador:** cuando la gente **repita lugares** y reescribirlos sea fricción
  (o lo pidan).

## Ordenar "Otra vez" por frecuencia

- **Qué:** la tira "Otra vez" (sugerencias en salida nueva) ordenada por lo que el
  usuario **más repite**, no por recencia/alfabético.
- **Disparador:** cuando el orden actual no priorice lo más repetido y estorbe al
  registrar rápido.

## Renombrar el modelo `Beer` → `Drink` (deuda técnica)

- **Qué:** desde la Pasada D el catálogo tiene bebidas de varios tipos (`kind`:
  CERVEZA | COCTEL), pero el modelo, la tabla (`beer`), las relaciones (`beerId`,
  `getBeersWithRanking`, etc.) y muchos nombres de variables siguen diciendo "beer".
- **Disparador:** cuando la confusión interna "beer = cualquier bebida" cause un bug
  real o frene una feature (p.ej. reglas por tipo que se enreden por el nombre).
- **Por qué esperar:** es refactor de esquema + código por **claridad interna**, con
  riesgo real (migración de tabla/columnas, tocar todo el código) y **cero beneficio
  para el usuario**. El `kind` ya resuelve el problema de producto. No hacerlo hasta
  que el nombre estorbe de verdad.
