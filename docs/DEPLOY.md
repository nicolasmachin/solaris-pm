# Guía de deploy — Voltia PM

Deploy del sistema a producción (VPS con Docker Compose). El deploy en sí se
ejecuta en un turno aparte; este documento es el runbook para hacerlo sin
depender de nadie. Runbook de emergencia: [ROLLBACK.md](ROLLBACK.md).

## 1. Prerequisitos en el VPS

- Ubuntu 24.04 (o similar), acceso SSH con sudo.
- **Docker** + **Docker Compose v2** (`docker compose version`).
- **Caddy** (o el reverse proxy elegido) para TLS + subdominios. El compose de
  prod **no** expone puertos al host público: publica en `127.0.0.1:4000`
  (server) y `127.0.0.1:5173` (client), y Caddy proxea internamente.
- Git configurado con acceso al repo.
- Espacio en disco para el volumen `voltia_storage` (uploads) y `postgres_data`.

## 2. Variables de entorno de producción

Copiar `.env.example` a `.env` en la raíz y completar. Claves críticas:

| Variable | Qué es |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciales de la DB (las usa el compose de prod) |
| `DATABASE_URL` | `postgresql://USER:PASS@postgres:5432/DB` (host `postgres` = servicio) |
| `JWT_SECRET` | **secreto fuerte y único** (no reusar el de dev) |
| `STORAGE_PATH` | `/app/storage` (montado en el volumen `voltia_storage`) |
| `BASE_URL` | URL pública del backend (para links en emails/PDFs) |
| `ANTHROPIC_API_KEY` | IA (Claude) |
| `OPENAI_API_KEY` | transcripción de audios (Whisper) |
| `SMTP_ENCRYPTION_KEY` | **cifra las credenciales SMTP por usuario** (AES-256-GCM). Sin esto, guardar el SMTP falla y no se puede mandar mail. Generar con `openssl rand -base64 32` y **no cambiarla nunca** (rompe lo ya cifrado). |
| `SMTP_*` / `TWILIO_*` | email / WhatsApp (opcionales: si faltan, se loguea y no rompe) |

> ⚠️ **Gap conocido del compose de prod**: el bloque `server.environment` de
> `docker-compose.prod.yml` hoy solo forwardea 7 variables (`NODE_ENV`,
> `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `STORAGE_PATH`,
> `MAX_FILE_SIZE_MB`, `BASE_URL`). La imagen se buildea sin `.env` (está en
> `.dockerignore`), así que **cualquier variable que no esté en ese bloque no
> llega al contenedor**. Antes del primer deploy, **agregar al compose**
> (`VAR: ${VAR}`): `SMTP_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
> `SMTP_HOST/PORT/USER/PASS/FROM`, `TWILIO_*`. Luego recrear: `docker compose -f
> docker-compose.prod.yml up -d server`.

> **NODE_ENV=production** en prod: activa el guard del seed (aborta), apaga la
> redirección de mails de dev (ver abajo) y el modo productivo. El compose de
> prod ya lo defaultea a `production` (`NODE_ENV: ${NODE_ENV:-production}`), así
> que aunque el `.env` no lo defina queda en producción; igual conviene setearlo
> explícito.

> ⚠️ **`DEV_EMAIL_REDIRECT_TO` es SOLO de desarrollo — NUNCA en prod.** En local
> (`docker-compose.yml`) esta variable redirige **todos** los mails salientes a
> una casilla de testing y les agrega un banner "CORREO DE PRUEBA", para no
> spamear al equipo mientras se testea. Dos barreras impiden que llegue a prod:
> (1) **no** está en el `server.environment` de `docker-compose.prod.yml` (ni hay
> `env_file`), así que aunque alguien la ponga en el `.env` de prod **no se pasa
> al contenedor**; y (2) el código la ignora si `NODE_ENV=production`. **No
> agregar `DEV_EMAIL_REDIRECT_TO` al compose de prod bajo ninguna circunstancia.**

## 3. Volumen de storage

`voltia_storage` (uploads de usuario + PDFs generados) y `postgres_data` (base)
son **volúmenes nombrados** de Docker. **Nunca** correr `docker compose down -v`
(el `-v` borra ambos). Para frenar sin perder datos: `docker compose stop`.

## 4. Deploy paso a paso

> **En producción ya existe `~/voltia-pm/deploy.sh`** (en el VPS `voltia@Voltia1`),
> que encapsula estos pasos. **No está versionado en el repo** (vive solo en el
> server). Nicolás deploya con `./deploy.sh`. Su flujo (con `set -eo pipefail` +
> `trap ERR` de rollback automático): (1) aborta si hay cambios sin commitear en el
> server, (2) backup DB pre-deploy a `/home/voltia/backups/` (retención 14 días),
> (3) `git pull --ff-only`, (4) `docker compose -f docker-compose.prod.yml --env-file
> .env up -d --build`, (5) `prisma migrate deploy`, (6) health check a
> `https://app.voltia.com.uy` (si falla → restaura el backup y aborta).
>
> Cubre `--build` **y** `migrate deploy`, así que para features **aditivas** alcanza
> con `./deploy.sh`. Como hace `git pull` de `origin/main`, **todo lo nuevo tiene que
> estar pusheado antes** (`save.sh` local; verificar `git status` sin commits sin
> pushear). Ver §9 para cuándo NO alcanza (migraciones riesgosas).

Equivalente manual (si no se usa el script):

```bash
# 0. Backup PRE-deploy de la DB (imprescindible, ver §5)
bash scripts/backup-db.sh   # o el pg_dump manual de §5

# 1. Traer el código nuevo
git pull origin main

# 2. Build + levantar (prod)
docker compose -f docker-compose.prod.yml up -d --build

# 3. Aplicar migraciones (NUNCA migrate dev en prod)
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy

# 4. Seed SOLO en la primera instalación (idempotente en claves; NO en prod ya poblado)
#    docker compose -f docker-compose.prod.yml exec server npm run db:seed

# 5. Correr los grant scripts pendientes (ver §6)

# 6. Health check (ver §7)
```

## 5. Backup automático de BD antes del deploy

Siempre antes de migrar. `pg_dump` comprimido del Postgres dockerizado:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup_pre_deploy_$(date +%Y%m%d_%H%M).sql.gz
```

Guardar el backup fuera del VPS (OneDrive / Backblaze). `save.sh` ya hace un
`pg_dump` + commit + push en el entorno de dev; en prod usar el comando de
arriba (o su equivalente en `deploy.sh`).

## 6. Scripts de grant (variables de calculadora y permisos)

Idempotentes: se pueden correr múltiples veces. Correr los que apliquen tras el
deploy que los introduce:

```bash
# Defaults de propuestas (equipamiento trifásico, mano de obra, BBVA)
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-fix-gonzalez-defaults.ts
# Factores de ahorro por tarifa (Simple/Doble/Triple)
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-fix-factores-tarifa.ts
# Markup a porcentaje (0.2 → 20)
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-markup-porcentaje.ts
# Permiso de memoria de cálculo (ADMIN → VENTAS:ACCESS_MEMORIA)
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-permission-access-memoria.ts
# Permiso del drawer de debug de calculadora (ADMIN → VENTAS:DEBUG_CALCULADORA)
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-permission-debug-calculadora.ts
# Permisos de Comisiones (ADMIN/FINANZAS/ASESOR → COMISIONES:VIEW) + subcategoría "Comisiones ventas"
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/grant-comisiones-permissions.ts
# Nuevos defaults de calculadora (rendimiento anual, m²/panel, factores estacionales):
# re-correr el seed de defaults (idempotente, solo agrega las claves que falten).
docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/seed-proposal-defaults.ts

# Plantilla de email "Consulta UTE": crear si no está + aplicar la firma dinámica.
# El seed general no corre en prod (guard NODE_ENV) y es create-if-absent, así que
# hay que correr estos dos a mano (viven en server/scripts/, no en prisma/scripts/):
docker compose -f docker-compose.prod.yml exec server npx tsx scripts/seed-email-templates.ts
docker compose -f docker-compose.prod.yml exec server npx tsx scripts/update-consulta-ute-template.ts
```

> Tras un grant de **permisos**, reiniciar el server para invalidar el cache de
> permisos (TTL 5 min): `docker compose -f docker-compose.prod.yml restart server`.

## 7. Verificar que el deploy salió bien

```bash
# Health del backend
curl -s http://127.0.0.1:4000/health   # → {"status":"ok",...}

# Logs (ver que arrancó sin errores)
docker compose -f docker-compose.prod.yml logs -f server
```

Luego, en el navegador (vía el dominio de Caddy): login como admin, abrir un
proyecto, armar una propuesta y publicar una versión de prueba. Checklist visual
completo: [QA_CHECKLIST_PRE_DEPLOY.md](QA_CHECKLIST_PRE_DEPLOY.md).

## 8. Aplicar migraciones nuevas (deploys posteriores)

```bash
docker compose -f docker-compose.prod.yml exec server npx prisma migrate deploy
```

`migrate deploy` aplica solo migraciones pendientes, sin generar nuevas ni
resetear. **Nunca** usar `migrate dev` ni `migrate reset` en producción.

## 9. Criterio de migraciones: aditiva vs. riesgosa

`./deploy.sh` es confiable para migraciones **aditivas / compatibles hacia atrás**
(el 90% de los casos): tablas nuevas, columnas **nullable** o con **default**,
índices, enums nuevos. El código viejo sigue andando mientras se aplica.

Es **riesgoso** (puede fallar o dejar estado inconsistente) cuando la migración:

- agrega una columna **NOT NULL sin default** a una tabla ya poblada,
- pone un **unique** sobre datos con duplicados,
- **borra / renombra / cambia el tipo** de columnas o tablas,
- requiere **backfill** de datos para no romper.

Límites del rollback automático del script en esos casos: restaura la **DB** pero
**no el código** (queda código nuevo + base vieja); el restore (`gunzip | psql` sin
`--clean`) puede fallar si el objeto ya existe; y una migración a medio aplicar
queda marcada *failed* en `_prisma_migrations` → hay que resolverla a mano
(`prisma migrate resolve`).

Para cambios riesgosos: probar la migración sobre una **copia** primero, hacerla en
dos pasos (**expand/contract**: agregar → backfill → luego quitar lo viejo), y tener
el backup a mano. Quien prepare el cambio debe **avisar explícitamente** que la
migración es riesgosa antes del deploy.
