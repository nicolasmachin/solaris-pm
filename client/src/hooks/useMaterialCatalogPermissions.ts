import { usePermission } from "./usePermission";

// Permisos del catálogo de materiales (Admin → Materiales).
//
// El catálogo no es "configuración del sistema" para quien lo usa: Ingeniería da
// de alta ítems nuevos todos los días al armar las listas de materiales. Por eso
// alta y edición aceptan también INGENIERIA:CREATE/EDIT, además de CONFIGURACION
// (Admin) y STOCK. Espeja el `authorizeAny` de las rutas `/materials/items` en
// `api.routes.ts` — si cambia uno, cambiar el otro.
//
// Borrar y administrar categorías siguen siendo de CONFIGURACION/STOCK: desde
// Ingeniería un ítem se desactiva (reversible), no se elimina.
export interface MaterialCatalogPermissions {
  canCreateItems: boolean;
  canEditItems: boolean;
  canDeleteItems: boolean;
  canManageCategories: boolean;
  /** Alcanza para entrar a la sección Materiales del panel de Administración. */
  canAccessSection: boolean;
}

export function useMaterialCatalogPermissions(): MaterialCatalogPermissions {
  const configCreate = usePermission("CONFIGURACION", "CREATE");
  const configEdit = usePermission("CONFIGURACION", "EDIT");
  const configDelete = usePermission("CONFIGURACION", "DELETE");
  const stockCreate = usePermission("STOCK", "CREATE");
  const stockEdit = usePermission("STOCK", "EDIT");
  const stockDelete = usePermission("STOCK", "DELETE");
  const ingCreate = usePermission("INGENIERIA", "CREATE");
  const ingEdit = usePermission("INGENIERIA", "EDIT");

  const canCreateItems = configCreate || stockCreate || ingCreate;
  const canEditItems = configEdit || stockEdit || ingEdit;
  const canDeleteItems = configDelete || stockDelete;
  const canManageCategories = configCreate || configEdit || configDelete;

  // Entrar a Administración → Materiales no es lo mismo que poder tocar el
  // catálogo. STOCK queda deliberadamente afuera de este gate: esos roles ya dan
  // de alta ítems desde su propia pantalla (`/stock`), y no tienen nada más que
  // hacer en Administración. Acá entran quienes no tienen otro camino: el admin
  // (CONFIGURACION) e Ingeniería.
  const canAccessSection = canManageCategories || ingCreate || ingEdit;

  return {
    canCreateItems,
    canEditItems,
    canDeleteItems,
    canManageCategories,
    canAccessSection,
  };
}
