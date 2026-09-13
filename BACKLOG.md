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

- **Resuelto (Pasada RU):** la ruleta se construyó — arquitectura A (un solo teléfono),
  6 dinámicas × 3 retos en código, perdedor y reto decididos en el servidor, presencia en
  detalle/feed/métricas. La restricción dura se mantiene: ningún reto de consumo.

### Ruleta · arquitectura B (sincronizada) — descartada para v1

- **Qué:** cada quien ve girar en su propio teléfono, en tiempo real (misma semilla, mismo
  arranque; todas las pantallas paran en el mismo nombre).
- **Por qué NO en v1:** exige tiempo real que hoy no existe (Next 16 en Vercel Hobby no
  sostiene websockets → SSE con función larga o servicio externo tipo Pusher/Ably), manejo
  de estados de conexión, resolución de carreras (dos giros a la vez) y un caso de rezagado
  ("abrió la app cuando la rueda ya paró") sin buena respuesta. Y rompe el objeto común: la
  mesa deja de mirar una sola pantalla. El teatro del giro vive en que todos miren el mismo
  teléfono, no en la sincronización.
- **Puente barato (ya viable en A):** al guardar la ronda, a los demás les llega la
  notificación en su feed — se pierden el giro pero no el resultado.
- **Disparador:** cuando el parche **juegue estando en bares distintos**. Si eso no pasa, no
  es v2: es una función que nadie pidió dos veces.

### Ruleta · "Otro reto" (cambiar de reto una vez por ronda)

- **Qué:** el perdedor puede, una vez por ronda, pedir OTRO reto dentro de la misma
  dinámica (las "salidas del apuro" del tablero, junto a "paso" y "cumplido").
- **Por qué esperar:** v1 quedó con solo **cumplir/pasar** (decisión de Edgar). Requiere que
  `spinRound` sepa re-elegir el reto de una ronda existente y un botón en la carta.
- **Disparador:** cuando el reto que toca no encaje seguido y "paso" se sienta demasiado.

### Ruleta · anclar comentarios a una ronda (UI)

- **Qué:** el modelo ya tiene `SessionComment.roundId` (RU · §8, mínimo), pero NO hay
  selector para elegir a qué ronda anclar un comentario al escribirlo.
- **Disparador:** cuando la gente comente rondas específicas y quiera que quede pegado.

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

## Assets animados propios de reacciones — RESUELTO en Pasada A-1

- **Resuelto:** las seis reacciones pasaron de emoji Unicode a **glifos SVG propios**
  (`ReactionGlyph`) con animaciones por parte: 🍻 brinda de verdad (dos jarras que chocan),
  🔥🤤😂 con partes separadas, ❤️ escala. El saludo 🫡 se **descartó**: no leía a 18px; el
  sexto se dibuja como **«sopla»** (matasuegras) — la clave en `REACTIONS`/DB sigue siendo
  🫡 (el dibujo cambió, el fallback Unicode ya no coincide, pero el glifo siempre se
  renderiza). Peso <1 KB gzip, sin runtime. Habilita, además, mostrar reacciones en el
  share-card (satori no puede emoji) — no implementado aún.

## Selector de reacciones con gesto continuo (hold → arrastrar → soltar)

- **Qué:** cambiar el selector de brindis del patrón actual (hold abre → **soltar** →
  tocar una) al patrón de Instagram/Facebook: hold → **arrastrar sin soltar** hasta la
  reacción → **soltar selecciona**. Elimina la ventana entre soltar y tocar, y con ella
  toda la clase de bug de "el evento del gesto que abrió cierra o elige por error".
- **Estado:** en R-2 se arregló el síntoma reportado (en PWA standalone el selector se
  cerraba al soltar) con el **Fix A**: el overlay ignora el `click` sintético del gesto que
  lo abrió (mismo guardado `endedAt` que ya usa el botón). Barato y suficiente. El gesto
  continuo es el arreglo estructural, pero es **más trabajo**: rastrear el dedo durante el
  hold (el `touchmove` sigue llegando al botón por captura iOS), hit-test contra los rects
  de las seis reacciones del portal, resaltar la que está debajo, y en `touchend` elegir esa
  (o cerrar si se soltó afuera) — más un nuevo harness de prueba de arrastre-sobre-botones.
  Estimado: ~medio día, riesgo medio (reescribe el manejo de gestos y sus bordes: flick
  rápido, dedo fuera de todo, el umbral MOVE_CANCEL vs. arrastre intencional al selector).
- **Disparador:** si el selector **vuelve a fallar por eventos** (otra variante del cierre/
  selección accidental que el Fix A no cubra), o si Edgar quiere el gesto pulido de las apps
  grandes. Hasta entonces, el Fix A resuelve el caso reportado.

## Fotos: cómo se ven y para qué sirven — RESUELTO en Pasada I-2

- **Resuelto:** la foto pasó a ser de la **noche** (tabla `SessionPhoto`, hasta 6 por
  salida), se sube desde el **detalle propio**, y **mirar** existe: carrusel deslizable +
  pantalla completa. La miniatura de 46px de las filas de bebida desapareció. La tarjeta
  del feed muestra la primera foto con indicador "1/N".

## Moderación de comentarios por el dueño de la salida

- **Qué:** que el dueño de una salida pueda **quitar un comentario ajeno** de su propia
  publicación. En I-3.2 se quitó (solo el autor borra el suyo): con 8 personas moderar es
  irrelevante y el poder de borrar lo ajeno se presta a abuso.
- **Disparador:** que alguien pida quitar un comentario de su salida, o el círculo crezca
  lo bastante para que aparezcan comentarios molestos.
- **Nota:** la lógica ya existió (canDeleteComment con `sessionOwnerId`); reintroducirla
  es volver a pasar el dueño de la salida al permiso y a la hoja/lista de comentarios.

## Rediseño de la pantalla de detalle de salida — RESUELTO en Pasada DS

- **Resuelto:** el detalle se rehízo según el tablero "Detalle de salida" (estados 1a–1e):
  foto como titular que absorbe el header, resumen de dos cifras (bebidas · distintas) en
  vez del bloque ámbar, un solo interruptor "Editar" que cambia de piel el MISMO scroll
  (sin navegar), fila de bebidas en tres datos (rating solo si existe), y zona social con
  fondo propio tras la costura de espuma. Solo presentación (`domain.ts` intacto).
- **Divergencias/pendientes que dejó DS (visuales o de datos, fuera de "solo presentación"):**
  1. **Modo Editar · fotos y campos** reutilizan `SessionPhotos` (carrusel+subir+borrar) y
     `SessionHeaderEditor`/`SessionTagsEditor` (formulario "Guardar detalles" / "Compañía").
     Cubren la función completa, pero **no** son la tira compacta "Subir foto / Gestionar N"
     ni las filas "Cambiar" del tablero. Disparador: si la piel de Editar se siente
     inconsistente con la de Lectura en uso real.
  2. ~~Constancia de 1e local~~ **RESUELTO en DS.1**: la constancia "✓ En tu salida" y el
     contador salen de los datos (`viewerDrinkKeysOnDate`, misma clave y salida objetivo que
     `yoTambien`), persisten a la recarga y re-tocar ya no duplica.
  3. **CTA de foto en lectura ("Ponle una foto")** entra al modo Editar (donde se gestionan
     las fotos) en vez de abrir el selector de archivo directo.
  4. ~~Ruta `/sessions/[id]/edit` sin enlaces~~ **RESUELTO en DS.1**: se eliminó (el modo
     Editar in-page la reemplaza); se quitaron sus `revalidatePath` muertos.

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

## La tarjeta del hito a pantalla completa (Pasada PT · §9)

- **Qué:** para los hitos **grandes** (1.000 / 5.000 / 10.000 y de ahí cada 5.000), el
  tablero "Los Puntos" prevé una **tarjeta a pantalla completa** que se comparte, además de
  la línea al pie de la cuenta que ya existe. Con "Ver" en esa línea → la tarjeta aparece
  **después de cerrar la cuenta, nunca encima**.
- **Diseño (del tablero):** reusa el share-card que ya existe — mismo lienzo (1080×1350 y
  1080×1920 story), padding 64, fondo noche, wordmark, franja de espuma y marcas de conteo.
  Es una variante **`kind:"hito"`** en la MISMA ruta `/api/share/[id]`, no una tubería nueva.
  Contenido: fecha (MES AÑO), nombre del hito, el número, "Edgar · en el parche desde…",
  "…× N", y "Lo que los hizo": salidas / rondas de ruleta / fotos / retos cumplidos. NO
  lleva: bebidas, puesto en ranking, ni el número de nadie más.
- **Estado:** en PT quedaron los hitos completos SIN la tarjeta: valores/nombres, barra y
  frase en el perfil, chips del historial, y la línea de cruce al pie de la cuenta. Falta
  solo esta tarjeta (y el botón "Ver" que la abre).
- **Disparador:** va **después de unos ajustes al sistema de puntos** que Edgar hará primero
  (decisión de Edgar, 2026-09-12). Retomar cuando esos ajustes estén.

## `Beer.style` como lista cerrada (Pasada SC.1)

- **Qué:** hoy `Beer.style` es texto libre. Con SC.1 el color de la tarjeta (nivel 2) se deriva
  del estilo por un mapa de palabra clave, que ya lo maneja bien. Pero una **lista cerrada** de
  estilos comunes mejoraría el catálogo, la **búsqueda por estilo** que ya existe, y haría el
  mapa estilo→color trivial (sin normalización ni "IPA" vs "India Pale Ale").
- **Estado:** en dev hay 26 estilos distintos en 44/45 cervezas, con redundancias ("Lager negra"
  vs "Stout", "Trigo" vs "Wheat Ale" vs "Weissbier" vs "Witbier"). El mapa por keyword las cubre.
- **Alcance:** es su propia pasada — una lista curada de estilos + un dropdown (o combo con
  "otro") al crear la bebida + migrar los valores libres existentes a la lista. Decisión de Edgar
  (2026-09-12): se queda texto libre por ahora; anotado aquí para retomar.

## El feed como "línea de tiempo con temperatura" (Pasada SC · Tanda 2)

- **Qué:** el tablero del rediseño (Tanda 2) previó que el **feed** también use el color de la
  cascada — cada salida lleva su propia franja/cabecera de color, y dos salidas seguidas se leen
  como dos temperaturas. Hoy el color de la cascada solo vive en el share-card.
- **Estado:** SC.2 dejó la cascada (`resolveCardColor`) y `getSessionDetail` trayendo
  `Beer.color`/`SessionPhoto.color`. La lógica de color es reutilizable; falta llevarla a las
  tarjetas del feed (la query del feed no trae aún esos campos).
- **Alcance:** su propia pasada — decidir la dosis de color en el feed (franja fina vs cabecera),
  traer el color en la query del feed, y no competir con la legibilidad del contenido.

## Hitos con nombre — y con eso, la línea del próximo hito (Pasada PT.1)

- **Qué:** darles **nombre y sentido** a los hitos. Hoy son números redondos (1.000, 5.000, y de
  ahí cada 5.000) sin nombre propio, así que traducirlos a salidas ("Cuatro salidas más para
  llegar a 500") es un acertijo: no dice a QUÉ se llega.
- **Estado:** en PT.1 se quitó del perfil la **línea/barra del próximo hito** (la tarjeta quedó con
  el número y el ritmo). El cálculo sigue en `points-queries` (`nextSalidas`, `nextHitoPoints`,
  `lastHitoPoints`) y `hitoEnSalidas` con sus tests — listo para volver.
- **Cuándo vuelve la línea:** cuando los hitos tengan nombre. Ahí la línea del próximo hito
  (texto + barra en `PointsCard`) se re-activa nombrando el destino, no un número pelado.

## Fusionar lugares repetidos (normalización retroactiva) (Pasada L)

- **Qué:** unificar lugares ya registrados que son el mismo sitio escrito distinto ("BBC Andino"
  vs "bbc andino"): elegir una ortografía y reescribir las salidas viejas a esa.
- **Disparador:** cuando alguien **pida** fusionar sitios repetidos (ve dos veces el mismo bar en
  su historial y le molesta).
- **Por qué esperar:** Pasada L ya **previene** duplicados nuevos (el autocompletar sugiere la
  ortografía dominante). Los viejos se dejan como están: borrar o fusionar datos del usuario sin
  pedirlo es peor que el duplicado. Si se hace, es una acción explícita, con confirmación de a qué
  ortografía se colapsa.

## El lugar como entidad (tabla `Place`) (Pasada L)

- **Qué:** convertir el lugar de texto libre en una **entidad** `Place` (con coordenadas, y de ahí
  "salidas en este bar", mapa, contador por sitio).
- **Disparador:** cuando se quiera una vista **por lugar** (todas las salidas de un bar, o un mapa
  del parche) — producto nuevo, no un campo mejorado.
- **Por qué esperar:** el problema real (Pasada L) era de **normalización**, no de descubrimiento;
  el historial del círculo (~20 bares) basta y no hace falta Google Places ni una tabla. Una
  entidad `Place` es peso muerto hasta que exista una vista que la aproveche.

## La fuga del rechazo silencioso (Pasada PA)

- **Qué:** el botón de la ficha ajena vuelve a "Agregar al parche" a los 15 días de un rechazo. Un
  solicitante que mire el perfil justo después ve el cambio y **deduce** el rechazo — lo que el diseño
  del rechazo silencioso quería evitar.
- **Disparador:** si alguien reporta que "se dio cuenta" de que lo rechazaron, o si el parche crece a
  un tamaño donde revisar el perfil de alguien cada dos semanas deja de ser un caso raro.
- **Por qué esperar:** hoy revisar el mismo perfil justo al cruzar el día 15 es un caso rarísimo (ocho
  personas, dos solicitudes al año). Arreglarlo (p. ej. mostrar "enviada" para siempre a quien pidió,
  o difuminar la fecha exacta del re-intento) agrega estado sin problema real que resuelva.

## Hoja "Quiénes brindaron" — la pila de avatares tocable (Pasada PA)

- **Qué:** hoy los avatares del brindis en el feed son adorno. Un tap abriría una hoja con cada quien
  y la reacción que dejó (orden cronológico, tu fila primero), y cada nombre/avatar abre su perfil —
  el cuarto camino al perfil ajeno del tablero (1b).
- **Disparador:** su propia pasada. Se dejó fuera de PA (que ya tocaba esquema, `loadCircle` y
  aislamiento) por ser UI nueva y autocontenida; sin ella la pila sigue de adorno y no se rompe nada.
  Los otros tres caminos (cabecera de la tarjeta, autor de comentario, fila de la Tabla) ya dan
  descubrimiento.

## Aviso de que llegó una solicitud (Pasada PA)

- **Qué:** hoy la tarjeta de "quieren entrar" solo se ve si entras a tu perfil — sin badge en la barra
  (decisión de PA: no es una alarma). Falta un aviso activo cuando llega una solicitud.
- **Disparador:** cuando exista notificación push, o si alguien reporta que se enteró tarde de una
  solicitud. Para ocho personas y dos solicitudes al año, ver la tarjeta al entrar al perfil puede
  bastar.

## Ver tu propia ficha como la ven los demás (Pasada PA)

- **Qué:** tocar tu propio avatar te lleva a `/profile` (tu panel completo), no a tu ficha ajena. Es lo
  correcto, pero nunca ves cómo te ven los demás (identidad, dos números, sin tu consumo).
- **Disparador:** si alguien pregunta "¿qué ven los demás de mí?" o al construir onboarding/privacidad.
  Requiere una vista de solo-lectura de tu propia ficha (o un toggle en `/profile`).

## Control de colisión de avatares (Pasada AV)

- **Qué:** al registrarse, preferir un avatar LIBRE en el círculo (arrancar en uno que nadie de tu
  parche use, en vez de anónimo); cuando el círculo supera el tamaño del set, permitir repetidos.
- **Disparador:** si una colisión (dos personas con el mismo animal en el feed) genera confusión real.
- **Por qué esperar:** el nudge se aplicaría en el registro, donde el círculo del nuevo usuario es una
  sola persona (quien lo invitó) — casi no hay de dónde elegir — y es lógica nueva en el wizard de
  registro, el flujo más frágil de la app. Además el avatar se edita desde Perfil, así que una
  colisión cuesta un toque. Se agrandó el set (16) para que además sea menos probable.

## Delfín y armadillo — mismo defecto de legibilidad a 18px (Pasada AV)

- **Qué:** los dos están de perfil y sin cara a tamaño chico (la misma enfermedad que se les trató a
  babilla y tortuga). El delfín es una mancha crema alargada; el armadillo, media cúpula con la cara a
  la izquierda en dos puntos.
- **Disparador:** ninguno por ahora — Edgar los acepta con su defecto. Rehacerlos (cara frontal, las 4
  reglas del tablero de avatares) si más adelante quiere subir la barra de consistencia del set.
