# 🍺 FriaDay

App social privada para un grupo de amigos: registra las cervezas que tomas por
salida, con rating y compañía. Estilo Strava (sesiones personales + etiquetas), no
evento compartido. Multiusuario, **solo por invitación**.

> **Regla de oro:** etiquetar a alguien **no** le acredita cervezas. Los totales de
> un usuario suben SOLO con sus propios check-ins.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 + Neon Postgres ·
Better Auth · PWA instalable · Vercel (Hobby, `main` = producción).

## Setup local

```bash
npm install
cp .env.example .env   # y llena las variables (ver abajo)
npm run prisma:generate
npx prisma migrate deploy   # aplica migraciones a tu Neon
npm run db:seed             # 2 usuarios, 3 cervezas, 1 sesión, 2 códigos
npm run dev
```

### Variables de entorno (`.env`)

| Variable             | Qué es                                                        |
| -------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | Neon **pooled** (endpoint con `-pooler`). Runtime de la app.  |
| `DIRECT_URL`         | Neon **directo** (sin `-pooler`). Migraciones.                |
| `BETTER_AUTH_SECRET` | Secreto aleatorio. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `BETTER_AUTH_URL`    | Local: `http://localhost:3000`. Vercel: la URL del deploy.    |

`.env` está en `.gitignore` (el repo es público — nunca commitees secretos).

## Scripts

| Script                | Acción                                                     |
| --------------------- | ---------------------------------------------------------- |
| `npm run dev`         | Dev server                                                 |
| `npm run build`       | `prisma generate && prisma migrate deploy && next build`   |
| `npm start`           | Server de producción                                       |
| `npm test`            | Tests unitarios (vitest) de la lógica de dominio           |
| `npm run db:seed`     | Siembra datos mínimos                                      |
| `npm run prisma:migrate` | Nueva migración en dev                                  |

## Deploy en Vercel

1. Importa el repo en Vercel (framework: Next.js, no toques el build command — el
   `build` de `package.json` ya hace `prisma migrate deploy`).
2. Configura las 4 env vars de arriba en el proyecto de Vercel. `BETTER_AUTH_URL`
   debe ser la URL del deployment (ej. `https://fria-day.vercel.app`).
3. `main` = producción. Cada PR genera un preview.

## Pantallas

1. **Auth** — login + registro con código de invitación (`/login`, `/register`).
   Cualquier usuario autenticado genera códigos en `/invite`.
2. **Feed** (`/`) — sesiones propias + donde te etiquetaron (badge "X te etiquetó"),
   por fecha desc.
3. **Nueva / editar sesión** (`/sessions/new`, `/sessions/[id]`,
   `/sessions/[id]/edit`) — fecha editable, lugar, notas, etiquetas (usuarios de la
   app + texto libre) y check-ins inline con creación de cervezas al vuelo.
   Agregar una cerveza a una sesión existente = 3 taps (elegir · rating · agregar).
4. **Catálogo** (`/beers`, `/beers/[id]`) — búsqueda + ranking del grupo (promedio
   de rating + nº de ratings).
5. **Perfil** (`/profile`) — total de unidades, por estilo, cervezas distintas, y
   leaderboard del grupo (solo check-ins propios).

## Arquitectura

- **Lógica de dominio pura** en `src/lib/domain.ts` (totales, leaderboard, ranking,
  regla "etiquetar no acredita") — sin Prisma, testeada en `src/lib/domain.test.ts`.
- **Data access** en `src/lib/queries.ts` (server-only) que reusa la lógica pura.
- **Mutaciones** vía Server Actions en `src/app/actions/*` con checks de propiedad
  (solo el dueño edita/borra su sesión).
- **Auth** en `src/lib/auth.ts` (Better Auth + Prisma adapter), protección de rutas
  en `src/proxy.ts`.

## Tests

```bash
npm test
```

Cubre la lógica pura, incluido el caso explícito: **un usuario etiquetado con 0
check-ins propios aparece con 0 en el leaderboard**.

## Usuarios de prueba (¡cámbialos en prod!)

El seed crea `ana@friaday.test` / `beto@friaday.test`, password `***REDACTED***`, y
2 códigos de invitación (se imprimen al correr `npm run db:seed`). Ver
[DECISIONES.md](DECISIONES.md) para la nota de seguridad.
