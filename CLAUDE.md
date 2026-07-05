# Voltia PM (antes Solaris PM)

Sistema interno de Voltia (Uruguay) para gestionar proyectos fotovoltaicos punta a punta: CRM comercial, ingeniería, operaciones, habilitación UTE, postventa, finanzas, stock, métricas y portal de cliente.

> Antes de empezar una sesión nueva, leé `/Users/nicolasmachin/.claude/projects/-Users-nicolasmachin-Dev-voltia-pm/memory/MEMORY.md` y los archivos referenciados ahí para tener contexto previo (preferencias del usuario, decisiones de proyecto).

## Stack y arquitectura

- **Frontend** (`client/`): React 18 + TypeScript + Vite + Tailwind + Zustand + TanStack Query + react-router-dom + react-hot-toast.
- **Backend** (`server/`): Node.js + Fastify + TypeScript + Prisma ORM.
- **DB**: PostgreSQL 15 dockerizado, puerto host `5433`.
- **Infra dev**: Docker Compose (servicios `postgres`, `server`, `client`).
- **IA**: Anthropic SDK (`@anthropic-ai/sdk`), modelo Claude Sonnet 4.5 por defecto, key vía `ANTHROPIC_API_KEY` en `.env` raíz.
- **Audio**: OpenAI Whisper para transcripción de audios de visitas (`OPENAI_API_KEY`).
- **PDFs**: PDFKit con fonts Roboto en `server/src/services/unifilarSvg/fonts/` y logo en `server/src/services/preingenieriaPdf/assets/`.

### Estructura relevante

```
voltia-pm/
├── client/src/
│   ├── api/                # 32 clientes axios por módulo
│   ├── components/         # ai, comments, finance, ingenieria, layout, metrics, notifications, project, ui, ute, visitas
│   ├── pages/              # ~40 vistas (Dashboard, Projects, Sales, Finance*, Ingenieria*, Visita*, Portal*)
│   ├── store/              # Zustand
│   ├── hooks/              # usePermission, etc.
│   └── version.ts          # versión semver del producto
├── server/
│   ├── src/
│   │   ├── routes/         # 9 archivos: api, auth, portal, unifilar, ingenieria, preingenieria, consolidador, visitas, efp
│   │   ├── services/       # ~30 servicios + subcarpetas para PDFs/IA
│   │   ├── middleware/     # auth.middleware.ts + authorize.middleware.ts
│   │   ├── lib/prisma.ts
│   │   └── index.ts        # entrypoint Fastify + jobs
│   └── prisma/
│       ├── schema.prisma   # 1991 líneas, fuente de verdad
│       ├── migrations/
│       └── seed.ts
├── storage/                # uploads en filesystem (volume Docker `voltia_storage`)
├── docker-compose.yml      # local
├── docker-compose.prod.yml # prod
└── save.sh                 # backup DB + commit + push
```

## Cómo levantar el proyecto en local

Toda la operación es vía Docker Compose desde la raíz del repo.

```bash
# Primera vez (build + levantar)
docker compose up -d --build

# Arranque diario
docker compose up -d

# Aplicar migraciones (en contenedor)
docker compose exec server npx prisma migrate deploy

# Crear migración nueva (cuando cambia schema.prisma)
docker compose exec server npx prisma migrate dev --name descripcion_cambio

# Correr seed
docker compose exec server npm run db:seed

# Logs
docker compose logs -f server
docker compose logs -f client

# Frenar sin perder datos
docker compose stop

# Prisma Studio
docker compose exec server npx prisma studio
```

**NUNCA `docker compose down -v`**: el flag `-v` borra los volúmenes (la base y el storage). Usar `stop` o `down` sin `-v`.

### Puertos

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000` (health check en `/health`)
- Postgres dockerizado: `localhost:5433` (user `voltia`, pass `voltia_dev_password`, db `voltia_pm`)

### Usuarios de prueba (creados por el seed)

| Email | Password | Rol |
|---|---|---|
| `admin@voltiapm.com` | `Y1025Voltia` | `ADMIN` |
| `comercial@voltiapm.com` | `Admin1234` | `ASESOR_COMERCIAL` |
| `ingeniero@voltiapm.com` | `Admin1234` | `INGENIERIA` |
| `operaciones@voltiapm.com` | `Admin1234` | `OPERACIONES` |
| `finanzas@voltiapm.com` | `Admin1234` | `FINANZAS` |

### Script de guardado (`save.sh`)

`bash save.sh` desde la raíz hace en una sola pasada:

1. `pg_dump` comprimido del Postgres dockerizado a OneDrive (`Backups/voltiapm_backup_<fecha>.sql.gz`), con purga de backups > 30 días.
2. `git add -A && git commit -m "chore: guardado automático <fecha>"` (skip si no hay cambios).
3. `git push` a GitHub.

Correrlo **antes y después de tareas grandes** y antes de aplicar migraciones que toquen producción.

## Convenciones

### Base de datos

- Tablas Postgres en `snake_case` y plural (`@@map("users")`, `@@map("file_attachments")`, etc.) — los modelos Prisma están en `PascalCase` singular.
- Migraciones: `migrate dev --name xxx` en local, `migrate deploy` en prod.
- Seed: `npm run db:seed` (no `npx prisma db seed`). El seed tiene un guard que aborta si `NODE_ENV=production`.
- `NODE_ENV` no se setea en el compose local a propósito (para no bloquear el seed).

### Permisos

- Matriz `Module × Action` en la tabla `permissions` (un row por combinación rol/módulo/acción permitida). No están hardcodeados.
- Backend: `authorize(module, action)` (en `server/src/middleware/authorize.middleware.ts`) se monta como `preHandler` en cada ruta. Tiene cache de 5 minutos por `roleName:module:action`. Para invalidar: `clearPermissionCache()` cuando se editan roles/permisos.
- Frontend: hook `usePermission(module, action)` + componente `<PermissionRoute>` en `App.tsx`. Toast automático si no tiene permiso y redirige a `/dashboard`.
- Rol especial `CLIENT`: solo puede entrar a `/portal/*` y `/cambiar-password`. Si tiene `passwordTemporary`, se fuerza el cambio de password antes de cualquier navegación.

### Archivos / uploads

- `saveUploadedFile(file, projectId)` en `server/src/services/file-storage.service.ts` para uploads de usuario.
- `saveBufferAsAttachment(...)` para PDFs/SVGs generados server-side.
- Ambos crean un `FileAttachment` con campos clave:
  - `tipo`: `FileAttachmentTipo` enum (UNIFILAR / PRE_INGENIERIA / LISTA_MATERIALES / PRESUPUESTO / CALCULO_TRIANGULOS / MINUTA_RELEVAMIENTO / UPLOAD_MANUAL / OTRO).
  - `toolSource` + `toolVersion` + `toolEntityId`: trazabilidad fina del origen, permiten badges tipo "Ingeniería: Unifilar v3" y filtros por origen.
- Archivos físicos en `storage/<projectId>/<uuid>.<ext>` (volume `voltia_storage` en Docker).
- Borrar input/visita debe soft-deletear el `FileAttachment` (`deletedAt`) y borrar el archivo físico — patrón establecido en visitas técnicas.
- Extensiones permitidas en `file-storage.service.ts`: imágenes, audio (incluye `webm`, `m4a`, `mp4` para iOS Safari), PDF, DWG, XLSX, DOCX, ZIP.

### Auditoría

- `createAuditEntry({...})` y `createAuditEntriesForChanges({...})` en `server/src/services/audit.service.ts`. Llamarlas en cada acción significativa.
- Enum `AuditEntityType` cubre project, stage, substage, lead, finance_movement, payment, etc. — extender el enum cuando se agrega una entidad nueva.

### Versionado de documentos generados

Mismo patrón en todas las herramientas que producen entregables:

- `UnifilarVersion`, `PreIngenieriaVersion`, `MaterialesConsolidadosVersion`, `EFPVersion`, `VisitReport`.
- Cada "Regenerar con IA" o "Snapshot" crea una versión nueva incremental (`@@unique([entityId, version])`).
- Edición inline NO crea versión nueva: actualiza la actual.
- En el caso de `VisitReport` (v5.2) hay **un solo informe vivo por visita** que se actualiza in-place; no se versiona (cambio de v5.1 → v5.2).

### IA (Claude / Anthropic)

- Cliente shared lazy en cada service (`getAnthropicClient()` interno). Modelo via env var, default `claude-sonnet-4-5` o `claude-sonnet-4-5-20250929`.
- Salida JSON estricta validada con Zod schema antes de persistir.
- Cada query persiste `modelUsed`, `tokensInput`, `tokensOutput`, `costUsd` en la entidad correspondiente o en `ai_queries`.
- Rate limit en `ai-rate-limit.service.ts` (`AIRateLimit`).
- SQL injection del Text-to-SQL del asistente AI: validador en `ai-sql-validator.ts` + usuario Postgres readonly (`voltia_readonly`) con tablas sensibles (`audit_logs`, `ai_queries`) `REVOKE`-eadas.

### Frontend

- Mutaciones TanStack Query: invalidar siempre con `qc.invalidateQueries({ queryKey: [...] })` en `onSuccess`.
- Notificaciones UI: `react-hot-toast` (`toast.success`, `toast.error`).
- Las rutas se cargan con `lazy()` + `<Suspense fallback={<Spinner />}>`.

## Workspace de Ingeniería (`/ingenieria/proyecto/:id`)

Sidebar persistente + accordion 2 columnas, una sola card abierta a la vez. Cada herramienta tiene su carpeta en `client/src/components/ingenieria/<herramienta>` y service+route en backend.

| Herramienta | Ruta UI | Routes backend | Service backend | Schema | Componentes |
|---|---|---|---|---|---|
| **Unifilar** (inline) | card en `/ingenieria/proyecto/:id` | `unifilar.routes.ts` | `unifilarSvg/` (genera SVG y PDF) | `UnifilarVersion` | `components/ingenieria/unifilar/` |
| **Materiales consolidados** | `/ingenieria/materiales-consolidados` + `MaterialesToolPanel` | `consolidador.routes.ts` | (en routes) | `MaterialesConsolidadosVersion` | `MaterialesToolPanel.tsx`, `consolidador/` |
| **Triángulos (cálculo)** | `TriangulosToolPanel` en accordion | `api.routes.ts` (sub-rutas `triangle`) | inline | (PDF buffer, sin tabla propia) | `TriangulosToolPanel.tsx` |
| **Pre-ingeniería** | card en accordion | `preingenieria.routes.ts` | `preingenieriaPdf/`, `minutaExtraction/` | `PreIngenieriaVersion`, `PreIngenieriaFoto` | `components/ingenieria/preing/` |
| **Visita técnica** (operario) | StageDrawer del proyecto + lectura en accordion | `visitas.routes.ts` | `visit-report.service.ts`, `visitReportPdf/`, `whisper.service.ts` | `TechnicalVisit`, `VisitInput`, `VisitReport` | `components/ingenieria/visitas/`, `components/visitas/VisitFloatingButton.tsx` |
| **Proyecto Final de Ingeniería (EFP)** | `/ingenieria/proyecto/:projectId/proyecto-final` | `efp.routes.ts` | `efp.service.ts`, `efpPdf/` | `EngineeringFinalProject`, `EFPVersion`, `EFPAttachment` | `components/ingenieria/efp/` |
| **Memoria técnica** | (próximamente) | — | — | — | — |

Sección "Documentos técnicos generados" del workspace junta los `FileAttachment` con `toolSource` configurado y los muestra agrupados; misma sección en formato compacto en el StageDrawer del proyecto para roles que no entran al módulo.

## Política de versionado del producto

- Versión actual en `client/src/version.ts` como string `"X.Y"` (hoy `"6.2"`). El footer de la app la muestra en todas las pantallas con un historial clickeable que lee `CHANGELOG.md`.
- **NO bumpear por iniciativa propia**, aunque haya algo "publicable". Iteramos varios cambios chicos sobre la misma versión mientras probamos; bumpear cada vez ensucia el historial. Reportar el cambio y dejar la decisión al usuario.
- Bumpear sólo cuando el usuario lo pide explícitamente: "nueva versión", "bumpeá", "pasemos a la X", "cerremos versión", "publicá".
- Cuando lo pida:
  1. Reportar la versión actual.
  2. Proponer **+0.1** por defecto (ej. 5.2 → 5.3).
  3. Pedir confirmación si la diferencia es alta o el número no fue especificado.
- Releases bundleados: a veces se acumulan varias sub-features bajo una sola versión (patrón histórico: "Fase F = F.1+F.2+F.3+F.4 → v2.5"). En esos casos no bumpear hasta cerrar la fase completa y pasar el chequeo end-to-end del usuario.
- Una vez confirmado el bump, actualizar **los 3 archivos en sincronía**:
  1. `VERSION` en `client/src/version.ts`.
  2. `CHANGELOG.md` (symlink → `client/public/CHANGELOG.md`): nueva cabecera al tope debajo de `# Novedades`.
  3. `client/src/data/latestRelease.ts`: reemplazar `LATEST_RELEASE` con la nueva, mover la anterior al tope de `OLDER_RELEASES` con `shortDate` corto (ej. "30 abr").
- Después del bump correr typecheck + build, y luego `bash save.sh` (autorizado para trazar commit + push).

### Estructura del CHANGELOG

Lenguaje **de usuario final** (español rioplatense), nada de paths, endpoints, nombres de componentes ni tecnicismos. Describir el cambio desde la perspectiva del usuario en la UI.

Jerarquía exacta de headings:

```
# Novedades                       ← título único del archivo
## vX.Y                           ← versión, sin fecha en cabecera
### {día} de {mes} de {año}       ← cada día con cambios, más reciente arriba
#### {Tema}                       ← subsección temática del día
- bullet conciso
```

- Si ya existe entrada para hoy → agregar las nuevas subsecciones `####` **dentro** de ese bloque `###`.
- Si es el primer cambio del día → crear nuevo `### {fecha}` arriba del día anterior, inmediatamente después de la cabecera de versión.
- Los bug fixes van en `#### Arreglos` al final del día.
- Cambios puramente internos / refactors / docs que no afectan al usuario pueden omitirse.
- Mantener el CHANGELOG **al cerrar cada cambio funcional**, antes de cerrar la respuesta — no esperar al bump.

## Roadmap de infraestructura (en curso)

- [x] Fase 1: Dockerizar desarrollo local.
- [ ] Fase 2: VPS (Hetzner Ashburn, Ubuntu 24.04).
- [ ] Fase 3: DNS + reverse proxy (Caddy) + subdominios desde cPanel.
- [ ] Fase 4: Deploy de producción con backup pre-deploy automático.
- [ ] Fase 5: Backups periódicos a Backblaze B2 + storage/ respaldado.
- [ ] Fase 6: Migrar bot de Telegram al mismo VPS.

## Estado de Propuestas v2 (v7.1 — trabajo reciente)

Handoff completo con lo hecho, lo pendiente (deploy/negocio/deuda) y los archivos
clave: **`docs/pendientes/estado-proposals-v2.md`**. Puntos que suelen morder:

- El **constructor ya no es página**: es un **modal** (`ProposalBuilderModal` +
  `LargeModal`); `/leads/:leadId/propuesta` se eliminó (redirige a `/ventas`).
- El **panel del lead** es un `LargeModal` centrado (no `<aside>`), con dos columnas.
- `GET /api/leads/:leadId/proposals` devuelve la **lista unificada** (propuestas
  nuevas `ProposalV2Version` + viejas `ProposalGeneration`).
- **Adjuntos por lead** viven en `FileAttachment` (campo `leadId`), no hay modelo
  dedicado; se copian al proyecto al convertir (`copyLeadAttachmentsToProject`).
- Cálculo: `/draft/calc` es **admin-only**; `/draft/viability` es **VENTAS:VIEW**.
- **Baseline `tsc` server = 5** (no 7). Suites de test nuevas: `npm run
  test:proposal*`, `test:lead-proposals`, `test:viability`, `test:lead-attachments`.
- **Prod**: el `docker-compose.prod.yml` solo forwardea 7 env al server — faltan
  `SMTP_ENCRYPTION_KEY`, `ANTHROPIC/OPENAI_API_KEY`, `SMTP_*`, `TWILIO_*` (ver
  DEPLOY.md §2), y hay scripts one-off de plantilla de email a correr (DEPLOY.md §6).

## Última feature mergeada — v6.2 (31 de mayo de 2026)

**Finanzas — Estado de resultados en USD y mejoras de Flujo de fondos**: el "Estado de resultados" (pestaña `/finanzas/resultados`, endpoint `/finance/results`) ahora convierte UYU→USD y muestra todos los montos en dólares (antes los pasaba a pesos). En "Flujo de fondos" se corrigió la proyección de costos fijos que se salteaba un mes cuando el día actual es 31 (`buildFixedCostEventsForRange`, ahora avanza los meses con aritmética en vez de `addMonths` sobre la fecha con día) y se agregó un filtro por tipo de movimiento (toggle on/off, "Todos"/"Ninguno") que afecta el listado, el gráfico y los totales.

### Feature anterior — v5.2 (5 de mayo de 2026)

**Proyecto Final de Ingeniería (EFP)**: documento integrador que combina pre-ingeniería + visitas técnicas + criterio profesional. La IA arma el primer borrador (7 secciones predefinidas) y el proyectista lo refina inline con auto-save (debounce 1.5s). Versionado N: "Regenerar con IA" o "Snapshot" crea v2/v3/…; edición inline actualiza la versión actual sin crear una nueva. Soporta anexos extra (datasheets, planos), exporta PDF profesional con header Voltia.

**Archivos clave**:

- Schema: `EngineeringFinalProject`, `EFPVersion`, `EFPAttachment` (`server/prisma/schema.prisma:1912-1990`).
- Backend: `server/src/routes/efp.routes.ts`, `server/src/services/efp.service.ts`, `server/src/services/efpPdf/index.ts`.
- Frontend: `client/src/pages/ProyectoFinal.tsx`, `client/src/api/efp.api.ts`, `client/src/components/ingenieria/efp/`.
- Permisos: solo `INGENIERIA` y `ADMIN` pueden editar/regenerar; otros roles del módulo ven en lectura.

Antes (v5.1) se había liberado **Visita técnica con IA** (audio/foto/nota → informe estructurado, transcripción Whisper). En v5.2 se simplificó a "un informe vivo por visita" + FAB de audio flotante en pantallas de proyecto + el informe ya no usa contexto previo del proyecto, solo lo que el operario relevó.
