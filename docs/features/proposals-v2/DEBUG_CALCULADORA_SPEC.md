# Debug de Cálculos — Especificación Técnica

> Drawer solo-admin en el constructor de propuestas que muestra los
> intermedios de la calculadora en tiempo real. Herramienta interna de
> diagnóstico para detectar divergencias como la del caso Gonzalez.
> Spec madre: `docs/features/proposals-v2/SPEC.md`. Versión: 1.

## Tabla de contenidos

1. Contexto y objetivo
2. Modelo de datos (sin cambios)
3. Metadata de intermedios
4. API REST
5. UI / Componentes
6. Casos de prueba
7. Fuera de alcance
8. Apéndice: glosario y referencias

## 1. Contexto y objetivo

Durante la validación de Fase F, Nicolás detectó una divergencia de
6,5% entre la propuesta generada por la app (V9 Gonzalez) y la calculada
en el Excel de referencia. El diagnóstico requirió correr un script
manual que reprodujera los inputs y devolviera los intermedios de la
calculadora.

Este drawer resuelve dos cosas:

- **Transparencia en tiempo real:** el admin puede ver todos los
  intermedios (subtotales, costos, márgenes, cuotas, factores) mientras
  edita el borrador de una propuesta, sin salir de la app.
- **Detección temprana de bugs:** si en el futuro cambia un default o
  se agrega una variable, el drawer permite verificar el impacto en
  cada intermedio sin volver a instrumentar scripts.

Objetivos:

- Ver todos los campos que la calculadora expone, con etiquetas
  legibles + explicación corta.
- Actualización con el mismo debounce que el preview PDF.
- Cero impacto sobre asesores comerciales: no lo ven, no les cambia el
  layout.
- Cero impacto sobre el pipeline de renderizado del PDF: endpoint
  aparte, más liviano que el preview.

**No** incluye: comparación con Excel u otras versiones, edición
inline, export CSV, historial entre saves.

## 2. Modelo de datos

Sin cambios en el schema. La calculadora ya expone el objeto
`Calculated` (o el nombre real que use post fix Gonzalez) con todos los
intermedios. El drawer solo lo consume.

## 3. Metadata de intermedios

Archivo nuevo: `server/src/services/proposal/calculator-labels.ts`.

Mapa `nombreTecnico → { label, descripcion, unidad, orden }`:

```ts
export const calculatorLabels = {
  costoEquipamientoSinIva: {
    label: "Costo equipamiento",
    descripcion: "Suma de paneles, estructuras, eléctrica, inversor y meter (sin IVA).",
    unidad: "USD",
    orden: 10,
  },
  manoDeObraUsdSinIva: {
    label: "Mano de obra",
    descripcion: "Tarifas horarias × 10h × escalón de cuadrilla / cotización dólar.",
    unidad: "USD",
    orden: 20,
  },
  costoTotalSinIva: {
    label: "Costo total",
    descripcion: "Equipamiento + costos fijos + costos variables + mano de obra.",
    unidad: "USD",
    orden: 30,
  },
  markupUsdSinIva: {
    label: "Markup",
    descripcion: "Margen sobre costo total (según % del singleton).",
    unidad: "USD",
    orden: 40,
  },
  subtotalSinIva: {
    label: "Subtotal sin IVA",
    descripcion: "Costo total + markup + comisiones.",
    unidad: "USD",
    orden: 50,
  },
  totalConIva: {
    label: "Total con IVA",
    descripcion: "Subtotal × 1.22.",
    unidad: "USD",
    orden: 60,
  },
  cuota24m: {
    label: "Cuota 24 meses",
    descripcion: "PMT × factor gastos admin × cotización UI. 0% tasa anual.",
    unidad: "pesos",
    orden: 100,
  },
  // ... y así con todos los que expone la calculadora
} as const satisfies Record<string, { label: string; descripcion: string; unidad: "USD" | "pesos" | "UI" | "%" | "kWh" | "unidades" | ""; orden: number }>;
```

Decisiones:

- El `orden` es un número explícito para que se pueda insertar
  intermedios nuevos sin refactor. Convención: subir de 10 en 10 para
  dejar espacio.
- La `unidad` es un enum cerrado. Si aparece una unidad nueva, se agrega
  al enum (fuerza a que Claude Code justifique el agregado).
- La `descripcion` debe explicar qué es el intermedio en una línea, en
  lenguaje comprensible por alguien que sabe el negocio pero no
  necesariamente el código.
- El archivo se **exporta desde el server** y se **importa desde el
  cliente** (via alias de path si aplica) para tener una única fuente de
  verdad de labels/descripciones.
- Si un intermedio existe en el objeto `Calculated` pero **no** tiene
  entrada en `calculatorLabels`, el drawer lo muestra con el nombre
  técnico como label y "sin descripción" como texto (fallback amigable
  para nuevos campos sin refactor).

## 4. API REST

### 4.1 `GET /api/proposals-v2/leads/:leadId/draft/calc`

- Permiso: `authorize(Module.VENTAS, Action.VIEW)` en middleware + gate
  de rol `ADMIN` dentro del handler.
- Levanta el draft del lead, valida con `draftDataPublishSchema`
  (strict, mismo schema que el preview PDF).
- Resuelve `ProposalDefaults` actuales.
- Corre la calculadora contra `data + defaults`.
- Devuelve el objeto `Calculated` completo tal cual, sin agregar labels
  ni descripciones (esas viven en el cliente).
- 200 con el objeto `Calculated`.
- 400 si el draft no valida (mensaje claro tipo "Faltan campos
  obligatorios: {lista}").
- 403 si el usuario no es admin.
- 404 si no existe el draft.

Justificación de endpoint aparte (vs reusar preview):

- El endpoint del preview genera el PDF con Puppeteer (~1-3s). El de
  cálculo solo corre la calculadora pura (~50ms). Es 20-60x más rápido.
- El drawer se actualiza más frecuentemente que el preview (mismo
  debounce, pero puede abrirse y cerrarse sin renderizar PDF).
- Aislar responsabilidades: si mañana cambia el pipeline de PDF, el
  endpoint de cálculo no se toca.

### 4.2 No hay más endpoints

Cero superficie adicional.

## 5. UI / Componentes

### 5.1 Botón "Debug" en el sub-header

Ubicación: sub-header sticky del constructor
(`/leads/:leadId/propuesta`), a la izquierda del botón "Publicar
V{n+1}".

Visible solo si el usuario tiene rol `ADMIN`. Para no-admin, el botón
no se renderiza (no basta con `disabled`; oculto del todo).

Icono: `<Bug />` o equivalente del set de iconos ya usado en el repo.
Label: "Debug".

Al hacer click, abre el drawer.

### 5.2 Drawer `CalculatorDebugDrawer`

- Componente `client/src/components/proposals-v2/CalculatorDebugDrawer.tsx`.
- Drawer lateral derecho, ancho fijo (~ 420px), overlay backdrop.
- Cierra con click en backdrop, tecla Escape, o botón "X" en el header
  del drawer.
- Header del drawer: título "Debug calculadora", subtítulo con nombre
  del lead + estado (por ejemplo: "Draft de Jose Gonzalez —
  actualizado hace 2s").

Contenido:

- **Tabla plana** con tres columnas:
  1. Label humano (bold).
  2. Valor (con unidad, formato con 2 decimales si aplica).
  3. Descripción (en fuente más chica, gris).
- Orden de las filas: por `orden` ascendente del mapa `calculatorLabels`.
- Si un intermedio no tiene entrada en el mapa, aparece al final con
  nombre técnico y descripción "sin descripción".

Estados especiales:

- **Cargando:** spinner en el header del drawer, tabla con skeleton de
  8-10 filas.
- **Draft no válido:** overlay con mensaje "Completá los campos
  obligatorios para ver los cálculos" + lista de faltantes (misma que
  el tooltip del botón Publicar).
- **Error del endpoint:** overlay con mensaje "No se pudieron cargar
  los cálculos. {detalle del error}" + botón "Reintentar".
- **Sin permiso:** el drawer no se abre (el botón no aparece). Si un
  no-admin llegara al endpoint por URL, el 403 se maneja con toast
  genérico "Sin permiso".

### 5.3 Actualización

- **Al abrir:** dispara la primera carga con el estado actual del draft.
- **Al editar el form (drawer abierto):** debounce de 2.5s (mismo que
  el preview PDF, sincronizado con el `savedTick` del autosave). Solo
  se refresca si el último autosave fue exitoso — si el autosave está
  fallando, el drawer muestra los datos de la última carga exitosa con
  un badge chico "desactualizado".
- **Al cerrar y reabrir:** vuelve a cargar (no cachea entre aperturas).

### 5.4 Responsive

- Desktop ≥1200: drawer lateral como se describió.
- Tablet 768-1199: ídem, pero puede tapar más contenido.
- Mobile <768: el drawer se abre a ancho completo, cierra con "X".

No es prioridad. El drawer es herramienta de admin en escritorio.

## 6. Casos de prueba

Unit tests:

1. `calculatorLabels` cubre todos los campos actuales del objeto
   `Calculated` (test que compara las llaves de ambos).
2. Renderizado del drawer con datos válidos: verifica que las 3 columnas
   se muestran y el orden es correcto.
3. Renderizado con draft inválido: muestra el overlay de faltantes.
4. Botón "Debug" no se renderiza para no-admin.
5. Endpoint `/draft/calc` devuelve 403 para no-admin.
6. Endpoint devuelve 400 con lista de campos faltantes si el draft no
   valida strict.

E2E manual (por Nicolás):

1. Como admin, abrir el constructor de un lead con draft completo →
   click en "Debug" → drawer abre con todos los intermedios listados en
   orden.
2. Editar un campo del form (por ejemplo, cambiar cantidad de paneles)
   → después de 2.5s el drawer se refresca con los intermedios nuevos.
3. Cerrar el drawer, editar más campos, reabrir → vuelve a cargar con
   los datos actuales.
4. Vaciar un campo obligatorio → el drawer muestra overlay de faltantes.
5. Cortar la red (DevTools offline) → editar → el drawer muestra badge
   "desactualizado" con los datos previos.
6. Como asesor comercial (no-admin), abrir el constructor → el botón
   "Debug" no aparece.

## 7. Fuera de alcance

- Comparación con valores del Excel u otras versiones publicadas.
- Edición inline de valores en el drawer.
- Export CSV / Excel de los intermedios.
- Historial de cálculos entre saves.
- Métricas / analytics del uso del drawer.
- Cache del cálculo por hash del data (solo si el endpoint se satura,
  cosa muy improbable dado que solo lo usa admin).
- Modo "diff" contra la última versión publicada.
- Modo "diff" contra un draft anterior.

## 8. Apéndice: glosario y referencias

- **Intermedio:** cualquier valor calculado por la calculadora que
  aparece en el objeto `Calculated`. Puede ser un input transformado, un
  cálculo derivado, o un resultado final.
- **Drawer:** panel lateral que se despliega sobre el contenido del
  constructor, con overlay.
- **Sub-header:** barra sticky arriba del contenido del constructor,
  con acciones principales (volver, estado autosave, publicar).

Referencias:

- Endpoint del preview PDF:
  `GET /api/proposals-v2/leads/:leadId/draft/preview.pdf` (Fase F 1.2).
- Endpoint de calculadora:
  `server/src/services/proposal/calculator.ts` (Fase B + fix Gonzalez).
- Spec de Fase F: `docs/features/proposals-v2/FASE_F_SPEC.md`.
