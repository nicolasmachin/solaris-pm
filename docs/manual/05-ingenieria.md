# 05 · Ingeniería

> **Capítulo parcial.** Están documentados el **consolidador de materiales**, el
> **catálogo de materiales**, las **plantillas y la lista de materiales del
> proyecto**, la **foto de referencia del material**, el
> **diseñador de gabinetes** y la **justificación de potencia ante UTE**. El resto de las herramientas existe y está en
> producción; falta escribirlas.

El workspace de ingeniería y sus herramientas: unifilar, materiales, pre-ingeniería, visitas y proyecto final.

---

## Qué falta cubrir en este capítulo

- El workspace y su acordeón de herramientas
- Unifilar: generación del SVG y del PDF
- Cálculo de triángulos
- Pre-ingeniería: extracción desde minuta con IA y PDF
- Visita técnica: audio, fotos, transcripción y el informe vivo
- Proyecto Final de Ingeniería (EFP): secciones, edición inline y anexos
- La sección de documentos técnicos generados

---

# Consolidador de materiales

## Para qué existe

Junta las listas de materiales de uno o varios proyectos en una sola tabla
(ítem × proyecto + total) para salir a comprar con un único documento, en vez de
abrir la lista de cada obra por separado. Produce un PDF y un Excel descargables.

A diferencia del resto de las herramientas de ingeniería, **no cuelga de un
proyecto**: es una herramienta global del módulo, con su propia pantalla y su
propio historial de versiones.

## Cómo se usa

Se entra desde **Ingeniería → Consolidador de materiales**
(`/ingenieria/materiales-consolidados`).

1. Se tilda uno o más proyectos de la lista de **elegibles** — son los proyectos
   no eliminados que tienen al menos un ítem en su lista de materiales.
2. Opcionalmente se pone una **etiqueta** (ej: "Compras semana 1 mayo").
3. **Generar** crea una versión nueva, numerada de forma correlativa y global
   (v1, v2, v3…), junto con su PDF y su Excel.
4. Cada versión del historial se puede **ver** (modal con la tabla), descargar en
   **PDF** o **Excel**, o **eliminar**.

**Alcanza con un solo proyecto.** Hasta la v9.1 el mínimo eran dos; hoy se puede
consolidar una obra sola para armar su lista de compra con el mismo formato.
Cuando la versión tiene un único proyecto, la columna **TOTAL** no se muestra
(repetiría la del proyecto) ni en pantalla, ni en el PDF, ni en el Excel.

### Vista compras

Dentro del modal de una versión, el toggle **Vista compras** (persistido en
`localStorage`) agrega por ítem el **estado de compra** (Pendiente / Pedido /
Recibido / En stock, o *Mixto* si difiere entre proyectos) y el **tachado**,
más filtros por texto, estado y tachado.

Cambiar el estado o el tachado desde ahí **aplica en cascada a todos los
proyectos de esa versión**, no solo a la vista del consolidado.

## Cómo funciona

Backend en `server/src/routes/consolidador.routes.ts` (todo el service vive ahí,
no hay archivo aparte). Frontend en `client/src/pages/MaterialesConsolidados.tsx`
+ `client/src/components/ingenieria/consolidador/ConsolidatedTableView.tsx`,
API en `client/src/api/consolidador.api.ts`.

- `buildConsolidation(projectIds)` agrupa los `ProjectMaterial` **por
  `catalogItemId`** (el ítem del catálogo), no por nombre: dos ítems con el
  mismo texto pero distinto ID quedan en filas separadas. Ordena por
  `categoriaOrden` → categoría → nombre.
- El resultado se congela en la tabla `MaterialesConsolidadosVersion` como dos
  snapshots JSON: `projectsSnapshot` (id, cliente, kWp, ubicación) e
  `itemsSnapshot` (cantidades por proyecto + total). **La tabla que se ve es el
  snapshot**, no las listas vivas: si después cambia la lista de un proyecto, la
  versión no se entera.
- El PDF (`generateConsolidadoPdf`) y el Excel (`generateConsolidadoXlsx`) se
  generan con PDFKit y ExcelJS a partir de esos snapshots. El PDF pasa a
  **horizontal** a partir de 4 proyectos.
- Los archivos **no son `FileAttachment`**: se escriben directo en
  `${STORAGE_PATH}/ingenieria/consolidados/` y su ruta relativa queda en
  `pdfPath` / `xlsxPath`. No aparecen en "Documentos técnicos generados" del
  proyecto.
- La **Vista compras** sí lee datos vivos: `GET /:id/compras-overlay` recalcula
  el estado agregado desde los `ProjectMaterial` actuales de los proyectos no
  eliminados de la versión. Por eso puede mostrar un estado que no coincide con
  las cantidades del snapshot.

## Permisos

| Endpoint | Permiso |
|---|---|
| `GET /ingenieria/materiales-consolidados/proyectos-elegibles` | `INGENIERIA:VIEW` |
| `GET /ingenieria/materiales-consolidados` | `INGENIERIA:VIEW` |
| `GET /ingenieria/materiales-consolidados/:id` | `INGENIERIA:VIEW` **o** `OPERACIONES:VIEW` |
| `GET /ingenieria/materiales-consolidados/:id/pdf` · `/xlsx` | `INGENIERIA:VIEW` |
| `POST /ingenieria/materiales-consolidados` | `INGENIERIA:EDIT` |
| `DELETE /ingenieria/materiales-consolidados/:id` | `INGENIERIA:DELETE` |
| `GET /ingenieria/materiales-consolidados/:id/compras-overlay` | `INGENIERIA:VIEW` **o** `OPERACIONES:VIEW` |
| `POST /ingenieria/materiales-consolidados/:id/items/:materialItemId/cascade-update` | `INGENIERIA:EDIT` **o** `OPERACIONES:EDIT` |

Asimetría a tener en cuenta: alguien con solo `OPERACIONES:VIEW` **puede abrir
el modal de una versión** (si llega con el id) pero **no puede listarlas ni
descargar el PDF/Excel**, porque esos endpoints piden `INGENIERIA:VIEW`. En el
frontend el botón de la Vista compras se habilita con `INGENIERIA:EDIT` ||
`OPERACIONES:EDIT` || rol `ADMIN` — ese `ADMIN` está **hardcodeado por rol** en
`ConsolidatedTableView.tsx`, no sale de la matriz.

## Reglas y decisiones

- **Numeración global y correlativa**: `versionNumber` es el máximo + 1 sobre
  toda la tabla, no por proyecto ni por etiqueta.
- **Snapshot, no vista viva**: se consolidó lo que había en ese momento. Para
  reflejar cambios hay que generar una versión nueva.
- **Agrupación por ID de catálogo**, avisada en la propia UI: si las cantidades
  no cuadran con lo esperado, hay que revisar las listas individuales.
- **La cascada de la Vista compras escribe en los proyectos**: no es una marca
  local del consolidado.
- **Si falla la generación de PDF/Excel, la versión igual se guarda**: se loguea
  el error y la tabla JSON queda accesible; los botones de descarga
  (`hasPdf` / `hasXlsx`) simplemente no aparecen.

## Casos borde

- **Un solo proyecto**: permitido; sin columna TOTAL.
- **Proyecto eliminado después de consolidar**: sigue apareciendo en el snapshot
  (y en el PDF/Excel ya generados), pero queda fuera del overlay de compras y de
  la cascada, que solo tocan proyectos vivos.
- **Ítem sin proyectos vivos** en la Vista compras: muestra "sin proyectos" y no
  ofrece cambiar estado ni tachar.
- **Proyecto sin ítems**: no aparece entre los elegibles.
- **Muchos proyectos**: el PDF pasa a horizontal desde 4, pero las columnas se
  reparten el ancho restante — con muchos proyectos quedan angostas. No hay tope.

---

# Catálogo de materiales (Administración)

## Para qué existe

Es la lista maestra de ítems que alimenta todas las listas de materiales:
proyectos, consolidador, plantillas, stock y compras. Vive en **Administración →
Materiales**, con dos pestañas: **Categorías** e **Ítems**.

## Cómo se usa

Se entra por **Admin → Materiales** (`/admin?tab=materiales`). Desde la lista de
materiales de un proyecto hay un enlace directo **"Catálogo"** para quien no
puede editar la fila ahí mismo.

- **Ítems**: buscador por nombre/descripción, filtro por categoría y check
  "Mostrar inactivos". Botón **Nuevo ítem**, y por fila lápiz (editar), interruptor
  (activar/desactivar) y cruz (eliminar).
- **Categorías**: alta, renombrado, reordenamiento y baja. Las subcategorías se
  ven indentadas debajo de su rubro y el reordenamiento es **entre hermanas**
  (una subcategoría se mueve dentro de su rubro, no sobre toda la lista).

### Dos niveles de categoría

El catálogo tiene **rubros** (primer nivel) y **subcategorías** (segundo). No
hay un tercer nivel: el backend lo rechaza (`CATEGORY_PARENT_IS_CHILD`), y una
categoría que ya tiene hijas no puede pasar a colgar de otra
(`CATEGORY_HAS_CHILDREN`).

Existe porque **"Electrica" juntaba 175 de los 307 ítems**: cables, caños,
codos, bandejas, térmicas, diferenciales, tableros, terminales y jabalinas en la
misma bolsa. Con eso no se puede ofrecer "elegí el cable" sin recorrer el rubro
entero, que es lo que hacía inusable la carga de la lista de materiales.

Hoy Eléctrica está abierta en: Cables (36), Canalización (51), Protecciones
(29), Terminales y conexionado (28), Tableros y gabinetes (13), Puesta a tierra
(5), Fijación y varios (8). Los conteos son del catálogo local al momento de
escribir esto; en producción pueden diferir.

El reparto lo hizo `server/prisma/scripts/seed-subcategorias-electrica.ts`,
**idempotente**: crea las subcategorías que falten y solo mueve los ítems que
todavía cuelgan del rubro padre, así que un ítem reclasificado a mano no se
pisa. Tiene `--dry-run` y reporta al final lo que cayó en "Fijación y varios",
que es el cajón de sastre a revisar.

**Los ítems van siempre en la categoría más específica.** En el formulario del
ítem, los rubros que tienen subcategorías aparecen deshabilitados: si un ítem
quedara en el rubro, vuelve a la bolsa grande y no aparece en ningún subgrupo.

**Ingeniería entra a Administración viendo únicamente esta sección.** El sidebar
se filtra (`allowedTabs` en `AdminSidebar`) y el resto de las secciones —usuarios,
permisos, configuración del sistema, reglas— no se le muestra ni se le puede
abrir por URL: `Admin.tsx` cae al tab permitido si el `?tab=` no está en su lista.
Tampoco ve la pestaña **Categorías**, que sigue siendo del administrador.

El campo **Proveedor por defecto** se completa con el listado de Finanzas. A quien
no tiene `FINANZAS:VIEW` el campo no se le muestra (la query ni se dispara) y el
ítem se crea sin proveedor; se puede completar después desde Administración.

## Cómo funciona

- Modelos `MaterialCategory` y `MaterialItem` en `schema.prisma`; rutas
  `/materials/categories` y `/materials/items` en `api.routes.ts`.
- Frontend: `client/src/pages/AdminMateriales.tsx` (`TabMateriales`,
  `CategoriesPanel`, `ItemsPanel`, `ItemForm`), montado como tab en
  `pages/Admin.tsx`.
- Los permisos de UI salen de un único hook,
  `client/src/hooks/useMaterialCatalogPermissions.ts`, que **espeja el
  `authorizeAny` de las rutas**. Si cambia uno hay que cambiar el otro: no hay
  nada que los mantenga sincronizados automáticamente.
- El acceso a `/admin` ya no es solo `USUARIOS:VIEW`: `AdminRoute` en `App.tsx`
  deja entrar también a quien administra el catálogo, y el enlace **Admin** de la
  barra superior y del menú mobile usa el mismo criterio.

## Permisos

| Endpoint | Permiso |
|---|---|
| `GET /materials/items` · `/items/:id` · `/categories` | `INGENIERIA:VIEW` |
| `POST /materials/items` | `CONFIGURACION:CREATE` **o** `STOCK:CREATE` **o** `INGENIERIA:CREATE` |
| `PATCH /materials/items/:id` | `CONFIGURACION:EDIT` **o** `STOCK:EDIT` **o** `INGENIERIA:EDIT` |
| `DELETE /materials/items/:id` | `CONFIGURACION:DELETE` **o** `STOCK:DELETE` |
| `POST`/`PATCH`/`DELETE /materials/categories` | `CONFIGURACION:CREATE` / `EDIT` / `DELETE` |
| `POST`/`PATCH`/`DELETE /material-templates` | `CONFIGURACION` **o** `INGENIERIA` (CREATE/EDIT/DELETE) |

Con la matriz vigente, **crear y editar ítems** lo pueden hacer: `ADMIN`,
`INGENIERIA` y `GERENTE_INGENIERIA` (por `INGENIERIA`), y `CAPATAZ`, `FINANZAS`,
`GERENTE_FINANZAS`, `GERENTE_OPERACIONES`, `INSTALADOR_TERCERIZADO`, `LOGISTICA`
y `OPERACIONES` (por `STOCK`, desde la pantalla de Stock).

Las **plantillas de lista de materiales** las administra también `INGENIERIA`:
son la base de trabajo de quien arma la lista y se ajustan seguido, así que
dejarlas detrás de permisos de administrador obligaba a pedir el cambio cada
vez. Las **categorías**, en cambio, siguen siendo de `CONFIGURACION`: definen la
estructura del catálogo y de los PDF.

**Ver la sección en Administración es más restrictivo que el endpoint**:
`canAccessSection` exige `CONFIGURACION` o `INGENIERIA:CREATE/EDIT`, y deja
`STOCK` afuera a propósito, porque esos roles ya dan de alta ítems desde
`/stock` y no tienen nada más que hacer en Administración.

## Reglas y decisiones

- **Ingeniería crea y edita, pero no elimina.** Eliminar quedó en
  `CONFIGURACION`/`STOCK`; desde Ingeniería un ítem se **desactiva**, que es
  reversible y no toca el histórico.
- **Las categorías son del administrador.** Definen la estructura del catálogo y
  de los PDFs; abrirlas a Ingeniería no era el problema a resolver.
- El permiso se resolvió **reusando `INGENIERIA:CREATE/EDIT`** en vez de crear un
  módulo `MATERIALES` nuevo: evita una migración del enum `Module` y la matriz ya
  distingue bien quién hace ingeniería. El costo es que el catálogo queda atado a
  un permiso que también gobierna otras cosas del módulo.

## Casos borde

- **Eliminar un ítem en uso** no lo borra: `DELETE` lo desactiva y responde
  `{ deactivated: true }`.
- **Categoría inactiva**: no se puede crear un ítem contra ella
  (`CATEGORY_INVALID`); los ítems que ya la tenían la conservan y se siguen
  editando.
- **Sin categorías activas**, el botón "Nuevo ítem" queda deshabilitado.
- Un usuario de Ingeniería que entre a `/admin?tab=usuarios` a mano **no ve esa
  sección**: cae en Materiales y la URL se corrige sola.

---

# Plantillas y lista de materiales del proyecto

## Para qué existe

La lista de materiales de cada obra se arma en el proyecto (la comparten
Ingeniería y Operaciones; en el proyecto es la pestaña **Compras**). La
**plantilla** es el punto de partida: carga de una vez lo que va en casi todas
las obras, para que armar la lista sea **completar cantidades** y no elegir
entre los 307 ítems del catálogo.

Hasta el 7-oct-2026 había tres plantillas por tipo de conexión (Monofásico,
Trifásico 230, Trifásico 400) generadas con el **promedio del uso histórico**
(`seed-material-templates.ts`). No servían: cargaban cantidades promedio que
siempre había que corregir, y siempre faltaba o sobraba algo, así que se
terminaba revisando todo. Se reemplazaron por **una sola plantilla "Base"** con
cantidades en cero.

## Cómo se usa

1. En la lista del proyecto, **Usar plantilla → Base**. Agrega solo los ítems
   que todavía no están, todos con cantidad **0**.
2. La lista se ve **por secciones** (la subcategoría del catálogo, "Eléctrica ›
   Cables"), cada una con su contador y, si tiene renglones en cero, la etiqueta
   **"N sin cantidad"**. Cada sección tiene **+ Agregar**, que abre el buscador del
   catálogo con esa sección ya desplegada.
3. Se completan las cantidades. La casilla en cero aparece con borde de aviso.
   **Enter** guarda y pasa a la cantidad siguiente; **Shift + Enter**, a la
   anterior (`QuantityInput` busca los `input[data-qty-input]` en el orden del
   DOM, que es el de las secciones).
4. Lo que depende de la obra se resuelve con **⇄ (cambiar variante)** junto al
   nombre: ofrece los demás ítems activos de **la misma subcategoría**
   (diferencial 2P ⇄ 4P, caño 1" ⇄ 1¼", medidor SPM ⇄ TPM, inversor 6 kW ⇄ 10 kW trifásico). El renglón toma el
   precio, la moneda, el IVA y el proveedor del ítem nuevo.
5. Mientras haya renglones en cero se ve un recuadro arriba de la lista
   ("N materiales sin cantidad") con **Quitar los que están en cero**, que
   elimina los que no van en esa obra.

## Cómo funciona

- Modelos `MaterialTemplate` / `MaterialTemplateItem` / `ProjectMaterial` en
  `schema.prisma`. ABM de plantillas en `routes/material-templates.routes.ts`;
  aplicar, editar renglón, cambiar variante y quitar ceros en `api.routes.ts`
  (`/projects/:id/materials/...`).
- **Cantidad 0 es válida** en `ProjectMaterial` (`POST`/`PATCH` aceptan
  `nonnegative`) y en `MaterialTemplateItem` (default 0 en `PUT .../items`). Un
  renglón en cero significa **"a completar"**, y por eso **queda afuera** de:
  el PDF de la lista (`export-pdf`), el consolidador
  (`consolidador.routes.ts`) y el snapshot del
  EFP (`efp.service.ts` → `buildEFPSnapshots()`). El conector MCP sí los muestra
  (`× 0`), porque describe la lista tal cual está.
- **No hay botón Guardar**: cada celda se guarda sola al salir. Por eso el aviso
  de ceros no es "al guardar" sino un recuadro permanente en la lista, y una
  confirmación al **Exportar** el PDF ("no van a salir en el PDF").
- **Cambiar variante** es `PATCH /projects/:id/materials/:materialId` con
  `materialItemId`. Valida que el ítem nuevo esté activo, que sea de la **misma
  `categoryId`** (`MATERIAL_SWAP_OTHER_CATEGORY`), que no esté ya en la lista
  (`MATERIAL_ALREADY_IN_LIST`, 409) y que el renglón esté `PENDIENTE` y sin
  `movementId` (`MATERIAL_SWAP_LOCKED`). En la UI el botón ⇄ ni se muestra fuera
  de esos casos (`VariantSwap` en `MaterialsTable.tsx`).
- **Quitar ceros** es `POST /projects/:id/materials/remove-zero`: borra los
  renglones con `quantity = 0`, `PENDIENTE` y sin `movementId`.
- **Secciones**: `groupBySection()` en `components/project/materials/types.ts`
  ordena por rubro (orden, nombre) y después por subcategoría. Hace falta porque
  el `orden` de una subcategoría es **relativo a su rubro**: ordenar solo por
  `category.orden` mezclaba "Cables" con "Paneles solares". El `GET` de la lista
  trae `category.parent` para esto.
- **El contenido de "Base"** lo carga `server/prisma/scripts/seed-plantilla-base.ts`
  (idempotente, `--dry-run`; aborta si falta algún ítem, `--skip-missing` para
  local). Sale de las 37 obras con lista en prod al 7-oct-2026: entra lo que
  aparece en la mitad o más, con la variante más usada. Además:
  - arma el rubro **"Inversor y monitoreo"** con dos subcategorías:
    **"Inversores"** (mono y tri juntos) y **"Monitoreo y medición"**
    (medidores, dongles, Shine). Antes todo estaba mezclado en "Inversores
    Monofasicos" / "Inversores Trifasicos", y como el ⇄ solo ofrece la misma
    subcategoría, separados por fase no se podía pasar del inversor mono al tri
    ni del medidor SPM al TPM. Las dos categorías viejas quedan vacías y
    **desactivadas**. Si ya existe una categoría con el nombre de una
    subcategoría (en local había una "Inversores" vacía en primer nivel), se la
    cuelga del rubro en vez de crear otra, porque el nombre es único;
  - mueve la jabalina de "Terminales y conexionado" a "Puesta a tierra";
  - **desactiva** las tres plantillas viejas (no las borra).

## Permisos

| Endpoint | Permiso |
|---|---|
| `GET /projects/:id/materials` | `INGENIERIA:VIEW` **o** `OPERACIONES:VIEW` |
| `POST`/`PATCH`/`DELETE /projects/:id/materials...`, `apply-template`, `remove-zero` | `INGENIERIA:EDIT` **o** `OPERACIONES:EDIT` |
| `POST /projects/:id/materials/export-pdf` | `INGENIERIA:VIEW` |
| `GET /material-templates` | `INGENIERIA:VIEW` **o** `OPERACIONES:VIEW` |
| `POST`/`PATCH`/`DELETE /material-templates` y `PUT .../items` | `CONFIGURACION` **o** `INGENIERIA` (CREATE/EDIT/DELETE) |

Cambiar variante y quitar ceros no agregaron permisos: usan los de editar la
lista. No hay guards por rol.

## Reglas y decisiones

- **Una plantilla, no una por tipo de conexión.** Lo que cambia entre
  monofásico y trifásico es casi siempre la misma pieza en otra medida. Con dos
  renglones (2P y 4P) uno queda siempre en cero y ensucia el aviso; con uno y el
  ⇄ no.
- **El ⇄ se limita a la misma subcategoría**, que es lo que define "variante".
  Si dos variantes reales están en grupos distintos, la solución es moverlas de
  categoría (como se hizo con los medidores), no abrir el ⇄ a todo el catálogo.
- **El inversor entra en "Base"** con el más usado, el Growatt MIN 6000TL-X2
  (decisión de Nicolás, 8-oct-2026), y se cambia con ⇄ por cualquier otro de
  "Inversores". **Queda afuera la estructura** que depende del techo (perfiles
  C/P/H, punta mecha, anclajes, losas): ninguna llega a dos tercios de las
  obras. Se cargan por sección. Si sirve, más adelante
  se agregan plantillas chicas por tipo de montaje que se suman a la base
  (aplicar plantilla ya agrega solo lo que falta).
- **Agregar a mano desde el catálogo sigue entrando con cantidad 1**, no 0: quien
  lo agrega ya sabe que va.
- El campo **Tipo de instalación** (`phaseType`) de la plantilla sigue
  existiendo pero ya no se usa para nada.

## Casos borde

- **Aplicar "Base" sobre una lista que ya tiene ítems**: solo agrega los que
  faltan; lo cargado no se toca.
- **Renglón en cero que ya se pidió** (`PEDIDO`/`RECIBIDO`) o con movimiento en
  Finanzas: no lo quita "Quitar los que están en cero" ni se le puede cambiar la
  variante. Hay que resolverlo a mano.
- **Ítem duplicado en el catálogo**: "Precintos de seguridad c/bloqueo de llave"
  está dos veces con el mismo nombre. El script usa el más usado en obras y lo
  avisa; unificarlos queda pendiente.
- **Catálogo local atrasado**: al 7-oct el local tenía 293 ítems contra 307 en
  prod (faltaban los caños flexibles). Por eso existe `--skip-missing`.

---

# Foto de referencia del material

## Para qué existe

El catálogo tiene ítems de nombre casi idéntico (perfiles, sujetadores,
borneras, cables). Quien compra o quien prepara la salida a obra no siempre sabe
cuál es cuál leyendo el nombre. Cada ítem del catálogo puede tener **una** foto
de referencia que se consulta desde cualquier lista de materiales.

No es una galería del material ni documentación del proveedor: es una sola foto,
chica, para reconocerlo de un vistazo.

## Cómo se usa

En todas las listas de materiales aparece un **ojito** junto al ítem:

| Dónde | Archivo |
|---|---|
| Lista de materiales del proyecto | `components/project/materials/MaterialsTable.tsx` |
| Buscador para agregar materiales al proyecto | `components/project/EngineeringMaterials.tsx` (`AddItemModal`) |
| Consolidador de materiales | `components/ingenieria/consolidador/ConsolidatedTableView.tsx` |
| Stock | `pages/Stock.tsx` |
| Plantillas de materiales | `pages/AdminMaterialTemplates.tsx` |
| Catálogo en Administración | `pages/AdminMateriales.tsx` (`ItemsPanel`) |

- **Ítem con foto**: el ícono es un ojo lleno. Al pasar el mouse se abre un
  popover con la imagen. Con click el popover queda fijo y, si el usuario puede
  editar, aparecen "Cambiar" y "Quitar".
- **Ítem sin foto**: el ícono es un `+` de imagen punteado y un click abre
  directamente el selector de archivos. A quien no puede editar no se le muestra
  nada (queda el hueco de la columna).
- El click sirve también en celular, donde no hay hover.

La foto se puede cargar **desde cualquiera de esas pantallas**, no solo desde
Administración: la confusión aparece armando la lista del proyecto, que es donde
conviene resolverla.

## Cómo funciona

- Campos `fotoPath` y `fotoUpdatedAt` en `MaterialItem` (`schema.prisma`).
- `server/src/services/material-photo.service.ts` procesa la imagen:
  `saveMaterialItemPhoto()` la reduce a **480px de lado mayor** y la recomprime a
  **JPEG calidad 72**; una foto de celular de varios MB queda en 15-25 KB. El
  original **no se guarda**.
- El formato es JPEG y no WebP **porque PDFKit solo embebe JPEG y PNG**, y la
  misma imagen se reusa en el PDF de la lista de materiales.
- HEIC del iPhone se acepta y se convierte al entrar (`convertirHeicABufferJpeg`),
  igual que en el resto de los caminos de subida.
- Los archivos viven en `storage/catalogo/materiales/<uuid>.jpg`. **No son
  `FileAttachment`** y no cuelgan de ningún proyecto: el ítem es del catálogo
  global.
- El frontend no pide la foto ítem por ítem para saber si existe: hay un índice
  liviano `GET /materials/items/con-foto` → `{ fotos: { itemId: epoch } }`,
  cacheado 5 minutos por TanStack Query y compartido por todas las listas
  (`useMaterialPhotoIndex` en `components/materials/MaterialPhoto.tsx`).
- La imagen se descarga **recién al pasar el mouse**, vía `useAuthBlobUrl` (el
  endpoint pide `Authorization`, así que un `<img src>` directo no sirve). La URL
  lleva `?v=<fotoUpdatedAt>`, lo que permite cachearla un día sin quedar pegado a
  una foto vieja tras un reemplazo.
- El popover se dibuja en un **portal con posición fija**: las tablas de
  materiales tienen `overflow-x-auto` y un `absolute` quedaría recortado.

### Carga en lote y paso a producción

Las fotos que se cargan una por una desde la app quedan **solo en el entorno
donde se cargaron**: el storage no se replica entre desarrollo y producción. Para
que terminen iguales en los dos, las fotos se versionan en el repo:

- Imágenes en `server/prisma/scripts/fotos-materiales/`.
- Un `manifest.json` que asocia cada archivo a su ítem por `itemId` (con
  `itemNombre` como fallback legible).
- `server/prisma/scripts/seed-fotos-materiales.ts` las aplica al entorno donde se
  corre, con el **mismo procesamiento** que la subida por la app (reusa
  `procesarFotoMaterial()`).

```bash
docker compose exec server npx tsx prisma/scripts/seed-fotos-materiales.ts --dry-run
docker compose exec server npx tsx prisma/scripts/seed-fotos-materiales.ts
```

Es idempotente: compara el **hash de la imagen ya procesada** contra la que el
ítem tiene en el storage y saltea las que están al día, así correrlo dos veces no
duplica archivos ni cambia `fotoUpdatedAt` (que es lo que invalida el cache del
navegador). Los ítems que no existen en ese entorno se reportan al final y no
frenan al resto. En producción se corre después del deploy (ver `DEPLOY.md` §6).

Detalles del flujo:

- Las fotos crudas del celular (HEIC de 1-2 MB) se dejan en
  `server/scripts/fotos-materiales/`, que **está en el `.gitignore`**, y se pasan
  a la carpeta versionada con `scripts/procesar-fotos-entrada.ts`. Al repo van
  solo las versiones de ~24 KB.
- **Una misma imagen puede ir a varios ítems**: cuando el material está cargado
  en varias medidas (perfiles de 3.600 y 4.800, cable de aluminio 50/75/95 mm²,
  termomagnéticas por amperaje) se repite la entrada cambiando el `itemId`. Cada
  ítem recibe su **propia copia** en el storage, así quitarle la foto a uno no
  afecta a los otros.
- El catálogo de desarrollo suele estar atrasado respecto al de producción, y los
  `itemId` tienen que coincidir para que el manifiesto sirva en los dos lados.
  `server/scripts/import-catalogo-prod.ts` copia categorías, proveedores e ítems
  desde un JSON exportado de prod (solo agrega y corrige nombres; no borra ni
  pisa precios ni stock locales).

### En el PDF de la lista de materiales

`POST /projects/:id/materials/export-pdf` antepone una columna **Foto** de 34pt
y sube el alto de fila de 16 a 34pt, restándole el ancho a la columna Ítem (por
eso los nombres largos se truncan más que antes en el modo con precios).

**Si ningún ítem de esa lista tiene foto, el PDF sale exactamente como antes**:
la columna no existe y las filas siguen siendo de 16pt.

## Permisos

| Endpoint | Permiso |
|---|---|
| `GET /materials/items/con-foto` | `INGENIERIA:VIEW` **o** `OPERACIONES:VIEW` **o** `STOCK:VIEW` **o** `CONFIGURACION:VIEW` |
| `GET /materials/items/:id/foto` | los mismos cuatro `VIEW` |
| `POST /materials/items/:id/foto` | `INGENIERIA:EDIT` **o** `OPERACIONES:EDIT` **o** `STOCK:EDIT` **o** `CONFIGURACION:EDIT` |
| `DELETE /materials/items/:id/foto` | los mismos cuatro `EDIT` |

La foto es el campo **más abierto** del catálogo: la puede cambiar cualquiera con
`EDIT` en Ingeniería, Operaciones, Stock o Configuración. El resto del ítem
(precio, categoría, unidad) pide `CONFIGURACION:EDIT`, `STOCK:EDIT` o
`INGENIERIA:EDIT` — ver "Catálogo de materiales (Administración)" más arriba —,
así que `OPERACIONES:EDIT` alcanza para la foto pero no para el ítem.

Como `OPERACIONES:EDIT` y `STOCK:EDIT` están repartidos ampliamente en la matriz,
en la práctica hoy pueden cambiar la foto casi todos los roles internos —
incluidos `ASESOR_COMERCIAL` y `FINANZAS`, que la tienen por vías indirectas.
Subir o quitar una foto queda auditado (`material_item` / `updated`).

## Reglas y decisiones

- **Una foto por ítem**, no una galería. Subir otra reemplaza la anterior.
- **El original se descarta.** Lo que se guarda es solo la versión chica: la
  feature existe para que las listas y el PDF sigan siendo livianos.
- **La foto se borra recién después** de que la nueva quedó escrita: si falla el
  reemplazo, el ítem se queda con la que tenía en vez de quedar sin ninguna.
- **La foto es del catálogo, no del proyecto**: cambiarla se ve en todos los
  proyectos que usan ese ítem, y en los consolidados viejos también (el
  consolidado guarda `catalogItemId`, la foto se resuelve en vivo).
- **Carga perezosa**: el índice se pide una vez por sesión-ish y las imágenes
  solo cuando se miran. Una lista de 60 ítems no descarga nada hasta el hover.

## Casos borde

- **Archivo que no es imagen**: rechazo con `INVALID_PHOTO_TYPE` por extensión, o
  `INVALID_PHOTO` si la extensión miente y sharp no puede decodificarlo.
- **Imagen muy grande**: se corta en el límite global de subida
  (`MAX_FILE_SIZE_MB`, 20 MB por defecto).
- **Foto en la base pero archivo faltante en el storage**: el endpoint responde
  404 y el popover dice "No se pudo cargar la foto"; en el PDF esa fila sale sin
  imagen en vez de romper la exportación.
- **Ítem desactivado**: conserva su foto; si vuelve a activarse, sigue ahí.
- **Borrar el ítem del catálogo**: si está en uso solo se desactiva, así que la
  foto queda. Si se borra de verdad, **el archivo físico queda huérfano** en
  `storage/catalogo/materiales/` — hoy no hay limpieza para ese caso.

---

## Plantilla para las secciones que faltan

Al escribir cada herramienta pendiente, seguir la estructura común (ver `README.md`):

```
## Para qué existe
## Cómo se usa
## Cómo funciona
## Permisos
## Reglas y decisiones
## Casos borde
```

## Mientras tanto

Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad
sobre cómo funciona hoy**:

- El código, que es lo único que no miente.
- `CHANGELOG.md` para saber qué cambió y cuándo.
- `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede
  contradecir a la implementación.
- `docs/pendientes/` para saber qué falta.


---

# Diseñador de gabinetes metálicos

## Para qué existe

Los gabinetes de intemperie se mandan a fabricar a medida. Hasta ahora el plano
se dibujaba a mano una vez, se mandaba por WhatsApp y cada pedido nuevo era
editar aquel dibujo o volver a explicarlo. El ida y vuelta era siempre el mismo:
el fabricante preguntaba **espesor** y **chapa**, y en la conversación aparecían
medidas que en el plano no estaban.

Dos decisiones ordenan toda la herramienta:

1. **Ninguna medida queda implícita, y cada una va acotada sobre el dibujo.**
   Todo lo que se dibuja sale de un campo con valor por defecto editable, y la
   cota se pone en la vista donde esa parte se ve. Nada depende de que el
   fabricante conteste un mensaje ni de que el taller resuelva por su cuenta.
2. **El gabinete es todo chapa plegada, y se entrega sin herrajes y sin
   perforar.** Es lo único que este fabricante hace. La tapa va suelta —sin
   bisagras ni cierre—, y los agujeros de amure los hace Voltia en obra.

## Cómo se usa

Dentro del workspace del proyecto (`/ingenieria/proyecto/:id`), tarjeta
**Gabinete metálico**.

1. **Nuevo gabinete** crea uno con los valores del que más se pide
   (50 × 85 × 26 cm, chapa galvanizada de 1,5 mm, fondo abierto, pestaña de 3 cm).
2. Se ajustan las medidas en el formulario de la izquierda. **La lámina de la
   derecha se redibuja sola** (450 ms después de dejar de tipear) y muestra las
   dos hojas.
3. **Emitir lámina (PDF)** guarda los cambios y congela una versión.

El formulario ocupa un tercio del ancho y el dibujo el resto: los datos son
pocos y el plano es lo que hay que mirar. **Ampliar** lo abre a pantalla
completa, para revisarlo sin descargar el PDF.

Un proyecto puede tener **varios gabinetes**; cada uno lleva su nombre, sus
medidas y su propio historial de láminas.

### Cómo es el gabinete

Un **cuerpo** de chapa plegada sin fondo, armado con **dos piezas en L**
atornilladas, con una **pestaña perimetral atrás** para amurar y un **reborde
plegado hacia adentro en el frente**, que es donde asienta la tapa. Y una
**tapa** suelta, plegada en sus cuatro caras, que monta sobre ese reborde.

### Qué lleva la lámina

**Una sola hoja A4**: frontal con la tapa puesta, lateral derecha, posterior,
**el plano de la tapa** (de frente y de canto) e isométrica, más las
especificaciones generales y las notas.

**Cada medida va acotada sobre el dibujo**, en la vista donde esa parte se ve:

| Medida | Dónde se acota |
|---|---|
| Ancho, alto | Frontal |
| Profundidad | Lateral |
| Reborde de la tapa (su profundidad como pieza) | Lateral |
| Reborde plegado del frente del cuerpo | Lateral (línea oculta punteada) |
| Solape de la tapa y holgura | Lateral (llamada) |
| Ancho de pestaña de amure | Lateral y posterior |
| Solape de unión de las dos L y paso de tornillos | Posterior (llamada) |
| Ancho y alto de la tapa | Plano de la tapa |
| Reborde plegado de la tapa (su profundidad) | Plano de la tapa, vista de canto |
| Espesor de chapa | Especificaciones (es del material, no geométrica) |
| Tolerancia | Notas |

El reborde de la tapa aparece dos veces a propósito: en la **lateral**, para ver
cómo encastra en el cuerpo, y en el **plano de la tapa**, que es la pieza que el
taller fabrica aparte. De frente parecería el ancho de un marco; de canto se ve
como lo que es —cuánto dobla hacia atrás—, y por eso la frontal no lo acota.

Las especificaciones dicen explícitamente lo que **no** se pide —"SE ENTREGA SIN
HERRAJES", "SIN NINGUNA PERFORACIÓN"—, y el dibujo lo repite sobre la pestaña
("SIN perforar: los agujeros de amure se hacen en obra"). Es a propósito: sin
eso el fabricante cotiza bisagras y cierre, o perfora la pestaña por su cuenta,
y el pedido vuelve con preguntas.

#### Lo que se probó y se descartó

La lámina llegó a tener **una hoja 2** con dibujos de detalle (corte del
encuentro tapa/cuerpo, despiece de las dos piezas en L, frente sin tapa, la tapa
suelta) y después **una tabla de medidas** al pie. Las dos cosas se sacaron, por
razones distintas y las dos del usuario:

- Los detalles **no se entendían solos** ("no entiendo qué es todo esto"), y ni
  el fabricante ni el instalador necesitan que les expliquen cómo se arma un
  gabinete.
- La tabla **no dice a qué parte corresponde cada número**: una medida escrita
  sin dibujo es ambigua. De ahí la regla actual: toda medida va acotada sobre la
  vista donde esa parte se ve.

También se probó una **vista en planta** para acotar el encuentro tapa/cuerpo;
quedó ilegible a la escala que permitía la hoja y se reemplazó por acotar esas
medidas en la lateral. El código de todas esas vistas está en el historial de
git (`views.ts`, 28-sep-2026).

### Los valores por defecto

Cada medida arranca con un default. **No son relleno: son la decisión que se toma
si nadie dice otra cosa**, y salen impresas como cualquier otra medida.

| Medida | Default |
|---|---|
| Solape de unión entre las piezas en L | 3 cm |
| Paso de tornillos de unión | cada 15 cm |
| Reborde plegado del frente del cuerpo | 2 cm |
| Reborde plegado de la tapa | 2 cm |
| Solape de la tapa sobre el cuerpo | 1 cm |
| Holgura tapa / cuerpo | 2 mm |
| Tolerancia general | ± 2 mm |
| Ancho de pestaña de amure | 3 cm |

## Cómo funciona

- Modelos `CabinetDesign` y `CabinetDesignVersion` (`schema.prisma`). El diseño
  se edita in-place; **emitir** crea una versión con un `snapshot` JSON de todos
  los campos, para que una lámina vieja siga siendo reproducible aunque el
  diseño cambie después.
- **Ningún campo de medida es nullable**, ni en Prisma ni en el schema Zod de la
  ruta: todos tienen `@default` / `.default()`, y los dos juegos de valores
  tienen que coincidir. Es la traducción en código de "que no queden medidas
  sueltas".
- Dibujo en `server/src/services/gabineteSvg/`: `draw.ts` (primitivas y cotas),
  `views.ts` (una función por vista), `index.ts` (`buildGabineteSvgs()`, que
  arma la hoja —devuelve un array de una— más `especificaciones()` y
  `especificaciones()`), `types.ts`
  (`GabineteInputs`, el contrato del dibujo).
- Rutas en `server/src/routes/gabinete.routes.ts`.
- Frontend: `client/src/api/gabinete.api.ts`,
  `components/ingenieria/gabinete/GabineteToolPanel.tsx` (lista) y
  `GabineteBuilder.tsx` (constructor + preview).

### El preview sale del server, no del navegador

`POST /gabinetes/preview` devuelve `{ hojas: string[] }` con **los mismos SVG**
que después se rasterizan al PDF, y el constructor los inyecta tal cual. Es
deliberado: si el dibujo se reimplementara en el cliente para que el preview
fuera instantáneo, las dos versiones se despegarían en la primera corrección de
geometría y el fabricante recibiría algo distinto de lo que se vio en pantalla.
El costo es un request por cada pausa al tipear.

Las respuestas fuera de orden se descartan con un contador (`lastRequest`): sin
eso, una petición lenta puede pisar el dibujo de una más nueva.

### SVG → PDF

`renderSvgsToPdf()` en `server/src/services/svgPdf.service.ts`, compartido con el
generador de unifilares (que usa el atajo `renderSvgToPdf()` de una sola hoja):
rasteriza con resvg-js y embebe un PNG por página con pdf-lib. Las fuentes
Roboto viven en `unifilarSvg/fonts/` y se cargan explícitamente porque el
container Node no trae fuentes del sistema — sin eso el PDF sale **sin texto**.

### Escalas

Frontal y lateral comparten una escala (`escalaFrontalLateral()`) porque están
lado a lado: si cada una se escalara para llenar su celda, el mismo gabinete se
vería de distinto alto en cada vista y el taller lo lee mal. La posterior y la
isométrica escalan cada una para su celda.

## Permisos

| Endpoint | Permiso |
|---|---|
| `GET /projects/:projectId/gabinetes` · `GET /gabinetes/:id` | `INGENIERIA:VIEW` |
| `POST /gabinetes/preview` | `INGENIERIA:VIEW` |
| `POST /projects/:projectId/gabinetes` · `PATCH /gabinetes/:id` · `POST /gabinetes/:id/emitir` | `INGENIERIA:EDIT` |
| `DELETE /gabinetes/:id` | `INGENIERIA:DELETE` |

Con la matriz vigente: ven la herramienta todos los roles con `INGENIERIA:VIEW`
(incluidos `ASESOR_COMERCIAL` y `LOGISTICA`, en lectura), y **diseñan y emiten**
`ADMIN`, `INGENIERIA` y `GERENTE_INGENIERIA`. No hay ningún guard por nombre de
rol. En el panel, "Nuevo gabinete" y el botón de eliminar se ocultan según
`usePermission`.

## Reglas y decisiones

- **Solo se pide lo que se hace plegando chapa.** Bisagras, cierre, ventilación,
  grado IP y los agujeros de amure salieron del modelo, no se guardan y no se
  imprimen: no los provee este fabricante, un IP sin herrajes ni burlete no se
  puede garantizar, y las perforaciones las hace el instalador.
- **La tapa no tiene alero.** Va a ras del frente; lo único que sobresale es su
  reborde plegado. La primera versión de la lámina le dibujaba un techo saliente
  y por eso la isométrica estaba mal.
- **Las láminas emitidas no se pisan.** A diferencia del unifilar —que mantiene
  solo el plano vigente y soft-deletea los anteriores—, acá cada versión queda:
  una lámina vieja puede ser un pedido que el fabricante todavía tiene en curso.
- **Borrar un gabinete no borra sus láminas**: quedan como documentos del
  proyecto, por lo mismo.
- **Las medidas son exteriores**, y la lámina lo dice en las notas.
- **Especificaciones adicionales** (`specsExtra`, JSON) existe para no tener que
  tocar la app cada vez que el taller pide un dato nuevo: se agrega como
  etiqueta + valor y sale impreso al final de las especificaciones. Cuando un
  dato se vuelve habitual, conviene promoverlo a campo propio **con su cota en
  el dibujo**.

## Casos borde

- **Gabinete sin pestaña de amure**: la vista posterior deja de dibujarla y la
  fila del ancho de pestaña sale de la tabla de medidas.
- **Fondo cerrado**: la posterior dibuja la chapa de fondo y los títulos dejan de
  decir "(sin fondo)".
- **Medidas muy desproporcionadas** (un gabinete muy bajo y ancho): las vistas se
  reescalan solas, pero los detalles mantienen su tamaño fijo.
- **Falla la generación del PDF**: la ruta responde `GABINETE_PDF_ERROR` y **no**
  crea la versión, para que no quede una versión sin lámina.
- El texto de las especificaciones se corta en renglones con una medida
  **aproximada** del ancho (`wrap()` en `draw.ts`, 0,5 em por carácter): un valor
  muy largo en una especificación adicional puede quedar algo corrido.

## Lo que falta

- **Rejillas de ventilación y entradas de prensacables**: los gabinetes en obra a
  veces las llevan, pero no se piden al fabricante (se agregan después), así que
  no hay campo ni dibujo. Si alguna vez se pidieran, van como campos nuevos.

---

# Justificación de potencia ante UTE

## Para qué existe

Antes de abrir el caso de microgeneración, UTE compara la generación anual de la
planta pedida contra el consumo del último año de la cuenta (**balance anual**).
Si no da, contesta la consulta con una potencia menor. Cuando el cliente va a
consumir más (mudanza, unificación de cuentas, obra en construcción, cargas
nuevas), Voltia contesta con un informe técnico que proyecta el consumo futuro.
Hasta ahora esos informes se armaban a mano en Word (ESTILO, Soler, Filippa,
García Rodríguez, Coviteja, Rodrigo Álvarez); esta herramienta los genera desde
el proyecto.

La potencia contratada es otro límite y **no entra** en el cálculo: se resuelve
con el aumento de potencia (capítulo 07, Suministro individual).

## Cómo se usa

Tarjeta **Justificación de potencia ante UTE** en el workspace de Ingeniería
(`/ingenieria/proyecto/:id`), clave `justif-potencia`. No hay subetapa en el
pipeline (decisión del 7/10/2026: se usa solo cuando UTE recorta, y una subetapa
obligatoria obligaba a marcar "No aplica" en casi todos los proyectos).

El formulario (`JustificacionFormModal`) tiene seis bloques: la consulta (tipo,
potencia pedida, la que dio UTE, consumo del último año), el motivo de
antecedentes, las cargas proyectadas (sugerencias de `catalogo.ts` → `CARGAS_SUGERIDAS`,
carga libre o cuenta que se unifica), el balance en vivo, el encabezado y los
cuatro textos. "Generar informe PDF" crea la versión. El detalle de uso para el
equipo está en el Manual de trabajo de Ingeniería.

## Cómo funciona

- **Modelo** `JustificacionPotenciaVersion` (`justificacion_potencia_versions`):
  1:N inmutable por proyecto, `@@unique([projectId, versionNumber])`. Todo el
  formulario va en `datos` (JSON) validado con Zod en
  `services/justificacionPotencia/schema.ts` → `datosSchema`; `potenciaSolicitadaKw`
  está denormalizado para listar. `textosConIa` lo manda el cliente (dice si los
  textos salieron de la IA, aunque después se editen).
- **Cálculo** puro en `justificacionPotencia/calculo.ts` → `calcularBalance()`:
  cada carga en kWh/mes (`kwhMesDeCarga()`: desglose = kW × h/día × días/mes ×
  cantidad, cantidad vacía = 1; directo y unificación = `kwhMes`), incremento
  anual = mensual × 12, consumo proyectado = actual + incremento,
  generación = kW pedidos × `productividadKwhKw` (default 1.450),
  `potenciaJustificadaKw` = consumo / productividad **redondeado hacia abajo** a
  centésimas, `cumpleBalance` = generación ≤ consumo. El formulario tiene una
  copia del cálculo (`catalogo.ts` → `balance()`) solo para mostrar en vivo; el
  que vale es el del servidor.
- **Textos** en `justificacionPotencia/textos.ts`: `textosAutomaticos()` arma
  Objeto, Antecedentes (frase según `motivoAntecedente`), Justificación y
  Conclusión con las frases de los informes manuales. `textosFinales()` usa lo
  escrito a mano y completa los vacíos con el automático: un informe se puede
  generar con los cuatro textos vacíos.
- **IA** opcional en `justificacionPotencia/ia.ts` → `redactarTextosConIa()`:
  tool_use forzado, salida validada con Zod, modelo `JUSTIFICACION_POTENCIA_MODEL`
  (default `claude-sonnet-4-5-20250929`). Se le pasan los números ya calculados y
  el texto automático como base, con la orden de no inventar datos. El uso queda
  en `ai_usage` con la feature `justificacion_potencia`. No pasa por el rate
  limit del asistente (igual que el EFP).
- **PDF** con PDFKit en `justificacionPotencia/pdf.ts` →
  `generateJustificacionPotenciaPdf()`: Roboto, logo embebido de
  `reportesFv/pdf/logo.ts`, secciones numeradas, tabla de cargas, tabla de
  balance, línea de firma (sin imagen: se firma digitalmente afuera) y pie con
  número de página.
- **Rutas** en `routes/justificacion-potencia.routes.ts`:
  `GET /projects/:projectId/justificacion-potencia` (contexto para precargar,
  versiones y los `datos` de la última), `POST …/textos-automaticos`,
  `POST …/redactar-ia`, `POST /projects/:projectId/justificacion-potencia`
  (crea versión + PDF), `GET /justificacion-potencia/:id/pdf` (regenera el PDF de
  cualquier versión desde `datos`; `?download=1` para descargar) y
  `DELETE /justificacion-potencia/:id`.
- **Precarga** (`buildContexto()`): cliente y ubicación del suministro principal
  vía `datosSuministro()`; cuenta, técnico (`ti`, `ciTi`) y potencia (`potImg`)
  de `UteDocumentConfig`; si `potImg` está vacío, suma de inversores de
  `SolarSystem` y, si no hay, `capacityKwp`.
- **Nombre del archivo**: `pdfFilename()` en la ruta arma "Justificacion de
  potencia - <cliente>.pdf" con el nombre del encabezado del informe (o el del
  proyecto si está vacío), sin tildes ni símbolos y **sin la versión**: es el
  archivo que se adjunta a UTE. El listado manda ese nombre en `archivo` para la
  descarga desde el visor.
- **Documentos**: el PDF de la última versión se guarda como `FileAttachment`
  con `tipo = JUSTIFICACION_POTENCIA`, `toolSource = "justif-potencia"`,
  `toolVersion` = número de versión y `toolEntityId` = id de la versión. Al
  generar una versión nueva el anterior se soft-deletea y se borra el archivo
  (mismo criterio que Pre-ingeniería). La etiqueta "Ingeniería · Justificación
  de potencia UTE vN" está en `buildToolSourceLabel()` (`ingenieria.routes.ts`)
  y en el mapeo de `/projects/:projectId/documents` (`api.routes.ts`): hay que
  mantener las dos.
- **Auditoría**: `AuditEntityType.file`, acciones `file_uploaded` al generar y
  `deleted` al borrar.

## Permisos

Todo bajo `Module.INGENIERIA`: `VIEW` para ver y bajar PDFs, `EDIT` para textos
automáticos, IA y generar, `DELETE` para borrar versiones. El panel oculta
"Armar informe" y el tacho según `usePermission`.

## Reglas y decisiones

- **El criterio es solo el balance anual.** Lo pidió Gerencia (Manual de
  Gerencia, 7/10/2026). La potencia contratada no se calcula ni se menciona.
- **1.450 kWh por kW por año** es el default; se edita por informe y queda
  guardado en la versión.
- **Firma: línea, no imagen.** Se descartó estampar una imagen de firma: el
  informe se firma digitalmente después, fuera de Voltia PM.
- **Sin subetapa en el pipeline** (ver "Cómo se usa").
- **Una carga en 0 kWh/mes no se puede generar** (validación del formulario):
  en un informe a UTE parece un descuido.
- **Número en los campos**: "1.600" es 1600 (punto de miles seguido de tres
  dígitos), "2,5" y "2.5" son 2,5 (`parseNum()` en el formulario).

## Casos borde

- **Consumo actual sin cargar** (la factura no trae el total anual):
  `consumoAnualActualKwh` es opcional. Si está vacío o en 0 y hay
  `potenciaUteKw`, `calcularBalance()` lo deduce como `potenciaUteKw ×
  productividad` y marca `consumoActualEstimadoDesdeUte`: UTE llega a su potencia
  dividiendo el consumo anual, así que la cuenta inversa da ese consumo con el
  factor de Voltia (si UTE usa otro factor, el número se corre un poco, pero el
  balance queda medido con la misma vara). El texto automático ("del orden de"), la fila
  del PDF ("≈") y el prompt de la IA lo presentan como aproximado y **sin
  explicar la cuenta**: decidido el 8/10/2026, no se le cita a UTE su propia
  respuesta en el informe. Lo cargado a mano le gana a la estimación. La copia del cálculo en
  `catalogo.ts` → `balance()` repite la regla.
- **Cuenta nueva** (sin consumo ni potencia de UTE): cuenta como 0: la tabla del PDF (`drawTablaBalance()`) muestra solo "Consumo anual proyectado (cargas previstas × 12)", `textos.ts` usa la
  frase sin consumo previo y el balance sale solo de las cargas.
- **Textos heredados**: una versión nueva arranca con `ultimaVersionDatos`,
  textos incluidos, y esos textos tienen los números viejos. El formulario
  muestra un aviso (`textosHeredados`) hasta que se rehacen con automático o IA;
  si se generan igual, el PDF sale con los números viejos en el texto (las
  tablas siempre se recalculan).

- **Borrar la última versión** deja el proyecto sin el informe en Documentos
  aunque haya versiones anteriores: no se "promueve" la anterior. Se genera una
  versión nueva.
- **Proyectos con varios suministros**: la precarga es del suministro principal;
  para otro suministro se corrigen a mano la cuenta y el encabezado.
- **Fecha del informe** = fecha de creación de la versión (hora de Montevideo);
  regenerar el PDF de una versión vieja conserva su fecha.
- **Sin `ANTHROPIC_API_KEY`** el botón de IA devuelve el error
  `ANTHROPIC_NOT_CONFIGURED`; el texto automático y el PDF funcionan igual.
- Si un `datos` guardado dejara de validar contra el schema (por un cambio
  futuro del schema), la lista lo muestra sin balance y su PDF devuelve 400:
  al cambiar `datosSchema` hay que mantenerlo compatible con lo guardado.

