# Generador de Pre-Ingeniería — Especificación Técnica

> **Feature:** Generador automático de "Resumen Técnico" del proyecto (PDF entregable)
> **Producto:** Voltia PM
> **Ubicación:** Nueva herramienta del **Módulo Ingeniería** (workspace del proyecto)
> **Spec madre:** `docs/features/ingenieria/SPEC.md`
> **Versión spec:** 1.0
> **Estado:** Aprobado para implementación

---

## Tabla de contenidos

1. [Contexto y objetivo](#1-contexto-y-objetivo)
2. [Estructura del documento](#2-estructura-del-documento)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Pre-rellenado desde UnifilarVersion](#4-pre-rellenado-desde-unifilarversion)
5. [API REST](#5-api-rest)
6. [Generador del PDF](#6-generador-del-pdf)
7. [UI dentro del workspace](#7-ui-dentro-del-workspace)
8. [Casos de prueba](#8-casos-de-prueba)
9. [Fuera de alcance](#9-fuera-de-alcance)

---

## 1. Contexto y objetivo

Voltia hoy genera manualmente un PDF llamado **"Resumen Proyecto IMG"** para cada cliente, antes de pasar a la etapa de ejecución. Este documento se hace en una herramienta de diseño externa (probablemente Pages, Word o Figma), llenando un template a mano con los datos del proyecto y agregando fotos del sitio.

El PDF se entrega al cliente y/o se usa internamente como referencia técnica antes de avanzar con la habilitación.

**Objetivo:** automatizar la generación de este documento desde el módulo Ingeniería de Voltia PM. La herramienta toma datos del proyecto + datos eléctricos + fotos del sitio, y produce un PDF A4 con el mismo formato que se usa hoy.

**Cobertura objetivo:** 100% de los proyectos Voltia (residencial mono, residencial tri, comercial, industrial, multi-instalación como COVITEJA).

**Importante:** esta spec asume que el módulo Ingeniería ya está implementado (Fase 1A). Esta es una herramienta más dentro del workspace, igual que el unifilar, lista de materiales y calculadora de triángulos.

---

## 2. Estructura del documento

### 2.1 Página 1 — Formulario fijo

Layout A4 vertical. Header con logo Voltia centrado arriba + título "Instalación Fotovoltaica / Resumen Técnico".

Cuerpo en 2 columnas:

**Columna izquierda — DATOS DEL CLIENTE**
- Nombre
- Dirección
- Ciudad
- Celular
- Fecha prevista (texto libre, ej: "3er semana abril")

**Columna izquierda (debajo) — DATOS SITIO DE INSTALACIÓN**
- Tipo de techo: una opción marcada con "X" (Isopanel / Hormigón / Chapa / Tejas / Otro)
- Info techo (texto libre, multi-línea)

**Columna derecha — DATOS ELÉCTRICOS**
- Cantidad paneles
- Potencia paneles (W)
- Inversor (texto libre, ej: "Growatt de 6kW")
- Strings/Líneas DC
- Cable AC (texto libre, ej: "Superplastico 2x6mm2")
- Térmica AC (texto libre, ej: "32 A")
- Diferencial AC (texto libre, ej: "40 A, 300mA")
- Largo cables AC (mts)
- Largo cables DC (mts)

**Columna derecha (debajo) — OTROS DATOS**
- Altura techo (texto libre, ej: "1 piso", "5 pisos")
- Red: una o más opciones marcadas con "X" (Monofásica / Trifásica 230 sin neutro / Trifásica 400 con neutro)

**Pie de página 1 (opcional)**
- NOTAS ADICIONALES (texto libre, multi-línea)

### 2.2 Páginas 2..N — Fotos del sitio

Una foto por página (o múltiples si caben). Cada foto puede tener una **etiqueta de texto** asociada que se renderiza junto a ella (no encima — eso requiere editor de anotaciones, fuera de alcance Fase 1).

**Importante:** las fotos pueden venir **ya anotadas** desde la herramienta de diseño del usuario (con cuadros, flechas, etc. ya dibujados sobre la imagen). Voltia PM las inserta tal como vienen.

### 2.3 Branding

- Logo Voltia centrado arriba en página 1
- Paleta de colores:
  - Azul oscuro (`#1E40AF` o similar) para títulos de sección
  - Texto en negro/gris oscuro
  - Fondos blancos/grises claros
- Tipografía sans-serif consistente con el resto de la app

---

## 3. Modelo de datos

### 3.1 Modelo Prisma

```prisma
model PreIngenieriaVersion {
  id            String   @id @default(cuid())

  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  versionNumber Int
  label         String?
  createdAt     DateTime @default(now())

  // ─── Snapshot de datos del cliente ───
  // (denormalizado del Project al momento de crear la versión)
  snapshotNombre        String
  snapshotDireccion     String?
  snapshotCiudad        String?
  snapshotCelular       String?
  snapshotFechaPrevista String?  // texto libre

  // ─── Datos del sitio de instalación ───
  tipoTecho       String?  // "ISOPANEL" | "HORMIGON" | "CHAPA" | "TEJAS" | "OTRO"
  tipoTechoOtro   String?  // descripción cuando tipoTecho = "OTRO"
  infoTecho       String?  // texto libre multi-línea
  alturaTecho     String?  // texto libre, ej: "1 piso", "5 pisos"

  // ─── Datos eléctricos (texto libre para flexibilidad) ───
  cantidadPaneles    String?
  potenciaPaneles    String?  // ej: "580W"
  inversor           String?  // ej: "Growatt de 6kW"
  stringsLineasDc    String?
  cableAc            String?  // ej: "Superplastico 2x6mm2"
  termicaAc          String?  // ej: "32 A"
  diferencialAc      String?  // ej: "40 A, 300mA"
  largoCablesAcMts   String?  // ej: "10 mts"
  largoCablesDcMts   String?  // ej: "15 mts"

  // ─── Tipo de red (multi-select por caso multi-instalación tipo COVITEJA) ───
  redMonofasica       Boolean @default(false)
  redTrifasica230SN   Boolean @default(false)
  redTrifasica400CN   Boolean @default(false)

  // ─── Notas adicionales ───
  notasAdicionales    String?  // texto libre multi-línea

  // ─── Origen del pre-rellenado (opcional, para trazabilidad) ───
  unifilarVersionId   String?  // si los datos eléctricos vinieron de un UnifilarVersion

  // ─── Fotos del sitio ───
  fotos PreIngenieriaFoto[]

  @@unique([projectId, versionNumber])
  @@index([projectId])
  @@map("preingenieria_versions")
}

model PreIngenieriaFoto {
  id          String   @id @default(cuid())
  versionId   String
  version     PreIngenieriaVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  orden       Int      // posición en el PDF (1, 2, 3, ...)
  etiqueta    String?  // texto descriptivo opcional, ej: "Inversor", "Tablero UTE"
  // El archivo físico vive en STORAGE_PATH
  fileAttachmentId String?  // referencia al FileAttachment con la imagen
  fileAttachment   FileAttachment? @relation(fields: [fileAttachmentId], references: [id])

  @@index([versionId])
  @@map("preingenieria_fotos")
}
```

### 3.2 Relación inversa en Project

```prisma
model Project {
  // ... campos existentes ...
  preIngenieriaVersions  PreIngenieriaVersion[]
}
```

### 3.3 Decisiones de diseño

- **Texto libre para campos eléctricos** — habilita casos como COVITEJA ("20 (8 mono, 12 tri)") sin modelo rígido
- **Multi-select para tipo de red** — soporta multi-instalación
- **Snapshot del cliente** — coherente con UnifilarVersion (versiones inmutables)
- **Versionado 1:N** — coherente con UnifilarVersion, igual patrón
- **Fotos como entidad separada** — permite múltiples fotos con orden y etiqueta
- **`unifilarVersionId` opcional** — trazabilidad de pre-rellenado, sin acoplamiento fuerte
- **`onDelete: Cascade`** — borrar el proyecto borra sus pre-ingenierías

---

## 4. Pre-rellenado desde UnifilarVersion

Al crear una nueva versión de Pre-Ingeniería, si existe al menos una `UnifilarVersion` para el proyecto:

- El formulario muestra los datos de la versión más reciente del unifilar como **valores iniciales**
- El usuario puede **editar libremente** cualquier campo
- Se guarda `unifilarVersionId` para trazabilidad

### 4.1 Mapeo de campos UnifilarVersion → Pre-Ingeniería

| Campo Pre-Ingeniería | Origen UnifilarVersion | Transformación |
|---|---|---|
| `cantidadPaneles` | `cantidadPaneles` | `String(cantidadPaneles)` |
| `potenciaPaneles` | `potenciaPanelW` | `${potenciaPanelW}W` |
| `inversor` | `modeloInversor` + `potenciaInversorKw` | Combinar: `${modeloInversor} de ${potenciaInversorKw}kW` o solo modelo |
| `stringsLineasDc` | `cantidadStrings` | `String(cantidadStrings)` |
| `cableAc` | `tipoRed` + sección | Construir según regla 4.4 del unifilar SPEC: `Superplastico ${prefijoRed}x${seccion}mm2` |
| `termicaAc` | `potenciaInversorKw` | Aplicar regla 4.5 del unifilar SPEC: `${calibre} A` |
| `diferencialAc` | `potenciaInversorKw` | Aplicar regla 4.5: `${calibre} A, 300mA` |
| `largoCablesAcMts` | `largoAcInversorIcpM` | `${valor} mts` |
| `largoCablesDcMts` | `largoDcPanelesM` | `${valor} mts` |
| `redMonofasica` | `tipoRed` | `tipoRed === "MONO_230"` |
| `redTrifasica230SN` | `tipoRed` | `tipoRed === "TRI_230_SN"` |
| `redTrifasica400CN` | `tipoRed` | `tipoRed === "TRI_400_CN"` |

### 4.2 Pre-rellenado del cliente

Independiente del UnifilarVersion. Toma siempre del `Project`:

- `snapshotNombre` ← `Project.cliente` o `Project.nombreCliente`
- `snapshotDireccion` ← `Project.direccion`
- `snapshotCiudad` ← `Project.ciudad`
- `snapshotCelular` ← `Project.celular` o `Project.telefono`
- `snapshotFechaPrevista` ← `Project.fechaInstalacion` formateada como texto libre, o vacío si no existe

> **Claude Code debe descubrir** los nombres exactos de los campos del modelo `Project` actual.

---

## 5. API REST

Prefijo: `/api/` (sin v1, consistente con resto del repo). Permisos: `INGENIERIA.ACCESS` para todos los endpoints; `INGENIERIA.EDIT` para crear/eliminar.

### 5.1 Listar versiones

```http
GET /api/projects/:projectId/preingenieria-versions
```

### 5.2 Obtener versión completa

```http
GET /api/preingenieria-versions/:id
```

Response incluye fotos asociadas con su orden y etiqueta.

### 5.3 Crear versión nueva

```http
POST /api/projects/:projectId/preingenieria-versions
```

Body:
```json
{
  "label": "v1 borrador",
  "tipoTecho": "CHAPA",
  "tipoTechoOtro": null,
  "infoTecho": "Techo de chapa sobre tubular...",
  "alturaTecho": "1 piso",
  "cantidadPaneles": "10",
  "potenciaPaneles": "580W",
  "inversor": "Growatt de 6kW",
  "stringsLineasDc": "2",
  "cableAc": "Superplastico 2x6mm2",
  "termicaAc": "32 A",
  "diferencialAc": "40 A, 300mA",
  "largoCablesAcMts": "10 mts",
  "largoCablesDcMts": "15 mts",
  "redMonofasica": true,
  "redTrifasica230SN": false,
  "redTrifasica400CN": false,
  "notasAdicionales": null,
  "unifilarVersionId": "clx...",
  "fotosOrden": ["fileId1", "fileId2"],
  "fotosEtiquetas": {"fileId1": "Inversor", "fileId2": "Tablero UTE"}
}
```

**Lógica del endpoint:**
1. Validar inputs con Zod
2. Snapshot de datos del cliente desde `Project`
3. Calcular `versionNumber` correlativo
4. Crear `PreIngenieriaVersion`
5. Crear `PreIngenieriaFoto` por cada foto subida (referenciar FileAttachment ya creado)
6. Generar PDF y guardarlo como `FileAttachment` con `tipo=PRE_INGENIERIA` (agregar al enum), `toolSource="preing"`, `toolVersion=N`
7. Soft-delete del PDF anterior si había (igual estrategia que unifilar)
8. Devolver versión creada + metadata del PDF

### 5.4 Subir foto (paso previo a crear versión)

```http
POST /api/projects/:projectId/preingenieria-versions/upload-foto
Content-Type: multipart/form-data
```

Body: archivo de imagen (jpg, png, webp).

Response:
```json
{
  "fileId": "clx...",
  "filename": "techo-frente.jpg",
  "size": 1234567
}
```

> Las fotos se suben al sistema antes de crear la versión. Quedan en estado "pendiente". Al crear la versión, se asocian. Si pasan N horas (ej: 24h) sin asociarse, un cleanup las borra. Implementación del cleanup queda fuera de Fase 1.

### 5.5 Generar SVG/preview (no aplica)

A diferencia del unifilar, el Pre-Ingeniería **no tiene preview SVG en vivo**. Es un PDF con texto + fotos. El preview, si se quiere, es generar el PDF y mostrarlo con un visor de PDF embebido.

### 5.6 Descargar PDF

```http
GET /api/preingenieria-versions/:id/pdf
```

Devuelve el PDF generado al crear la versión.

### 5.7 Eliminar versión

```http
DELETE /api/preingenieria-versions/:id
```

Borra `PreIngenieriaVersion` + `PreIngenieriaFoto[]` + archivos físicos del PDF y las fotos. Permiso: `INGENIERIA.DELETE`.

---

## 6. Generador del PDF

### 6.1 Aproach técnico

A diferencia del unifilar (que es SVG complejo con símbolos IEC), el Pre-Ingeniería es un PDF con texto formateado + imágenes. Es más simple.

**Recomendación:** usar `pdf-lib` (TypeScript) o `puppeteer` con HTML+CSS template, lo que sea más natural para el repo. Si ya usás `@resvg/resvg-js` para el unifilar, podés generar el PDF como un HTML renderizado a SVG → PDF. Pero un template HTML+CSS rasterizado a PDF probablemente sea más mantenible.

> Claude Code elige según conveniencia y dependencias existentes.

### 6.2 Layout de página 1 (formulario)

Reproduce el documento canónico que se usa hoy. Estructura HTML+CSS de 2 columnas con secciones tipo card.

**Elementos visuales:**
- Header: logo Voltia centrado + título "Instalación Fotovoltaica" + subtítulo "Resumen Técnico" (negrita)
- Sección con header azul oscuro y body blanco
- Cada campo en una fila: label + valor en negrita
- Checkboxes representados con cuadrado y "X" si está marcado
- Sección "NOTAS ADICIONALES" al final si hay contenido

### 6.3 Layout de páginas 2..N (fotos)

- 1 foto por página, centrada, ajustada al ancho disponible (manteniendo proporción)
- Si tiene `etiqueta`, se muestra en bold arriba o al costado de la foto
- Numeración discreta: "Foto 1 de N", "Foto 2 de N"

### 6.4 Casos especiales

- **0 fotos**: PDF de solo página 1 (caso Rafael Real válido)
- **Multi-instalación con N fotos**: PDF de N+1 páginas (1 formulario + N fotos)
- **Foto rotada**: respetar orientación EXIF de la imagen original

---

## 7. UI dentro del workspace

### 7.1 Activación de la card

En el workspace del módulo Ingeniería (`/ingenieria/proyecto/:id`), agregar **una card nueva** "Pre-ingeniería" en la sección "Herramientas". La card que ya estaba como "Memoria técnica · Próximamente" se reemplaza, o se agrega como una herramienta más (junto a Unifilar, Materiales, Triángulos).

### 7.2 Inline en el bloque expandido

Al click, el bloque se expande mostrando:

```
PRE-INGENIERÍA — Resumen Técnico
[+ Nueva versión]                    Última versión: v3 · 03 may 26

ÚLTIMAS VERSIONES (3 más recientes)
v3 · "Para cliente" · 03 may 26  · [Ver PDF] [Duplicar] [Eliminar]
v2 · borrador      · 28 abr 26  · [Ver PDF] [Duplicar] [Eliminar]
v1 · —             · 20 abr 26  · [Ver PDF] [Duplicar] [Eliminar]

[Ver historial completo (5)]
```

Mismo patrón que el unifilar.

### 7.3 Modal de "+ Nueva versión"

Modal grande (full-width, ~900px) con scroll vertical. Estructura:

**Sección 1: Identificación**
- Etiqueta opcional ("v1 borrador", "Para cliente", etc.)

**Sección 2: Datos del cliente** (pre-rellenado, editables)
- Nombre, dirección, ciudad, celular, fecha prevista

**Sección 3: Datos del sitio**
- Tipo de techo (radio: Isopanel / Hormigón / Chapa / Tejas / Otro)
- Si "Otro": campo texto adicional
- Info techo (textarea)
- Altura techo (texto libre)

**Sección 4: Datos eléctricos** (pre-rellenado desde UnifilarVersion si existe)
- 9 campos texto libre según schema
- **Botón "Pre-rellenar desde unifilar"** (visible si hay UnifilarVersion):
  - Si no hay versión seleccionada de unifilar: lleva a un dropdown para elegir cuál
  - Si hay una sola: pre-rellena automático
  - Después de pre-rellenar, el usuario puede editar libremente
- Indicador visual de campos pre-rellenados (ícono ✨ o color sutil) que desaparece al editarlos

**Sección 5: Tipo de red**
- Checkboxes (multi-select): Monofásica / Trifásica 230 SN / Trifásica 400 CN

**Sección 6: Notas adicionales**
- Textarea opcional

**Sección 7: Fotos del sitio**
- Drag-and-drop area + botón "Subir fotos"
- Cada foto subida muestra:
  - Thumbnail
  - Campo de texto para etiqueta opcional
  - Botón eliminar
  - Drag handle para reordenar
- Sin límite mínimo ni máximo

**Footer del modal:**
- Botón "Cancelar" (cierra sin guardar)
- Botón "Generar PDF y guardar" (crea versión + genera PDF)

### 7.4 Hooks TanStack Query

```typescript
usePreIngenieriaVersions(projectId)
usePreIngenieriaVersion(versionId)
useCreatePreIngenieriaVersion()
useDeletePreIngenieriaVersion()
useUploadPreIngenieriaFoto()
```

### 7.5 Validaciones (Zod)

```typescript
const PreIngenieriaFormSchema = z.object({
  label: z.string().max(80).optional(),
  // Sitio
  tipoTecho: z.enum(["ISOPANEL", "HORMIGON", "CHAPA", "TEJAS", "OTRO"]).optional(),
  tipoTechoOtro: z.string().max(100).optional(),
  infoTecho: z.string().max(2000).optional(),
  alturaTecho: z.string().max(50).optional(),
  // Eléctricos (texto libre)
  cantidadPaneles: z.string().max(100).optional(),
  potenciaPaneles: z.string().max(50).optional(),
  inversor: z.string().max(150).optional(),
  stringsLineasDc: z.string().max(50).optional(),
  cableAc: z.string().max(100).optional(),
  termicaAc: z.string().max(50).optional(),
  diferencialAc: z.string().max(50).optional(),
  largoCablesAcMts: z.string().max(20).optional(),
  largoCablesDcMts: z.string().max(20).optional(),
  // Red
  redMonofasica: z.boolean().default(false),
  redTrifasica230SN: z.boolean().default(false),
  redTrifasica400CN: z.boolean().default(false),
  // Notas
  notasAdicionales: z.string().max(2000).optional(),
  // Trazabilidad
  unifilarVersionId: z.string().cuid().optional(),
  // Fotos
  fotosOrden: z.array(z.string().cuid()).default([]),
  fotosEtiquetas: z.record(z.string().cuid(), z.string().max(100)).optional(),
});
```

### 7.6 Sincronización con sección Documentos del proyecto

Al crear/eliminar versión:
- El PDF generado aparece automáticamente en "Documentos técnicos generados" del workspace (gracias al filtro por `toolSource`)
- Aparece en sección Documentos del proyecto con badge azul **"Ingeniería · Pre-ingeniería v3"**

---

## 8. Casos de prueba

### Caso A — Mínimo absoluto (Rafael Real)
- Sin fotos, todos los campos llenos, monofásico
- PDF de 1 página
- Verificar que se genera correctamente sin fotos

### Caso B — Residencial mono completo (Mezquita)
- Pre-rellenado desde un UnifilarVersion existente
- 3 fotos con etiquetas ("Inversor", "Jabalina", "Tablero UTE")
- PDF de 4 páginas

### Caso C — Multi-instalación (COVITEJA)
- Mono + Trifásica 400 con neutro (ambos checkboxes marcados)
- Campos eléctricos con texto libre describiendo ambas instalaciones
- 2 fotos
- PDF refleja correctamente los 2 checkboxes marcados

### Caso D — Industrial trifásico (ESTILO)
- Trifásica 400, 30 paneles, 30kW
- Sin pre-rellenado (datos manuales)
- Notas adicionales con varias líneas
- 2 fotos

### Caso E — Foto rotada
- Subir una foto en orientación retrato pero con metadata EXIF que indica rotación
- Verificar que se muestra correctamente en el PDF

---

## 9. Fuera de alcance

- **Editor integrado de anotaciones sobre fotos** (cuadros, flechas, texto sobre la imagen). El usuario sube fotos ya anotadas externamente.
- **Plantillas personalizables** del PDF (colores, layout). Solo el formato canónico.
- **Multi-instalación estructurada** (entidad separada por instalación). Por ahora se resuelve con texto libre.
- **Firma digital** del PDF.
- **Aprobación/flujo** del documento (DRAFT → APPROVED → SENT). Versionado simple.
- **Cleanup automático** de fotos huérfanas (subidas sin asociar a versión). Pendiente para fase futura.
- **Vista preview en vivo** del PDF antes de guardar. Solo se ve el PDF después de generarlo.

---

## Apéndice A: Diferencias con UnifilarVersion

| Aspecto | UnifilarVersion | PreIngenieriaVersion |
|---|---|---|
| Generación | SVG → PDF | HTML/template → PDF |
| Datos | Estructurados (enums, tipos) | Texto libre |
| Imágenes | Generadas (símbolos IEC) | Subidas por el usuario |
| Reglas | Tablas eléctricas (4.4, 4.5) | Sin reglas (texto libre) |
| Snapshot | Solo cliente (de Project) | Cliente + datos eléctricos completos |
| Pre-rellenado | No aplica | Desde UnifilarVersion (opcional) |
| Multi-página | No (siempre 1 página A4) | Sí (1 formulario + N fotos) |

---

## Apéndice B: Glosario

- **Pre-ingeniería:** estado del proyecto donde se relevan los datos técnicos antes de la ejecución
- **IMG:** Intendencia (Municipio) — el nombre histórico viene de "Resumen Proyecto IMG" porque se usa para presentaciones municipales
- **Multi-instalación:** proyectos donde el cliente tiene 2 sistemas independientes (mono + tri) en la misma cuenta
