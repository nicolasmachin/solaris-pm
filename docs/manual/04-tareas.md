# 04 · Tareas y tickets

Tres cosas distintas que conviven y se confunden seguido:

- **Subetapas** — los pasos del pipeline de un proyecto. No son tareas; se
  documentan en [03 · Proyectos](03-proyectos.md).
- **Tareas** (`Task`) — trabajo suelto, con o sin proyecto, asignable a personas.
  Es lo de este capítulo.
- **Tickets** — reclamos y pedidos, casi siempre del cliente, con circuito de
  derivación y resolución. Modelo aparte.

Todo se ve junto en **Mis tareas**, que es la pantalla donde cada uno arranca el
día.

---

## 1. Tareas

### Para qué existen

Cubrir el trabajo que el pipeline no modela. El pipeline sabe que un proyecto
tiene que pasar por Ingeniería, pero no sabe que hay que llamar a un proveedor el
jueves. Las tareas son ese resto: recordatorios con dueño y fecha.

Pueden estar atadas a un proyecto, a un cliente potencial, o a nada.

### Cómo se usa

Se crean desde **Mis tareas** con el botón "Nueva", o desde la ficha del proyecto
en el panel de tareas. Cada una tiene título, descripción opcional, fecha,
asignados y —opcionalmente— un proyecto o un cliente potencial.

El estado se cambia desde el modal de detalle, o marcando el círculo de la
izquierda en el listado para completarla de un toque.

Cada tarea tiene su propio hilo de comentarios en el modal, con formato markdown.

### Los tres estados

| Estado | Qué significa | Dónde aparece |
|---|---|---|
| **Pendiente** | Es acción de hoy o de los próximos días. | Pestaña "Pendientes" |
| **En espera** | Depende de un tercero: el cliente, un organismo, un proveedor. | Pestaña "En espera" |
| **Completada** | Cerrada. | Pestaña "Completadas" |

(El modelo tiene además `IN_PROGRESS`, que sobrevive del flujo viejo de tareas de
proyecto. El selector rápido del panel de proyecto todavía lo ofrece; las
pantallas nuevas no lo usan.)

#### En espera

Existe porque hay trabajo que no es ninguna de las otras dos cosas. Un permiso
municipal que tramita un tercero, un cliente que pidió tiempo para decidir, un
proveedor que todavía no cotizó: dejarlos como pendientes tapa lo que sí es
acción de hoy, y completarlos los borra del radar.

Al poner una tarea en espera se piden dos datos:

- **Qué se está esperando** — obligatorio. Sin motivo, la tarea vuelve a ser
  indistinguible de una pendiente y el estado no aporta nada. El servidor
  rechaza la transición con `WAITING_REASON_REQUIRED`.
- **Cuándo reconsultarlo** — opcional. Es lo que ordena la lista.

Las tareas en espera **no aparecen entre las pendientes**. En su pestaña se
ordenan por fecha de recontacto: arriba lo que hay que retomar antes. El listado
muestra el motivo en lugar de la descripción, y la etiqueta de fecha dice
"Reconsultar" en vez del vencimiento.

Al sacarla de la espera —a pendiente o a completada— **el motivo y la fecha de
recontacto se limpian solos**, para no dejar datos colgados de un estado que ya
no aplica. Editar una tarea en espera sin tocar su estado no la saca de la
espera.

### El vínculo: proyecto o cliente potencial

Una tarea puede colgar de un proyecto (`projectId`), de un cliente potencial
(`leadId`), de los dos, o de ninguno.

- **De un proyecto**: aparece en el panel de tareas del proyecto y se borra con
  él (cascade).
- **De un cliente potencial**: es el pendiente comercial de alguien a quien
  todavía no se le vendió. Se ve en tres lugares: en la sección **Pendientes** de
  la ficha del cliente potencial (todos los del lead, sean de quien sean), en el
  listado de tareas sueltas de "Mis tareas" con el nombre del cliente (solo las
  propias), y en el detalle de la tarea con su código.
- **De nada**: es una tarea suelta. Sigue siendo válido y es lo que hace la
  mayoría de la gente para una nota rápida.

**No hay una regla en la base que obligue a tener uno u otro.** Se evaluó
exigirlo —"ningún pendiente huérfano"— y se descartó: rompería todas las tareas
sueltas existentes, que son legítimamente `projectId: null` sin lead. La regla se
aplica en la capa que crea: lo que nace desde el conector o desde una minuta sí
tiene que traer lead o proyecto.

### Origen

El campo `origin` (`MANUAL` / `MINUTA` / `MCP`) registra de dónde salió la tarea.
Sirve para medir si lo que se crea automáticamente —extraído de una minuta,
dictado por voz— acierta o genera ruido. Todo lo creado desde la interfaz es
`MANUAL`.

### Asignación

La fuente de verdad es la tabla `TaskAssignee`: **varios responsables por tarea,
y cualquiera puede resolverla**. El campo `Task.userId` es el "primario" legacy,
que se mantiene sincronizado con el primer asignado por retrocompatibilidad.

Al crear una tarea sin especificar asignados, **se asigna al creador**. Un array
vacío explícito la deja sin asignar.

---

## 2. Cómo funciona

### Modelo `Task`

`server/prisma/schema.prisma`, tabla `tasks`:

| Campo | Notas |
|---|---|
| `projectId?` | Nullable. Si es null y no hay lead, es una tarea suelta. `onDelete: Cascade`. |
| `leadId?` | Vínculo al cliente potencial. `onDelete: Cascade`. |
| `stageId?` / `substageId?` | Contexto dentro del proyecto. `onDelete: SetNull`. |
| `title`, `description?` | |
| `status` | `PENDING` / `IN_PROGRESS` / `COMPLETED` / `WAITING`. |
| `priority` | `NORMAL` / `URGENT`. |
| `origin` | `MANUAL` / `MINUTA` / `MCP`, por defecto `MANUAL`. |
| `waitingReason?` | Solo con `WAITING`. |
| `followUpAt?` | `@db.Date`. Solo con `WAITING`. |
| `responsible` | **Deprecado.** String libre legacy; los flujos nuevos guardan `""`. |
| `userId?` | Asignado primario legacy, sincronizado con `assignees[0]`. |
| `assignees` | `TaskAssignee[]` — la fuente de verdad. |
| `dueDate?` | `@db.Date`. |
| `completedAt?`, `deletedAt?` | |

**No existe `createdById`**: el modelo no tiene concepto de creador. Quién creó
una tarea solo se puede reconstruir desde la auditoría, y únicamente si la tarea
tiene proyecto.

### Endpoints

Dos familias que conviven. Las de proyecto son el flujo viejo; las de `/api/tasks`
son las nuevas y soportan los dos casos.

**Tareas de proyecto** (`server/src/routes/api.routes.ts`):

| Método y ruta | Permiso |
|---|---|
| `GET /api/projects/:projectId/tasks` | `OPERACIONES:EDIT` |
| `POST /api/projects/:projectId/tasks` | `OPERACIONES:EDIT` |
| `PATCH /api/projects/:projectId/tasks/:taskId` | `authorizeByStageContext(EDIT)` — el módulo depende de la etapa |
| `DELETE /api/projects/:projectId/tasks/:taskId` | `OPERACIONES:EDIT` |

La asimetría es real: GET, POST y DELETE piden `OPERACIONES:EDIT` fijo, mientras
que el PATCH resuelve el módulo según la etapa de la tarea.

**Tareas por id** (sirven para sueltas y de proyecto):

| Método y ruta | Permiso |
|---|---|
| `POST /api/tasks` | Autenticado |
| `GET /api/tasks/:id` | Autenticado + `userCanAccessTask`, **o** `VENTAS:VIEW` si la tarea cuelga de un lead |
| `PATCH /api/tasks/:id` | Autenticado + `userCanAccessTask` |
| `DELETE /api/tasks/:id` | Autenticado + `userCanAccessTask` |
| `GET /api/my-tasks` | Autenticado |
| `GET /api/leads/:id/tasks` | `VENTAS:VIEW` |

`GET /api/leads/:id/tasks` devuelve **todos** los pendientes del lead, sin filtrar
por asignado, con la misma forma que los `standaloneTasks` de `/api/my-tasks`
(salvo el `urgencyRank`, que no incluye: el orden lo fija el backend — abiertas
primero por vencimiento, completadas al fondo). Por defecto excluye las
completadas; `?includeCompleted=true` las trae.

La lectura de `GET /api/tasks/:id` se relajó para que ese listado sea coherente:
si la tarea tiene `leadId` y el usuario tiene `VENTAS:VIEW`, puede abrir el
detalle aunque no sea asignado. **La escritura no**: `PATCH` y `DELETE` siguen
exigiendo `userCanAccessTask`, así que un no-asignado ve la tarea pero recibe 403
si intenta modificarla.

**Comentarios de tareas**:

| Método y ruta | Quién |
|---|---|
| `GET` / `POST /api/tasks/:taskId/comments` | Quien pase `userCanAccessTask` |
| `PATCH` / `DELETE /api/tasks/:taskId/comments/:commentId` | **Solo el autor.** A diferencia de los comentarios de proyecto y de lead, acá ADMIN no tiene poder extra. |

`userCanAccessTask(task, user)` está en `api.routes.ts` y devuelve verdadero si el
usuario es ADMIN, si es el asignado primario, o si está entre los `assignees`.
**Requiere que la consulta haya traído `assignees`**; si no, el chequeo fino
falla por omisión.

### Transiciones de estado

No hay endpoint de "completar": se hace con `PATCH` mandando `status`.

- `COMPLETED` setea `completedAt`. En el PATCH por id, volver a `PENDING` lo
  limpia; **en el PATCH de proyecto no se limpia** (queda la fecha de cuando se
  había completado).
- `WAITING` exige `waitingReason`. Salir de `WAITING` limpia `waitingReason` y
  `followUpAt`.
- El PATCH por id acepta `PENDING`, `COMPLETED` y `WAITING`, **no `IN_PROGRESS`**.

La lógica de los campos de espera está centralizada en `applyWaitingFields()`,
que usan los dos PATCH.

### `GET /api/my-tasks`

Devuelve tres listas en una sola respuesta:

| Lista | Qué trae |
|---|---|
| `blocks` | Etapas activas con subetapas pendientes del usuario, agrupadas por proyecto. |
| `tasks` | Tareas **con proyecto**, de proyectos no archivados ni completados. |
| `standaloneTasks` | Tareas **sin proyecto** (incluidas las que cuelgan de un lead). |

**Parámetros**: `taskScope` (`pending` por defecto, `waiting`, `completed`) y
`userId`.

`taskScope` **solo afecta a las tareas**; la lista de etapas es siempre la misma.
El filtro lo arma `taskStatusFilterForScope()`, y lo importante es que `pending`
excluye explícitamente `WAITING`.

**Un ADMIN puede pasar `userId`** para ver las tareas de otra persona. En ese
caso los módulos visibles se calculan con **el rol del usuario consultado**, no
con el del admin: se ve lo que vería el otro. Queda un log de servidor
(`my_tasks_admin_view`), no una fila de auditoría, porque `AuditAction` no tiene
un valor para lecturas.

**Orden**: `urgencyRank()` clasifica en 0 (atrasada o vence hoy), 1 (≤ 7 días),
2 (> 7 días) y 3 (sin fecha). Con `taskScope=waiting`, el rango se calcula sobre
`followUpAt` en lugar de `dueDate`.

### Auditoría: el agujero

Las tareas **con proyecto** se auditan al crear y al editar. Las **tareas
sueltas no dejan ningún rastro**, y el `DELETE` no audita en ningún caso.

Es una limitación conocida, no un descuido puntual: sumada a la ausencia de
`createdById`, hoy no hay forma de saber quién creó ni quién borró una tarea
suelta.

---

## 3. La pantalla Mis tareas

`client/src/pages/MisTareas.tsx`, con `StandaloneTasksBlock` y `TaskDetailModal`
en `client/src/components/tasks/`.

De arriba hacia abajo:

1. **Filtros** de alcance (Todas / Mías) y orden.
2. **Bloques de etapas**: un acordeón por etapa activa con sus subetapas
   pendientes.
3. **Tareas asignadas**: las de proyecto, con el toggle Pendientes / En espera /
   Completadas.
4. **Tareas sueltas**: las que no tienen proyecto, con el mismo toggle y el botón
   "Nueva".

El toggle es uno solo y gobierna las dos listas.

### El modal de detalle

`TaskDetailModal` sirve para crear y para editar. En edición trae el detalle del
servidor y muestra abajo el hilo de comentarios.

El selector de estado tiene tres botones. "Pendiente" y "Completada" aplican el
cambio de inmediato; **"En espera" no**: despliega un panel con el motivo y la
fecha de recontacto, porque el servidor rechaza la transición sin motivo. El
botón de confirmar queda deshabilitado hasta que haya texto.

Si la tarea cuelga de un cliente potencial, el modal lo muestra con su código.
**No linkea**: en Ventas el lead abierto es estado interno del componente y no
está en la URL, así que no hay a dónde apuntar.

Al abrirlo con `defaultLeadId` (lo hace la ficha del lead), la tarea creada nace
colgada de ese lead. **No hay selector de cliente potencial en el formulario**:
el vínculo se hereda del lugar desde donde se creó, o se cambia por API.

### Pendientes en la ficha del cliente potencial

`client/src/components/sales/LeadTasks.tsx`, dentro del panel del lead
(`client/src/pages/Sales.tsx`, columna derecha, debajo de las propuestas).

Lista los pendientes del lead **de todo el equipo**, no solo los del usuario que
mira: el trabajo pendiente de un lead es información del lead, igual que sus
comentarios o adjuntos. Cada fila muestra título, descripción (o el motivo de
espera si está `WAITING`), asignados y una insignia de vencimiento —o de fecha de
recontacto, si está en espera— con los mismos colores que "Mis tareas".

- El **checkbox** completa o reabre en el acto, y **solo aparece habilitado para
  los responsables de esa tarea (o ADMIN)**: el servidor rechaza el cambio a
  cualquier otro, así que no se ofrece.
- El **clic en la fila** abre `TaskDetailModal` para editar.
- **"Nueva"** —solo con `VENTAS:EDIT`, el mismo permiso que gobierna el resto de
  la edición del lead— crea un pendiente ya atado al lead.
- **"Ver completadas"** alterna `includeCompleted`.

Las mutaciones invalidan `["lead-tasks"]` además de `["my-tasks"]` y
`["dashboard-my-tasks"]` (en `useStandaloneTasks` y en `TaskDetailModal`), para
que las dos vistas queden en sincronía.

---

## 4. Tickets

### Para qué existen

Los reclamos y pedidos que llegan del cliente y necesitan circuito: se abren, se
derivan a un área, alguien los toma, se resuelven y se cierran. Una tarea no
alcanza porque no tiene ese recorrido ni es visible para el cliente.

### Cómo funciona

**Modelo aparte, no comparte nada con `Task`.** `Ticket` y `TicketComment` en el
schema; la lógica en `server/src/services/tickets/tickets.service.ts` y las rutas
en `server/src/routes/tickets.routes.ts`.

Diferencias que importan frente a una tarea:

- **`projectId` es obligatorio.** Un ticket siempre cuelga de un proyecto.
- Tiene `origenCliente`, que distingue lo que abrió el cliente desde el portal.
- Los comentarios tienen `esInterno`: una nota que el cliente **no ve**.
- `creadoPorId`, `asignadoAId` y `resueltoPorId` son strings **sin clave foránea**
  a `users`.

**Estados**: `ABIERTO` → `DERIVADO` → `EN_PROGRESO` → `RESUELTO` → `CERRADO`.
**Prioridades**: `BAJA`, `MEDIA`, `ALTA`.

### Endpoints

Todos bajo `/api/tickets`, con permisos del módulo `TICKETS`:

| Ruta | Permiso |
|---|---|
| `GET /api/tickets`, `GET /api/tickets/:id` | `TICKETS:VIEW` |
| `POST /api/tickets` | `TICKETS:CREATE` |
| `PATCH /api/tickets/:id` | `TICKETS:EDIT` |
| `DELETE /api/tickets/:id` | `TICKETS:DELETE` |
| `POST /api/tickets/:id/comentarios` | `TICKETS:EDIT` |
| `POST /api/tickets/:id/derivar`, `/en-progreso`, `/resolver`, `/cerrar` | `TICKETS:EDIT` |

Del lado del cliente, el portal expone `/api/client/tickets` con permisos de
`PORTAL_CLIENTE` (ver [10 · Portal del cliente](10-portal-cliente.md)).

### Limitación actual

**`asignadoAId` nunca se setea.** No existe asignación real de tickets: el campo
está en el modelo pero ningún flujo lo escribe. Definir el modelo de asignación
es requisito para mostrar "asignado actual" en la cabecera.

---

## 5. Casos borde

- **Una tarea con proyecto y con lead a la vez** es válida. Aparece en el panel
  del proyecto y también cuenta como pendiente comercial.
- **Borrar el lead borra sus tareas** (cascade). Lo mismo con el proyecto.
- **Convertir un lead en proyecto no mueve sus tareas**: quedan colgadas del
  lead, que sigue existiendo. Los comentarios sí se re-vinculan al proyecto.
- **`WAITING` no tiene vencimiento propio**: si `followUpAt` está vacío, la tarea
  cae al final de la lista con rango "sin fecha" y puede quedar olvidada.
- **El selector rápido del panel de proyecto no ofrece "En espera"** a propósito:
  poner algo en espera exige escribir el motivo, y eso vive en el modal.
- **Una tarea de un proyecto archivado o completado desaparece de Mis tareas**
  aunque siga pendiente. Se sigue viendo desde la ficha del proyecto.
