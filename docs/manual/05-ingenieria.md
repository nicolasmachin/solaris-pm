# 05 · Ingeniería

> **Capítulo parcial.** Están documentados el **consolidador de materiales** y la
> **foto de referencia del material**. El resto de las herramientas existe y está
> en producción; falta escribirlas.

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

Es **el único campo del catálogo que se puede tocar sin permisos de
configuración**, y es deliberado: el resto del ítem (precio, categoría, unidad)
sigue pidiendo `CONFIGURACION:EDIT` o `STOCK:EDIT`.

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
