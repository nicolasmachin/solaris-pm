# Tanda 1 — Panel de viabilidad + Rediseño panel del lead + Adjuntos

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> Batch único: indicadores de viabilidad en el sub-header del constructor,
> panel del lead ampliado a ~50% (Opción A: datos+notas | propuestas+adjuntos),
> y adjuntos por lead. Spec madre: `docs/features/proposals-v2/SPEC.md`. Versión: 1.

## 1. Contexto y objetivo

Tres mejoras de UX del asesor sobre el flujo de propuestas:
1. **Viabilidad**: ver en vivo el % de ahorro y si los paneles entran en el techo,
   sin abrir el drawer de debug. Informativo, no bloquea publicar.
2. **Panel del lead ampliado**: de ~25% a ~50%, dos columnas parejas, sin scroll.
3. **Adjuntos por lead**: subir/listar/descargar/borrar documentos del lead.

## 2. Alcance

Incluye: viabilidad en el sub-header; rediseño del panel a ~50% (Opción A); CRUD
chico de adjuntos con confirmación de borrado.
No incluye: preview de adjuntos, tags/categorías, adjuntos por proyecto/versión,
migración de adjuntos al convertir lead, otros indicadores de viabilidad.

## 3. Panel de viabilidad

### 3.1 Ubicación
Sub-header sticky del `ProposalBuilderModal`, a la derecha del nombre + autosave,
antes de Debug y Publicar.

### 3.2 Indicadores
- **Ahorro**: texto `Ahorro N%`, sin ícono. `(ahorroMensual / factura.pagaMensualPesos) × 100`.
  Si `pagaMensualPesos` es 0/falta o `ahorroMensual` no calcula → `Ahorro —`.
- **Espacio**: `Espacio {ocupado}/{disponible} m²` + ícono. `ocupado = metrosCuadradosPaneles`
  (cantidadPaneles × 3), `disponible = techo.tamanoM2`. Umbrales:
  - `disponible ≥ ocupado × 1.10` → ✅ verde
  - `ocupado ≤ disponible < ocupado × 1.10` → ⚠️ ámbar
  - `disponible < ocupado` → ❌ rojo
  - `disponible = 0` → `Espacio —` sin ícono.

### 3.3 Cálculo y actualización
- Cliente, a partir del `data` del draft + el `Calculated` de un endpoint.
- **Debounce 500ms** (más rápido que el preview PDF de 2.5s).
- Sincronizado con `savedTick` del autosave (solo actualiza si el save fue OK).
- Si el autosave falla, muestra el último valor con opacidad 60%.

## 4. Rediseño del panel del lead

### 4.1 Ancho
~50% viewport desktop; ~65% en <1200px; móvil como hoy.

### 4.2 Layout — Opción A
- **Header** full width: clientName · code · estado · X + Marcar Ganado/Perdido.
- **Columna izquierda**: datos del lead (campos actuales) + Notas al pie.
- **Columna derecha** (orden): botones generar propuestas (Armar / Generar viejo)
  → `LeadProposalsList` (existente) → Adjuntos.
- Dos columnas parejas, scroll independiente. Separadores suaves en la derecha.

### 4.3 Sin cambios
Botón X, estados/transiciones del lead, datos que consumen los inputs, endpoint
de datos del lead.

## 5. Adjuntos por lead

### 5.1 UI
Sección "Adjuntos" al pie de la columna derecha: título + `+ Agregar adjunto`;
lista (ícono por tipo, nombre, tamaño, fecha relativa, descargar, borrar); estado
vacío `Sin adjuntos todavía`. Upload directo con progress. Borrar → modal de
confirmación (`¿Borrar {nombre}? Esta acción no se puede deshacer.`).

### 5.2 Tipos y tamaño
PDF, JPG/JPEG/PNG, DOC/DOCX, XLS/XLSX. Máx **10 MB**. Rechazo con mensaje claro.

### 5.3 Permisos
Subir/borrar: `VENTAS:EDIT`. Descargar: `VENTAS:VIEW`. Sin restricción por autor.

## 6. Modelo de datos
Reusar `FileAttachment` (owner por `leadId`) si existe; si no, `LeadAttachment`
dedicado. Storage `${STORAGE_PATH}/leads/{leadId}/attachments/{fileId}-{fileName}`.
Viabilidad no persiste nada.

## 7. API REST
- **Viabilidad**: reusar `GET /draft/calc` si es accesible con VENTAS:VIEW; si es
  admin-only, endpoint chico dedicado a VENTAS:VIEW con solo los dos campos.
- **Adjuntos**: `POST` (EDIT), `GET` (VIEW), `GET /:id/download` (VIEW),
  `DELETE /:id` (EDIT). Validación mime + tamaño en server. Auditoría.

## 8. Casos de prueba
Unit: ahorro con paga 0 → "—"; ahorro NaN → "—"; espacio 33/33, 33/36, 33/40;
tamanoM2 0 → "—"; debounce 500ms; adjuntos subir/listar/descargar/borrar; mime +
tamaño en server. E2E: ver prompt.

## 9. Fuera de alcance
Preview de adjuntos, tags, búsqueda, adjuntos por proyecto/versión, migración al
convertir, otros indicadores.

## 10. Referencias
REWORK_MODAL_SPEC.md, FASE_F_SPEC.md, FASE_E_SPEC.md, DEBUG_CALCULADORA_SPEC.md.
