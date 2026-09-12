# DECISIONES.md — FriaDay v1

Desviaciones, overrides y decisiones tomadas durante la construcción respecto al
spec. Cada una con su porqué.

## Pasada C — El círculo · rama `pasada/circulo`

"EL PARCHE" eran TODOS los usuarios de la app; con el uso real, alguien invita a
gente que no conoces y aparece en tu leaderboard. Solución: **derivar el círculo**
de las etiquetas que ya existen, sin crear entidad `Parche`.

### Definición (función pura `circleOf`, una sola implementación)
El círculo de A = las personas con las que **ha salido**: B etiquetó a A, o A
etiquetó a B. **Simétrico** (etiquetar afirma que salieron juntos), **NO transitivo**
(amigos de amigos no entran), y A **siempre** está en su círculo. El texto libre no
genera arista (no tienen cuenta); las etiquetas **descartadas (`dismissedAt`) SÍ
cuentan** (descartar es "no tomé", no "no estuve"). `loadCircle(userId)` en
`queries.ts` arma las aristas y la usan feed, permisos y leaderboard — una sola vía.

### Feed social
El feed pasa a mostrar salidas de **cualquiera del círculo**, aunque esta salida no
te etiquete (eso es lo que lo vuelve red social). Como etiquetar es simétrico,
"el dueño está en mi círculo" cubre los tres casos (propia, etiquetado, del círculo),
así que el `where` es `userId IN círculo` — a quien te etiqueta ya lo tienes en el
círculo, sus salidas entran solas.

### Permisos y distintivo
- Ver: si el dueño está en tu círculo. Fuera del círculo → **404** (como antes).
- Editar/borrar/agregar: solo el dueño (sin cambios).
- El distintivo **"X te etiquetó" solo con etiqueta real**. Una salida del círculo
  sin etiqueta aparece **sin distintivo** (en el detalle la identifica el título
  "Salida de X"). **C.1:** Code había agregado un chip "Del parche" que no estaba en
  el spec; Edgar decidió que sobraba y se quitó (feed y detalle). No dejó CSS ni
  componente huérfano (era inline).

### Leaderboard acotado al círculo
"EL PARCHE" lista el círculo + él mismo, no a todos. El invariante intacto: solo
cuentan check-ins propios (etiquetar no acredita). Se eliminó `getLeaderboard()`
(código muerto que listaba a todos). Usuario **sin círculo** → aparece solo él, con
copy que lo explica sin sonar a error ("Todavía no has salido con nadie del parche")
y apunta a la mecánica (etiquetar arma el parche).

### Descubrimiento: NO
No se construye forma de encontrar usuarios fuera del círculo. El código de
invitación sigue siendo la única puerta; salir juntos, la única forma de entrar a un
círculo. Parches explícitos quedan en `BACKLOG.md` con su disparador.

## Pasada F — Fotos de cerveza (Vercel Blob) · rama `pasada/fotos`

Primera funcionalidad que sube archivos de usuario. Contexto de uso: bar, noche,
4G, borracho → todo lo que pese o falle mata la funcionalidad.

### Arquitectura de subida: client-upload (no server-upload)
Se usa `@vercel/blob/client` `upload()` contra una ruta `POST /api/blob/upload`
que corre `handleUpload`. El navegador sube los bytes **directo al blob**; no
pasan por la función serverless. Porqué: en 4G, enrutar el archivo por nuestra
función es un vector de fallo (cold start, tope de 4.5 MB del body); el
client-upload lo evita como clase. La ruta solo **autoriza** (`onBeforeGenerateToken`
exige sesión) y acuña un token corto — "la subida se autoriza en servidor" sin
que los bytes la atraviesen. `onUploadCompleted` NO corre en localhost (necesita
webhook público); no se depende de él: el `photoUrl` se guarda con una Server
Action (`setCheckInPhoto`) **después** de que `upload()` resuelve.

### Orden: check-in primero, foto después; foto nunca bloquea
- Al agregar en la hoja (add a salida existente): `addCheckIn` guarda el check-in
  y **devuelve su id**; recién entonces, si hay foto, `setCheckInPhoto(id, url)`.
- En sesión nueva: la foto se sube en la hoja (upload-first), viaja en el borrador
  local y se persiste en `createSession`. La consolidación del `photoUrl`
  (misma cerveza+formato = "el primero gana") se hace **en la acción**, NO en
  `domain.ts` — el dominio queda puro y sus 46 tests intactos.
- Un fallo de subida solo muestra el error y deja el check-in guardado. Verificado
  por ejecución inyectando el fallo con la ausencia de token (ruta → 503): la
  cerveza se agrega y la salida se guarda igual (WebKit).

### Huérfanos en Blob (Blob vive fuera de Postgres)
- Borrar check-in / salida borra también su(s) blob(s); reemplazar una foto borra
  el archivo anterior. Todo **best-effort** (`deleteBlobQuietly`): si el borrado
  del blob falla, se registra y se sigue — nunca se revierte el borrado del
  check-in (un huérfano ocasional es aceptable; un check-in que no se deja borrar,
  no). Solo se tocan URLs de nuestro store (`*.blob.vercel-storage.com`).
- `scripts/clean-orphan-blobs.ts` (dry-run) lista blobs sin `CheckIn` asociado,
  mismo patrón que `clean-passkey-orphans.ts`.

### Validación
`image/*` (la ruta restringe a jpeg/png/webp); compresión en cliente a 1200px de
lado mayor, JPEG 0.82 (`src/lib/image.ts`); tope duro tras comprimir (5 MB) con
error explícito; la ruta re-verifica el tamaño en servidor. EXIF respetado con
`createImageBitmap(file, { imageOrientation: "from-image" })` (fotos verticales
de iPhone).

### Decisión de alcance: FOTOS EN EL DETALLE, NO EN EL FEED
El feed es una lista densa pensada para escanear muchas salidas; meter imágenes
significa cargar muchos blobs en la pantalla de inicio en 4G — justo lo que "pesa
y mata la funcionalidad". Las fotos se ven en el **detalle** de la salida (dueño y
etiquetado). Reversible: si Edgar las quiere en el feed, una miniatura con
`loading="lazy"` en el hero de una-cerveza es un follow-up acotado.

### Config que pone Edgar (Code NO toca Vercel)
**Dos stores SEPARADOS** (como las ramas de Neon). Vercel solo tiene Production y
Preview, así que cada store quedó con su propia variable:
  - Production → `BLOB_READ_WRITE_TOKEN` (store de prod)
  - Preview → `BLOB_PREV_READ_WRITE_TOKEN` (store de dev/preview)

El SDK lee `BLOB_READ_WRITE_TOKEN` por defecto, que en Preview NO existe → se
resuelve el token por entorno (`blobToken()` en `src/lib/blob.ts`, según
`VERCEL_ENV`) y se pasa explícito a `put`/`del`/`list`/`handleUpload`. **LOCAL usa
SOLO `BLOB_PREV_READ_WRITE_TOKEN`** (store de dev), nunca el de prod — regla dura:
Code jamás escribe en producción. Sin token, la app corre pero no sube/borra fotos
(no-op con aviso). La **subida real** contra el store de dev se verifica en local
poniendo `BLOB_PREV_READ_WRITE_TOKEN` en el `.env`.

## Pasada B — Mecánica social (racha, "quién falta", leaderboard dos ejes)

Primera lógica de dominio nueva desde v1. Toda en `domain.ts` (pura, testeada). Los
28 tests previos quedan intactos; +11 nuevos (los 10 casos de aceptación + 1
invariante) → 39/39.

- **PIEZA 1 · Racha** (`registrationStreak`): mide DÍAS QUE REGISTRASTE, no frecuencia.
  Recorre la unión de días con salida propia o etiqueta no descartada, del más
  reciente al más antiguo: día propio → +1; día solo etiquetado dentro del plazo (48h
  desde medianoche UTC) → pendiente (ni suma ni rompe); vencido → rompe. **No tomar
  NUNCA la rompe** (se congela) — caso 7 demostrado corriendo a 10 años. **No se
  cachea**: se calcula en cada lectura (`getProfile`). Copy: "N salidas seguidas
  registradas" (nunca "viernes").
- **Descartar etiqueta**: columna nullable `SessionTag.dismissedAt` (migración
  `session_tag_dismissed`). Solo el propio etiquetado (`setTagDismissed`, chequea
  `taggedUserId === userId`). Descartada = neutra para la racha (sale de los eventos) y
  fuera del denominador de la pieza 2. Control "No tomé ese día / Deshacer" en el
  detalle, solo para el etiquetado.
- **PIEZA 2 · "quién falta"** (`sessionRegistration`): "N de M registraron" en la
  tarjeta. Denominador = dueño + usuarios de la app etiquetados no descartados (el
  texto libre NO cuenta); el dueño siempre registrado; un etiquetado cuenta si tiene
  salida propia esa fecha. **Reutiliza `hasOwnRegistration`, la MISMA función de
  emparejamiento fecha↔usuario que la racha** (una sola implementación). Aviso social
  (acotado al grupo de la salida, que ya es privado): nombre del día si faltan >24h
  ("hasta el domingo"), horas si faltan menos ("quedan 9 h").
- **PIEZA 3 · Leaderboard dos ejes**: `leaderboard` (unidades, sin tocar → los tests
  con `toEqual` siguen pasando) + `leaderboardVariety` nuevo (cervezas distintas,
  `count distinct beerId` sobre check-ins propios). Dos chips de igual peso
  (`LeaderboardTabs`), Unidades por defecto. Invariante en ambos: solo check-ins
  propios; etiquetar no acredita.
- **Fuera de alcance respetado**: no se construyó la comparación dentro de una misma
  salida (agrupación "misma salida" sigue diferida).

**Verificación:** 39/39 tests (los 10 casos de aceptación como tests; el caso 7
crítico corrido). UI en **Playwright WebKit** (login Beto, datos sembrados en dev):
feed muestra "2 de 3 registraron / Falta tú · hasta el domingo", "1 de 2 · plazo
vencido", "Faltan Edgar, Caro · quedan 9 h", el texto libre fuera del denominador;
perfil racha "2 salidas seguidas registradas" (sin "viernes"); leaderboard Unidades
(Edgar 10) ↔ Variedad (Caro 5) con un toque; descartar etiqueta verificado
(determinista). Datos de prueba dejados en **dev** (dos usuarios que se etiquetan,
fechas distintas, una etiqueta dentro del plazo y otra vencida). Nada tocó producción.

### Punto aparte — P.6 plan B (gap inferior iOS): SEPARADO

Se eliminó la `box-shadow` de P.6 (código muerto: Edgar confirmó que no arregló el
gap). El plan B real (sacar `BottomNav` de `position: fixed` y ponerla en flujo en un
contenedor `100dvh` con el contenido en scroll) **se separa a su propia pasada**, como
el spec permite ("si se complica, se reporta y se separa; NO mezclar con la mecánica
social"). Motivo: es un refactor por-pantalla de **8 archivos** (`.pb-nav` en 4 tabs +
sus 4 skeletons) con estructura NO uniforme (el feed tiene `AppHeader` hermano; el
perfil un solo `main`; el catálogo su propio header) y headers `sticky` que interactúan
— cada pantalla necesita envolver su contenido en un scroller `flex:1` con la barra
`flex:none` al final. Bundlearlo con la lógica de dominio arriesga desestabilizar todas
las tabs, y **Code no puede verificar el beneficio** (barras dinámicas de iOS). Se hará
como pasada enfocada, verificando cada tab en Chromium/WebKit y con Edgar en el iPhone.

## Pasada G.1 — Gap iOS: comparación con una PWA sin gap + ABV (misma rama)

### 1 · Comparación con el cotizador (repo `edgar981/cotizador-personal-shopper`)

Otra PWA de Edgar, mismo stack e iPhone, con barra inferior y SIN gap. Traído del
repo (público) y comparado:

| | Cotizador (sin gap) | FriaDay (con gap) |
|---|---|---|
| `display` | standalone | standalone |
| bg/theme | `#0b0b0f` (**oscuro**) | `#120E0A` (oscuro) |
| **statusBarStyle** | **default** | **black-translucent** |
| altura html/body | ninguna (natural) | `min-height: 100dvh` |
| barra | `position: fixed; bottom:0; pb-[safe-area]` | flujo (plan-B) |
| scroll | documento | contenedor interno |

**Conclusiones:** (a) el cotizador es **oscuro** y no tiene gap → la hipótesis "es
claro y no se nota" queda **descartada** (gap real ausente, no oculto); (b) el
cotizador usa **`position: fixed`** y no tiene gap → **`fixed` NO era la causa** (el
plan-B atacó un no-problema); (c) lo que FriaDay hace y el cotizador no:
**`statusBarStyle: black-translucent`** y **`100dvh`**. Esos son los sospechosos.

### 2 · Fix (comparación + red cosmética que el spec avala)

- **`statusBarStyle: black-translucent → default`** (+ `apple-mobile-web-app-capable:
  yes`), igual que el cotizador. Es el sospechoso de mayor señal y el de menor riesgo.
- **Red cosmética:** `html { background: #181209 }` (color de la barra, no el fondo de
  la app). El `body` (noche, 100dvh) cubre el html en toda la app; el color solo asoma
  en la franja residual bajo la barra (el "canvas background" de iOS sale del html), y
  al ser el color de la barra **desaparece visualmente**. El spec avala esto tras 3
  pasadas.
- **NO se revirtió** el `100dvh`/flujo del plan-B en esta pasada (revert grande, no
  verificable en Playwright). Si el preview aún muestra gap, ese es el siguiente paso:
  volver al patrón exacto del cotizador (fixed nav + scroll de documento + sin dvh).

Verificado Chromium/WebKit: sin regresión de layout, **botón "+" AMBOS bordes**
dentro del viewport (top 771 ≥ 0, bottom 827 ≤ 844), nav al fondo, sin scroll
horizontal, `html` bg = barra. **Code NO puede verificar el síntoma iOS** → lo confirma
Edgar en el preview (barra visible y oculta; y revisar también el TOP, porque
`default` cambia el manejo del status bar).

### 3 · ABV faltantes (datos de Edgar)

El seed ahora **completa campos vacíos en registros existentes** (antes solo creaba
nuevos y hacía skip): para cada cerveza del catálogo, si existe y su `abv`/`style`
está en null y el catálogo lo trae, lo rellena (sin pisar correcciones). Idempotente
(2ª corrida: 0 completadas). Se completaron los 9 ABV aportados (Águila 4.0, Águila
Light 3.4, Poker 4.0, Club Colombia Roja/Negra/Trigo 4.7, Corona 4.5, Heineken 5.0,
Budweiser 5.0; +3 Cordilleras Negra 6.4). **Cobertura en dev: 23 con ABV · 21 en null
(de 44).** En prod lo corre Edgar.

## Pasada G.3 — Rating propio en el detalle de cerveza

Misma rama `pasada/plan-b-gap`. Solo el **detalle** del catálogo (la lista y el ranking
no se tocan). Dos stats:

- **Tu rating** — `ownBeerRating` (dominio, puro): de los check-ins PROPIOS de esa
  cerveza, el MÁS RECIENTE (fecha de salida desc, desempate por createdAt), no el
  promedio. La opinión actual pesa más que la vieja.
- **El parche** — promedio del grupo + conteo obligatorio ("3.7 · 3 ratings").

Estados (todos verificados ejecutando en dev):
- Nunca la probó → "No la has probado" (nunca cero).
- La tomó sin calificar → "Sin calificar".
- Nadie del grupo la calificó → "Sin calificar" en el lado del parche.
- **Solo la calificaste tú** → colapsa a UNA stat con el label del grupo (dos números
  iguales son redundantes; es el estado normal las primeras semanas). Condición:
  `ratingsCount > 0 && ningún otro usuario la calificó`.

Invariante intacto: solo cuentan check-ins propios de cada usuario (el rating propio
filtra por `session.userId`; el grupo promedia todos, que por construcción pertenecen a
su dueño; etiquetar no acredita). `getBeerDetail` ahora recibe `userId`.

Verificación: **+6 tests** de `ownBeerRating` (incl. el caso clave: dos ratings
distintos → el más reciente; y desempate por createdAt) → **46/46** (los 40 previos sin
tocar). Los 5 estados verificados con Playwright WebKit sobre datos sembrados en dev.
Solo dev.

## Pasada G.2 — Espuma uniforme, búsqueda sin acentos, deuda del plan-B

Misma rama `pasada/plan-b-gap`. Merge a `main` sigue bloqueado hasta autorización.

1. **Espuma uniforme (corrige B.1).** El criterio es uniformidad, no ausencia: si una
   fila la tiene, todas. **Había DOS implementaciones** del festón: la clase CSS
   `.foam-scallop`/`.foam` (sin uso) y `radial-gradient` inline (BeerHero + filas). Se
   consolidó en **un** componente `FoamStrip` (`sm`/`md`) y se **eliminaron** las clases
   CSS muertas. Se puso la espuma en TODAS las filas de las listas de cerveza (detalle
   dueño `OwnerCheckInList`, detalle solo-lectura, y filas del feed multi-cerveza
   `CompactRow`); `BeerHero` (una sola cerveza) la conserva (`md`).
2. **Búsqueda insensible a acentos.** `normalizeKey` ahora quita diacríticos
   (`NFD` + eliminar marcas), tanto al **guardar** como al **buscar** (las 3 búsquedas
   pasan a consultar `nameKey`/`breweryKey` con `normalizeKey(query)`). `aguila`,
   `Águila`, `AGUILA` y `Póker`/`poker` coinciden. La recomputación de claves
   (`scripts/recompute-beer-keys.ts`) **chequea colisiones ANTES de aplicar**: en dev
   fueron 18 claves, **0 colisiones** (nadie viola el `@@unique`). El nombre visible no
   cambia. Corrido en dev; en prod lo corre Edgar (dry-run primero).
3. **"Poker" → "Póker".** El nombre oficial lleva tilde. El seed corrige el `name`
   visible de existentes (el catálogo es autoridad; el name no es editable por el
   usuario) sin cambiar la clave. Revisado el resto del catálogo: la única con tilde
   faltante era Poker (Águila, Costeña/Costeñita, Bogotá, Cajicá, Bacatá, Clásica ya la
   tenían). Con la búsqueda sin acentos, `poker` sigue encontrándola.
4. **Deuda del plan-B (documentada, sin revertir).** El gap inferior resultó ser
   **`statusBarStyle: black-translucent`** (G.1, confirmado por Edgar). El refactor del
   plan-B —barra de `fixed` a **flujo**, scroll en **contenedor interno** (`.pb-scroll`),
   **`100dvh`**— **NO era necesario**: el cotizador usa `fixed` + scroll de documento +
   sin `dvh` y no tiene gap. **No se revierte** (está verificado y funcionando), pero
   queda anotado que **esa arquitectura de scroll es incidental, no requerida** — nadie
   debe construir sobre ella asumiendo que resuelve el gap (lo resolvió el status bar).

Verificación: **40/40 tests** (los 39 previos + 1 de acentos), tsc/build OK, Playwright
WebKit 8/8 (búsqueda `aguila`/`AGUILA`/`Águila`/`poker`/`Póker`/`bogota`; espuma
uniforme en detalle y feed). Recomputación de claves corrida en dev con chequeo de
colisiones reportado. Solo dev.

## Pasada B.1 — Correcciones de gate + catálogo semilla (misma rama plan-B)

Hallazgos del gate de Edgar en el preview. Misma rama `pasada/plan-b-gap`; merge a
`main` sigue bloqueado hasta autorización explícita.

1. **Regresión del "+" (bloqueador).** Diagnóstico por medición: el "+" sobresale 9px
   sobre la barra, pero NINGÚN ancestro lo recorta (`clippers: []` — no es `overflow`
   del DOM). Al pasar la barra de `position:fixed; z-index:40` a flujo plano perdió su
   contexto de apilado, y en iOS el hermano `.pb-scroll` (`overflow:auto` → capa de
   composición) **ocluye** el saliente. Fix: `nav { position:relative; z-index:2 }` —
   la barra sigue en flujo (no se mueve) pero pinta por ENCIMA del scroller. Verificado
   AMBOS bordes del "+" (top 771 ≥ 0, bottom 827 ≤ 844; saliente 9px intacto) —
   corrige la aserción de la pasada anterior, que medía solo el borde inferior. La
   oclusión iOS no se reproduce en Playwright → la confirma Edgar en el preview.
2. **"Falta tú" → "Faltas tú".** Helper `pendingLabel` (format.ts) con conjugación:
   1 y soy yo → "Faltas tú"; 1 y es otro → "Falta Caro"; varios → lista natural
   "Faltan tú y Caro" / "Faltan Edgar, Caro y Dani" (yo primero). Usado en feed y
   detalle. Verificado.
3. **Franja de espuma.** Inventario: se **queda** en `SessionCard` BeerHero (bloque
   protagonista del feed) y en el festón del header de onboarding (`RegisterWizard`,
   decorativo). Se **quitó** de las listas del detalle (`OwnerCheckInList` y la lista de
   solo-lectura), donde solo la primera fila la tenía → filas compactas uniformes. Nota:
   `.foam` / `.foam-scallop` en globals.css están definidas pero SIN USO (CSS muerto del
   diseño original).
4. **Catálogo semilla.** `scripts/seed-catalog.ts` (dry-run por defecto, `--apply`),
   idempotente por `nameKey`/`breweryKey` (misma lógica que `createBeer`), `createdById`
   = Edgar. 36 entradas (Bavaria, BBC, importadas, 3 Cordilleras); SIN artesanales de
   carta rotativa. **ABV null salvo verificados** (Club Colombia Dorada 4.7, Águila Cero
   0.4, BBC Macondo 5.7, 3 Cordilleras del sitio oficial); no se inventan porcentajes.
   Corrido en dev (idempotente: 2ª corrida 0 creadas); en prod lo corre Edgar. Búsquedas
   verificadas ("clu" → las 4 Club Colombia; "bbc" → las de BBC).
   - **Editar `abv`/`style` desde el detalle** (`updateBeerFields` + `BeerFieldsEditor`):
     para completar vacíos o corregir, sin historial. Da salida a la política de ABV null
     (si no, los null serían permanentes). Verificado: editar Costeñita → `abv=4.2`
     persiste y se muestra.

Verificación: **39/39 tests** (sin tocar), tsc/build OK, Playwright WebKit 12/13 (el 1
que falló era timing del refresh; el feature quedó probado con captura + DB). Solo dev.

## Pasada plan-B — Gap inferior iOS: refactor de layout (rama)

Primera pasada bajo el **nuevo flujo de ramas** (ver CLAUDE.md): va en
`pasada/plan-b-gap`, se verifica en el preview de Vercel, y NO se mergea a `main`
sin autorización explícita de Edgar tras el gate.

**Dato nuevo de Edgar:** la `box-shadow` de P.6 SÍ redujo el gap (no lo dejó igual).
→ hay DOS contribuciones. Identificadas por medición (Playwright, geometría del
layout) antes de tocar:
- **(a) `BottomNav` con `position: fixed; bottom:0`** no sigue la barra dinámica de
  iOS → franja bajo la barra. La box-shadow la pintaba del color de la barra (por eso
  quitarla agrandó el hueco).
- **(b) `html` sin `min-height`** (medido `0px`): solo `body`/`app-shell` eran
  `100dvh`, el root no pintaba hasta el fondo → franja de raíz que la box-shadow
  (bloque fijo anclado a la nav) nunca alcanzó. Si el plan B solo arreglaba (a), (b)
  persistía.

**Refactor (cubre ambas):**
- (b) `html { min-height: 100dvh; background: noche }` → el root pinta a fondo completo.
- (a) `.pb-nav` pasa a columna flex de `100dvh` con `.pb-scroll` (`flex:1; overflow-y:
  auto`) para el contenido y `BottomNav` en FLUJO al final (`flex:none`, ya no
  `position:fixed`). La barra se ancla al fondo real del contenedor `100dvh`, que sí
  sigue el viewport dinámico. Se envolvió el contenido en `.pb-scroll` en las **8**
  pantallas de pestaña (feed, catálogo, perfil, invitar + sus 4 skeletons), una por una
  (estructura no uniforme: headers sticky, `AppHeader` hermano vs `main` único). Se
  eliminó la `box-shadow` muerta de P.6.

**Verificado (Chromium y WebKit, 18/18):** nav anclada al fondo (bottom=vh); contenido
scrollea SOLO dentro de `.pb-scroll` (el documento no scrollea); al scrollear la nav
sigue abajo y los headers `sticky` siguen arriba; botón "+" completo (bottom 827 <
844); sin scroll horizontal. **Code NO puede verificar el síntoma iOS** (barras
dinámicas) → lo confirma Edgar en el preview, con la barra visible y oculta, probando
los cinco botones en su zona baja. Sin migración.

## Pasada P.6 — Gap inferior en PWA standalone (iOS)

### Diagnóstico (antes de tocar)

- El contenedor raíz **ya usa `100dvh`** (`body` y `.app-shell` en globals.css;
  `sessions/new`), **no `vh`** → el sospechoso principal del spec (vh sin descontar
  barras dinámicas) **no aplica**: ya está migrado.
- `viewport-fit=cover` **está** (`viewport.viewportFit` en el root layout) y **no hay
  `height` fijo** compitiendo (solo `min-height: 100dvh`).
- La barra inferior es **`position: fixed; left/right/bottom: 0`** (fuera del flujo del
  `.app-shell`); su padding-bottom es `env(safe-area-inset-bottom)+14px` (solo el home
  indicator). Único `vh` restante: `88vh` en `BeerSheet` (una hoja, no la barra).

**Causa (razonada, no reproducible en Playwright):** como el contenedor ya es `dvh`,
el gap no viene de `vh`. Es el `position: fixed; bottom:0` contra la barra dinámica de
iOS en standalone: el ancla no la sigue y por debajo asoma el fondo `noche` del body;
`env(safe-area-inset-bottom)` no cubre esa barra (solo el home indicator).

### Fix

- **dvh vs svh:** se **mantiene `dvh`** en el contenedor. `svh` dejaría un margen fijo
  cuando la barra está oculta (peor para layout a sangre); `dvh` sigue el área visible.
- **Barra:** `BottomNav` gana `box-shadow: 0 100px 0 100px #181209` — extiende el color
  de la barra ~200px hacia ABAJO (solo paint, no layout). Rellena cualquier hueco con el
  color de la barra en todo estado del viewport; cuando no hay gap queda fuera de
  pantalla. No toca el botón "+" (sobresale hacia arriba) ni genera scroll horizontal.
- `88vh` → `88dvh` en `BeerSheet` (alinear el último `vh` de pantalla completa).

### Verificación

- **Code NO puede verificar el síntoma**: Playwright no simula las barras dinámicas de
  iOS (viewport fijo). Esto lo confirma **Edgar en iPhone standalone**, haciendo scroll
  arriba/abajo para forzar la barra.
- Lo que Code SÍ verificó (Chromium **y** WebKit, 8/8): el cambio no rompe el layout, el
  botón "+" sigue completo (bottom 827 < viewport 844), la nav llega al bottom, y la
  box-shadow **no** genera scroll horizontal. 28/28 tests, tsc/build OK.

## Pasada P.5 — Gap del feed vacío + pendientes

### 1 · Arreglo del salto del feed vacío

`EmptyFeed` dejó de centrarse por viewport (`minHeight:60vh; justify-content:center`)
y pasó a top-align: un contenedor externo con el MISMO arranque que el `<main>` real
y el del skeleton (`padding:"16px 18px 0"` → su primer hijo cae en la misma Y que la
primera tarjeta del skeleton) y un offset visual FIJO adentro (`paddingTop:56`). Al
no depender del viewport, ya no se re-centra cuando cargan las fuentes.

Medido con Playwright WebKit (misma medición de P.4, carga fría, fuentes +700ms):
**skeleton 77 / contenido 77 / estable 77 → salto 0px, CLS 0** (antes 77/134/116). El
estado vacío sigue con offset generoso (no pegado al header), verificado por captura.

### 2 · Pendientes

**(a) Padding inferior:** `.pb-nav` bajó de 76px a **73px** (la barra mide 73:
64 + 9 del "+"). Verificado en WebKit: el botón "+" no se corta (bottom 827 <
viewport 844, `cutOff:false`).

**(b) "Último uso" de passkeys (propuesta, NO implementada):** el plugin no guarda
`lastUsed`; su schema de `passkey` no trae `updatedAt`. PERO en `verify-authentication`
hace `adapter.update({ update: { counter } })` en **cada** login (verificado en el
dist). Por eso la vía mínima **sin tocar el plugin** sería agregar
`updatedAt DateTime @updatedAt` al modelo `Passkey` (una migración): Prisma lo refresca
en cada UPDATE que dispara el plugin al autenticar → `updatedAt` ≈ último uso, y se
mostraría como "Usada …". Caveats: también se refresca al renombrar la passkey
(endpoint `update-passkey`, raro) y es "última escritura", no estrictamente "última
autenticación". Un campo dedicado `lastUsedAt` escrito SOLO al autenticar requeriría
un hook/envoltura sobre el endpoint del plugin (Better Auth no expone databaseHooks
para modelos de plugin) → no vale la pena; tema cerrado salvo que Edgar quiera el
`updatedAt` aproximado.

### 3 · Remediación del secreto (confirmada)

`.env.prod` fuera de `git status`; `.gitignore` ignora `.env` y `.env.*` con
`!.env.example`; solo `.env.example` queda tracked. El commit de remediación
(`14d2e96`) está en `origin/main`. La historia **no** se reescribió (decisión de
Edgar: repo ahora privado + password de Neon rotada), así que el blob del secreto
sigue en la historia de `7f24267` pero apunta a una credencial ya muerta.

## Pasada P.4 — Borrar a Ana, gestión de passkeys, diagnóstico del gap

Todo el trabajo corrió contra **dev** (`ep-nameless-glade`); prod lo corre Edgar.

### 1 · Borrar a Ana preservando integridad (+ hallazgo del catálogo)

`scripts/delete-user-reassign-invites.ts` (dry-run por defecto, ids por argumento).
Orden en UNA transacción: reasignar a Edgar lo que NO debe morir con Ana, luego
borrarla en cascada.

**Hallazgo por ejecución (no asumido):** el primer `--apply` falló con
`check_in_beerId_fkey RestrictViolation`. Causa: `Beer.createdById` tiene
`onDelete: Cascade`, así que borrar a Ana intentaba borrar las **4 cervezas que
creó** — pero el catálogo es **compartido** (Club Colombia tiene 3 check-ins del
grupo) y `CheckIn.beer` es `Restrict`. Se corrigió **reasignando también las
cervezas a Edgar** (como las invitaciones), en la misma transacción → el catálogo
se preserva. Es exactamente el tipo de "por construcción no aplica pero existía por
otra puerta" que el proyecto vigila.

Verificado en dev: Ana borrada; **5 invitaciones ahora de Edgar** (NZFX55A conserva
`usedById`=Edgar); **4 cervezas preservadas** (ahora de Edgar); 0 salidas/check-ins/
etiquetas de Ana; Edgar intacto (passkey+email); feed de Edgar vacío. UI (login Beto,
WebKit): feed muestra estado vacío, leaderboard sin Ana. En **prod lo corre Edgar**
con el mismo script + `--apply`.

### 2 · Ver y revocar passkeys

Perfil (`AccountAccess` + `deletePasskey` en `actions/account.ts`):
- **Lista**: nombre del autenticador vía `getAuthenticatorName(aaguid)` (p.ej. la
  passkey de Edgar → "Apple Passwords"), badge SINCRONIZADA (`backedUp`), fecha de
  creación (`createdAt`). **"Último uso" NO existe**: el plugin no guarda `lastUsed`
  ni `updatedAt` en `Passkey` (verificado); solo `counter` + `createdAt`. Se reporta.
- **Eliminar**: Server Action con `auth.api.deletePasskey`.
- **Guardarraíl (server-authoritative)**: no se puede borrar la ÚNICA passkey si NO
  hay contraseña NI correo de recuperación (dejaría sin acceso). Se muestra el motivo
  (candado + texto), no solo un botón deshabilitado. Verificado por ejecución
  (Chromium + authenticator virtual, 9/9): última bloqueada → agregar 2ª desbloquea →
  eliminar → vuelve a bloquearse → agregar correo desbloquea. Render en WebKit ✓.
- "Agregar passkey a este dispositivo" se queda.

### 3 · El gap al entrar (DIAGNÓSTICO — medido, sin tocar código aún)

Medido con Playwright WebKit (viewport iPhone), posición Y del primer elemento del
contenido en carga fría:

| momento | feed poblado | feed VACÍO |
|---|---|---|
| skeleton mostrado | 77 | 77 |
| contenido cargado | 77 | 134 |
| estable (fuentes) | 77 | 116 |

- **Feed poblado: 0px de salto.** Header 61px estable en ambos, CLS 0.
- **Hipótesis descartadas por medición:** sprite (está `position:absolute; 0×0` →
  no ocupa layout); fuentes en el caso poblado (next/font aplica `size-adjust`, CLS 0,
  Y constante); montaje del header (server-rendered, 61px en skeleton y real).
- **Causa medida (feed vacío, que es el estado de Edgar hoy):** el skeleton
  (`FeedLoading`) siempre pinta **2 tarjetas pegadas arriba** (primer elemento en 77),
  pero `EmptyFeed` va **centrado** (`minHeight:60vh; justify-content:center`) → su
  primer elemento cae en 134 = **salto de 57px hacia abajo**. Además, al cargar Syne
  el bloque centrado **se re-centra** (134→116, otros 18px). Es la hipótesis
  "skeleton y contenido con alturas distintas", amplificada por el centrado vertical.
- **Fix propuesto (pendiente de OK de Edgar):** que el estado vacío no dependa de un
  centrado por viewport que se re-centra (top-align con offset fijo, o que el skeleton
  del feed no asuma 2 tarjetas), para que skeleton→contenido no salte. No se tocó
  código: el spec pide reportar la causa medida antes de arreglar. Si Edgar ve el gap
  en un feed POBLADO, sería el safe-area del device (inset=0 en Playwright, no
  reproducible en navegador) → haría falta un video del iPhone.

## Pasada P.2 — Usuario duplicado (huérfano) + separación de entornos

### 1 · El duplicado era un HUÉRFANO de registro no-atómico (no presentación)

Diagnóstico por consulta a la DB (dev, snapshot de prod): 2 filas "Edgar".
- `OL0Rg10p…`: email null, **0 passkeys, 0 accounts**, sin invitación reclamada,
  0 check-ins → huérfano.
- `4Q0mC1PM…`: passkey=1, invitación `NZFX55A` reclamada, email de recuperación
  puesto → cuenta real (creada 25 min después). Ambas avatar `oso-andino`, 0
  check-ins → el leaderboard las mostraba como "Edgar" + "Tú".

**Causa raíz:** el registro passkey-first creaba el usuario en `resolveUser` (antes
del prompt de FaceID). En producción el `rpID` no coincidía con el origen (era
`localhost` porque `BETTER_AUTH_URL` no era el dominio canónico — el riesgo marcado
en la Pasada P), así que `navigator.credentials.create()` fallaba en el navegador,
`verify-registration` nunca corría y quedaba la fila sin passkey ni invitación.

**Arreglo (a) — registro atómico:** `resolveUser` ya **no crea** el usuario; solo
genera el id (= userHandle de WebAuthn). El usuario se crea en `afterVerification`
(que corre SOLO si la passkey se verificó) junto con la reclamación atómica de la
invitación. Si la ceremonia falla, no queda NADA. Verificado por ejecución
(Playwright Chromium): happy path crea usuario+passkey+invitación; fallo simulado
(`credentials.create` rechaza, como el rpID mismatch) → **0 usuarios, invitación
libre**.

**Arreglo (b) — limpieza:** `scripts/clean-passkey-orphans.ts` (dry-run por defecto)
borra usuarios sin passkey, sin account, sin invitación, sin salidas ni etiquetas.
Corrido en **dev** (borró el huérfano). En **prod lo corre Edgar** (Code no toca prod).

### 2 · Separación de entornos (Neon branching)

Dos ramas de Neon: principal = producción (`ep-holy-rain`), dev = branch
(`ep-nameless-glade`). Vercel: Production→principal, Preview→dev. El `.env` local
apunta a **dev**. Regla nueva en CLAUDE.md: **toda verificación de Code corre contra
dev, nunca contra producción**; config de Neon/Vercel la maneja Edgar. La rama la
creó Edgar y pegó las URLs.

### 3 · Cuentas de prueba

- **En dev**: `ana@`/`beto@` con contraseña cambiada (ya no `***REDACTED***`, que está en
  el repo público). Verificado por ejecución: la nueva entra, la vieja no. Las
  contraseñas se le pasaron a Edgar por chat.
- **En prod (decisión de Edgar, sin ejecutar):**
  - **Beto**: sin check-ins, sin salidas, sin invitaciones creadas; solo aparece
    etiquetado en 1 salida (esa etiqueta se borra con él). Seguro de borrar.
  - **Ana**: 5 check-ins = **6 unidades**; dueña de 3 salidas ("Andrés Carne de Res",
    "Bolirana Villa del prado", "Mono Bandido"); creó 5 invitaciones (una, `NZFX55A`,
    es la que usó el Edgar real). Borrarla arrastra esas 3 salidas, 5 check-ins, 3
    etiquetas y sus 5 invitaciones. **No se tocó**: Edgar decide entre (a) borrar,
    (b) renombrar a una cuenta real conservando el historial, o (c) dejarla.

## Pasada P.1 — Selector de avatar (dos bugs, verificados en WebKit)

Reportado por Edgar en iPhone real (PWA standalone). Ambos en `AvatarPicker`
(un solo archivo → aplica también al perfil).

1. **Doble selección.** No era estado (el E2E confirmó siempre 1 celda `selected`):
   "Anónimo" tenía un `border: 1px dashed` **permanente** que se leía como una
   segunda selección junto al avatar elegido. Se quitó ese borde; Anónimo es una
   celda más (fondo oscuro + símbolo). El anillo es el **único** indicador → exacto
   una marcada.
2. **Anillo incompleto.** Se dibujaba con `outline: 3px solid` + `outlineOffset` sobre
   el `<svg>`. En iOS/WebKit el outline sobre un replaced element con offset+radius
   se pinta incompleto (solo lados), y además un `outline` lo recorta cualquier
   ancestro con `overflow` (el picker vive dentro de un `overflowY:auto` en un paso).
   Se cambió por un **borde en un contenedor** (dentro del border-box): siempre
   reserva 3px (transparente si no está elegido, para que el layout no salte) +
   `padding` como separación. Se pinta completo y no lo recorta ningún overflow.

Verificado con **Playwright WebKit** (viewport tipo iPhone): eligiendo Armadillo →
Capibara → Cóndor → Anónimo en secuencia, siempre **exactamente 1 celda con anillo
completo (4 lados ámbar), 0 anillos parciales, 0 bordes punteados** (16/16), más
captura del anillo cerrado. `domain.ts` intacto, 28/28 tests, `tsc`/`build` OK.

## Pasada P — Passkeys (registro sin contraseña)

Registro sin correo ni contraseña: código → nombre → avatar → passkey (FaceID).
El correo pasa a ser recuperación **opcional**. Solo toca autenticación. `domain.ts`
INTACTO; los 28 tests pasan sin tocarse.

### Verificado POR EJECUCIÓN antes de construir (condición a/b de Edgar)

- El plugin passkey **no viene** en `better-auth`; es `@better-auth/passkey@1.7.2`
  (trae `@simplewebauthn/*`).
- Better Auth 1.7 **fija `email` como `required:true, unique:true`** en su core
  (`@better-auth/core/.../get-tables.mjs`). `signUpEmail` con email vacío →
  `400 VALIDATION_ERROR`. Solo el *nombre* del campo es configurable, no su
  obligatoriedad.
- El plugin passkey **NO crea usuarios**: con `requireSession:false` sin
  `resolveUser` lanza `RESOLVE_USER_REQUIRED`. Adjunta la passkey a un usuario que
  uno provee. Por eso el create directo es necesario (no sobra).
- Un signup normal crea: `user` + `account`(providerId `credential`, con password)
  + `authSession`. Un usuario **passkey-only NO lleva `account`** (la credencial es
  la passkey, en la tabla `passkey`); la sesión la emite el plugin.
- Un usuario con `email = null` (creado vía `internalAdapter.createUser`, que **sí
  acepta null**): obtiene sesión, **sobrevive a `getSession`** (probado con cookie
  firmada real), puede agregar correo después y puede agregar contraseña. Todo
  ejecutado, no deducido.

### Cómo quedó (Opción 1, aprobada por Edgar)

- **`User.email` nullable** (migración `passkey_and_nullable_email`:
  `ALTER COLUMN email DROP NOT NULL` + tabla `passkey`). Sin correos sintéticos.
  Postgres permite varios `NULL` bajo `@unique`.
- **Alta passkey-first** (`src/lib/auth.ts`): `passkey({ registration: {
  requireSession:false, resolveUser, afterVerification } })`.
  - `resolveUser` (corre en generate-options, antes de FaceID): valida la
    invitación y crea el usuario passkey-only con `internalAdapter.createUser`
    (`email:null`). Debe existir para que la passkey (FK) y la sesión lo referencien.
  - `afterVerification` (tras verificar la passkey, antes de persistir/crear sesión):
    **reclama la invitación** de forma atómica (`updateMany usedById:null`); si
    alguien la usó en el intermedio, **revierte** el usuario y aborta.
  - El cliente manda `addPasskey({ context: JSON{code,name,avatar}, authenticator
    Attachment:"platform", createSession:true })`; `createSession` deja la cookie.
- **Correo de recuperación** (`actions/account.ts` → `addRecoveryEmail`): Better
  Auth **bloquea** fijar email vía `updateUser` (`EMAIL_CAN_NOT_BE_UPDATED`,
  verificado), así que se hace con `prisma.user.update` (hay sesión = ownership, y
  el grupo ya va sin verificación de correo). Se ofrece **visible tras el registro**
  (paso "¿Y si cambias de teléfono?") y desde el perfil.
- **Contraseña alterna** (`setAccountPassword` → `auth.api.setPassword`): crea el
  `account` credential. Requiere correo primero (el login por contraseña lo usa).
- **Pieza 3 — método alterno intacto:** login con passkey primero + enlace discreto
  "Otra forma de entrar" → correo+contraseña (los seed `ana@`/`beto@` entran igual).
  Un usuario puede tener **passkey Y contraseña** a la vez (verificado). El registro
  también ofrece "correo y contraseña" como alterno; si el dispositivo no soporta
  WebAuthn, ese método es el default.
- **Login:** botón passkey explícito + **autofill condicional** armado en mount
  (`signIn.passkey({ autoFill:true })`, guardado con `isConditionalMediation
  Available()` — la API existe en 1.7.2, verificado).

### rpID / origin (crítico)

`rpID`/`origin` se derivan de `BETTER_AUTH_URL` (hostname/origin), con override
`PASSKEY_RP_ID` / `PASSKEY_ORIGIN`. En producción `BETTER_AUTH_URL` **debe** ser el
dominio canónico `https://fria-day.vercel.app` (no una URL de deployment
`fria-xxxx-*.vercel.app`): una passkey registrada bajo un rpID de deployment queda
inservible. En local deriva a `localhost` / `http://localhost:3000`.

### Trade-off conocido — usuarios huérfanos al cancelar FaceID

El usuario se crea en `resolveUser` (antes del prompt de FaceID) porque la passkey y
la sesión necesitan un id existente. Si se cancela FaceID, queda un usuario
`email=null`, sin passkey y sin account, **sin credenciales** (no puede entrar) y la
invitación **NO** se consume (se reclama en `afterVerification`). Se prefirió esto a
quemar invitaciones. Para un grupo cerrado el acumulado es despreciable; si molesta,
se limpia con un job o se agrega un `pendingUserId` a la invitación. Documentado, no
oculto.

### Verificación (toda por ejecución)

- **Playwright — Chromium con authenticator virtual** (WebAuthn CDP): alta passkey
  sin correo → feed; login con passkey; login `ana@` correo+contraseña. Estado en DB:
  usuario `email=null`, 1 passkey (`internal`), **0 accounts**, invitación reclamada.
- **Playwright — WebKit (motor de Safari)**: `/` sin sesión → `/login` **sin bucle**;
  login renderiza; **fallback correo+contraseña funciona**; `/register` renderiza;
  botón passkey presente. (WebKit no soporta el authenticator virtual de CDP, así que
  la ceremonia real en WebKit no se automatiza — ver abajo.)
- **Perfil (UI real, Chromium)**: agregar correo de recuperación → agregar contraseña
  → logout → login con ese correo+contraseña. 4/4.
- Camino de error de `resolveUser` (código inválido): lanza mensaje claro, **no crea
  huérfano**.
- `tsc` limpio, **28/28 tests sin tocar**, `next build` OK.
- **Playwright queda en devDependencies** (fue la única herramienta con verificación
  confiable en A.2/A.4). `chromium` + `webkit` instalados.

### Lo que Code NO puede verificar (declarado, no dado por bueno)

**Passkey real con FaceID en la PWA standalone en iPhone.** El authenticator virtual
de Chromium prueba el mecanismo WebAuthn, pero no el comportamiento de iOS/WebKit en
una app añadida a la pantalla de inicio (donde `navigator.share()` ya nos falló). Eso
lo prueba **Edgar** en su iPhone. El fallback correo+contraseña existe justo por si
la passkey falla ahí.

## Pasada P · TAREA 0 — El bucle de Safari (diagnóstico documentado)

**Síntoma:** en Safari (incluida la PWA instalada) `/` entraba en un bucle
`/ ↔ /login` sin fin; borrar los datos del sitio NO lo curaba. En Brave nunca
pasó.

**Causa raíz — desacuerdo proxy vs. página sobre una cookie *presente pero
inválida*:**
- El proxy usaba `getSessionCookie(req)`, que solo mira **presencia** de la
  cookie (no consulta la DB). Con una cookie presente rebotaba `/login → /`
  creyendo que había sesión.
- Cada página valida de verdad con `auth.api.getSession()`. Con una cookie
  inválida devuelve `null` → `requireUser()` rebota `/ → /login`.
- Presencia ≠ validez → ping-pong infinito. El bug es **agnóstico al navegador**:
  se dispara en CUALQUIER cliente que presente una cookie presente-pero-inválida.

**Por qué Brave pasaba y Safari no (la asimetría):** no es un bug de motor
(WebKit vs Chromium); es una diferencia de **estado de la cookie** y de dónde la
guarda cada uno:
- En Brave, Edgar no tenía una cookie presente-pero-inválida (o no había cookie,
  o la sesión era válida) → proxy y página concordaban → sin bucle.
- En Safari había una `__Secure-better-auth.session_token` vieja cuya sesión ya
  no validaba en el servidor (expirada / de antes de un redeploy). Y "Borrar
  datos del sitio" en Safari **no** borró la cookie de la **PWA instalada**: iOS
  guarda el almacenamiento de una web app añadida a la pantalla de inicio en un
  scope separado del de las pestañas de Safari, así que la cookie inválida
  sobrevivió al borrado y cada apertura re-entraba al bucle. Esa asimetría era la
  pista: sin cookie no hay bucle, con la cookie vieja sí.

**Qué cambió (archivo y línea):**
- `src/proxy.ts`: se **eliminó** la rama `if (hasSession && isPublic) return
  redirect("/")` (el rebote por mera presencia). Queda un único guardia:
  `if (!hasSession && !isPublic) redirect("/login")` y si no, `NextResponse.next()`.
- `src/app/(auth)/layout.tsx`: el salto de conveniencia "ya logueado → `/`" ahora
  usa `getCurrentUser()` (**validación real**, no presencia). Con cookie inválida
  devuelve `null` → se renderiza el login, sin rebote → sin bucle.

**Es arreglo de raíz, no un rodeo:** se atacó la causa (el proxy ya no confía en
la presencia para rebotar), así que el bucle desaparece para todo navegador y
todo estado de cookie. Safari con la cookie vieja ahora va `/ → /login`, renderiza,
Edgar inicia sesión y la cookie nueva reemplaza la inválida. **No** se relajó
`Secure`, `SameSite` ni `Domain` de la cookie (siguen `HttpOnly; Secure;
SameSite=Lax`, host-only), y **no** se sacó ninguna ruta de la protección del
proxy (el matcher no se tocó en ese commit; la rama eliminada era una comodidad,
no una protección). Verificado por curl (4 estados de cookie) y Playwright.
Commit `75a3b52`.

## Pasada A.2 — Bugs visuales y consolidación

`domain.ts` se tocó SOLO para el punto 5. Los 22 tests previos pasan sin cambios;
+6 nuevos → 28/28.

1. **Logo roto (causa raíz)**: no era la ruta ni el caché. El **matcher del proxy**
   excluía `_next`, `favicon.ico`, `manifest.webmanifest`, `icons/` — pero NO
   `/friaday-icon.png`. En pantallas sin sesión (`/login`, onboarding) el proxy
   redirigía la imagen a `/login` → `<img>` recibía HTML → imagen rota. En el feed
   (con sesión) cargaba. Fix: el matcher ahora excluye CUALQUIER archivo con
   extensión (`.*\\..*`). Verificado por curl: `/friaday-icon.png` sin cookie →
   `200 image/png` (antes 307→/login), y `/` sigue protegido.
2. **Safe area**: `env(safe-area-inset-top)` en todos los headers (AppHeader,
   BackHeader, catálogo, perfil, invitar, onboarding, login); `inset-bottom` ya
   estaba en la barra inferior y las hojas. (`viewport-fit=cover` ya estaba.)
   Edgar verifica en iPhone standalone.
3. **Campos que desbordan**: `.field` con `max-width/min-width`; `input[type=date]`
   con `-webkit-appearance:none`. El avatar de "Con quién" ahora va en una caja de
   tamaño constante (borde transparente si no está seleccionado) para que el anillo
   no cambie el layout ni se salga. Edgar verifica en iPhone.
4. **Aviso de deshacer**: 6 s → 8 s.
5. **Consolidación (dominio)**: al agregar un check-in con la MISMA `beerId` y el
   MISMO `format` que uno existente, se suma la cantidad en vez de crear fila. El
   rating existente nunca se sobrescribe (para eso está `updateCheckIn`); si el
   existente es null y el nuevo trae rating, se toma el nuevo. Formato distinto =
   check-in aparte. Funciones puras `planCheckInAdd` / `consolidateNewCheckIns` /
   `mergeCheckInRating` en `domain.ts`, con 6 tests. Aplica en `createSession`,
   `addCheckIn` (detalle + quick-add) y en la lista local de nueva salida. **No se
   migran datos existentes** (las dos filas de Club en "Bolirana" quedan). Nota: el
   "deshacer" de un borrado re-usa `addCheckIn`, así que restaurar un check-in
   borrado también consolida si ya existe uno igual — solo afecta a los datos
   legados con filas duplicadas; para datos nuevos no hay duplicados que fusionar.
6. **Invitaciones**: la lista muestra SOLO códigos disponibles (sin usar y sin
   expirar). El botón Compartir (`navigator.share` + respaldo al portapapeles)
   funciona para CUALQUIER código de la lista, no solo el recién generado.

Verificación: 28/28 tests; consolidación probada contra los datos reales del gate
(Club/Botella 2× + add → merge a 3× sin pisar el rating; formato distinto → create);
logo por curl; invitaciones por curl. El panel de navegador quedó inestable a mitad
de sesión (clics con timeout), así que las pruebas interactivas restantes se
hicieron por curl/script; los puntos 2 y 3 los verifica Edgar en iPhone real.

## Pasada A.1 — Fricción y reversibilidad

`domain.ts` intacto; los 20 tests siguen pasando sin tocarse (+2 tests nuevos de
fecha → 22/22).

1. **Editar rating de un check-in guardado**: acción `updateCheckIn` (solo el
   rating; cantidad/formato quedan). Solo el dueño. Punto de entrada: el detalle
   de la salida, tocando los vasos del check-in (poner y quitar).
2. **Deshacer al quitar un check-in**: la X aplica el borrado de inmediato y
   muestra "Cerveza eliminada · Deshacer" ~6 s; Deshacer restaura con los mismos
   valores (nuevo id). Sin diálogo. Borrar la salida completa SÍ mantiene diálogo
   con conteo. Se distinguen visualmente (X pequeña vs "Borrar" rojo en el header).
3. **Validar el código en el paso 1**: acción `validateInviteCode` (solo verifica:
   existe, no usada, no expirada; NO crea ni reclama). La reclamación atómica se
   queda en el submit final. Código inválido → vuelve al paso 1 con error.
4. **Compartir el código**: botón que llama `navigator.share()`; respaldo = copiar
   al portapapeles con confirmación visible.
5. **Transiciones**: `loading.tsx` por ruta con **esqueletos** que imitan la forma
   real (tarjetas del feed, filas del catálogo, bloques del perfil, etc.). La barra
   inferior marca la pestaña destino al instante con `useLinkStatus` (API vigente
   de Next 16, verificada).
6. **Fecha por defecto**: `todayInputValue()` YA usaba componentes locales
   (`getFullYear/Month/Date`), no `toISOString()`. **No había bug.** Se agregó test
   con hora simulada (20:00 America/Bogota → devuelve el día en curso, no el
   siguiente).
7. **Rastro del borrador**: (a) `CheckInForm.getDraft()` ya se había eliminado en
   el rediseño (no quedaba código muerto). (b) La hoja de cerveza ahora **conserva
   el borrador** al cerrarse sin agregar (toque afuera): al reabrir sigue lo
   elegido; solo un "Agregar" exitoso limpia el estado.
8. **Pie de la tarjeta de salida**: se quitó "N check-ins" (detalle de
   implementación). "N unidades" ocupa esa posición, conservando las **marcas de
   conteo** para el total — distinto del **número-en-chip** de cada cerveza. El
   formato se muestra en cada fila, así dos check-ins de la misma cerveza se leen
   como registros legítimos, no como error.

## Pasada A — Rediseño (solo presentación)

Implementación del entregable de Claude Design (`FriaDay.dc.html`). Solo tocó
presentación salvo la excepción de avatares. `src/lib/domain.ts` y los 20 tests
quedaron INTACTOS (20/20 pasan sin modificarse).

- **Sistema**: tokens `@theme` de Tailwind v4 (nombres semánticos: `noche`,
  `barra`, `barra-alta`, `borde`, `ambar`, `marca`, `espuma`, `botella`, `crema`,
  `tenue`, `tenue-2`, `alerta`), **solo tema oscuro** (sin claro ni toggle).
  Tipografía **Syne + Outfit vía `next/font`** (no el `<link>` de Google del
  mockup). Dos motivos propios: **franja de espuma** (radial-gradient, cero
  imágenes) y **marcas de conteo** para totales. Rating con **vasos que se
  llenan** (no estrellas); "Sin calificar" nunca se dibuja como cero.
- **Sprite**: los 11 avatares + 8 iconos vienen como `<symbol>` del entregable,
  embebidos una sola vez en el layout (`src/components/Sprite.tsx`, generado del
  `.dc.html`), referenciados con `<use href="#av-…">`.
- **Guardarraíles de contraste** (los números del doc estaban mal): `tenue-2` y
  `botella` solo sobre `noche`/`barra`, nunca sobre `barra-alta`. El distintivo
  "te etiquetó" usa `#6FC79C` (verde claro) sobre chip translúcido, no `botella`.
- **AVATARES = única excepción de esquema, y toca algo de servidor.** `User.avatar`
  (migración `user_avatar`). Para persistirlo hizo falta plumbing **mínimo y
  aditivo**: `avatar` como additionalField de Better Auth, leerlo en
  `registerWithInvite`, y una acción nueva `updateAvatar` (editar desde el perfil).
  La regla "no tocar server actions" y "avatar editable" están en tensión; se
  resolvió con lo mínimo indispensable, sin cambiar el comportamiento de las
  acciones existentes. Sin subida de imágenes.
- **Flujo de nueva salida** rediseñado (hoja inferior + lista). La regla de la
  ronda 2 ("no perder el check-in a medio llenar") se preserva por construcción:
  agregar una cerveza es SIEMPRE explícito (hoja "Agregar a la salida" o quick-add
  "+"), y "Guardar salida" con lista vacía → "Agrega al menos una cerveza". No
  queda un formulario inline a medio llenar que se pueda perder.
- **Editar el rating de un check-in YA guardado**: no soportado en esta pasada
  (requeriría una acción `updateCheckIn`, fuera de "no tocar server actions"). El
  rating se fija al agregar (en la hoja) o, en una salida nueva, en la lista local
  antes de guardar. En el detalle, un check-in sin rating muestra "Sin calificar".
  → follow-up.
- **Catálogo**: chip "Mejor calificadas" (orden por defecto) + sección
  "SIN CALIFICAR · N". Se omitieron los tabs "Más tomadas"/"A–Z" (requerían orden
  en servidor; fuera de "solo presentación").
- **Perfil**: se omitió el stat "viernes seguidos" (racha = Pasada B); en su lugar
  "salidas registradas". Se conservó "por estilo" (dato v1 real).
- **Onboarding**: código en un solo campo estilizado (no 7 casillas). La validez
  del código se comprueba en el submit final; si es inválido vuelve al paso 1.
- **Verificación**: navegador Chromium real (más fuerte que jsdom; no hay
  deliverable HTML/JS suelto que meter en jsdom en una app SSR). 20/20 tests sin
  tocar. Build de producción OK. Migraciones aplicadas a Neon.

## Ajustes post-gate visual (ronda 2)

Tres ajustes de fricción encontrados por Edgar en el gate:

1. **Rating opcional.** `CheckIn.rating` pasó a `Int?` (migración
   `rating_optional`). En el formulario, sin estrella seleccionada = sin rating
   (no cero); se puede limpiar tocando la estrella activa o el botón "Limpiar".
   El ranking del grupo (`beerRanking`) promedia SOLO los check-ins con rating: un
   check-in sin calificar no baja el promedio ni suma al conteo. Cerveza sin
   ningún rating → "Sin calificar" (no "0"). Test explícito añadido.
2. **Vocabulario "sesión" → "salida"** en TODO el copy visible (títulos, botones,
   confirmaciones, vacíos, errores). El modelo Prisma `Session` y todo el código
   se quedan igual — solo cambia la interfaz.
3. **No perder el check-in a medio llenar.** Al enviar la salida, si el formulario
   de check-in tiene una cerveza seleccionada y es válido, se agrega
   automáticamente (sin exigir "Agregar a la lista"). Si es inválido, no se envía
   y se muestra el error. Si formulario y lista están vacíos → "Agrega al menos
   una cerveza". Implementado con un handle imperativo (`CheckInForm.getDraft()`)
   que el formulario de crear salida consulta al enviar.
   - **Nota sobre editar salida:** en esta arquitectura los check-ins de una salida
     existente se agregan uno por uno de forma inmediata (botón "Agregar cerveza"
     en el detalle, cada uno su propia acción validada). No hay un "guardar salida"
     por lotes en edición que pueda descartar un check-in pendiente, así que el
     problema del descarte silencioso solo aplica a **crear salida**, donde quedó
     resuelto.

## Stack / versiones

- **Next 16.3.3**, **React 19.2.8**, **Tailwind v4.3.3**, **Better Auth 1.7.2**,
  **Prisma 7.10.0**, **Neon** (Postgres), **zod 4**.
- **TypeScript fijado a 5.9.3** (no TS 7): el registro ya marca TS 7 (compilador
  nativo) como `latest`, pero es demasiado nuevo para este stack. Se usó la línea
  5.x estable para evitar sorpresas.
- **Prisma fijado a 7.10.0** (no 8.0 RC): npm tagea `8.0.0-rc.12` como `latest`.
  El spec pide Prisma 7, así que se usó la 7.x estable.

## Prisma 7 = driver adapters (cambio arquitectónico obligatorio)

Prisma 7 **eliminó `url`/`directUrl` del `datasource` del schema**. La config de
conexión ahora vive en dos lugares:

- `prisma.config.ts` → usado por la CLI de migraciones. Su `datasource.url` apunta
  a **`DIRECT_URL`** (conexión directa de Neon, sin `-pooler`). Carga `.env` con
  `process.loadEnvFile` (en Vercel las vars ya vienen en `process.env`).
- `src/lib/prisma.ts` → el runtime construye `PrismaClient` con un **driver
  adapter** (`@prisma/adapter-pg` + `pg`) usando **`DATABASE_URL`** (conexión
  **pooled** de Neon, con `-pooler`).

Esto no es opcional en Prisma 7. **Dependencias añadidas** por esto:
`@prisma/adapter-pg`, `pg`, `@types/pg` (dev). Se eligió `adapter-pg` (TCP estándar
de node-postgres) sobre `adapter-neon` por ser lo más robusto y con menos piezas
móviles, y funciona igual en local y en Vercel.

## Colisión de nombres `Session`

Better Auth trae su propio modelo `Session` (sesión de auth), que choca con el
modelo de dominio `Session` (la salida a tomar cerveza, que el spec nombra así y es
no negociable). **Se renombró el de Better Auth a `AuthSession`** (tabla
`auth_session`) vía `session: { modelName: "authSession" }`. El modelo de dominio
`Session` queda tal cual (tabla `session`).

## Better Auth 1.7: campo `issuer` en Account

Better Auth 1.7 exige un campo **`issuer`** (requerido) en el modelo `Account`, más
un único compuesto `[issuer, accountId]`. No estaba en el primer schema y rompía la
creación de cuentas. Se añadió en la migración `add_account_issuer`.

## Único case-insensitive de Beer

El spec pide único compuesto `(name, brewery)` case-insensitive. Prisma no puede
expresar un índice funcional `lower(...)` en el schema, y meterlo por SQL crudo
genera *drift* con `migrate dev`. **Decisión:** columnas normalizadas
`nameKey`/`breweryKey` (`lower(trim(collapse-espacios))`) que la app mantiene, con
`@@unique([nameKey, breweryKey], map: "beer_name_brewery_ci")`. 100% nativo de
Prisma, enforced a nivel DB, y sin drift. `createBeer` **devuelve la cerveza
existente** si hay match (en vez de error) para que registrar sea de pocos taps.

## SessionTag: XOR a nivel de aplicación

El spec pide que el constraint "exactamente uno de `taggedUserId` | `freeText`" sea
a nivel de aplicación. Se cumple con zod (`isValidTag`) + `buildTags` en las
actions. A nivel DB se añadió `@@unique([sessionId, taggedUserId])` para que no se
etiquete dos veces al mismo usuario en una sesión (los `NULL` son distintos en
Postgres → se permiten varios `freeText`).

## Registro por invitación (atomicidad)

Flujo en `registerWithInvite`: (1) validar que la invitación existe, no está usada y
no expiró; (2) crear el usuario con Better Auth (`autoSignIn` → deja la cookie);
(3) reclamar la invitación con `updateMany WHERE usedById IS NULL` — si alguien la
usó en el intermedio, se **revierte** el usuario recién creado. Para un grupo chico
las carreras son casi imposibles; se documenta el trade-off.

## Sin verificación de email

Grupo cerrado de amigos, sin proveedor de correo: `requireEmailVerification: false`,
`autoSignIn: true`. El gating real es el **código de invitación**.

## Fechas

`Session.date` representa un día de calendario. Se guarda como **medianoche UTC** del
día elegido y se formatea en **UTC** → todos ven el mismo día sin importar su zona
horaria. Default: hoy (calculado con la fecha local del navegador). Editable para
registro retroactivo.

## Foto = stub (permitido por el spec)

`CheckIn.photoUrl` existe en el schema, pero **no hay subida de fotos ni Vercel Blob
en v1**. El campo queda listo para v2. (El spec permite dejarlo como stub.)

## `middleware` → `proxy`

Next 16 deprecó la convención `middleware`; se usa `src/proxy.ts` exportando
`proxy()`. Protege rutas: sin cookie de sesión → redirige a `/login`; con sesión en
`/login`/`/register` → redirige a `/`. La validez real de la sesión la comprueba
cada página con `getSession()`.

## `tsx` para el seed

Se añadió `tsx` (solo dev) para correr `prisma/seed.ts`. No es dependencia de
runtime.

## ESLint

No se instaló ESLint. Next 16 no corre lint en el build por defecto, y el
`build` script del spec es exacto (`prisma generate && prisma migrate deploy &&
next build`). No hay `vercel.json`.

## Aviso SSL de `pg` (no es error)

`pg` 8.23 imprime un warning: en el futuro tratará `sslmode=require` como
`verify-full`. Hoy conecta bien contra Neon. Se dejaron las URLs de Neon tal cual.
Si un futuro major de `pg` lo rompe, añadir `uselibpqcompat=true` a las URLs. (Aquí
`pg` está fijado a 8.23.)

## ⚠️ Usuarios de prueba del seed (SEGURIDAD)

El repo es **público**. El seed crea 2 usuarios con credenciales **conocidas**:

- `ana@friaday.test` / `***REDACTED***`
- `beto@friaday.test` / `***REDACTED***`

Cualquiera que lea el repo las conoce. **Antes de usar la app en serio con tus
amigos, borra o cambia estos usuarios.** Los secretos reales (`DATABASE_URL`,
`BETTER_AUTH_SECRET`) NO están en el repo: viven solo en `.env` (gitignored) y en
las env vars de Vercel.

## Fuera de alcance (confirmado, sin stubs)

Mapa/geo/Places, badges/logros/rachas, likes/comentarios, push, vista "misma
salida" (el schema ya lo permite calcular a futuro), ponderación por formato. El
`format` **sí** se guarda siempre en cada check-in para poder ponderar en v2 sin
migrar.

## Pasada RU · La ruleta — háptico en iOS (RU.1 §9)

**Confirmado por ejecución/plataforma:** iOS Safari y las PWA en iOS **no soportan la
Vibration API** (`navigator.vibrate` es no-op). El diseño del tablero apoyaba tres de los
siete estados en háptico: la **carga** (pulso ligero cada 300 ms), el **chasquido del pin**
por casilla durante el giro, y el **golpe fuerte del veredicto**. En iPhone esas tres capas
hápticas **no existen**: el giro es mudo (sin vibración y —por decisión del tablero— sin
sonido). En Android/PWA compatibles sí vibran (`navigator.vibrate` se llama igual).

**Compensación visual que ya existe (no hace falta agregar nada para v1):**
- Carga → la **marca de conteo/medidor** se llena y la rueda retrocede: se ve el "tensado".
- Chasquido del pin → el pin **chasquea visualmente** (`fd-rl-tick`) en cada casilla.
- Veredicto → **flash ámbar**, el sector se enciende y el resto baja de opacidad, y el
  nombre entra desde abajo.

**Decisión:** se acepta la pérdida háptica en iOS apoyándose en esas señales visuales. El
**sonido** se evalúa aparte (RU.2 §2): es la vía real para devolver el "chasquido" y el
"golpe" en iPhone, con un control de encendido y default conservador. Ver el reporte de RU.2.

## Compartir en iOS — `navigator.share` exige activación fresca (RU.6.2)

**Confirmado por ejecución:** el fallo intermitente "No se pudo crear la imagen. Revisa tu
conexión" **no era del servidor**. En el log de producción la ruta `/api/share/[id]` devolvía
**200 en 4.7 s** — la imagen se generó bien. Quien abortaba era el **cliente**: `navigator.share()`
en iOS exige *transient user activation* (ventana de ~5 s desde el toque), y los ~4 s de
generación la **agotan** → `share()` rechaza con `NotAllowedError` → el `catch` lo etiquetaba
como fallo de creación/conexión (mentira doble: la imagen existía y la red funcionó). **No había
timeout de cliente** (ni `AbortController`, ni `setTimeout`, ni service worker); el mensaje era
un `catch` que mezclaba tres causas distintas.

**Por qué 4 s es el piso real:** la app ya comprime las fotos en el cliente a **1200px máx, JPEG
q0.82** antes de subir, así que el render **nunca ve** los 4032×3024 de la cámara. Medido: el
render con foto real de 1200px son **~760 ms** (de los cuales ~600 ms son un peaje FIJO por tener
cualquier raster; el resto escala poco con la dimensión). Los ~4 s vienen de Neon frío + auth +
queries + el **fetch remoto del blob** que satori hace dentro del render. **Comprimir más no
ayuda.** Memoria ~343 MB con foto real (bajo el límite de 1024 MB de Hobby).

**Decisión (Edgar, opción C):** (1) **mensajes honestos** — el `catch` distingue respuesta
fallida (`!res.ok`, con submensajes por estado), fallo de red real (único caso donde "revisa tu
conexión" es cierto) y cancelación (`AbortError`, sin error); (2) **rearmar el gesto** — si el
auto-share falla porque la ventana expiró, la imagen ya generada se guarda y se ofrece un botón
**"Compartir imagen"** que la comparte dentro de una activación **fresca** (con "Descargar" como
salida). Regla para futuro: **cualquier flujo generar-luego-compartir en iOS debe separar la
generación lenta del `share()`** con un toque fresco; no se puede `await` varios segundos y luego
llamar a `share()`.

## RU.6 — Compartir desde el detalle, gesto del "+" y entrada de las hojas

**Punto 1 · Compartir no funcionaba desde el detalle del DUEÑO (regresión de DS).** El
`ShareButton` del menú del dueño (`variant="menuItem"`) vivía **dentro** de `{menuOpen && (…)}`
y cerraba el menú al ABRIR (`onAfterOpen → setMenuOpen(false)`): en el mismo commit React
desmontaba el subárbol del menú —con el botón y su portal— así que el `setOpen(true)` se
descartaba y la hoja nunca aparecía. Confirmado por ejecución: feed (`bar`) y detalle de
no-dueño (`icon`) funcionaban; solo el dueño caía en el camino roto. **Fix:** `ShareButton`
recibe `onClose` en vez de `onAfterOpen`; el menú queda abierto **debajo** de la hoja (tapado)
y se cierra cuando la hoja se cierra. Regla: **una hoja disparada desde un menú no debe cerrar
ese menú al abrir** (lo desmonta); cerrarlo al terminar.

**Punto 3 · El hold del "+" elegía dinámica al soltar.** La hoja de dinámicas es inferior:
sus ítems quedaban justo bajo el dedo y `pickDynamic` no filtraba el click sintético del
release. Se aplica el patrón del selector de reacciones (I-1): (1) **guarda de click
sintético** — se ignora el click dentro de `SYNTH_CLICK_MS` (600 ms) de `endedAt`, así soltar
NO elige y un tap posterior sí; (2) **zona muerta inferior** (~64px de respiro) para que
ninguna dinámica quede bajo el dedo (medido: ~19px de aire sobre la última). Verificado con
toques sintéticos: hold abre → soltar no navega → tap elige.

**Punto 4 · Entrada de las hojas (decisión de Edgar: unificar todas).** Hallazgo: **ninguna**
hoja deslizaba al entrar —ni la de bebida, la referencia— todas aparecían de golpe (solo tenían
`transition` para el arrastre). Se agrega un deslizamiento de entrada (100%→0 con easing) a
**todas** (`BeerSheet`, `CommentSheet`, `InviteSheet`, `ShareButton`, `RouletteMenu`) vía un
hook compartido `useSheetEnter(open)` + `sheetEnterTransform(entered, dragY)`. Reusa la MISMA
transición que ya tenían (sin keyframe), y arranca en `translateY(100%)` cambiando a `0` un
frame después de abrir (rAF) — así no pisa el `translateY(dragY)` del gesto (la trampa de
RU.5). Se reinicia al cerrar para volver a deslizar en la próxima apertura.

## Pasada PT — El sistema de puntos (Tanda 1: motor + migración + la cuenta)

Un número personal, acumulativo de por vida, que paga por dejar constancia. Tres reglas del
tablero, codificadas: **nada resta nunca** (los borrados no llaman al motor; el número solo
sube), **tomar más no rinde más** (el techo de 40), **paga el registro, no la visita** (cero
por abrir/deslizar).

**Modelo — ledger, no contador (§4).** `PointEntry(userId, action, points, sessionId?, refId,
createdAt, shownAt?)`. Guarda los puntos YA con el tope aplicado (efectivos) → el total es
`SUM(points)` y el desglose cuadra solo. **Idempotencia por `@@unique([userId, action,
refId])`**; claves por acción: session→sessionId, round/challenge→roundId, photo→photoId,
first_time→beerId (global, se acredita donde se probó por primera vez), rate/drink→checkInId,
comment→commentId, toast→sessionId (un brindis por salida aunque cambie el emoji). `createdAt`
= cuándo ocurrió la acción (topes por día en hora de Bogotá + orden del techo, deterministas
en vivo y en backfill). El motor (`src/lib/award-points.ts`) es best-effort en vivo
(`safeAward`, un fallo no tumba la acción del usuario) y el backfill RECONCILIA.

**El techo de 40 NO se nombra (§3).** Las bebidas (registrar/calificar/primera vez) salen en
la cuenta como UNA línea "Bebidas" con su total; quien tope verá el mismo +40 en dos salidas
sin saber por qué. Verificado: 10 bebidas calificadas → 40; 4 fotos → 45 (no 60).

**La cuenta (§5).** Se dispara al SALIR del detalle de una salida editada, vía un watcher de
`usePathname` en el layout `(app)` (sobrevive al cambio de ruta). El detalle tiene **dos**
salidas reales — botón atrás y gesto de iOS (no tiene barra inferior: esa vive solo en las
pestañas) —; ambas cambian el pathname, así que se detecta la TRANSICIÓN, no el mecanismo (el
gesto de iOS no se puede interceptar). `takeCuenta` lee lo no visto y lo marca visto en el
mismo paso (atómico) → nunca repite. Si la app se cierra dentro del detalle no hay transición:
los puntos quedan `shownAt=null` y salen la próxima vez que se sale de un detalle editado
(nunca al abrir). El +10 de "cumplir un reto" es la excepción: se marca visto al acreditarse
(se muestra en vivo junto al botón, 700ms) y el servidor devuelve `awarded` para mostrarlo solo
la primera vez.

**Migración (§10) — retroactiva.** `scripts/backfill-points.ts` reconstruye el ledger desde los
datos existentes con el mismo motor idempotente (dry-run por defecto; `--apply` escribe). Al
aplicar marca TODO lo reconstruido como visto (es historia; no debe saltar la cuenta al abrir
salidas viejas): solo lo ganado en vivo de ahí en adelante dispara recibo. En **dev**: 39
eventos → **52 entradas · 550 puntos** (dry-run y apply coinciden; re-correr crea 0). Producción
la corre Edgar con el mismo script.

**Presencia (Tanda 2 · §6, §7, §8, §9).** En **Perfil**, arriba del total histórico, una
tarjeta OSCURA con franja de espuma (no el degradado ámbar, para no competir): el número, el
ritmo (puntos por salida) y el próximo hito EN SALIDAS ("Dos salidas más"). Debajo, "De dónde
salieron" despliega el desglose (mayor a menor, bebidas y social colapsadas) y cierra con la
frase de la ética ("N bebidas dieron X. M salidas dieron Y. La app te paga por salir, no por
tomar."). En el **Leaderboard**, el icono de personas abre la hoja de invitar, con una segunda
sección "El círculo": cada quien con sus puntos, **ordenada por antigüedad, NUNCA por puntos**
(por puntos sería el ranking que no es). Los puntos **NO van** en el leaderboard (ranking),
header, tarjeta del feed ni push (§6).

**Hitos (§9) — "sin temporadas, los hitos son el calendario" (del tablero).** SIETE nombrados
(100 La primera marca · 250 Habitual · 500 De la casa · 1.000 Los mil · 2.500 Veterano · 5.000
Los cinco mil · 10.000 Los diez mil) y luego uno cada 5.000. `big` = merece tarjeta (1.000,
5.000, 10.000+). En el perfil: la **barra** del próximo hito + la frase en salidas, y los hitos
alcanzados como **chips en orden** (el único historial). Al **cruzar** un hito, una **línea al
pie de la cuenta** ("Llegaste a Habitual", ámbar, no interrumpe) — el total de vida se calcula
en `takeCuenta` (before→after). **Pendiente (follow-up): la tarjeta del hito** a pantalla completa
para los grandes (variante `kind:"hito"` del share-card, con "Ver" después de cerrar la cuenta).

**Topes "completo" (§3, §7):** el techo de 40 NUNCA se nombra. Los demás sí, en verde y en
pasado, y solo al alcanzarse: al llegar al tope de puntos de fotos sale "Fotos · ya está
completo" en verde (no bloquea; se pueden subir más, solo no dan más puntos). No hay "2 de 3"
en ninguna parte.

## Pasada CI — La invitación entra al círculo

**Caso real:** Edgar invitó a un amigo de otra ciudad; el amigo no había salido con nadie del
parche → su círculo estaba vacío → no veía ninguna salida, ni las de Edgar que le dio el código.

**Cambio:** el círculo (`loadCircle`) pasa a ser la unión de DOS aristas, ambas simétricas y
**NO transitivas**: (1) salieron juntos (`SessionTag`, como en la Pasada C) y (2) uno invitó al
otro (`Invitation.createdById ↔ usedById`). El invitado ve las salidas de quien lo invitó; no
las del resto del parche. Cuando salga con ellos y lo etiqueten, su círculo crece por la vía 1.

**Sin migración:** `Invitation.usedById` ya registra quién redimió cada código (lo escribe
`registerWithInvite` de forma atómica, y siempre lo ha hecho). La arista sale de datos
existentes → el amigo de Edgar queda conectado con el merge, sin backfill.

**Una sola implementación:** solo cambió `loadCircle` (agrega las aristas de invitación a las de
etiqueta antes de `circleOf`, que es puro y no se tocó). Feed, permisos, leaderboard y la sección
del círculo lo heredan. Verificado por ejecución (WebKit) los 6 casos; los 8 de la Pasada C
(tests de `circleOf`) intactos.

## Pasada SC · TANDA 1 — La cascada de color (datos, sin cambio visual)

El color de la share-card sale de una **cascada de tres niveles, todos leídos del ÚLTIMO
check-in** (decisión del tablero, turno 4): (1) **marca** — el HEX curado del empaque
(`Beer.color`), "el verde de la Costeñita es SU verde"; (2) **foto** — el tono dominante ya
ajustado a la rueda de doce (`SessionPhoto.color`); (3) **hora** — la franja horaria; sin
ventana real, `#N mod 5`. Todo en `src/lib/colors.ts` (puro, testeado).

**Esquema:** `Beer.color` y `SessionPhoto.color`, ambos `String?`.

**La rueda de doce** (aprobada por Edgar): las 5 de la hora (fijas del tablero) + 7 intermedios
derivados. Ninguna compite con el ámbar de marca `#F2A016`. **Las tintas están FIJADAS** (no se
calculan en render) por la regla de contraste (L* ≥ 45 → oscura del mismo matiz; < 45 → crema,
con caída a crema cuando la oscura no llega); **las 12 parejas y las 22 de marca pasan ≥ 4,5:1**.
Único color ajustado: 3 Cord. Negra `#9A6B3A → #B5863F` (el original no pasaba).

**Nivel 2 en el CLIENTE:** la extracción del tono dominante va dentro de `compressImage`
(`image.ts`), con la imagen ya decodificada en canvas — nunca en el servidor, que ya tarda ~4s.
Vota por matiz sobre la rueda; foto gris → null → baja al nivel 3.

**El selector:** al crear una bebida, la rueda de doce con "¿de qué color es?", opcional y
saltable. Sin tocar nada → sin color → cascada al nivel 2. Un nombre que matchee el mapa igual
recibe su color de marca.

**Migración:** `scripts/seed-beer-colors.ts` siembra `Beer.color` (idempotente, dry-run por
defecto). En dev: 48 bebidas → **25 con color de marca, 23 sin color** (variantes/artesanales/
cócteles → nivel 2). Prod la corre Edgar.

**Ajuste suelto:** en la tarjeta del feed, sin reacciones ya NO se muestra "Nadie ha brindado";
la zona queda vacía y el botón Brindar se queda.

**Pendiente:** TANDA 2 (la tarjeta con el color y Big Shoulders) y TANDA 3 (el sheet).

## Pasada SC.1 — El color se deriva del estilo, no de un selector

Se quitó la pregunta "¿De qué color es?" (la rueda de doce al crear una bebida): nadie piensa
una cerveza como un color. En su lugar el color sale del **estilo**, dato que el catálogo ya
quiere. **La cascada pasa a CUATRO niveles:** (1) marca — `Beer.color` (HEX del empaque, sin
cambios); (2) **estilo** — NUEVO, `styleColorFor(Beer.style)` mapea el estilo a un tono de la
rueda; (3) foto; (4) hora (→ `#N mod 5`).

**El mapa estilo→color** es por palabra clave (minúsculas + sin acentos + substring), ordenado
por especificidad ("Lager negra" cae en oscura antes que "Lager" en dorada). Un estilo fuera del
mapa, vacío, o un **cóctel** (sin estilo) → null → baja al nivel 3. Las **oscuras** (porter/
stout/negra) van a **índigo** `#5B54C8` (la rueda no tiene negro/café — decisión de Edgar). Usa
5 tonos (brasa, ámbar, índigo, rosa, rojo), el rango real de color de una cerveza.

`Beer.color` se queda (guarda solo la marca); el color de estilo NO se persiste, se deriva en la
cascada. `Beer.style` sigue **texto libre** (lista cerrada anotada al backlog). Verificado: el
selector ya no aparece; el mapa y la cascada de 4 niveles con tests; ejecutada sobre datos reales
(Septimazo IPA → nivel 2 brasa; Coffee Stout → nivel 2 índigo; Mojito → nivel 3).

## Pasada SC · TANDA 2 — El rediseño de la tarjeta (color + Big Shoulders)

La share-card se rehace con la composición del tablero: el **color de la cascada** pintado y
**Big Shoulders Display** (mayúsculas, "el registro de la carta impresa"). Tres estados por DATO:

- **Con foto** y **sin foto (varias bebidas)** — fondo oscuro `#070B16` + **banda de color**
  arriba (FriaDay + lugar + fecha en la tinta), y en el cuerpo la foto (si hay) y el recorrido en
  crema con flechas del color; la mejor de la noche en un recuadro con borde del color; métricas
  con la `#N` en el color.
- **Una sola bebida sin foto** (incluye el **caso pobre** retroactivo) — fondo **a todo color**,
  tinta emparejada, el nombre gigante, y un **pie invertido** (fondo = la tinta) con las métricas.
  Robusto para las 12 parejas: el contraste color/tinta es simétrico, así el color se lee sobre la
  tinta y viceversa; cuando la tinta es clara (azul, violeta…) el pie sale claro con texto oscuro.

**El texto cambió** (decisión del turno 4): `arrancó {inicio}` → **`hasta las {último check-in}`**,
solo cuando hay ventana real; retroactiva (sin ventana) no muestra hora. El color y la hora se
leen del **último** check-in, un solo criterio que explicar.

**Big Shoulders es variable; satori (0.25, el bundle de `@vercel/og` de Next 16) NO interpola
ejes** — una fuente variable se renderiza en su master por defecto (fino). Se verificó rasterizando
un probe: hacen falta **instancias estáticas**. Se embeben **700 y 800** (woff v1, subconjunto
latin, ~17,3 KB c/u → **~35 KB** al bundle de fuentes); cubren las mayúsculas acentuadas (Á É Í Ó Ú Ñ).
Syne (la display de la v2) salió; Outfit 400/700 se queda para el texto de apoyo.

`getSessionDetail` ahora trae `Beer.color` y `SessionPhoto.color` (la cascada los necesita). El par
color/tinta llega resuelto desde la ruta (`resolveCardColor`); la tarjeta solo deriva tonos de
apoyo (acento suave, barra apagada, pie) del par. Verificado por ejecución sobre datos reales de
dev (nivel 1 marca: BBC Cajicá `#D79A2B`, Corona `#F5D34B`; nivel 4 hora: Mojito 1:15 am → azul;
respaldo `#N mod 5`: Cuba Libre → brasa; con foto + story), más el render local de los tres estados.

> El feed también se vuelve una línea de tiempo con temperatura (una franja de color por salida)
> según el tablero — queda para una pasada aparte (anotado en el backlog).
