# Consolidador de Materiales — Especificación Técnica

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> **Feature:** Herramienta para unificar listas de materiales de múltiples proyectos en una sola lista para compras
> **Producto:** Voltia PM
> **Ubicación:** Dashboard del **Módulo Ingeniería** (no atada a un proyecto específico)
> **Spec madre:** `docs/features/ingenieria/SPEC.md`
> **Versión spec:** 1.0
> **Estado:** Aprobado para implementación

---

## Tabla de contenidos

1. [Contexto y objetivo](#1-contexto-y-objetivo)
2. [Modelo de datos](#2-modelo-de-datos)
3. [Lógica de consolidación](#3-lógica-de-consolidación)
4. [API REST](#4-api-rest)
5. [Generación de documentos](#5-generación-de-documentos)
6. [UI dentro del dashboard](#6-ui-dentro-del-dashboard)
7. [Casos de prueba](#7-casos-de-prueba)
8. [Fuera de alcance](#8-fuera-de-alcance)

---

## 1. Contexto y objetivo

Voltia compra materiales para varios proyectos a la vez (típicamente al inicio de la semana, agrupando 3-5 proyectos). Hoy el comprador abre proyecto por proyecto en Voltia PM, mira la lista de materiales de cada uno, y arma manualmente una lista unificada en Excel para hacer las compras.

**Objetivo:** automatizar esa consolidación. El usuario selecciona los proyectos a comprar, y la herramienta genera una tabla con:
- **Filas:** ítems de material agrupados por categoría
- **Columnas:** una por proyecto + **TOTAL** al final
- **Celdas:** cantidad de cada ítem en cada proyecto

El resultado se persiste como versión y se puede descargar como PDF (vista de presentación) y Excel (vista editable para compras).

**Cobertura objetivo:** todos los proyectos de Voltia que tengan lista de materiales generada en el módulo Ingeniería.

---

## 2. Modelo de datos

### 2.1 Modelo Prisma

```prisma
model MaterialesConsolidadosVersion {
  id            String   @id @default(cuid())

  versionNumber Int      @unique
  label         String?
  createdAt     DateTime @default(now())

  projectsSnapshot  Json   // [{id, nombreCliente, potenciaKwp}, ...]
  itemsSnapshot     Json   // ver sección 2.2

  @@index([createdAt])
  @@map("materiales_consolidados_versions")
}
```

### 2.2 Estructura del `itemsSnapshot`

```typescript
type ItemConsolidado = {
  catalogItemId: string;
  nombre: string;
  categoria: string;
  unidad: string;
  cantidadesPorProyecto: { [projectId: string]: number };
  cantidadTotal: number;
};

type ItemsSnapshot = ItemConsolidado[];
```

### 2.3 Decisiones de diseño

- Snapshot completo de proyectos e ítems
- Versionado correlativo global (no por proyecto)
- Sin relación directa con Project en el schema

---

## 3. Lógica de consolidación

### 3.1 Inputs
- Array de `projectIds` (mínimo 2)
- Etiqueta opcional

### 3.2 Algoritmo
1. Validar que cada projectId es accesible
2. Para cada proyecto, cargar lista de materiales
3. Agrupar por `catalogItemId`, sumar cantidades, mantener cantidades por proyecto
4. Ordenar por categoría y nombre
5. Calcular versionNumber correlativo
6. Persistir + generar PDF + Excel

### 3.3 Reglas
- Agrupación por `catalogItemId` exacto (sin normalización de nombres)
- Sin filtro por flag — se traen todos los ítems
- Si un proyecto no tiene un ítem, su columna queda en 0
- Si un proyecto entra con lista vacía, no contribuye

### 3.4 Advertencia para el usuario

> "El consolidador agrupa ítems por ID de catálogo. Si esperás cantidades distintas a las que ves, revisá las listas individuales antes de hacer la compra."

### 3.5 Listado de proyectos elegibles
- Tienen al menos un ítem en su lista de materiales
- El usuario tiene acceso al proyecto

---

## 4. API REST

Permisos:
- `INGENIERIA.ACCESS` para listar/ver
- `INGENIERIA.EDIT` para crear
- `INGENIERIA.DELETE` para eliminar

### 4.1 GET /api/ingenieria/materiales-consolidados/proyectos-elegibles
Solo proyectos con `cantidadItems > 0`.

### 4.2 GET /api/ingenieria/materiales-consolidados
Historial completo.

### 4.3 GET /api/ingenieria/materiales-consolidados/:id
Versión completa con tabla.

### 4.4 POST /api/ingenieria/materiales-consolidados
Body: `{ label?, projectIds: string[] }` (mínimo 2).

### 4.5 GET /api/ingenieria/materiales-consolidados/:id/{pdf|xlsx}
Descarga.

### 4.6 DELETE /api/ingenieria/materiales-consolidados/:id
Borra versión + archivos físicos.

---

## 5. Generación de documentos

### 5.1 PDF
A4 horizontal si 4+ proyectos, vertical si 2-3. Una tabla por categoría. Header con metadata.

### 5.2 Excel
Una sola hoja con encabezados de categoría como filas separadoras. Auto-width.

### 5.3 Naming
- PDF: `consolidado-v{N}-{timestamp}.pdf`
- XLSX: `consolidado-v{N}-{timestamp}.xlsx`

### 5.4 Persistencia
`FileAttachment` con `toolSource="consolidado"`, `toolVersion=N`. Path: `${STORAGE_PATH}/ingenieria/consolidados/...`.

---

## 6. UI

### 6.1 Ubicación
`/ingenieria` (dashboard) — sección "Herramientas globales".

### 6.2 Página `/ingenieria/materiales-consolidados`
- Form: etiqueta + checkboxes de proyectos elegibles + botón Generar
- Historial: lista de versiones con Ver/PDF/Excel/Eliminar

### 6.3 Vista de tabla
Modal o página completa con la tabla agrupada por categoría.

### 6.7 Validaciones (Zod)
```typescript
z.object({
  label: z.string().max(80).optional(),
  projectIds: z.array(z.string().cuid()).min(2),
})
```

---

## 7. Casos de prueba

- A: 2 proyectos, pocos ítems
- B: 4 proyectos típicos
- C: 5 proyectos con catálogos compartidos
- D: proyecto con lista vacía
- E: eliminar versión

---

## 8. Fuera de alcance

- Consolidación con precios/costos
- Edición manual del consolidado
- Generar orden de compra
- Comparar versiones
- Filtros por categoría/proveedor
