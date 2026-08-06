# 01 · Fundamentos

Los mecanismos que atraviesan toda la aplicación: quién entra, quién puede qué,
qué queda registrado, dónde van los archivos y cómo se versionan los documentos
que la app genera. Casi todos los capítulos siguientes dan por sabido lo que
está acá.

---

## 1. Autenticación

### Para qué existe

Identificar al usuario en cada request. La app no tiene usuarios anónimos: todo
—incluido el portal del cliente— pasa por el mismo login.

### Cómo se usa

Se entra con email y contraseña en la pantalla de login. La sesión dura siete
días; vencida, la app pide entrar de nuevo. No hay "recordarme" ni renovación
silenciosa: cuando el token expira, expira.

Los usuarios creados por un administrador (típicamente los clientes del portal)
arrancan con una **contraseña temporal**. Mientras la marca `passwordTemporary`
esté activa, la app fuerza el cambio de contraseña antes de dejar navegar a
cualquier otra pantalla.

### Cómo funciona

Todo el sistema son 76 líneas en `server/src/middleware/auth.middleware.ts`.

**Emisión** — `signToken()`: un JWT firmado con `JWT_SECRET` (HS256) que lleva
`{ sub: userId, email, name, role }`, donde `role` es el **nombre** del rol como
string, no su id. Expira según `JWT_EXPIRES_IN`, por defecto `7d`.

**Validación** — `authenticate()`, que se monta como `preHandler` y hace cinco
cosas en orden:

1. Exige el header `Authorization: Bearer <token>`. **No lee cookies ni query
   params.**
2. Verifica la firma. Si falla, 401.
3. **Rechaza cualquier token que traiga el campo `typ`** (ver más abajo).
4. Busca el usuario en la base **en cada request**, trayendo su rol y su
   `deletedAt`.
5. Si el usuario no existe o está borrado, 401. Si no, escribe `request.user`.

El paso 4 es un query a la base por cada llamada a la API. Es el precio de que
dar de baja a un usuario lo desconecte de inmediato: como no hay tabla de
sesiones ni lista de revocación, **soft-deletear al usuario es la única forma de
invalidar un token antes de que expire**.

### Endpoints

| Método y ruta | Qué hace | Guard |
|---|---|---|
| `POST /auth/login` | Devuelve `{ token, user }` | ninguno |
| `POST /auth/change-password` | Cambia la contraseña y baja `passwordTemporary` | `authenticate` |

Se registran **sin el prefijo `/api`** (`server/src/routes/index.ts`). No hay
`/auth/logout` —cerrar sesión es borrar el token del lado del cliente— ni
refresh tokens.

### El campo `typ`: tokens de propósito acotado

Un token de sesión **nunca** lleva `typ`. Los tokens de propósito acotado —los
que autorizan una sola cosa por poco tiempo— sí, y `authenticate` los rechaza
por diseño.

La asimetría es deliberada y hay que conservarla: esos tokens viajan en la URL
(un `<video src>` no puede mandar headers), así que se filtran por el historial
del navegador, los logs y las capturas de pantalla. Sin el rechazo, un token que
solo debía servir para mirar un video valdría como sesión completa.

El único uso hoy es el streaming de videos, en `server/src/routes/videos.routes.ts`:

- `signStreamToken()` firma `{ typ: "ensayo-stream", vid: videoId, sub: userId }`
  con el mismo `JWT_SECRET` y **15 minutos** de vida.
- `verifyStreamToken()` valida que `typ` sea el esperado **y** que `vid`
  corresponda al video pedido. Sin ese segundo chequeo, un token de un video
  serviría para bajar cualquier otro conociendo su id.
- `GET /api/videos/:id/stream?t=<token>` es **la única ruta de la API sin
  `authenticate`**.
- `server/src/index.ts` redacta el `?t=` de los logs con `redactStreamToken()`.

**Es el patrón a copiar** para cualquier enlace que deba abrirse sin sesión.

### No existe

Ni API keys, ni tokens de servicio, ni cuentas de máquina, ni magic links, ni
invitaciones por link, ni SSO. Toda acción la ejecuta un usuario real: `AuditLog.userId`
es una clave foránea obligatoria con `onDelete: Restrict`, así que **no hay forma
de registrar una acción sin un usuario detrás**.

---

## 2. Permisos

### Para qué existe

Decidir qué puede hacer cada rol. No está programado en el código: es una tabla
que se edita desde la pantalla de administración, así que cambiar quién puede
borrar una propuesta no requiere tocar el código ni desplegar.

### Cómo se usa

La matriz vive en Administración → Permisos: una grilla de **módulo × acción**
por cada rol. Marcar una casilla habilita esa combinación.

Si alguien intenta algo sin permiso, el backend responde 403 y el frontend
muestra un aviso y lo manda al dashboard. El menú tampoco muestra los módulos
que el rol no puede ver.

### Cómo funciona

Una fila en la tabla `permissions` por cada combinación permitida
(`@@unique([roleId, module, action])`). Si no hay fila, no hay permiso.

`server/src/middleware/authorize.middleware.ts` expone cuatro funciones:

| Función | Para qué |
|---|---|
| `authorize(module, action)` | `preHandler` de una ruta. 401 si no hay usuario, 403 si no tiene el permiso. |
| `authorizeAny([{module, action}, …])` | Pasa si tiene **al menos uno**. Para recursos compartidos entre módulos. |
| `hasPermission(roleName, module, action)` | El chequeo crudo, sin Fastify. Útil fuera de una ruta. |
| `clearPermissionCache()` | Vacía el cache. |

**El rol se resuelve por nombre**: `request.user.role` es el string del nombre
del rol, y la consulta busca `role: { name: roleName }`.

**No hay atajo para ADMIN.** El rol administrador pasa porque tiene todas las
filas en la tabla, no porque el código lo exceptúe. Si a un ADMIN se le borran
las filas de un módulo, deja de poder entrar. (Hay excepciones puntuales
*dentro* de algunos handlers, que sí comparan contra el string `"ADMIN"`: el
acceso a tareas ajenas, el `assertAdmin()` de la administración de roles y la
regeneración de PDFs de propuesta.)

### El cache y su trampa

`hasPermission()` cachea el resultado en memoria del proceso, con clave
`rol:módulo:acción` y **5 minutos** de vida. Cachea también los negativos.

`clearPermissionCache()` se llama al crear, editar o borrar un rol. **En ningún
otro lado.** Dos consecuencias que explican la mayoría de los "le di el permiso
y no lo toma":

1. Editar filas de permisos por fuera de esos endpoints (un script, Prisma
   Studio, SQL a mano) **no invalida el cache**: el cambio tarda hasta 5 minutos.
2. El cache es por proceso. Con más de una instancia del servidor, cada una tiene
   el suyo y se desincronizan hasta que vencen.

### Los módulos

19 valores en el enum `Module`:

```
VENTAS · ONBOARDING · INGENIERIA · OPERACIONES · HABILITACION · POSTVENTA
METRICAS · CONFIGURACION · USUARIOS · FINANZAS · STOCK · TRAMITES_UTE
PORTAL_CLIENTE · INFORMES · EXPERIENCIA_CLIENTES · COMISIONES · TRASPASOS
TICKETS · ENCUESTAS
```

### Las acciones

11 valores en el enum `Action`. Las seis primeras son las genéricas; el resto son
gates de funcionalidades puntuales:

| Acción | Qué habilita |
|---|---|
| `VIEW` | Ver el módulo. Es también lo que decide si aparece en el menú. |
| `CREATE` / `EDIT` / `DELETE` | Las escrituras. |
| `COMPLETE` | Cerrar subetapas y checklists. |
| `COMMENT` | Comentar. **Declarada en la matriz de VENTAS pero ningún endpoint la chequea**: hoy `POST /api/comments` solo exige estar autenticado. |
| `ACCESS` | **Sin uso.** Se pensó como gate grueso de "puede entrar al módulo" y nunca se implementó; sus filas se borraron en la migración `20260805210000`. El valor sigue en el enum porque Postgres no deja quitarlo sin recrear el tipo. |
| `ACCESS_MEMORIA` | La memoria de cálculo de propuestas. Admin por defecto. |
| `DEBUG_CALCULADORA` | El drawer de debug del constructor de propuestas. Admin por defecto. |
| `CONFIRM` | Confirmar un traspaso (módulo TRASPASOS). |
| `ADMIN_REPORT` | Los reportes agregados de traspasos. Admin por defecto. |

Las últimas cinco **no aparecen en el catálogo curado** de la pantalla de
permisos. El endpoint del catálogo las agrega dinámicamente si existen filas
reales en la base, para que "marcar todo / marcar nada" no borre lo que la
pantalla no muestra.

### Permisos que dependen del contexto

`server/src/middleware/authorize-by-stage.middleware.ts` resuelve el módulo **en
tiempo de request**, según a qué etapa pertenece el recurso. Editar una subetapa
de Ingeniería pide `INGENIERIA:EDIT`; la misma ruta sobre una de Operaciones
pide `OPERACIONES:EDIT`.

- `STAGE_TYPE_TO_MODULE` es la fuente única de verdad etapa → módulo.
- `authorizeByStageContext(action)` busca el contexto en este orden:
  `substageId` → `stageId` → `taskId`. Si el recurso no existe devuelve **404, no
  403**, para no filtrar la existencia de recursos ajenos.
- Tiene caches propios de **10 minutos**, y `clearStageModuleCache()` **no se
  llama nunca en producción**: si una tarea cambia de etapa, su contexto de
  permisos puede quedar viejo hasta 10 minutos.

### Roles del sistema

Los crea el seed: `ADMIN`, `OPERACIONES`, `POSTVENTA`, `INGENIERIA`,
`ASESOR_COMERCIAL`, `FINANZAS`, `CLIENT`, `TRAMITACION_UTE`, `EXPERIENCIA_SOLAR`,
`GERENTE_OPERACIONES`, `GERENTE_COMERCIAL`, `GERENTE_INGENIERIA`,
`GERENTE_FINANZAS`, `LOGISTICA`, `CAPATAZ`.

`CLIENT` es especial: solo puede entrar a `/portal/*` y a la pantalla de cambio
de contraseña.

---

## 3. Auditoría

### Para qué existe

Dejar registro de quién hizo qué y cuándo. Se consulta desde la ficha del
proyecto y alimenta el historial del cliente.

### Cómo funciona

`server/src/services/audit.service.ts`, dos funciones:

**`createAuditEntry({ entityType, entityId, projectId?, userId, action,
fieldChanged?, oldValue?, newValue?, description, metadata? })`** — inserta una
fila en `audit_logs`. `userId` y `description` son obligatorios.

**`createAuditEntriesForChanges({ oldData, newData, labels?, formatter?, … })`** —
compara dos objetos campo a campo y escribe **una fila por cada campo que
cambió**, con su etiqueta legible. Es lo que se usa en los PATCH.

### La regla que más importa

**`createAuditEntry` nunca lanza.** Envuelve todo en un `try/catch` y, si falla,
escribe en la consola y sigue. Un problema de auditoría no puede tumbar la
operación que se estaba auditando.

El corolario: **un fallo de auditoría es silencioso**. Si faltan registros, hay
que buscar `"No se pudo insertar AuditLog"` en los logs del servidor.

### Qué se guarda

`entityType`, `entityId`, `projectId?`, `userId`, `action`, `fieldChanged?`,
`oldValue?`, `newValue?`, `description`, `timestamp` y **`metadata` (JSON
libre)**.

`AuditEntityType` tiene 43 valores (project, stage, substage, task, lead,
proposal, finance_movement, payment, commission, ticket, survey, ensayo_video…) y
`AuditAction` 37 (created, updated, deleted, lead_stage_changed, lead_converted,
proposal_v2_version_published, traspaso_confirmado…). **Al agregar una entidad
nueva hay que extender el enum**, y eso es una migración.

**No hay acción `viewed`.** Las lecturas no se auditan; cuando hizo falta dejar
rastro de que un admin miró las tareas de otro, se resolvió con un log de
servidor, no con una fila de auditoría.

**No hay campo de origen** que distinga la interfaz de un script o un job
automático. El único identificador del actor es `userId`. Para marcar procedencia
sin migrar, se usa `metadata` (por ejemplo `{ source: "mcp" }`).

### Qué no se audita hoy

Las **tareas sueltas** (las que no tienen proyecto): su creación y su edición
solo generan registro si tienen `projectId`, y el borrado de una tarea no genera
registro **en ningún caso**. Ver el capítulo [04 · Tareas](04-tareas.md).

---

## 4. Archivos

### Cómo funciona

Los archivos físicos viven en `storage/<projectId>/<uuid>.<ext>`, un volumen de
Docker (`voltia_storage`), y cada uno tiene una fila en `FileAttachment` con la
ruta relativa en `url`.

Dos funciones de entrada, en `server/src/services/file-storage.service.ts`:

- `saveUploadedFile(file, projectId)` para lo que sube un usuario.
- `saveBufferAsAttachment(...)` para lo que genera el servidor (PDFs, SVGs).

`FileAttachment` cuelga de **uno solo** de: proyecto, lead, etapa, subetapa o
informe. Tres campos dan trazabilidad fina del origen: `toolSource`,
`toolVersion` y `toolEntityId`, que permiten mostrar etiquetas como "Ingeniería:
Unifilar v3" y filtrar por herramienta. El borrado es lógico (`deletedAt`).

### HEIC: obligatorio convertir

Las fotos del iPhone llegan en HEIC y **nunca se guardan así**: `heic.service.ts`
las convierte a JPEG al entrar (`esHeic()` + `convertirArchivoHeicAJpeg()`) y
reescribe `filename`, `storedFilename`, `mimeType` y `sizeBytes`.

No es una comodidad, es un requisito: sharp no decodifica HEIC (se romperían las
miniaturas y el PDF de pre-ingeniería), Chrome y Firefox no lo muestran en un
`<img>`, y la API de Claude —que lee cédulas y facturas— solo acepta jpeg, png,
gif y webp.

**Al agregar un endpoint que reciba fotos hay que sumar `esHeic()` a su lista de
tipos permitidos**: algunos navegadores mandan `application/octet-stream`, así
que filtrar solo por mimetype deja el HEIC afuera.

### Videos

Tienen su propia lista de formatos y su propio límite (`MAX_VIDEO_SIZE_MB`, 500
por defecto), aplicado **por ruta** con `request.file({ limits })`. **No se sube
el límite global** para que entre un video: eso abriría la puerta a archivos
enormes por cualquier endpoint. Se comprimen con ffmpeg a H.264 720p y el
original se descarta.

### Borrado

Borrar el objeto dueño debe **soft-deletear el `FileAttachment` y borrar el
archivo físico**. El patrón está establecido en visitas técnicas.

---

## 5. Versionado de documentos generados

Todas las herramientas que producen entregables siguen el mismo patrón:
`UnifilarVersion`, `PreIngenieriaVersion`, `MaterialesConsolidadosVersion`,
`EFPVersion`, `ProposalV2Version`.

La regla es la misma en todas:

- **"Regenerar con IA" o "Snapshot" crea una versión nueva** e incremental, con
  `@@unique([entityId, version])`.
- **La edición inline no versiona**: actualiza la versión actual.

La excepción es `VisitReport`: desde la v5.2 hay **un solo informe vivo por
visita**, que se actualiza en el lugar y no se versiona.

---

## 6. Arranque del servidor

`server/src/index.ts` → `buildServer()`:

| Paso | Detalle |
|---|---|
| Logger | Apagado con `NODE_ENV=test`. Serializer propio que redacta el `?t=` de las URLs. |
| Storage | Crea el directorio si no existe. |
| `@fastify/cors` | Orígenes **hardcodeados** a `localhost:5173` y `127.0.0.1:5173`. No hay variable de entorno para cambiarlo. |
| `@fastify/multipart` | `fileSize` = `MAX_FILE_SIZE_MB` (20 MB por defecto), **un archivo por request**. |
| Error handler | Formatea el error con `formatErrorPayload()`; solo loguea si es 500. |
| Rutas | `registerRoutes(app)`. |

**Solo hay dos plugins registrados.** No hay rate limit HTTP en toda la
aplicación (el único límite es el de consultas a la IA, que es de aplicación), ni
helmet, ni cookies, ni swagger.

### Cómo se montan las rutas

`server/src/routes/index.ts`: el health check, después `registerAuthRoutes(app)`
sin prefijo, y después 25 registros con `prefix: "/api"`.

Cada archivo de rutas es un plugin encapsulado que arranca con
`app.addHook("preHandler", authenticate)`, lo que deja el hook confinado a ese
plugin. **La excepción es `videos.routes.ts`**, que no usa el hook global y pone
el `preHandler` explícito en cada ruta, justamente para poder tener una ruta sin
autenticación.

Ese es el patrón para cualquier módulo que necesite su propia autenticación.

### Trabajos programados

`start()` levanta ocho tareas con `node-cron` antes de escuchar: metas, cotización
del BCU, avisos de vencimiento, traspasos, aviso de habilitación, encuestas de
aniversario, reportes fotovoltaicos y el reporte semanal. Además recupera los
videos que quedaron a medio procesar.

**`buildServer()` no se exporta** y `start()` corre al importar el módulo.

---

## 7. Manejo de errores

`server/src/utils/errors.ts` expone `badRequest`, `unauthorized`, `forbidden`,
`notFound` y `conflict`. Todos arman un error con **código de dominio** y
mensaje, y el error handler los serializa igual:

```json
{ "error": true, "code": "LEAD_NOT_FOUND", "message": "El lead especificado no existe" }
```

El `code` es lo que el frontend usa para decidir; el `message` es lo que ve el
usuario, y por eso está en español rioplatense.

---

## 8. Convenciones de datos

- **Tablas** en `snake_case` y plural (`@@map("file_attachments")`); **modelos
  Prisma** en PascalCase singular.
- **Fechas**: `@db.Timestamptz(6)` para instantes; `@db.Date` para fechas sin
  hora (vencimientos, fecha de una propuesta). La distinción importa: un
  `@db.Date` no se corre por zona horaria.
- **Borrado lógico** con `deletedAt` en casi todo. Toda consulta de lectura
  filtra `deletedAt: null`.
- **Serialización**: `serializeDate()` para instantes y `serializeDateOnly()`
  para fechas, en `server/src/utils/serialization.ts`.
