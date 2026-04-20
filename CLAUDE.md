# Voltia PM (antes Solaris PM)

Sistema interno para gestionar proyectos fotovoltaicos de punta a punta.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + Zustand + TanStack Query (en `client/`)
- **Backend**: Node.js + Fastify + TypeScript + Prisma ORM (en `server/`)
- **DB**: PostgreSQL 15
- **Infra**: Docker + Docker Compose para desarrollo local

## Cómo levantar el proyecto en local

El proyecto está dockerizado. Toda la operación es vía Docker Compose desde la raíz.

```bash
# Primera vez (build + levantar)
docker compose up -d --build

# Arranque diario
docker compose up -d

# Aplicar migraciones (en contenedor)
docker compose exec server npx prisma migrate deploy

# Crear migración nueva (cuando se cambia schema.prisma)
docker compose exec server npx prisma migrate dev --name descripcion_cambio

# Correr seed
docker compose exec server npm run db:seed

# Logs
docker compose logs -f server
docker compose logs -f client

# Frenar sin perder datos
docker compose stop

# NUNCA usar `docker compose down -v` en producción: borra los volúmenes.
```

## Puertos

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Postgres dockerizado: `localhost:5433` (user: `voltia`, pass: `voltia_dev_password`, db: `voltia_pm`)
- Prisma Studio: `docker compose exec server npx prisma studio`

## Usuarios de prueba (creados por el seed)

| Email | Password | Rol |
|---|---|---|
| `admin@voltiapm.com` | `Y1025Voltia` | `ADMIN` |
| `comercial@voltiapm.com` | `Admin1234` | `ASESOR_COMERCIAL` |
| `ingeniero@voltiapm.com` | `Admin1234` | `INGENIERIA` |
| `operaciones@voltiapm.com` | `Admin1234` | `OPERACIONES` |
| `finanzas@voltiapm.com` | `Admin1234` | `FINANZAS` |

## Convenciones importantes

- Los nombres de tablas en Postgres están en `snake_case` y plural (ej. `users`, no `User`).
- Las migraciones se generan con `migrate dev` en local y se aplican con `migrate deploy` en producción.
- El `NODE_ENV` no se setea en el compose local a propósito (para que el seed funcione). En producción va a ser `production` y el seed queda bloqueado por el guard.
- El script de seed se llama `npm run db:seed` (no `npx prisma db seed`).

## Estructura relevante

- `server/prisma/schema.prisma` — modelo de datos (fuente de verdad).
- `server/prisma/migrations/` — migraciones versionadas en Git.
- `server/src/routes/` — endpoints de la API.
- `server/src/services/` — lógica de negocio.
- `client/src/api/` — clientes axios por módulo.
- `client/src/pages/` — vistas principales.

## Roadmap de infraestructura (en curso)

- [x] Fase 1: Dockerizar desarrollo local.
- [ ] Fase 2: VPS (Hetzner Ashburn, Ubuntu 24.04).
- [ ] Fase 3: DNS + reverse proxy (Caddy) + subdominios desde cPanel.
- [ ] Fase 4: Deploy de producción con backup pre-deploy automático.
- [ ] Fase 5: Backups periódicos a Backblaze B2 + storage/ respaldado.
- [ ] Fase 6: Migrar bot de Telegram al mismo VPS.
