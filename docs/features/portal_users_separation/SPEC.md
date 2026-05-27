# Separación visual de usuarios internos vs clientes portal

Implementado con filtro `role.name != "CLIENT"` en endpoint dedicado
`GET /api/users/assignable` y query param `excludePortalClients` en
`GET /api/users`. UserSelect consume el endpoint nuevo, lo que arregla
todos los selectores de asignación de una sola vez.

La spec extendida con discriminador `userType` se evaluó y se descartó
por agregar deuda técnica sin resolver el caso de uso actual mejor que
el filtro por rol existente. Si aparece la necesidad de SSO, multi-proyecto
o vinculación con `Client` para portal clients, considerar refactor a
tabla `PortalClient` separada en lugar de discriminador.

## Endpoints involucrados

- `GET /api/users/assignable` — usuarios activos con `role.name != "CLIENT"`. Es el endpoint que consume `UserSelect`.
- `GET /api/users?excludePortalClients=true` — usa la tab "Usuarios" del Admin para no listar portal clients.
- `GET /api/users` (sin param) — comportamiento legacy: devuelve todos.
- `GET /api/users/active` — sin cambios, sigue devolviendo todos. Sin consumers post-refactor.
- `GET /api/admin/clients` — ya filtraba `role.name = "CLIENT"`. Es la fuente de la tab "Clientes portal".

## Frontend

- `UserSelect` (componente compartido) → consume `/api/users/assignable`. Esto cubre 6 call sites: TaskDetailModal, LeadsListView (filtro propietario), StageDrawer x3, TasksPanel, MisTareas (selector admin).
- `Admin.tsx > TabUsuarios` → `fetchUsers` pasa `excludePortalClients=true`.
- `AdminClientes.tsx > TabClientes` → sin cambios. Ya consumía `/admin/clients` que filtra por role CLIENT.

## Pendiente / sugerencias

- Validación defensiva en `POST /api/users` para rechazar creación con `role=CLIENT` desde el flujo interno (hoy se confía en que la UI no lo expone). No bloqueante; documentado por si se agrega después.
- Si más adelante hace falta enforce real (SSO, multi-proyecto, vínculo con `Client`), considerar `PortalClient` como tabla separada en vez de discriminador `userType`.
