# Rol POSTVENTA

## Qué hace este rol

`POSTVENTA` es un rol del sistema (`isSystem=true`, label "Postventa") pensado
para que, a futuro, un empleado dedicado pueda manejar la etapa **Postventa** de
los proyectos tal como hoy lo hace **Operaciones**.

Por ahora **no se asigna a ningún usuario**: el rol existe en el sistema (seed +
script ad-hoc para prod) y queda listo para activarse cuando se decida.

## Matriz de permisos: clon 1:1 de OPERACIONES

La matriz de permisos de `POSTVENTA` es una **clonación exacta** de la de
`OPERACIONES` tal como quedó en el seed: mismas filas, mismas acciones por
módulo, incluido `Action.ACCESS` en `INGENIERIA`. No se agrega ni se quita
ninguna acción respecto de OPERACIONES.

Son **9 filas de módulo / 27 permisos a nivel acción**:

| Módulo | Acciones |
|---|---|
| `VENTAS` | VIEW |
| `ONBOARDING` | VIEW, COMMENT |
| `INGENIERIA` | VIEW, CREATE, EDIT, DELETE, COMPLETE, COMMENT, ACCESS |
| `OPERACIONES` | VIEW, CREATE, EDIT, COMPLETE, COMMENT |
| `HABILITACION` | VIEW, CREATE, EDIT, COMPLETE, COMMENT |
| `POSTVENTA` | VIEW, COMMENT |
| `METRICAS` | VIEW |
| `STOCK` | VIEW |
| `TRAMITES_UTE` | VIEW, CREATE, EDIT |

> Nota: el módulo `Module.POSTVENTA` (fila de la matriz) existe desde antes y es
> independiente del rol `POSTVENTA` que documenta este README.

## Cómo se crea en producción

Con el script ad-hoc idempotente `server/prisma/scripts/add-postventa-role.ts`:

```bash
docker exec -it voltia-server npx tsx prisma/scripts/add-postventa-role.ts
```

El script:

1. Hace **upsert** del rol `POSTVENTA` por `name`. Si ya existe, **no pisa** su
   label/description (respeta ediciones hechas desde la UI Admin).
2. Hace **upsert** de cada permiso de la matriz de arriba con la key compuesta
   `roleId_module_action`.
3. Imprime el total de permisos del rol POSTVENTA en la DB y `OK` si todo cuadra.

Es **idempotente**: se puede correr en cualquier momento, las veces que haga
falta, sin duplicar nada. **No crea usuarios** y **no modifica** los permisos de
OPERACIONES ni de ningún otro rol.

## Estado actual

- El rol está agregado al seed (`SYSTEM_ROLES` + matriz de `seedPermissions`),
  así que un entorno nuevo lo crea automáticamente al correr el seed.
- En producción se aplica corriendo el script de arriba en el VPS (post-deploy).
- **No se ejecutó el seed** para aplicar este rol en local: el código quedó
  listo, pero la DB local no se tocó.
- Todavía **no hay usuarios** con este rol asignado.
