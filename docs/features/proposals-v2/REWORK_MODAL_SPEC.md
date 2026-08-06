# Propuestas v2 — Rework post-Fase G — Especificación Técnica

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> Cambio de UX del constructor y unificación de propuestas viejas y
> nuevas en el panel del lead. Spec madre:
> `docs/features/proposals-v2/SPEC.md`. Versión: 1.

## 1. Contexto y objetivo

Fase F implementó el constructor como página dedicada en
`/leads/:leadId/propuesta`, con la lista de versiones dentro. Dos
problemas de UX:

1. "Armar propuesta" saca del contexto del lead (navega a otra página).
2. Las versiones publicadas quedan escondidas dentro del constructor;
   las viejas (`ProposalGeneration`) sí se ven en el panel del lead.

Rework:
- Constructor → **modal grande** (~90% viewport) desde el mismo botón,
  sin cambiar de página.
- Lista de versiones sale del constructor y se **unifica** con las
  viejas en el panel del lead, mezcladas por fecha, con chip por tipo.

## 2. Alcance

- Constructor página → modal grande.
- Lista de versiones nuevas sale del constructor.
- Panel del lead: lista unificada viejas + nuevas por fecha DESC.
- Acciones por tipo (viejas y nuevas tienen sets distintos).
- Backend: endpoint de lectura agregada. Sin cambios de BD, calculadora,
  pipeline PDF, permisos ni snapshots inmutables.

## 3. Modelo de datos

Sin cambios de schema. Rework puro de UI + un endpoint de lectura agregada.

## 4. API REST

### 4.1 `GET /api/leads/:leadId/proposals` (unificado)

- Permiso: `VENTAS:VIEW`.
- Query opcional: `?includeDiscarded=false` (default).
- Devuelve `ProposalListItem[]` mezclando viejas + nuevas, `createdAt DESC`:

```ts
type ProposalListItem = {
  id: string;
  tipo: "vieja" | "nueva";
  createdAt: string;         // ISO
  versionNumber?: number;     // solo "nueva"
  clientName: string;
  status: "activa" | "descartada" | null;
  totalConIva?: number;
  actions: {
    canDownloadFull: boolean;
    canDownloadSummary: boolean;
    canDownloadExcel: boolean;
    canPreview: boolean;
    canDiscard: boolean;
    canRestore: boolean;
  };
};
```

- **Nuevas activas**: full/summary/preview/discard = true; restore/excel = false.
- **Nuevas descartadas**: solo restore = true.
- **Viejas**: según lo confirmado en PASO 0.

### 4.2 Endpoints existentes que se siguen usando

Nuevas: `GET /pdf/full`, `GET /pdf/summary`, `DELETE /versions/:id`,
`POST /versions/:id/restore`. Viejas: los que identifica el PASO 0.

## 5. UI / Componentes

### 5.1 Modal grande del constructor

- `ProposalBuilderPage` → `ProposalBuilderModal`. El botón "Armar
  propuesta" abre el modal (estado local), no navega.
- ~90% viewport, backdrop oscuro. **Solo X** cierra. NO Escape, NO
  backdrop, NO URL propia, sin confirmación al cerrar (autosave protege).
- Layout interno igual a Fase F (sub-header, form + preview). Se **saca
  la lista de versiones** (va al panel). El botón Debug queda para admin.

### 5.2 Sección "Propuestas" en el panel del lead

- Fuente: endpoint nuevo unificado.
- Cada fila: chip de tipo (`[V2]` nuevas / `[Excel]` viejas), nombre del
  cliente, número de versión (nuevas), fecha relativa, total c/IVA si
  aplica, badge de status, acciones inline según `actions.canX`
  (preview, full, summary, excel, descartar, restaurar).
- Toggle "ver descartadas" arriba (oculto por default).
- Orden por fecha DESC (del backend). Sin paginación.

### 5.3 Modal chico de preview

- ~80% viewport, iframe con el PDF full. X y Escape cierran (solo lectura).
- Solo del full (el summary se descarga).

### 5.4 Botón "Armar propuesta"

Mismo lugar; abre el modal. Con borrador → lo muestra; sin borrador →
datos default.

### 5.5 Ruta `/leads/:leadId/propuesta`

Se elimina como página; redirect a `/leads/:leadId`.

## 6. Casos de prueba

Unit (client): lista con mezcla de tipos; acciones según `canX`; toggle
descartadas; modal grande abre/cierra sin URL; modal preview con iframe;
ruta vieja redirige.

E2E (Nicolás): ver spec del prompt.

## 7. Fuera de alcance

Unificación en BD, migración de viejas, filtros/búsqueda, paginación,
URL linkeable, Escape en modal grande, confirmación al cerrar, preview
de summary.

## 8. Apéndice

- **Vieja**: `ProposalGeneration` (Excel + PDF legacy).
- **Nueva**: `ProposalV2Version` (snapshot inmutable + full/summary).

Referencias: FASE_F_SPEC.md, FASE_E_SPEC.md.
