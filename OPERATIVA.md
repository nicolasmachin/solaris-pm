# VOLTIA PM — Guía operativa del día a día

> **¿Buscás el setup inicial?** Mirá [README.md](README.md).
> Esta guía asume que ya tenés el repo clonado y Docker andando en la Mac, y se enfoca en el ciclo diario: desarrollar → probar → deployar → diagnosticar.

## Contenido

- [Arquitectura en 2 líneas](#arquitectura-en-2-líneas)
- [Mac — comandos esenciales](#mac--comandos-esenciales)
- [Flujo para cargar cambios en producción](#flujo-para-cargar-cambios-en-producción)
- [Cheatsheet del servidor](#cheatsheet-del-servidor)
- [Si algo sale mal](#si-algo-sale-mal)
- [Qué NO hacer nunca](#qué-no-hacer-nunca)
- [Guardado diario del día (backup + commit + push)](#guardado-diario-del-día)
- [Credenciales](#credenciales)
- [Archivos clave](#archivos-clave)
- [Datos del servidor](#datos-del-servidor)
- [Roadmap](#roadmap)

---

## Arquitectura en 2 líneas

```
Tu Mac (desarrollo)   →   GitHub (repo)   →   VPS Antel (producción)
    editás                  git push            ./deploy.sh
```

Tu Mac es donde trabajás. GitHub es el intermediario. El VPS es donde corre producción.

**Regla de oro**: el VPS nunca se edita directamente. Todo cambio viaja desde tu Mac vía GitHub.

---

## Mac — comandos esenciales

**Ubicación del proyecto**: `/Users/nicolasmachin/Dev/voltia-pm`

### Arrancar ambiente local

```bash
cd /Users/nicolasmachin/Dev/voltia-pm
docker compose up -d
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Postgres: `localhost:5433` (user `voltia`, db `voltia_pm`)

Verificación rápida:
```bash
curl http://localhost:4000/health
# {"status":"ok","service":"voltia-pm-server",...}
```

### Ver logs si algo no anda

```bash
docker compose logs -f server    # backend
docker compose logs -f client    # frontend
docker compose logs -f postgres  # DB
```

`Ctrl+C` para salir.

### Frenar todo sin perder datos

```bash
docker compose stop
```

Volver a arrancar: `docker compose start` (no rebuildea imágenes, sólo levanta los contenedores ya creados).

### Reset completo del ambiente local (BORRA la DB local)

```bash
docker compose down -v
docker compose up -d --build
docker compose exec server npx prisma migrate deploy
docker compose exec server npm run db:seed
```

Solo si querés empezar de cero. **Nunca en el VPS**. El flag `-v` borra los volúmenes de Postgres.

---

## Flujo para cargar cambios en producción

### 1. En tu Mac — probar local

Levantás local (`docker compose up -d`), hacés los cambios, probás en `localhost:5173` hasta que estés conforme.

### 2. Si cambiaste el schema de la DB

```bash
docker compose exec server npx prisma migrate dev --name descripcion_corta
```

Crea la migración en `server/prisma/migrations/` y la aplica en tu DB local. La migración viaja al repo con el código.

### 3. Commit + push

```bash
git add .
git commit -m "feat: descripción del cambio"
git push
```

Convención de mensajes:
- `feat:` features nuevas
- `fix:` bugs
- `chore:` cambios internos (refactor, config, renombres)
- `docs:` documentación

### 4. Deploy en el VPS

```bash
ssh voltia@179.27.97.141
cd ~/voltia-pm
./deploy.sh
```

Qué hace el script automáticamente:

1. **Backup** de la DB en `~/backups/pre-deploy-YYYYMMDD-HHMMSS.sql.gz`
2. `git pull` para traer tus cambios
3. Rebuild de contenedores de producción
4. `npx prisma migrate deploy` (aplica migraciones nuevas, nunca genera migraciones nuevas)
5. Health check contra `/health`
6. Si **cualquier paso falla** → rollback automático al backup + commit anterior

Tarda entre 30 s y 2 min según qué cambió.

### 5. Verificar en producción

```bash
curl https://app.voltia.com.uy/health                  # responde 200 con JSON
# y/o abrir en el browser
open https://app.voltia.com.uy
```

Probá el cambio específico que hiciste (abrí el módulo afectado, hacé una operación de prueba, mirá logs si necesitás).

---

## Cheatsheet del servidor

Todos se corren tras `ssh voltia@179.27.97.141`.

| Qué quiero hacer | Comando |
|---|---|
| Deploy | `cd ~/voltia-pm && ./deploy.sh` |
| Estado de contenedores | `docker compose -f docker-compose.prod.yml ps` |
| Logs del server | `docker compose -f docker-compose.prod.yml logs -f server` |
| Logs de Caddy (HTTPS) | `sudo journalctl -u caddy -f` |
| Reiniciar solo el server | `docker compose -f docker-compose.prod.yml restart server` |
| Ver backups disponibles | `ls -lh ~/backups/` |
| Espacio en disco | `df -h` |
| Uso de memoria | `free -h` |
| Procesos pesados | `htop` (`q` para salir) |
| Abrir shell en Postgres | `docker compose -f docker-compose.prod.yml exec postgres psql -U voltia -d voltia_pm` |
| Contar registros de una tabla | `... psql ... -c "SELECT COUNT(*) FROM projects WHERE \"deletedAt\" IS NULL;"` |

---

## Si algo sale mal

### El deploy falla

El script hace rollback automático. Además:

1. Leé el log: `cat ~/backups/deploy-YYYYMMDD-HHMMSS.log`
2. Identificá en qué paso falló.
3. Casos típicos:
   - **Migración Prisma**: conflicto de migración. Arreglá en tu Mac, commit, push, deploy de nuevo.
   - **Health check**: el server arrancó pero no responde. Mirá `docker compose -f docker-compose.prod.yml logs server`.
   - **`git pull` falla**: hay cambios locales en el servidor (esto no debería pasar, ver "Qué NO hacer"). Resolvé con:
     ```bash
     cd ~/voltia-pm
     git status           # revisá qué hay
     git checkout .       # descarta cambios locales sin commitear
     ./deploy.sh
     ```

### Restaurar un backup manualmente

```bash
cd ~/voltia-pm

# Ver backups disponibles
ls -lh ~/backups/

# Restaurar uno específico
gunzip -c ~/backups/pre-deploy-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U voltia -d voltia_pm
```

### Deshacer el último deploy (sin rollback automático)

Si necesitás volver a la versión anterior manualmente:

```bash
cd ~/voltia-pm
git log --oneline -5                    # ver los últimos commits
git reset --hard HEAD~1                 # volver al anterior (o al hash específico)
./deploy.sh                             # redeploy con la versión anterior
```

Restaurá también el backup de la DB del deploy fallido si tocó el schema.

### El sitio no carga

1. Probá en una ventana de incógnito (descarta caché).
2. En el servidor: `docker compose -f docker-compose.prod.yml ps` (¿todo `Up`?).
3. `sudo systemctl status caddy` (¿Caddy OK?).
4. Si Caddy está raro: `sudo systemctl restart caddy`.
5. Si un contenedor está raro: `docker compose -f docker-compose.prod.yml restart <servicio>`.
6. Si nada funciona: revisá DNS/Antel del dominio (`dig app.voltia.com.uy`).

### Revisar un dato específico en producción

```bash
ssh voltia@179.27.97.141
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U voltia -d voltia_pm -c "SELECT code, \"clientName\" FROM projects WHERE \"deletedAt\" IS NULL ORDER BY code;"
```

Para consultas más cómodas se puede abrir Prisma Studio contra la DB de producción vía túnel SSH (cuando haga falta, no como hábito).

---

## Qué NO hacer nunca

- **Editar archivos directamente en el servidor**. Tarde o temprano rompe `git pull`.
- **`docker compose down -v` en el servidor**. El `-v` borra volúmenes → adiós DB de producción.
- **`npx prisma migrate dev` en el servidor**. Solo es para desarrollo; en prod va `migrate deploy`.
- **Pushear desde el servidor a GitHub**. El servidor consume, no produce.
- **Deploy sin pasar por `./deploy.sh`**. Te saltás backup + rollback.
- **`npm run db:seed` en producción sin entender el seed**. Hay un guard (`NODE_ENV=production` lo bloquea, ver `server/prisma/seed.ts`). Para forzarlo: `FORCE_SEED=1 npm run db:seed` — pero el seed es idempotente (sólo `upsert`, nunca `delete`), así que no debería destruir nada.

---

## Guardado diario del día

Para cerrar el día o antes de una migración riesgosa: backup de la DB local a OneDrive + commit automático + push en un solo comando:

```bash
cd /Users/nicolasmachin/Dev/voltia-pm
npm run save
```

También funciona `bash save.sh` desde la raíz. El script:

1. Dumpea la DB local (`docker compose exec -T postgres pg_dump ...`) y guarda `voltiapm_backup_YYYY-MM-DD_HH-MM.sql.gz` en `~/Library/CloudStorage/OneDrive-Personal/1. Voltia/Cosas Nico/Backups/`.
2. Aborta si el dump quedó vacío (guarda contra fallos silenciosos de `pg_dump`).
3. `git add -A && git commit -m "chore: guardado automático {timestamp}"` (si hay cambios).
4. `git push`.

Este backup es **local** (tu DB de desarrollo). No reemplaza a los backups de producción en `~/backups/` del VPS.

---

## Credenciales

Guardalas en tu gestor de contraseñas:

- Password admin de Voltia (`nmachin@voltia.com.uy`).
- Password del usuario `voltia` del servidor (para `sudo`).
- `POSTGRES_PASSWORD` y `JWT_SECRET` (en el `.env` de producción).
- Llave SSH: `~/.ssh/id_ed25519` en tu Mac. Si cambiás de equipo, copiala al nuevo.
- Git config global: `nfmj@hotmail.com` como autor de los commits.

---

## Archivos clave

En tu Mac / repo:

| Archivo | Qué es |
|---|---|
| `README.md` | Setup inicial y puesta en marcha |
| `OPERATIVA.md` | Esta guía (día a día + deploy) |
| `CLAUDE.md` | Contexto del proyecto para Claude Code |
| `docker-compose.yml` | Ambiente de desarrollo local |
| `docker-compose.prod.yml` | Ambiente de producción (en el VPS) |
| `deploy.sh` | Script de deploy del VPS |
| `save.sh` / `server/scripts/save.sh` | Backup local + commit + push |
| `.env` | Credenciales de producción (solo en el VPS, no va al repo) |
| `server/prisma/schema.prisma` | Modelo de la DB (fuente de verdad) |
| `server/prisma/migrations/` | Migraciones versionadas |
| `server/prisma/seed.ts` | Datos de ejemplo (idempotente, bloqueado en prod) |

---

## Datos del servidor

- IP pública: `179.27.97.141`
- Dominio: `app.voltia.com.uy`
- Proveedor: Antel (Mi Nube)
- Specs: 4 cores · 8 GB RAM · 150 GB disco
- OS: Ubuntu 24.04 LTS
- Usuario SSH: `voltia` (sin password, solo llave SSH)
- Admin app Voltia: `nmachin@voltia.com.uy`

---

## Roadmap

### Completadas

- Fase 1 — Dockerización local
- Fase 2 — VPS con hardening (usuario no-root, SSH, firewall, fail2ban)
- Fase 3 — Caddy + HTTPS automático + subdominio
- Fase 4 — Script de deploy con backup pre-deploy y rollback

### Pendientes

- Fase 5 — Backups off-site a Backblaze B2 o Cloudflare R2 (por si se rompe el VPS)
- Fase 6 — Sumar bot de Telegram al mismo servidor
- Opcional — Frontend de Vite dev mode a build estático
- Opcional — Carga de permisos al seed (hoy es manual)
