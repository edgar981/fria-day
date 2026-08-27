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
Better Auth · Tailwind v4 (tema oscuro) · PWA. Ver DECISIONES.md.

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # prisma generate && prisma migrate deploy && next build
npm start        # server de producción (NODE_ENV=production)
npm test         # vitest (lógica de dominio pura)
npm run db:seed  # datos mínimos
```

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
