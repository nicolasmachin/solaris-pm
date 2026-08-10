# 05 · Ingeniería

> **Capítulo parcial.** Solo está documentado el **consolidador de materiales**.
> El resto de las herramientas existe y está en producción; falta escribirlas.

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
