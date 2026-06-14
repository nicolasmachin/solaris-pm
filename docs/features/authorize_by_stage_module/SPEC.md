# Fix de Autorización por Módulo Dinámico — Especificación Técnica

> Refactor del sistema de permisos en endpoints de stages/substages/projects que hoy chequean `OPERACIONES` hardcoded, para que resuelvan dinámicamente el módulo correcto según la etapa involucrada. Sincronización del seed con la matriz de permisos real de producción.
> Ubicación: `server/src/middleware/`, `server/src/routes/api.routes.ts`, `server/prisma/seed.ts`.
> Spec madre: no aplica. Versión: 1.1 (incluye §2.3 con hallazgos del PASO 0).

## Tabla de contenidos

1. Contexto y objetivo
2. Diagnóstico actual (+ §2.3 hallazgos del PASO 0)
3. Modelo de la solución
4. Implementación del middleware nuevo
5. Endpoints a refactorizar
6. Endpoints sin authorize (Grupo B)
7. Sincronización del seed
8. Casos de prueba
9. Fuera de alcance
10. Apéndice: matriz de permisos de prod

## 1. Contexto y objetivo

### 1.1 Problema observado

El asesor comercial no puede marcar como completadas subetapas de la etapa Onboarding ni editar la información general de un proyecto, a pesar de tener todos los permisos de `ONBOARDING` cargados en la matriz de la DB. Logs de prod: 403 Forbidden en `PATCH /api/projects/:id/stages/:stageId/substages/:substageId` y en `PATCH /api/projects/:id`.

### 1.2 Causa raíz

Los endpoints que manipulan stages, substages y proyectos están hardcoded con `authorize(Module.OPERACIONES, Action.EDIT)` (o `Action.COMPLETE`). Solo roles con permiso en `OPERACIONES` pueden tocar cualquier subetapa de cualquier módulo. El bug es estructural: roles como `INGENIERIA` tampoco podrían editar subetapas de su propio módulo si no fuera por workarounds en la matriz.

### 1.3 Objetivo

Reemplazar el chequeo hardcoded por uno dinámico que resuelva el módulo correcto a partir de los IDs presentes en el request (`:projectId`, `:stageId`, `:substageId`, `:taskId`). Cada subetapa hereda su módulo de la etapa padre, y cada etapa lo deriva de su `name: StageType`. Sincronizar el seed con la matriz real de prod.

### 1.4 No-objetivos

- No se agrega un campo `module` a `Stage`. El mapping `StageType → Module` vive en código.
- No se modifica el cache de permisos, ni `authorize()` ni `authorizeAny()`.
- No se cambia la matriz de permisos: el seed se sincroniza con lo que ya hay en prod.

## 2. Diagnóstico actual

### 2.1 Endpoints afectados (Grupo A — 11 endpoints)

Todos con `authorize(Module.OPERACIONES, Action.EDIT|COMPLETE)`:

| Endpoint | Acción | Resolución del módulo |
|---|---|---|
| `PATCH /projects/:id` | EDIT | any pipeline module |
| `PATCH /projects/:projectId/systems/:systemId` | EDIT | any pipeline module |
| `PATCH /projects/:projectId/stages/:stageId` | EDIT | desde `stageId` |
| `POST /projects/:projectId/stages/:stageId/substages` | EDIT | desde `stageId` |
| `PATCH /projects/:projectId/stages/:stageId/substages/:substageId` | EDIT | desde `substageId` |
| `PATCH /substages/:substageId/complete` | COMPLETE | desde `substageId` |
| `PATCH /projects/:projectId/stages/:stageId/complete-all` | COMPLETE | desde `stageId` |
| `PATCH /projects/:projectId/stages/:stageId/substages/reorder` | EDIT | desde `stageId` |
| `DELETE /projects/:projectId/stages/:stageId/substages/:substageId` | EDIT | desde `substageId` |
| `POST /projects/:projectId/stages/:stageId/substages/:substageId/checklist` | EDIT | desde `substageId` |
| `PATCH /projects/:projectId/tasks/:taskId` | EDIT | desde `taskId` |

> Nota: las líneas exactas se corrieron respecto del diagnóstico original (+~190) por cambios previos del archivo. Los endpoints se ubican por firma, no por número de línea.

### 2.2 Endpoints sin authorize (Grupo B — 3 endpoints)

- `PATCH /substages/:id/deadline`
- `DELETE /substages/:id/deadline-override`
- `PATCH /substages/:id/actual-dates`

### 2.3 Hallazgos adicionales del PASO 0 (nuevos en v1.1)

Durante la verificación previa a implementar surgieron cuatro puntos que ajustan el alcance:

1. **Dos `authorize` INLINE de COMPLETE (no listadas en §2.1).** Dentro de dos handlers del Grupo A había llamadas inline:
   - En `PATCH /projects/:projectId/stages/:stageId`, cuando `body.status !== undefined`.
   - En `PATCH .../substages/:substageId`, cuando `body.status === COMPLETED`.

   Ambas eran `await authorize(Module.OPERACIONES, Action.COMPLETE)(request)`. El bug "el asesor no puede completar subetapas" pasa por esta ruta (completar vía `PATCH .../substages/:substageId` con `status: COMPLETED`), no solo por `/substages/:substageId/complete`. **Decisión: migrarlas a `await authorizeByStageContext(Action.COMPLETE)(request)`** (mismo commit 1.4). Sin esto, el fix quedaba incompleto.

2. **`DELETE /projects/:id` se deja como está (solo OPERACIONES).** Eliminar un proyecto es destructivo; la asimetría con `PATCH /projects/:id` (que sí pasa a any-pipeline) es intencional. No se toca. Tampoco se tocan otros hermanos fuera de alcance (checklist sueltos `PATCH/DELETE /checklist/:itemId`, `PATCH /projects/:projectId/checklist/:itemId`, y tasks `GET/POST/DELETE`).

3. **Task a nivel proyecto (sin etapa) → fallback a any-pipeline.** El modelo `Task` tiene `stageId String?` y `substageId String?` (ambos nullable). `getTaskContextById(taskId)` devuelve `{ exists, module }`: resuelve módulo vía substage→stage, o vía stage; si la task no tiene ninguno (task a nivel proyecto) → `module: null`. El middleware, ante `exists: true` + `module: null`, aplica fallback al criterio de `authorizeProjectEditAnyPipeline` (la acción en algún módulo del pipeline). Si la task no existe → 404.

4. **Grupo B no modificado (decisión consciente).** Los tres endpoints tienen chequeo de rol inline, no preHandler:
   - `PATCH /substages/:id/deadline`: `role === ADMIN || OPERACIONES`.
   - `DELETE /substages/:id/deadline-override`: `role === ADMIN || OPERACIONES`.
   - `PATCH /substages/:id/actual-dates`: `role === ADMIN`.

   Es una política deliberada ("deadlines/fechas manuales = ADMIN/OPS"). No son el bug reportado. **Se dejan como están.**

## 3. Modelo de la solución

### 3.1 Mapping `StageType → Module`

```ts
export const STAGE_TYPE_TO_MODULE: Record<StageType, Module> = {
  ONBOARDING:       Module.ONBOARDING,
  INGENIERIA:       Module.INGENIERIA,
  OPERACIONES:      Module.OPERACIONES,
  HABILITACION_UTE: Module.HABILITACION,  // nombre distinto en cada enum
  POSTVENTA:        Module.POSTVENTA,
};
```

### 3.2 Helpers de resolución

- `getModuleByStageId(stageId): Promise<Module | null>`
- `getModuleBySubstageId(substageId): Promise<Module | null>` (vía Substage → Stage)
- `getTaskContextById(taskId): Promise<{ exists: boolean; module: Module | null }>` (vía Task → Substage/Stage; distingue 404 de "sin etapa")
- `getModuleByTaskId(taskId): Promise<Module | null>` (wrapper, compat con tests)

Cada uno con cache TTL 10 min.

### 3.3 Middlewares nuevos

- **`authorizeByStageContext(action)`**: resuelve por prioridad `substageId > stageId > taskId`, llama a `hasPermission(role, module, action)`. 404 si el recurso no existe (no 403). Task a nivel proyecto → fallback any-pipeline. Sin IDs → Error (bug de programación).
- **`authorizeProjectEditAnyPipeline(action)`**: para endpoints con solo `:projectId`. Reusa `authorizeAny(PIPELINE_MODULES.map(...))`.

```ts
export const PIPELINE_MODULES: Module[] = [
  Module.VENTAS, Module.ONBOARDING, Module.INGENIERIA,
  Module.OPERACIONES, Module.HABILITACION, Module.POSTVENTA,
];
```

### 3.4 Cache

Tres mapas con TTL 10 min (`stageId→Module`, `substageId→stageId`, `taskId→{exists,module}`) + `clearStageModuleCache()`. Reusa `hasPermission()` exportándola desde `authorize.middleware.ts` (1 línea de cambio).

## 4. Implementación del middleware nuevo

Archivo: `server/src/middleware/authorize-by-stage.middleware.ts`. Ver el código para el detalle. `hasPermission` se exporta (`export`) desde `authorize.middleware.ts` sin tocar nada más (el cache vive en el mismo archivo y no se exporta).

## 5. Endpoints a refactorizar (Grupo A)

- `PATCH /projects/:id` y `PATCH .../systems/:systemId` → `authorizeProjectEditAnyPipeline(Action.EDIT)`.
- Los 9 restantes → `authorizeByStageContext(Action.EDIT | COMPLETE)`.
- **+ las 2 llamadas inline de COMPLETE** (§2.3.1) → `authorizeByStageContext(Action.COMPLETE)`.

No se toca la lógica interna de los handlers.

## 6. Endpoints sin authorize (Grupo B)

Inspeccionados (§2.3.4): tienen chequeo de rol inline (ADMIN/OPS o ADMIN). **No se modifican** (criterio role-based intencional).

## 7. Sincronización del seed

Se reemplaza el array `matrix` en `seedPermissions` por la matriz real de prod (137 filas, §10), conservando `upsert` con `update: {}`.

> **Preservación de INFORMES:** el snapshot de §10 es anterior al módulo Informes. La fila `ADMIN INFORMES [VIEW, CREATE, EDIT]` existe en prod, así que se preserva en el seed (regla "no remover permisos de prod"). El array queda con 140 filas = 137 (prod) + 3 (Informes).
>
> **El seed NO se ejecutó** al aplicar este cambio (la base local tiene datos de producción que no se deben pisar). Solo se editó el código del array.

## 8. Casos de prueba

Validación manual por rol (en local, antes de deploy): ADMIN, ASESOR_COMERCIAL, INGENIERIA, OPERACIONES — editar/completar subetapas por módulo y editar proyecto, verificando OK / 403 según la matriz. Reproducir post-deploy los dos casos originales del asesor comercial (completar subetapa de Onboarding + editar proyecto).

### 8.1 Deuda técnica conocida — tests de los resolvers

Los tests del mapping (`STAGE_TYPE_TO_MODULE`, `PIPELINE_MODULES`) están cubiertos. **Los resolvers que pegan a la DB (`getModuleByStageId`, `getModuleBySubstageId`, `getModuleByTaskId`/`getTaskContextById`) y el comportamiento de cache NO están cubiertos por tests automáticos**: los delegates del cliente **Prisma v6 no son mockeables con el runner builtin `node:test` (`mock.method`)** — los métodos del delegate son getters dinámicos y `mock.method` falla con "methodName must be a method. Received undefined". Quedan cubiertos por la validación manual por rol. Si en el futuro se adopta un runner con mock de módulos (p.ej. vitest), completar estos tests.

## 9. Fuera de alcance

- No se agrega campo `module` a `Stage`. No se cambia la matriz (solo se sincroniza el seed). No se refactorizan endpoints fuera del Grupo A. No se toca el cache de `authorize()`. No se cambia el frontend. No se documenta `Action.ACCESS`.

## 10. Apéndice: matriz de permisos de prod

137 filas (referencia del seed §7). Resumen por rol/módulo (acciones):

```
ADMIN | VENTAS/ONBOARDING/INGENIERIA/OPERACIONES/HABILITACION/POSTVENTA | full (ONB/ING/OPS/HAB/POS con COMPLETE; ADMIN.INGENIERIA sin ACCESS)
ADMIN | METRICAS VIEW · CONFIGURACION/USUARIOS/FINANZAS/STOCK/TRAMITES_UTE/PORTAL_CLIENTE VIEW,CREATE,EDIT,DELETE
CLIENT | PORTAL_CLIENTE VIEW
ASESOR_COMERCIAL | VENTAS VIEW,CREATE,EDIT,COMMENT · ONBOARDING full · INGENIERIA/OPERACIONES/HABILITACION/POSTVENTA/TRAMITES_UTE VIEW
FINANZAS | FINANZAS/STOCK full · TRAMITES_UTE VIEW
INGENIERIA | ONBOARDING VIEW,COMMENT · INGENIERIA full · OPERACIONES VIEW,CREATE,EDIT,COMPLETE,COMMENT · HABILITACION full · POSTVENTA/METRICAS VIEW · TRAMITES_UTE VIEW,CREATE,EDIT,DELETE
OPERACIONES | VENTAS VIEW · ONBOARDING VIEW,COMMENT · INGENIERIA VIEW,CREATE,EDIT,DELETE,COMPLETE,COMMENT,ACCESS · OPERACIONES VIEW,CREATE,EDIT,COMPLETE,COMMENT · HABILITACION VIEW,CREATE,EDIT,COMPLETE,COMMENT · POSTVENTA VIEW,COMMENT · METRICAS/STOCK VIEW · TRAMITES_UTE VIEW,CREATE,EDIT
```

(Más, fuera del snapshot de prod pero preservado: `ADMIN INFORMES VIEW,CREATE,EDIT`.)
