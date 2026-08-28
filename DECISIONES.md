# DECISIONES.md — FriaDay v1

Desviaciones, overrides y decisiones tomadas durante la construcción respecto al
spec. Cada una con su porqué.

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
