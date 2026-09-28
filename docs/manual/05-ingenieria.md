# 05 · Ingeniería

> **Capítulo parcial.** Están documentados el **consolidador de materiales**, el
> **catálogo de materiales**, la **foto de referencia del material** y el
> **diseñador de gabinetes**. El resto de las herramientas existe y está en
> producción; falta escribirlas.

El workspace de ingeniería y sus herramientas: unifilar, materiales, pre-ingeniería, visitas y proyecto final.

---

## Qué falta cubrir en este capítulo

- El workspace y su acordeón de herramientas
- Unifilar: generación del SVG y del PDF
- Plantillas de materiales
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
- **Categorías**: alta, renombrado, reordenamiento y baja.

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

Con la matriz vigente, **crear y editar ítems** lo pueden hacer: `ADMIN`,
`INGENIERIA` y `GERENTE_INGENIERIA` (por `INGENIERIA`), y `CAPATAZ`, `FINANZAS`,
`GERENTE_FINANZAS`, `GERENTE_OPERACIONES`, `INSTALADOR_TERCERIZADO`, `LOGISTICA`
y `OPERACIONES` (por `STOCK`, desde la pantalla de Stock).

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
medidas que en el plano no estaban (el perfil de la puerta, cómo se arma el
cuerpo).

La herramienta genera esa lámina desde los datos del gabinete. El principio que
la ordena: **ninguna medida queda implícita**. Todo lo que se dibuja sale de un
campo con valor por defecto editable, y además está escrito en la tabla de
medidas de la hoja 2, para que nada dependa de que el taller interprete bien un
trazo ni de que el fabricante conteste un WhatsApp.

## Cómo se usa

Dentro del workspace del proyecto (`/ingenieria/proyecto/:id`), tarjeta
**Gabinete metálico**.

1. **Nuevo gabinete** crea uno con los valores del gabinete que más se pide
   (50 × 85 × 26 cm, chapa galvanizada de 1,5 mm, fondo abierto, pestaña de 3 cm).
2. Se ajustan las medidas en el formulario de la izquierda. **La lámina de la
   derecha se redibuja sola** (450 ms después de dejar de tipear) y muestra las
   dos hojas.
3. **Emitir lámina (PDF)** guarda los cambios y congela una versión.

Un proyecto puede tener **varios gabinetes**; cada uno lleva su nombre, sus
medidas y su propio historial de láminas.

### Qué lleva la lámina

**Hoja 1 — Conjunto**: frontal (con ancho, alto y la posición de las bisagras),
lateral derecha (profundidad y ala de la tapa), posterior (pestaña de amure con
diámetro y cantidad de agujeros) e isométrica, más las especificaciones
generales y las notas.

**Hoja 2 — Detalles de fabricación**: corte del encuentro puerta/marco, detalle
de la pestaña de amure, **despiece de las dos piezas en L**, detalle de plegado,
interior con las bisagras, y la **TABLA DE MEDIDAS** completa.

El **corte de puerta y marco** se agregó porque un instalador que ya había
fabricado gabinetes marcó que faltaba: sin ver cómo asienta la puerta sobre el
marco, el taller no sabe cómo doblar los perfiles. Acota ala de la puerta, ala
del marco, solape y holgura.

El **despiece** y el **detalle de plegado** se agregaron al cerrar la decisión de
que el fabricante podía no contestar nunca: el armado en dos piezas en L estaba
dicho con palabras pero sin ninguna medida, y el radio de plegado —que hace
falta para calcular el desarrollo de la chapa— no figuraba en ningún lado.

### Los valores por defecto

Cada medida arranca con un default. **No son un relleno: son la decisión que se
toma si nadie dice otra cosa**, y salen impresas como cualquier otra medida.

| Medida | Default |
|---|---|
| Ala / reborde de la tapa | 3 cm |
| Radio interior de plegado | 2 mm |
| Solape de unión entre las piezas en L | 3 cm |
| Paso de tornillos de unión | cada 15 cm |
| Diámetro de agujero de amure | 6 mm |
| Agujeros de amure | 4 por lado vertical · 3 por lado horizontal |
| Ala del perfil de la puerta / del marco | 2 cm / 2 cm |
| Solape puerta sobre marco | 1 cm |
| Holgura puerta / marco | 2 mm |
| Bisagras | 2, apertura izquierda, eje a 12 cm del extremo |
| Tolerancia general | ± 2 mm |

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
  arma las dos hojas, más `especificaciones()` y `tablaMedidas()`), `types.ts`
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
vería de distinto alto en cada vista y el taller lo lee mal. La posterior, la
isométrica, la interior y el despiece escalan cada una para su celda; el corte
de puerta, el detalle de pestaña y el de plegado son esquemáticos y **lo dicen
en el dibujo** ("Detalle sin escala").

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

- **Las láminas emitidas no se pisan.** A diferencia del unifilar —que mantiene
  solo el plano vigente y soft-deletea los anteriores—, acá cada versión queda:
  una lámina vieja puede ser un pedido que el fabricante todavía tiene en curso.
- **Borrar un gabinete no borra sus láminas**: quedan como documentos del
  proyecto, por lo mismo.
- **Las medidas son exteriores**, y la lámina lo dice en las notas.
- **La tabla de medidas duplica a propósito lo que ya está acotado en los
  dibujos.** No es redundancia por descuido: un número escrito no se presta a
  interpretación y sobrevive a una impresión mala o a una foto de WhatsApp.
- **Especificaciones adicionales** (`specsExtra`, JSON) existe para no tener que
  tocar la app cada vez que el taller pide un dato nuevo: se agrega como
  etiqueta + valor, sale impreso al final de las especificaciones **y también en
  la tabla de medidas**. Cuando un dato se vuelve habitual, conviene promoverlo
  a campo propio.

## Casos borde

- **Gabinete sin pestaña de amure**: la vista posterior pierde los agujeros, el
  detalle de pestaña dice "Sin pestaña de amure" y las filas de amure salen de
  la tabla de medidas.
- **Fondo cerrado**: la posterior y la interior dibujan la chapa de fondo y los
  títulos dejan de decir "(sin fondo)".
- **Una sola bisagra**: se dibuja centrada, y la cota al extremo deja de tener
  sentido (sigue saliendo en la tabla).
- **Medidas muy desproporcionadas** (un gabinete muy bajo y ancho): las vistas se
  reescalan solas, pero los detalles mantienen su tamaño fijo.
- **Falla la generación del PDF**: la ruta responde `GABINETE_PDF_ERROR` y **no**
  crea la versión, para que no quede una versión sin lámina.
- El texto de las especificaciones se corta en renglones con una medida
  **aproximada** del ancho (`wrap()` en `draw.ts`, 0,5 em por carácter): un valor
  muy largo en una especificación adicional puede quedar algo corrido.

## Lo que falta

- **Ventilación**: hoy es un sí/no. Si un gabinete lleva rejillas, sus medidas y
  su posición no se dibujan — van por `specsExtra`.
- **Entradas de cable / prensacables**: mismo caso, no hay campo ni dibujo.
- El despiece muestra **un tornillo representativo** sobre el solape y el paso
  como nota, en vez de repartirlos a lo largo del solape.
