# Inventario de gates hardcodeados por rol (auditoría T4.4)

> Relevamiento de los checks `user.role === "ADMIN"` / `!== "ADMIN"` en el backend,
> categorizados. **Conclusión:** la mayoría son reglas de negocio legítimas o
> chequeos de propiedad (autor/uploader-o-admin), NO gates de módulo. El único
> feature-gate migrado a permiso declarativo fue el **drawer de debug**
> (`VENTAS:DEBUG_CALCULADORA`, T4.2). No se migran las reglas de negocio (riesgo
> alto, poco beneficio). Este doc queda como referencia para futuras decisiones.

Generado el 2026-07-06 con `grep -rnE '\.role\s*(===|!==)\s*"' server/src`.

## Categorías

### A. Propiedad (autor/uploader-o-admin) — dejar como está
Patrón `x.authorId !== user.id && user.role !== "ADMIN"`: "solo el autor o un admin".
Es correcto y no corresponde a un permiso de módulo.

- `api.routes.ts:6179`, `6219` — editar/borrar comentario propio o admin.
- `api.routes.ts:10689` — borrar archivo subido por uno mismo o admin.
- `visitas.routes.ts:221` — bypass de admin en chequeo de propiedad de visita.
- `services/clientes/index.ts:356` — `user.id === authorId || role === "ADMIN"` (interacciones).

### B. Regla de negocio (acción restringida a admin) — dejar como está
Restricciones deliberadas del dominio, no "entrar a una sección". Migrarlas a
permisos declarativos agregaría acciones muy específicas al enum sin beneficio real.

- `api.routes.ts:2020` — solo admin edita fechas reales del proyecto (`touchesActualDates`).
- `api.routes.ts:2936` — solo admin cambia si un ítem de checklist es obligatorio.
- `api.routes.ts:12456` — solo admin regenera previstos.
- `api.routes.ts:1634`, `5234`, `16653` — restricciones puntuales de admin (revisar caso a caso si alguna vez se quiere delegar).
- `api.routes.ts:7645`, `7694` — `ADMIN || OPERACIONES` (acción de operaciones).
- `api.routes.ts:3263`, `3329`, `3365`, `3412`, `4905`, `5680`, `7249`, `7321`, `7750` — flags `isAdmin` para ramas de lógica (mostrar/ocultar campos, permitir override). Comportamiento, no gate de acceso.

### C. Config de propuestas admin-only — candidatos débiles a permiso
Edición de defaults/config del generador de propuestas. Hoy admin-only por diseño.
Podrían pasar a una acción declarativa si alguna vez se quiere delegar a un rol
no-admin, pero **no hay pedido** para eso.

- `proposals-v2-defaults.routes.ts:178`, `262`, `376` — guardar defaults / tapa / overlay.
- `proposals-v2-preview.routes.ts:142` — preview admin.
- `proposals-v2-drafts-versions.routes.ts:76` — descargar versión descartada (admin + `?includeDiscarded`).
- `proposals-v2-drafts-versions.routes.ts:243` — **regenerar PDF** de una versión. Feature-gate real; se dejó **fuera de alcance** explícito (se puede migrar a `VENTAS:DEBUG_CALCULADORA` o una acción propia en otro turno).

### D. No es un gate
- `services/project.service.ts:576` — extracción del nombre de rol (helper), no un check de acceso.

## Migrado en esta tanda
- `proposals-v2-drafts-versions.routes.ts:45` (drawer de debug) → **`authorize(VENTAS, DEBUG_CALCULADORA)`** + gate declarativo en el cliente (T4.2). ✅

## Recomendación
No migrar B ni A (riesgo de romper reglas correctas). Si en el futuro se quiere
delegar la config de propuestas (C) o el "regenerar PDF" a un rol no-admin,
seguir el patrón de `ACCESS_MEMORIA` / `DEBUG_CALCULADORA` (enum + migración +
seed + grant + `authorize` + `usePermission`).
