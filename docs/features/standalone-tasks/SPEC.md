# Tareas Sueltas (Standalone Tasks) — Especificación Técnica

> Feature que permite crear tareas no atadas obligatoriamente a un proyecto,
> gestionables desde "Mis Tareas" y desde la página de proyecto.
> v1.0 — Mayo 2026

---

## Tabla de contenidos

1. Contexto y objetivo
2. Modelo de datos
3. API REST
4. UI / Componentes
5. Casos de prueba
6. Fuera de alcance
7. Apéndice

---

## 1. Contexto y objetivo

Hoy el modelo `Task` ya existe y está siempre vinculado a un `projectId`.
La sección "Mis Tareas" muestra dos bloques:
- Subetapas (`Substage`) pendientes por proyecto.
- Tareas (`Task`) por proyecto.

El objetivo es permitir tareas sin proyecto obligatorio ("tareas sueltas"),
asignables a cualquier usuario, editables después de creadas, con estados
`PENDING` / `COMPLETED`, visibles en "Mis Tareas" como un tercer bloque
separado.

---

## 2. Modelo de datos

### 2.1 Cambio en `Task`

El campo `projectId` actualmente es obligatorio. Hay que hacerlo **nullable**.

```prisma
model Task {
  id           String    @id @default(cuid())
  title        String
  description  String?
  status       TaskStatus @default(PENDING)
  dueDate      DateTime?

  // Ahora nullable — si es null es una tarea suelta
  projectId    String?
  project      Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  assignedUserId String?
  assignedUser   User?   @relation("TaskAssignee", fields: [assignedUserId], references: [id])

  createdById  String
  createdBy    User     @relation("TaskCreator", fields: [createdById], references: [id])

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([projectId])
  @@index([assignedUserId])
  @@map("tasks")
}
```

**Decisiones de diseño:**
- `projectId` pasa de `String` a `String?`. Migración simple, no destructiva.
- Si `projectId` es null → tarea suelta.
- `onDelete: Cascade` se mantiene: si se borra el proyecto, sus tareas se borran.
  Las tareas sueltas no tienen proyecto, así que no les aplica.
- `createdById` sigue siendo obligatorio — siempre sabemos quién la creó.
- `assignedUserId` ya era nullable → sin cambio.

> **IMPORTANTE:** Verificar el schema real antes de aplicar. Si ya existe
> alguna constraint `NOT NULL` en la columna `projectId` en la DB, la
> migration debe manejarla. Prisma lo hace automático con `migrate dev`.

---

## 3. API REST

### 3.1 Endpoints nuevos / modificados

#### `GET /api/tasks` — Listar tareas (modificado)

Ya existe para tareas de proyecto. Se agrega soporte para tareas sueltas.

**Auth:** Autenticado. Sin `authorize()` extra (igual que substages en my-tasks).

**Query params:**

| Param | Tipo | Descripción |
|---|---|---|
| `standalone` | `boolean` | Si `true`, devuelve solo tareas sin proyecto |
| `assignedTo` | `string` (userId) | Filtrar por usuario asignado. Solo ADMIN puede pedir otro userId; no-admin solo ve el suyo |
| `status` | `PENDING \| COMPLETED` | Filtrar por estado |

**Response:**
```json
[
  {
    "id": "cuid",
    "title": "Revisar propuesta comercial",
    "description": "...",
    "status": "PENDING",
    "dueDate": "2026-06-01T00:00:00.000Z",
    "projectId": null,
    "project": null,
    "assignedUserId": "cuid",
    "assignedUser": { "id": "...", "name": "...", "email": "..." },
    "createdById": "cuid",
    "createdBy": { "id": "...", "name": "..." },
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

#### `POST /api/tasks` — Crear tarea (modificado)

Actualmente requiere `projectId`. Pasa a ser opcional.

**Auth:** Autenticado.

**Body:**
```json
{
  "title": "string (requerido, min 1, max 200)",
  "description": "string? (max 2000)",
  "dueDate": "ISO date string? (opcional)",
  "projectId": "string? (opcional — si viene, debe existir)",
  "assignedUserId": "string? (opcional — si viene, debe ser usuario activo)"
}
```

**Validaciones:**
- `title` requerido.
- `projectId` si viene → validar que el proyecto exista → 400 si no.
- `assignedUserId` si viene → validar que sea usuario activo → 400 si no.
- `createdById` = usuario autenticado (del request).

**Response:** `201` con la tarea creada (mismo shape que GET).

---

#### `PATCH /api/tasks/:id` — Editar tarea

Ya existe o hay que crearlo. Debe soportar edición de todos los campos
incluyendo `projectId` (para vincular/desvincular proyecto después de creada).

**Auth:** Autenticado. El usuario puede editar tareas que creó o que le están asignadas. ADMIN puede editar cualquiera.

**Body (todos opcionales):**
```json
{
  "title": "string?",
  "description": "string?",
  "dueDate": "ISO date string? | null",
  "projectId": "string? | null",
  "assignedUserId": "string? | null",
  "status": "PENDING | COMPLETED"
}
```

**Validaciones:**
- Si `projectId` viene y no es null → validar que el proyecto exista.
- Si `assignedUserId` viene y no es null → validar que sea usuario activo.
- Si el usuario no es ADMIN y no es creador ni asignado → 403.

**Response:** `200` con la tarea actualizada.

---

#### `DELETE /api/tasks/:id` — Eliminar tarea

**Auth:** ADMIN o creador de la tarea.

**Response:** `204`.

---

#### `GET /api/my-tasks` — Modificado para incluir standalone

Agregar al response un bloque `standaloneTasks` con las tareas sueltas
asignadas al usuario (o creadas por él si no tiene asignado).

**Response modificado:**
```json
{
  "substageBlocks": [...],   // ya existente
  "taskBlocks": [...],       // ya existente
  "standaloneTasks": [       // NUEVO
    {
      "id": "...",
      "title": "...",
      "description": "...",
      "status": "PENDING",
      "dueDate": "...",
      "assignedUser": { "id": "...", "name": "..." },
      "createdBy": { "id": "...", "name": "..." }
    }
  ]
}
```

**Lógica de inclusión en `standaloneTasks`:**
- `projectId IS NULL`
- Y (`assignedUserId = me` OR `createdById = me`)
- Y `status = PENDING`
- Si el request viene con `?userId=X` y el usuario es ADMIN → usar userId X

---

### 3.2 Manejo de errores

| Caso | Status | Mensaje |
|---|---|---|
| `projectId` no existe | 400 | "El proyecto especificado no existe" |
| `assignedUserId` inactivo o inexistente | 400 | "El usuario asignado no existe o está inactivo" |
| No es dueño ni admin para editar | 403 | "No tenés permiso para modificar esta tarea" |
| Tarea no encontrada | 404 | "Tarea no encontrada" |

---

## 4. UI / Componentes

### 4.1 Sección en "Mis Tareas"

Agregar un tercer bloque debajo de los dos existentes:

```
┌─────────────────────────────────────────┐
│  Subetapas por proyecto                 │  (ya existe)
├─────────────────────────────────────────┤
│  Tareas por proyecto                    │  (ya existe)
├─────────────────────────────────────────┤
│  Tareas sueltas          [+ Nueva]      │  (NUEVO)
│  ─────────────────────────────────────  │
│  ☐  Revisar propuesta ...   Juan P.    │
│     Sin proyecto              Hoy       │
│  ☐  Llamar proveedor ...    (yo)       │
│     Sin proyecto           01-jun       │
└─────────────────────────────────────────┘
```

- Cada fila: checkbox (marcar completada), título, usuario asignado, fecha.
- Click en la fila → abre modal de detalle/edición.
- Botón `+ Nueva` en el header del bloque → abre modal de creación.
- Las tareas completadas se ocultan del listado (igual que el comportamiento actual).

### 4.2 Modal de creación/edición

Reutilizar el patrón de modal existente para tareas de proyecto. Campos:

| Campo | Tipo | Requerido |
|---|---|---|
| Título | text input | Sí |
| Descripción | textarea | No |
| Fecha de vencimiento | date picker | No |
| Proyecto | select (ProjectSelect o similar) | No |
| Asignado a | UserSelect | No (default: yo mismo) |

- El campo "Proyecto" usa el componente selector de proyectos existente (o uno nuevo simple con búsqueda).
- Si se selecciona proyecto → la tarea se vincula.
- Si se borra el proyecto del select → `projectId = null`.
- El campo "Asignado a" usa `UserSelect` existente.
- Al guardar → invalidar query de `my-tasks`.

### 4.3 Desde la página de proyecto

En `ProjectDetail` (o donde viven las tareas del proyecto hoy), agregar
en el mismo panel/tab de tareas la capacidad de crear tareas sueltas.

Alternativa más simple: el modal de creación de tarea desde el proyecto
ya pre-rellena el `projectId` pero permite dejarlo en blanco.
→ **Recomiendo esta opción**: es más simple y consistente.

### 4.4 Componentes a crear/modificar

| Componente | Acción |
|---|---|
| `StandaloneTasksBlock.tsx` | Nuevo — bloque en Mis Tareas |
| `StandaloneTaskModal.tsx` | Nuevo — modal crear/editar tarea suelta |
| `useStandaloneTasks.ts` | Nuevo hook TanStack Query para `GET /api/tasks?standalone=true` |
| `MyTasksPage.tsx` | Modificar — agregar tercer bloque |
| `my-tasks.routes.ts` (server) | Modificar — agregar `standaloneTasks` al response |
| `tasks.routes.ts` (server) | Modificar — `projectId` opcional en POST, agregar PATCH |

---

## 5. Casos de prueba

### Backend
- [ ] `POST /api/tasks` sin `projectId` → crea tarea suelta (201)
- [ ] `POST /api/tasks` con `projectId` inválido → 400
- [ ] `POST /api/tasks` con `assignedUserId` de usuario inactivo → 400
- [ ] `GET /api/my-tasks` → incluye `standaloneTasks` del usuario autenticado
- [ ] `GET /api/my-tasks?userId=X` como ADMIN → incluye standalone de X
- [ ] `GET /api/my-tasks?userId=X` como no-ADMIN → ignora el param, devuelve las propias
- [ ] `PATCH /api/tasks/:id` — vincular proyecto → `projectId` se actualiza
- [ ] `PATCH /api/tasks/:id` — desvincular proyecto → `projectId = null`
- [ ] `PATCH /api/tasks/:id` como usuario sin permiso → 403

### Frontend
- [ ] Bloque "Tareas sueltas" aparece en Mis Tareas
- [ ] Botón "+ Nueva" abre modal vacío
- [ ] Crear tarea sin proyecto → aparece en el listado
- [ ] Crear tarea con proyecto → aparece en el listado con badge de proyecto
- [ ] Click en fila → modal de edición con datos pre-llenados
- [ ] Marcar como completada → desaparece del listado
- [ ] Editar proyecto en modal → tarea se mueve al bloque de tareas de proyecto en la próxima recarga

---

## 6. Fuera de alcance (v1)

- Notificaciones por vencimiento de tareas sueltas
- Prioridades (alta/media/baja)
- Comentarios en tareas
- Filtros avanzados en Mis Tareas para tareas sueltas
- Vista de tareas sueltas desde la página de proyecto (solo creación)
- Historial de cambios de una tarea

---

## Apéndice

### Glosario
- **Tarea suelta / standalone task:** `Task` con `projectId = null`
- **Tarea de proyecto:** `Task` con `projectId` definido (comportamiento actual)
- **Subetapa:** modelo `Substage`, distinto de `Task` — no se modifica en este feature

### Riesgo de migración
- Hacer `projectId` nullable es una migración **no destructiva**.
- Las tareas existentes mantienen su `projectId`.
- No hay datos a migrar, solo cambio de constraint en la columna.
- Bajo riesgo. Se puede hacer sin backup dedicado, aunque siempre se recomienda.
