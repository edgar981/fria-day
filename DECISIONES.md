# DECISIONES.md — FriaDay v1

Desviaciones, overrides y decisiones tomadas durante la construcción respecto al
spec. Cada una con su porqué.

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
