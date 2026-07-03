# Runbook de rollback — Voltia PM

Qué hacer cuando un deploy sale mal. Ver también [DEPLOY.md](DEPLOY.md).
Todos los comandos asumen `docker compose -f docker-compose.prod.yml` (abreviado
`dc` abajo) desde la raíz del repo en el VPS.

## 1. ¿Hay que hacer rollback? (síntomas típicos)

- El `/health` no responde o el server crashea en loop (`dc logs -f server`).
- Errores 500 masivos en endpoints que antes andaban.
- El frontend carga pero no trae datos (revisar consola + logs del server).
- Una migración falló a mitad y la DB quedó inconsistente.
- Números de negocio claramente mal (ej. precios ×100, cuotas ×40) → suele ser
  un cambio de unidad/fórmula, no infra.

Antes de revertir: mirá los logs. Muchas veces es una env var faltante o el
server sin reiniciar, no un bug de código.

## 2. Rollback rápido (revert de código + redeploy)

Cuando el problema es de código y **no** hubo migración nueva:

```bash
git log --oneline -10                 # identificar el commit bueno anterior
git revert <hash-malo>                # o: git checkout <hash-bueno> para el deploy
dc up -d --build server client
curl -s http://127.0.0.1:4000/health
```

Si el deploy fue un merge de varios commits, `git revert -m 1 <merge>` o resetear
a la tag/commit estable previo y redeployar.

## 3. Rollback con restauración de BD (desde backup)

Cuando el deploy corrompió o migró mal los datos. **Requiere el backup
pre-deploy** (DEPLOY.md §5).

```bash
# 1. Frenar el server para que nadie escriba
dc stop server

# 2. Restaurar el dump (⚠️ pisa la base actual)
gunzip -c backup_pre_deploy_YYYYMMDD_HHMM.sql.gz | \
  dc exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# 3. Volver el código a la versión que matchea ese backup (§2)
# 4. Levantar
dc up -d server
```

> El backup y el código deben ser de la **misma versión**: restaurar una DB vieja
> con código nuevo puede fallar si hubo migraciones intermedias.

## 4. Revertir una migración

Prisma **no** revierte migraciones automáticamente. Opciones:

- **Preferido**: restaurar la DB desde el backup pre-deploy (§3). Es lo más
  seguro y siempre funciona.
- **Manual**: escribir el SQL inverso de la migración (DROP COLUMN, etc.) y
  aplicarlo con `psql`. Solo si sabés exactamente qué hizo la migración.
- **Cuándo NO se puede revertir sin pérdida**: si la migración borró/renombró
  columnas con datos, o el nuevo código ya escribió datos en el schema nuevo. En
  ese caso el único camino limpio es el restore del backup (§3), asumiendo la
  pérdida de lo escrito después del deploy.

Las migraciones aditivas (agregar un valor de enum, una columna nullable) son
seguras y normalmente **no** necesitan revertirse.

## 5. Revertir un cambio de default del singleton

Los defaults viven en la tabla `proposal_defaults` (fila `singleton`, columna
JSON `data`), **no** en migraciones. Para revertir un valor:

- Desde **Admin → Defaults de propuestas** (lo más rápido): editar la variable y
  guardar.
- O con un grant script inverso (los grant scripts son idempotentes y logean).
- Los **snapshots de versiones publicadas son inmutables**: no se tocan. La
  calculadora interpreta unidades viejas por magnitud (ej. markup 0.2 vs 20), así
  que revertir el default no afecta versiones ya publicadas.

## 6. Si el volumen `voltia_storage` se corrompe

`voltia_storage` guarda uploads + PDFs generados (paths relativos a
`STORAGE_PATH`, referenciados en `file_attachments`).

- **Nunca** correr `docker compose down -v` (borra `voltia_storage` **y**
  `postgres_data`).
- Restaurar el volumen desde el último backup de `storage/` (fuera del VPS).
- Los `FileAttachment` de la DB apuntan a los archivos: si el volumen se pierde
  sin backup, las filas quedan pero los archivos físicos no. Los PDFs de versiones
  publicadas se pueden **regenerar** desde el snapshot (endpoint admin de
  regenerate); los uploads originales no.

## 7. Contactos de emergencia

- **Hosting / VPS**: (proveedor + panel) — completar.
- **DNS / dominio**: (registrar + panel) — completar.
- **Base de datos / backups**: OneDrive / Backblaze — completar.
- **Responsable técnico**: Nicolás — completar.

> Completar esta sección con los datos reales antes del primer deploy productivo.
