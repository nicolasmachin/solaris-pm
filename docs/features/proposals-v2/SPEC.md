# Generador de Propuestas Comerciales — Especificación Técnica

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> **Feature:** Constructor interactivo de propuestas comerciales FV on-grid
> **Ubicación:** Módulo Ventas (`/ventas/lead/:leadId/propuesta`)
> **Reemplaza progresivamente a:** Generador actual basado en Excel + script Python
> **Versión spec:** 2.0 (consolidada tras 3 iteraciones de diseño)
> **Estado:** Aprobado para implementación Fase A
> **Fecha:** Junio 2026

---

## Tabla de contenidos

1. Contexto y objetivo
2. Alcance Fase 1
3. Arquitectura general
4. Modelo de datos
5. Inputs del formulario
6. Cálculos del negocio
7. Sistema de permisos por variable
8. API REST
9. Generación de HTML y PDF
10. Estructura del PDF (validada)
11. Tapa externa con overlay
12. Datos del asesor
13. Ítems adicionales opcionales
14. UI / Componentes
15. Defaults de Voltia (Admin)
16. Permisos del sistema
17. Convivencia con generador viejo
18. Plan de implementación por fases atómicas
19. Fuera de alcance
20. Casos de prueba

---

## 1. Contexto y objetivo

### 1.1 Estado actual
El generador de propuestas vigente depende de un Excel
(`Negocio_Paneles_v8.xlsx`) con fórmulas complejas en la hoja
`CALCULADORA`, que el usuario completa manualmente, exporta variables
a celdas C35–C66, y un script Python (`generate_proposal.py`) lee
esas celdas y compone un PDF combinando una plantilla `Original.pdf`
con texto sobrepuesto y gráficos generados con matplotlib.

Limitaciones del enfoque actual:
- **Frágil**: el parser de números (separadores de miles uruguayos vs
  decimales ingleses) ha causado bugs en producción.
- **No reproducible**: cada usuario mantiene su propio Excel; cambios
  de plantilla requieren editar archivos del VPS.
- **Sin versionado real**: el PDF queda como `FileAttachment` pero no
  se preservan los datos de entrada.
- **No interactivo**: el ciclo "editar Excel → subir → generar →
  revisar" puede tomar varios minutos por iteración.
- **Sin trazabilidad del negocio**: el flujo de caja (costos, ganancia,
  margen) vive solo en el Excel del usuario.

### 1.2 Objetivo

Construir una herramienta autocontenida dentro de Voltia PM que:
- **Reemplaza al Excel** como fuente de datos del negocio.
- **Genera dos PDFs** desde plantillas HTML+CSS controladas por el repo:
  - Propuesta completa (~11 páginas)
  - Propuesta resumen (1-2 páginas, versión ejecutiva)
- **Versiona propuestas inmutables** con sus PDFs + snapshot completo
  de datos al momento de generarlas.
- **Permite iteración rápida**: preview en vivo del PDF mientras el
  usuario edita parámetros, debounced a 500ms.
- **Centraliza la vista del negocio para ADMIN**: flujo de caja
  (cobro/pago/ganancia/margen) visible al lado del preview, oculto
  para otros roles.
- **Permite override granular por variable**: cada parámetro tiene un
  flag `asesorCanOverride` configurable desde Admin.
- **Convive con el viejo** durante toda Fase 1.

### 1.3 Resultado esperado

Una página `/ventas/lead/:leadId/propuesta` con:
- Form 40% a la izquierda (datos cliente + datos sistema + datos
  económicos editables si lo permite el rol/flags).
- Preview 60% a la derecha (iframe con HTML del PDF, actualizado en
  vivo).
- Para ADMIN: panel adicional con "Flujo de caja del negocio".
- Botón "Guardar versión" que congela todo como `ProposalVersion`
  inmutable + dos PDFs generados con Puppeteer + Canva overlay.

---

## 2. Alcance Fase 1

### Incluido

- Una plantilla visual: **residencial on-grid** (basada en el diseño
  validado en iteración 3 de Imagine).
- Cálculos completos del negocio (costos, pricing, flujo de caja,
  TIR, PRI, ahorros).
- **Generación de DOS PDFs**: completo + resumen, generados juntos al
  guardar versión.
- Tapa externa: PDF de Canva con overlay de variables vía `pdf-lib`.
- Preview HTML en vivo (mismo template, sin Puppeteer ni overlay).
- Versionado 1:N inmutable.
- Borrador editable persistente.
- **Sistema de permisos por variable** (`asesorCanOverride`).
- Panel de flujo de caja visible solo para ADMIN.
- 2 gráficos: generación mensual + retorno 15 años.
- Datos del asesor (nombre, cargo, email, teléfono) dinámicos del
  usuario logueado, con snapshot inmutable.
- Ítems adicionales opcionales en cotización.
- Defaults configurables desde Admin.

### Postergado

- Plantillas adicionales (comercial, industrial) → Fase 2
- Tercer gráfico → Fase 2
- Envío de propuesta por email desde la app → pendiente del sistema de emails
- Off-grid o híbridos
- Firma electrónica
- Editor de plantillas desde Admin

### Deuda técnica conocida

El generador viejo seguirá disponible hasta que el nuevo esté maduro
y validado en producción.

---

## 3. Arquitectura general

### 3.1 Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend form + preview | React + TanStack Query + Zustand | Stack del repo |
| Cálculos | Backend Node + TypeScript | Source of truth |
| Render HTML | Handlebars templates | Ya usado en el repo |
| Render PDF cuerpo | Puppeteer + Chromium headless | Ya usado en EFP |
| Overlay tapa | pdf-lib | Ya usado en el repo |
| Gráficos | Chart.js renderizado server-side con chartjs-node-canvas | Inline en HTML |
| Almacenamiento PDF | `FileAttachment` con `toolSource = "proposal-v2"` | Patrón estándar |
| Validación | Zod en backend, react-hook-form en frontend | Estándar del repo |

### 3.2 Flujo de generación de PDF al guardar versión

1. Validar `data` completo con Zod estricto.
2. Calcular `calculated` (función pura).
3. Renderizar HTML del cuerpo (Handlebars + datos + gráficos inline).
4. Lanzar Puppeteer, generar PDF del cuerpo (A4, sin la tapa).
5. Cargar PDF de Canva (la tapa) desde Admin defaults.
6. Con `pdf-lib`: aplicar texto overlay sobre la tapa (nombre cliente,
   ciudad, fecha en coordenadas configuradas en Admin).
7. Concatenar: tapa PDF (con overlay) + cuerpo PDF (Puppeteer) =
   **propuesta completa final**.
8. Generar **propuesta resumen** (sigue el mismo flujo, sin tapa, todo
   con Puppeteer).
9. Guardar ambos PDFs en disco con sus respectivos `FileAttachment`.
10. Crear `ProposalVersion` apuntando a ambos attachments + snapshot
    de datos + calculated + datos del asesor.

---

## 4. Modelo de datos

### 4.1 Schema Prisma (referencia)

Ver `server/prisma/schema.prisma` para la versión vigente. Modelos:
`ProposalDraft`, `ProposalVersion`, `ProposalDefaults`. Ver el prompt
de Fase A para el detalle de campos y relaciones.

### 4.2 Decisiones de diseño

- **Draft único por lead** (`leadId @unique`): solo hay un borrador
  activo.
- **Versiones inmutables**: una vez creada, no se edita.
- **`data` y `calculated` como JSON**: el modelo puede evolucionar sin
  migraciones por cada cambio menor.
- **Snapshot del asesor también en JSON**: si el asesor cambia su
  teléfono después, las versiones viejas mantienen el original.
- **Dos PDFs por versión** (full + summary): se generan juntos al
  guardar.
- **`toolSource = "proposal-v2"`** distingue del PDF del generador viejo.
- **ProposalDefaults singleton** (`id = "singleton"`): solo hay un
  registro de defaults globales.

---

## 5. Inputs del formulario

### 5.1 Estructura del JSON `data`

```typescript
{
  cliente: {
    nombre: string;              // "Jose Gonzalez"
    dirigidoA: string;           // "Estimado Jose Gonzalez,"
    ciudad: string;              // "El Pinar, Uruguay."
  };
  factura: {
    pagaMensualPesos: number;
    tarifa: "Simple" | "Doble" | "Triple";
    suministro: "monofásico" | "trifásico";
    potenciaContratadaKw: number;
  };
  techo: {
    descripcion: string;         // "de tejas de 8 x 4 mts."
    tamanoM2: number;
  };
  cotizacion: {
    distanciaInstalacionKm: number;
    cotizacionDolar: number;
    markupPorcentaje: number;
  };
  sistema: {
    cantidadPaneles: number;
    potenciaPanelW: number;
    marcaPaneles: string;        // "Resun"
    potenciaInversorKw: number;
    marcaInversor: string;       // "Growatt"
  };
  fecha: string;                 // ISO
  itemsAdicionales: ItemAdicional[];
  costosEditables: { ... }       // Precargados desde defaults
}
```

### 5.2 `ItemAdicional`

```typescript
interface ItemAdicional {
  id: string;                    // cuid
  nombre: string;
  descripcion: string;
  precioSinIvaUsd: number;
  potenciaW?: number;
}
```

Si `itemsAdicionales` está vacío, la cotización muestra la **Variante A**
(sin ítems). Si tiene al menos un elemento, la **Variante B** (con ítems
adicionales como filas y total que los suma).

---

## 6. Cálculos del negocio

Implementado en `server/src/services/proposal/calculator.ts`. Documentación
detallada de cada intermedio (fórmula + variables del singleton + ejemplo):
memoria de cálculo en `/admin/propuestas/memoria-calculo`.

Definiciones que suelen confundirse:

- **margen** = `gananciaFinal / subtotalSinIva` (NO es un % sobre el total con
  IVA). Es la ganancia neta del negocio sobre el subtotal sin IVA.
- **markup**: se guarda en porcentaje (20 = 20%); la calculadora lo interpreta
  por magnitud (≤1 decimal, >1 porcentaje) para soportar snapshots viejos.

Caso de referencia (Jose Gonzalez, post fix BBVA + tarifas) para validar:
- 11 paneles × 590W → 6.49 kWp
- Inversor 6 kW trifásico, dólar 40, markup 20%, tarifa Simple
- Subtotal sin IVA: USD 10.530 · Total con IVA: **USD 12.846**
- TIR: 15.9% · PRI: 6.3 años · margen: 15.4%
- Cuotas BBVA: **$22.450 / $15.453 / $10.543**

---

## 7. Sistema de permisos por variable

Cada variable en `ProposalDefaults.data` se almacena como objeto:

```typescript
{ value: any; asesorCanOverride: boolean }
```

- `asesorCanOverride: true` → campo editable en el formulario del asesor.
- `asesorCanOverride: false` → solo lectura, agrupado al final del
  formulario en "Parámetros del sistema (configurado por administración)".

El backend valida en `save-version`: si el asesor manda un valor distinto
para una variable con `asesorCanOverride: false`, responde 400.

Todas las variables de `costosEditables` y `cotizacion` tienen el flag.
Cliente, sistema, techo, fecha e ítems adicionales son siempre editables.

---

## 8. API REST

```
GET    /api/proposals-v2/lead/:leadId/draft
PUT    /api/proposals-v2/lead/:leadId/draft
DELETE /api/proposals-v2/lead/:leadId/draft
POST   /api/proposals-v2/preview
POST   /api/proposals-v2/lead/:leadId/save-version
GET    /api/proposals-v2/lead/:leadId/versions
GET    /api/proposals-v2/version/:id
GET    /api/proposals-v2/version/:id/pdf/full
GET    /api/proposals-v2/version/:id/pdf/summary
GET    /api/proposals-v2/version/:id/preview-html
GET    /api/proposals-v2/defaults          // VENTAS:VIEW
PUT    /api/proposals-v2/defaults           // Rol ADMIN
POST   /api/proposals-v2/defaults/cover     // Rol ADMIN
```

Permisos: `VENTAS:VIEW`, `VENTAS:EDIT`, `VENTAS:CREATE`, rol `ADMIN`.

---

## 9. Generación de HTML y PDF

Templates en `server/src/templates/proposal-v2/` (`full.hbs`,
`summary.hbs`, `partials/`, `styles/`, `assets/`). Colores: azul Voltia
`#1836B2`. Tipografía: Inter / Helvetica Neue / Arial. A4 794×1123px.
Tratamiento informal (tu/te/vos). Sin emojis, sin CO₂, sin equivalencias.

Gráficos con `chartjs-node-canvas` server-side, embebidos como
`<img src="data:image/png;base64,...">`. Dos gráficos: generación mensual
(barras) y retorno acumulado 15 años (barras divergentes).

Para ADMIN en preview: sección extra al final con flujo de caja
(`business-flow` + `display: none` en `@media print`).

---

## 10. Estructura del PDF (validada)

### 10.1 PDF completo (orden definitivo)

1. Tapa (Canva PDF con overlay: nombre, ciudad, fecha)
2. Carta de presentación (narrativa + firma asesor)
3. Especificaciones del sistema
4. Cómo funciona el sistema on-grid (diagrama corregido)
5. Servicios incluidos (3×3) + no incluidos
6. Plazo de entrega (timeline + 4 cards)
7. Generación de energía (gráfico mensual + "Tu ahorro")
8. Cotización (Variante A o B según itemsAdicionales)
9. Financiación BBVA + Seguro contra granizo
10. Análisis económico (texto + tabla + gráfico retorno 15 años)
11. Tu retorno (card de inversión + 4 cards + cierre)
12. Contratapa (logo + datos contacto)

### 10.2 PDF resumen (1-2 páginas)

Header compacto + 4 highlights + tabla especificaciones + TOTAL C/IVA +
timeline compacto + (opcional) financiación BBVA.

---

## 11. Tapa externa con overlay

La tapa se diseña en Canva y se sube a Admin como PDF. El sistema
superpone 3 datos (nombre cliente, ciudad, fecha) en coordenadas
configurables (`coverOverlay` en `ProposalDefaults`).

Implementación con `pdf-lib`: cargar la tapa, `drawText` para cada campo
en sus coordenadas, concatenar tapa + cuerpo (Puppeteer).

Si `coverPdfAttachmentId` es null, el PDF arranca por la carta de
presentación (no falla); el preview muestra "Tapa no configurada".

---

## 12. Datos del asesor

La firma de la carta y el teléfono de la contratapa vienen del usuario
logueado. Requiere `User.phone` (ya existe) y `User.jobTitle` (se agrega
en Fase F). Snapshot en `ProposalVersion.advisor`:
`{userId, name, email, phone, jobTitle}`.

Validación: si el asesor no tiene `phone`/`jobTitle`, "Guardar versión"
queda deshabilitado.

---

## 13. Ítems adicionales opcionales

El asesor puede agregar renglones extras a la cotización. Cálculos:

```typescript
itemsAdicionalesTotalSinIva = sum(items.precioSinIvaUsd)
itemsAdicionalesIva = itemsAdicionalesTotalSinIva * 0.22
itemsAdicionalesTotalConIva = itemsAdicionalesTotalSinIva * 1.22
totalFinalConIva = totalConIva + itemsAdicionalesTotalConIva
```

Las cuotas BBVA se calculan sobre `totalFinalConIva`.

---

## 14. UI / Componentes

Página `/ventas/lead/:leadId/propuesta`. Layout: form 40% izquierda /
preview 60% derecha (iframe). Para ADMIN: panel de flujo de caja.

Componentes en `client/src/pages/proposals/` y
`client/src/components/proposals/`. Hooks en `client/src/hooks/proposals/`.

Botón "Guardar versión" habilitado solo si la validación Zod pasa y el
usuario tiene `phone` + `jobTitle`.

Entrada desde el Lead: botón "Generador nuevo (beta)" al lado del viejo.

---

## 15. Defaults de Voltia (Admin)

Pestaña en Admin bajo "Procesos y reglas" → **"Defaults de propuestas"**.
Secciones colapsables: Tapa, Precios de equipamiento, Marcas, Costos del
negocio, Mano de obra, Comisiones, Plazos de entrega, Tasas BBVA, Otros.

Por cada variable: input del valor + switch "Asesor puede modificar".

Permisos: ver = `VENTAS:VIEW`; editar = rol `ADMIN`; subir tapa = rol
`ADMIN`.

---

## 16. Permisos del sistema

| Acción | Permiso |
|---|---|
| Ver propuesta (draft, versiones, preview) | `VENTAS:VIEW` |
| Editar draft | `VENTAS:EDIT` |
| Guardar versión (crea PDF) | `VENTAS:CREATE` |
| Ver "Flujo de caja del negocio" | Rol `ADMIN` |
| Editar defaults en Admin | Rol `ADMIN` |
| Subir tapa PDF | Rol `ADMIN` |

El flujo de caja del negocio solo se muestra a ADMIN; el backend lo
respeta aunque el cliente pida `includeBusinessFlow: true`.

---

## 17. Convivencia con generador viejo

- Rutas viejas (`/api/proposals/*`) + script Python: sin cambios.
- Rutas nuevas: `/api/proposals-v2/*`.
- `FileAttachment.toolSource`: viejo `"ProposalGenerator"`, nuevo
  `"proposal-v2"`.
- Botón "Generador nuevo (beta)" en el Lead, al lado del viejo.
- Las propuestas viejas no se migran. Retirar el viejo: fase futura.

---

## 18. Plan de implementación por fases atómicas

- **Fase A** — Modelo de datos + Defaults Admin (este prompt).
- **Fase B** — Calculadora del negocio.
- **Fase C** — Template HTML + Puppeteer + gráficos.
- **Fase D** — Tapa PDF + overlay.
- **Fase E** — Draft, versiones, autosave.
- **Fase F** — UI del constructor (+ `User.jobTitle`).
- **Fase G** — Pulido + validación en producción.

---

## 19. Fuera de alcance

Plantillas adicionales, off-grid/híbrido, firma electrónica, envío
automático por email, comparación de versiones, editor de plantillas
desde Admin, migración de propuestas viejas, i18n, modo oscuro del
preview.

---

## 20. Casos de prueba

- **Referencia Jose Gonzalez**: `calculated` produce los números
  esperados (TIR 17,2%, PRI 5,8 años, total USD 14.029).
- **Borde**: sistema chico/grande, tarifa Simple vs Doble/Triple,
  distancia 0 km, markup 0%, dólar distinto del default, varios ítems
  adicionales.
- **Error**: guardar sin nombre de cliente → 400; sin phone/jobTitle →
  botón deshabilitado; sin tapa → genera sin tapa; preview incompleto →
  placeholders; Puppeteer/pdf-lib falla → 500 con log.

---

## Apéndice B: Referencias

- Diseño visual validado: `Propuesta_Voltia.pdf` (iteración de Imagine)
- PDF de referencia: `casos_referencia/Propuesta_Comercial_Voltia_-_Jose_Gonzalez_v1.pdf`
- Excel fuente: `Negocio Paneles v8 Jose Gonzalez.xlsx`
- Generador EFP (patrón Puppeteer): `server/src/services/efpPdf/`
- Generador Unifilar (patrón versionado): `server/src/services/unifilarSvg/`
