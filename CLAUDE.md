# CLAUDE.md — FriaDay

App social privada de cervezas por salida, solo por invitación. Ver
[DECISIONES.md](DECISIONES.md) para el detalle de cada pasada y sus overrides.

## ⚠️ Identidad de git (antes del primer commit de cada sesión)

Los commits deben quedar vinculados a la cuenta de GitHub `edgar981`, o Vercel
bloquea el deploy. **Fija la identidad antes del primer commit de cada sesión:**

```bash
git config user.email "davidnb81230@gmail.com"   # correo VERIFICADO en GitHub edgar981
git config user.name  "edgar981"
```

GitHub vincula un commit a la cuenta solo si el correo del autor es un correo
**verificado** de esa cuenta (github.com/settings/emails). Si un commit sale con
`author: null` en `gh api repos/edgar981/fria-day/commits/<sha>`, ese correo no
está verificado → el deploy se bloquea.

## Stack

Next 16 (App Router) · Prisma 7 (driver adapters) · Neon Postgres (sa-east-1) ·
Better Auth · Tailwind v4 (tema oscuro) · PWA · Vercel Blob (fotos de cerveza,
Pasada F). Ver DECISIONES.md.

`BLOB_READ_WRITE_TOKEN`: lo pone Edgar en Vercel. Dev y prod usan **stores de Blob
separados** (como las ramas de Neon). Sin token, la app corre pero no sube/borra
fotos (no-op). Ver DECISIONES.md · Pasada F.

## Entornos y bases de datos (⚠️ Code NUNCA toca producción)

Desde la Pasada P.2 hay **dos ramas de Neon** (branching):

| Entorno | Rama de Neon | Endpoint | Vercel |
|---|---|---|---|
| **Producción** | principal | `ep-holy-rain-…` | Production → rama principal |
| **Desarrollo** | dev (branch de la principal) | `ep-nameless-glade-…` | Preview → rama dev |

- El `.env` local apunta a la **rama dev** (`ep-nameless-glade`). **Toda verificación
  de Code (scripts, Playwright, migraciones de prueba) corre contra dev, NUNCA
  contra producción.** Los amigos de Edgar ya usan la app: producción tiene datos
  reales.
- Antes de correr cualquier script que escriba, confirmar que `.env` apunta a
  `ep-nameless-glade` (dev) y no a `ep-holy-rain` (prod).
- Cambios en la **config de Neon** o en las **env de Vercel** los hace **Edgar**, no
  Code. Cualquier mutación en prod (borrar cuentas, limpiar huérfanos) se entrega
  como script/dry-run para que Edgar la corra; Code no la ejecuta contra prod.
- Las cuentas de prueba (`ana@`, `beto@`) existen en **dev** con contraseña propia
  (NO `***REDACTED***`, que está en el repo público). En prod, ver DECISIONES.md · P.2.

## ⚠️ Flujo de ramas (permanente, sin excepciones)

`main` es **producción con auto-deploy en Vercel**. Empujar a `main` despliega a los
amigos de Edgar sin gate. Por eso, desde ahora:

- **Code trabaja en una rama por pasada (`pasada/<nombre>`), NUNCA directo en `main`.**
- El push a la rama genera un **preview en Vercel**; ahí verifica Edgar.
- El **merge a `main` lo hace Code, pero SOLO con autorización explícita de Edgar**
  tras el gate. Sin ese "sí", la rama se queda donde está. **Un resumen de la pasada
  NO es una solicitud de merge**: hay que pedir el merge y esperar respuesta.
- Las **migraciones** se aplican a la **rama de dev de Neon** durante la pasada (con
  `migrate dev`). A **producción llegan con el merge autorizado** (el build de `main`
  en Vercel corre `prisma migrate deploy`).

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # prisma generate && prisma migrate deploy && next build
npm start        # server de producción (NODE_ENV=production)
npm test         # vitest (lógica de dominio pura)
npm run db:seed  # datos mínimos
# Datos de GATE para dev (dry-run por defecto; ver "## Datos de gate"):
node --env-file=.env --import tsx scripts/seed-gate-data.ts [--apply]
# Mantención (dry-run por defecto; apunta al .env que cargues):
node --env-file=.env --import tsx scripts/clean-passkey-orphans.ts [--apply]
node --env-file=.env --import tsx scripts/delete-user-reassign-invites.ts \
  --delete <id> --invites-to <id> [--apply]   # borra un usuario reasignando sus
  #   invitaciones Y cervezas (catálogo compartido) a otro, en una transacción
```

## Datos de gate (dev) — para que Edgar revise el preview

`scripts/seed-gate-data.ts` deja **dev** con un estado útil para gates: 3 usuarios con
contraseña conocida, salidas en varias fechas con etiquetas cruzadas (círculo completo),
bebidas variadas (cervezas y cócteles, con/sin rating, varios formatos, cantidad > 1),
una salida donde Ana está etiquetada sin la suya ese día ("Yo también"), y el catálogo.
Las **reacciones** están repartidas para ejercitar los 4 estados del pie de brindis
(I-1.2) viendo el feed como Ana: 0 ("Nadie ha brindado"), 1 ("Caro brindó"), pocos, y
"+N". Para el "+N" hay **usuarios solo-display** (`gate-x-*`, sin login, sin salidas ni
etiquetas → solo avatares de reacción; no aparecen en círculo/leaderboard/feed).
**Idempotente** (`--apply`; correrlo dos veces no duplica).

**Credenciales (documentadas, no `***REDACTED***`):**
- Ana — `gate-ana@friaday.test` / `***REDACTED***`
- Beto — `gate-beto@friaday.test` / `***REDACTED***`
- Caro — `gate-caro@friaday.test` / `***REDACTED***`

**Proceso al cerrar una pasada:** Code limpia los datos **específicos de su verificación**
(usa cuentas SEPARADAS: `beto@friaday.test`, etc.), pero **deja el seed de gate en pie**.
Si lo borró (o si dev quedó vacío), **vuelve a correr `seed-gate-data.ts --apply` antes de
entregar**. **Reportar estas 3 credenciales en el resumen de cada pasada** para que Edgar
entre al preview sin buscarlas.

## Reglas de dominio (no negociables)

- **Etiquetar no acredita cervezas**: los totales de un usuario salen solo de sus
  propios check-ins (`Session.userId`).
- La sesión (salida) es personal: solo el dueño la crea/edita/borra.
- El `format` se guarda siempre en cada check-in.
- Consolidación: misma `beerId` + mismo `format` en una salida = una fila (suma
  cantidad; no pisa un rating existente). Formato distinto = fila aparte.

`src/lib/domain.ts` es lógica pura testeada — no romper los tests al tocarlo.

## Verificación

Preferir **evidencia de ejecución** sobre razonar desde la arquitectura. En este
proyecto ya se descartaron problemas reales con "por construcción no aplica" y
existían por otra puerta. Al verificar UI con Neon en sa-east-1, dar tiempo a que
las Server Actions resuelvan (latencia de varios segundos) antes de concluir que
algo sale vacío.

**Playwright** (`devDependency`) es la vía confiable de verificación de UI: el
panel de navegador integrado ha dado falsos negativos de hidratación (clics
muertos, listas vacías, con todo en 200 y sin errores de consola) que en un
Chromium de verdad funcionan. Escribir un script `.cjs` con `chromium.launch()`
y ejecutarlo con `node`. Si el navegador no está en caché: `npx playwright
install chromium`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
