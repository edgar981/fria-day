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

## Comentarios en salidas (plana, sin hilos)

- **Qué:** comentar una salida del feed, lista **plana** (sin hilos anidados).
- **Estado:** las **reacciones** ya se hicieron (Pasada R). Queda el comentario en texto.
- **Disparador:** cuando la gente ya comente las salidas **por fuera** (WhatsApp,
  en persona) sobre lo que ve en el feed, o pida responder dentro. La señal es que
  el feed del círculo (Pasada C) genera conversación que hoy se va a otro lado.

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

## Hueco del eje Salidas: una salida vacía sigue contando

Contexto (Pasada E + Y): el eje **Salidas** cuenta salidas propias, y una salida
puede quedar sin check-ins (borrando el último) y sigue sumando. Tres alternativas,
**ninguna implementada** — se elige cuando dispare:

- **Reemplazar en vez de bloquear:** si es el último check-in, "Quitar" ofrece
  "Cambiar la bebida" — resuelve "registré mal" sin dejar la salida vacía.
- **Que Salidas cuente solo salidas con ≥1 check-in:** una línea en la query, sin
  tocar la UI. Contradice la decisión del caso 3 de la Pasada E (presencia = estuviste,
  no consumo), pero es lo más barato.
- **Bloquear el borrado del último check-in:** *descartada* — contradice A.1 (quitar
  es frecuente y barato: por eso lleva "Deshacer" y no diálogo) y atrapa al usuario si
  registró mal su única bebida.

**Disparadores:** si alguien del parche infla el conteo de Salidas, o si alguien se
queja de haber borrado su única bebida.

_(Nota: "Yo también" ya evita crear salidas vacías: al deshacer, si la salida se creó
por la acción y queda vacía, se borra — Pasada Y, caso 4.)_

## createSession: doble-submit concurrente crea salidas duplicadas

Diagnóstico por ejecución (Y.2, punto 2): dos pestañas guardando "Nueva salida" a la
vez → **2 salidas idénticas** (verificado: 2 salidas, mismo contenido). **No se
arregla en esta pasada** (es un flujo distinto).

- A diferencia de "Yo también" —que INTENTA reutilizar la salida del día y por eso se
  serializó con advisory lock (Y.2)—, `createSession` **siempre crea**, y tener dos
  salidas el mismo día puede ser **legítimo** (almuerzo y noche). Por eso **NO** va un
  `@@unique(userId, date)` ni un lock.
- El doble-click en **una sola pestaña** ya está protegido (`disabled={busy}` en
  "Guardar salida"). El duplicado residual necesita **dos pestañas/dispositivos** o un
  doble-submit real.
- Fix (si se quiere): guard de doble-submit del MISMO borrador (clave de idempotencia
  por borrador enviada a `createSession`), no un lock por usuario+día.

**Disparador:** si alguien se queja de salidas duplicadas tras guardar, o si el
doble-submit resulta molesto en uso real.

## SessionTag.dismissedAt: columna sin uso en la UI (Pasada R)

La Pasada R quitó el contador "X de N registraron" y el control "No tomé ese día".
`dismissedAt` era la salida de ese contador; sin él, ya no se puede setear desde la
interfaz. **La columna NO se borró** (borrar es destructivo; reversible es mejor).

- La **lógica de la racha NO cambió**: sigue leyendo `dismissedAt` (una etiqueta
  descartada no cuenta como evento). Como ya nadie la setea, en la práctica será null
  para etiquetas nuevas; las viejas conservan su valor.
- El componente `TagDismissControl` y la acción `setTagDismissed` quedan sin uso.

**Disparador para retomar:** si se decide volver a mostrar presencia/racha de forma
social, o si se hace una limpieza de esquema y se confirma que nada la lee.

## Modo bar (Pasada N)

- **Qué:** perfil de establecimiento, con sus propios retos y ranking del sitio.
- **Disparador:** que un **bar lo pida**, o que haya **suficientes usuarios** para que
  a algún local le interese.
- **Por qué esperar:** es un producto aparte (lado B2B); no aporta al parche privado
  hasta que exista demanda real de un establecimiento.

## Puntos (Pasada N)

- **Qué:** un sistema de puntos.
- **Restricción dura:** si se implementan, es **por registrar una salida, NO por
  bebida**. Registrar una o siete da lo mismo: el incentivo apunta al **registro**, no
  al consumo (regla de producto — nada que premie tomar más).
- **Disparador:** cuando haga falta un empujón para que la gente registre seguido y
  el resto de señales (racha, feed) no basten.

## Rachas entre amigos (Pasada N)

- **Qué:** racha de pares del círculo, tipo "Edgar y Carlos · 12 salidas juntos".
- **Por qué encaja:** sale del **círculo** (gente con la que sales), no premia cantidad
  de bebida — celebra aparecer juntos.
- **Disparador:** cuando el círculo (Pasada C) ya se sienta vivo y la gente quiera ver
  con **quién** sale más, no solo cuánto.

## Invitation.expiresAt: columna sin uso desde la interfaz (N.2)

N.2 quitó el campo "Expira en (días)" de la hoja de invitar: un parche de amigos no
necesita códigos con vencimiento. Desde ahora todos los códigos se generan **sin
expiración** (`expiresAt` null).

- La **columna NO se borró** (borrar es destructivo; reversible es mejor). Los códigos
  viejos con `expiresAt` conservan su valor y la validación los sigue respetando
  (`getMyInvitations` filtra `expiresAt: null OR > now`).
- `createInvite` aún acepta `expiresInDays`; el cliente siempre manda `""` → null.

**Disparador para retomar:** si alguna vez se quiere códigos con vencimiento (p.ej. un
enlace público temporal), el backend ya lo soporta — solo faltaría reponer el control.

## Sistema de interacciones (rediseño) — pendiente de DISEÑO

- **Qué:** replantear qué se puede hacer sobre una salida ajena. Hoy son **seis emojis
  genéricos** en una fila plana (Pasada R): funcionan, pero no se sienten parte de la
  app y la forma de reaccionar es sosa. Edgar va a rediseñar el sistema completo: si son
  reacciones, comentarios, ambos, o algo del dominio (reaccionar a una **bebida** concreta,
  "yo pido una de esas").
- **Estado:** I-1 ya dio el primer paso — barra de acciones (Reaccionar visible; Comentar
  I-3 y Compartir/share-card ocultos), tap/hold con selector, y una animación CSS por emoji.
  Lo demás sigue pendiente de diseño. Ver también "Comentarios en salidas (plana, sin hilos)".
- **Sin disparador de tiempo:** depende de que Edgar lo defina (decisión de producto +
  sesión de diseño), no de una condición del uso.

## Assets animados propios de reacciones: 🍻 y 🫡 (I-1)

- **Qué:** en I-1 las seis reacciones se animan con CSS al aplicarlas (una vez). Dos son
  versiones simples a propósito: **🍻 rebota** (falta el **brindis real** — dos jarras que
  chocan) y **🫡 hace un pulso** (falta la **coreografía de la mano** del saludo).
- **Disparador:** si las versiones CSS **saben a poco** en uso real, hacer assets animados
  propios (SVG/Lottie) para esas dos.
- **Nota:** el resto (❤️ 🔥 😂 🤤) con CSS probablemente basta; revisar caso por caso.

## Fotos: cómo se ven y para qué sirven — RESUELTO en Pasada I-2

- **Resuelto:** la foto pasó a ser de la **noche** (tabla `SessionPhoto`, hasta 6 por
  salida), se sube desde el **detalle propio**, y **mirar** existe: carrusel deslizable +
  pantalla completa. La miniatura de 46px de las filas de bebida desapareció. La tarjeta
  del feed muestra la primera foto con indicador "1/N".

## Limpieza de `CheckIn.photoUrl` (columna sin uso tras I-2)

- **Qué:** I-2 migró cada `CheckIn.photoUrl` a `SessionPhoto` pero **NO borró la columna**
  (para no perder datos si algo salía mal). Queda sin lectura ni escritura en la app.
- **Disparador:** una vez I-2 esté en prod y estable, una migración que `DROP COLUMN
  "photoUrl"` de `check_in`. Antes de dropear, confirmar que ninguna fila tiene un
  `photoUrl` que **no** haya quedado en `SessionPhoto` (la migración copió todos los no
  nulos, pero verificar por si acaso).
- **Nota:** hasta entonces, `deleteSession` y `clean-orphan-blobs` siguen incluyendo esos
  URLs legados en el set de referencias (mismo blob que la fila de `SessionPhoto`).

## Share-card v2: tira de 2–3 fotos (Pasada S.2 · §5, habilitado por I-2)

- **Qué:** el diseño v2 previó que con varias fotos la zona de foto del share-card se
  convierta en una **tira** (la primera grande, 1–2 más en columna) en vez de una sola.
- **Estado:** hoy el share-card usa **una** foto (`session.photos[0]`). Con `SessionPhoto`
  ya existiendo, pasar 2–3 y componer la tira es **bajo esfuerzo, no trivial**: un layout
  flex nuevo en `card.tsx` (fila: foto grande + columna de miniaturas) y ajustar el alto.
- **Disparador:** cuando el share-card de una noche con varias fotos se sienta pobre
  mostrando solo una. Decisión estética de Edgar.

## Nombres de etiquetados en la share-card: ¿opcional? (Pasada S)

- **Qué:** la share-card (imagen que va a Instagram/afuera) incluye los **nombres de los
  etiquetados** ("con Beto y Caro"). Alguien podría no querer salir en una imagen pública.
- **Estado v1 (Pasada S):** se dejan los nombres (recomendación aceptada). La imagen sale
  del círculo y muestra quién salió — es parte del sentido.
- **Disparador para retomar:** si alguien del parche pide no aparecer, o incomoda en uso
  real. Opciones: opt-out por usuario (no aparecer en imágenes de otros), o que el dueño
  elija incluir/omitir compañía al compartir. Decisión de producto de Edgar.
