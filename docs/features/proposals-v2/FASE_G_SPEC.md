# Propuestas v2 — Fase G — Pulido pre-deploy

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> Última fase antes del deploy a producción. Incluye ocho pendientes
> acumulados de fases anteriores + memoria de cálculo (feature nuevo) +
> documentación de deploy + checklist de QA visual. Spec madre:
> `docs/features/proposals-v2/SPEC.md`. Versión: 1.

## Tabla de contenidos

1. Contexto y objetivo
2. Alcance
3. Orden de trabajo
4. Ítems de pulido chico
5. Memoria de cálculo (feature nuevo)
6. Documentación de deploy
7. Checklist de QA visual (para Nicolás)
8. Fuera de alcance
9. Apéndice: glosario y referencias

## 1. Contexto y objetivo

Fase G cierra Propuestas v2 y prepara el sistema para el primer deploy
del constructor a producción. Todo lo que va a producción tiene que
estar consistente, documentado y verificado.

Objetivos:

- Cerrar los ocho pendientes acumulados en Fases A-F y en los fixes
  post-F (Gonzalez + BBVA + tarifas).
- Documentar la calculadora al detalle (memoria de cálculo) para que
  cualquier admin pueda entender cada intermedio sin leer código.
- Preparar la documentación de deploy: README, guía de deploy paso a
  paso, y runbook de rollback.
- Recorrer visualmente toda la app con un checklist antes del deploy.

El deploy en sí queda fuera de Fase G — se hace en un turno aparte con
la documentación ya escrita.

## 2. Alcance

### 2.1 Ocho pendientes acumulados

1. Memoria de cálculo (feature nuevo, ver sección 5).
2. Peso del PDF (725KB vs 242KB de Fase E) — **fuera de alcance**
   decidido con Nicolás ("si funciona no importa el tamaño").
3. Refinamiento responsive fino del constructor.
4. Cleanup automático obvio de errores TS en `api.routes.ts`.
5. Corregir definición de margen en `SPEC.md` a
   `gananciaFinal/subtotalSinIva`.
6. Decisión sobre precio del panel 100 vs 105 — **queda como decisión
   de negocio de Nicolás**, no de código. Se anota en el reporte final.
7. Markup en UI de defaults: mostrar como porcentaje en vez de decimal.
8. Factor real de tarifa Triple — **queda como decisión de negocio de
   Nicolás**, no de código. Se anota en el reporte final.

Sale del alcance en total: ítem 2 (peso PDF), ítems 6 y 8 (decisiones
de negocio). Se implementan efectivamente: 1, 3, 4, 5, 7.

### 2.2 Trabajo nuevo

- Memoria de cálculo (feature con endpoint + página + placeholders
  interactivos + link desde admin).
- Documentación de deploy (README general, docs de deploy, runbook de
  rollback).
- Checklist de QA visual para Nicolás.

## 3. Orden de trabajo

1. **Ítems chicos con impacto en datos primero** (markup como
   porcentaje: cambia una unidad de una variable en el singleton, hay
   backfill).
2. **Ítems chicos sin impacto en datos** (definición de margen en
   SPEC, cleanup TS obvio, responsive fino).
3. **Feature nuevo grande** (memoria de cálculo).
4. **Documentación** (README + deploy + rollback).
5. **Checklist de QA visual** (para Nicolás, al final).

## 4. Ítems de pulido chico

### 4.1 Markup como porcentaje

**Contexto**: hoy `markupPorcentajeDefault` se guarda en el singleton
como decimal (`0.2` = 20%). Poco práctico para el admin.

**Cambio**: pasar a porcentaje en el modelo (`20`), en la UI (`20 %`)
y en cualquier lugar del código que lo use.

**Puntos críticos** (auditar antes de tocar):

- Todo lugar del código que lea el markup tiene que actualizarse en el
  **mismo commit**. Si algo queda leyendo `0.2` y otro lugar `20`, el
  precio se dispara por 100 (mismo tipo de bug que el BBVA 40x).
- Backfill del singleton en producción: `0.2` → `20`.
- Snapshots de versiones publicadas: **no se tocan** (inmutables). La
  calculadora acepta ambas unidades detectando por magnitud (≤1 decimal,
  >1 porcentaje) o por `snapshot.version`.

#### 4.1.1 Schema del singleton
- Renombrar a `markupPorcentaje` (sin `Default`) o mantener el nombre y
  solo cambiar la unidad. Decide según impacto real.

#### 4.1.2 UI de admin
- Input con sufijo `%`, validación `0 ≤ valor ≤ 100`.

#### 4.1.3 Calculadora
- `markup = (costoTotal + manoDeObra) × markupPorcentaje / 100`.
- Helper puro con detección de magnitud + test.

#### 4.1.4 Backfill
- Grant idempotente `grant-markup-porcentaje.ts` (× 100 si sigue decimal).
- No toca snapshots.

### 4.2 Definición de margen en SPEC.md
- Editar la línea a `gananciaFinal / subtotalSinIva`.

### 4.3 Cleanup TS obvio en `api.routes.ts`
- Solo imports muertos, variables no usadas, `any` implícitos triviales.
- Fuera de alcance: refactor que cambie runtime, cambios en handlers/schemas.

### 4.4 Responsive fino del constructor
- Tablet (768-1199): preview PDF 38% legible.
- Móvil (<768): "Ver preview" abre iframe full-screen y cierra bien.
- Sub-header sticky no tapa contenido al scrollear.
- Modal de publicación no se sale de pantalla.
- Drawer de debug abre full-screen en móvil.
- No incluye rediseño ni nuevas breakpoints.

## 5. Memoria de cálculo (feature nuevo)

- **Ruta**: `/admin/propuestas/memoria-calculo`.
- **Entrada**: link "Ver memoria de cálculo" en `/admin/propuestas/defaults`.
- **Permiso**: solo admin.
- **Formato**: markdown con placeholders interactivos con valores en vivo.

### 5.1 Backend
- `GET /api/admin/proposals-calculator/memoria` (o la ruta que confirme
  la convención del repo), gate admin.
- Devuelve `{ singletonValues: { [key]: { value, label, unidad } } }`.
- Reusa la infra del drawer (`calculator-labels.ts`).

### 5.2 Contenido del markdown
- Redacta Claude Code, Nicolás revisa. Archivo
  `client/src/content/calculator-memory.md`. Orden de cálculo:
  1. Inputs del asesor. 2. Dimensionado. 3. Costos. 4. Pricing.
  5. Ahorro. 6. Retorno. 7. BBVA. 8. Flujo financiero interno.
- Cada sección: fórmula + variables del singleton + ejemplo Gonzalez +
  qué pasa si la variable se sube/baja.

### 5.3 Placeholders interactivos
- `{{singleton:nombreVariable}}` → chip `[markupPorcentaje: 20 %]`.
- Si no existe: `[nombreVariable: ??]` con color de alerta (drift).

### 5.4 Frontend
- `CalculatorMemoryPage.tsx`, query TanStack `["proposals-memoria"]`,
  render markdown + post-proceso de placeholders. Estilo admin.

### 5.5 Link desde defaults
- Link discreto "Ver memoria de cálculo →" arriba en la página de defaults.

### 5.6 PASO 0 obligatorio
- Mapeo exhaustivo temporal (no commiteado) antes de redactar el markdown.

## 6. Documentación de deploy

### 6.1 README principal
- Descripción, requisitos, setup local paso a paso, estructura de
  carpetas, links a specs.

### 6.2 Guía de deploy (`docs/DEPLOY.md`)
- Prerequisitos VPS, `.env.example` de prod, volumen `voltia_storage`,
  `deploy.sh` paso a paso, backup pre-deploy, health check, migraciones,
  scripts de grant.

### 6.3 Runbook de rollback (`docs/ROLLBACK.md`)
- Síntomas, rollback rápido (revert + redeploy), rollback con restore de
  BD, revertir migración / default del singleton, corrupción de volumen,
  contactos de emergencia.

## 7. Checklist de QA visual (para Nicolás)

Archivo `docs/QA_CHECKLIST_PRE_DEPLOY.md`. Secciones: 7.1 Autenticación
y roles · 7.2 Ventas/Leads · 7.3 Constructor de propuestas · 7.4 Admin
de propuestas · 7.5 Ingeniería (regresión) · 7.6 Otros módulos · 7.7
Responsive · 7.8 Errores (consola + endpoints borde).

## 8. Fuera de alcance

- Deploy en sí (turno aparte). Peso del PDF. Precio panel 100 vs 105.
  Factor real Triple. Refactor profundo de `api.routes.ts`. Features
  post-deploy. Envío al cliente desde la app. Panel del lead a 2 columnas.

## 9. Apéndice: glosario y referencias

- **Memoria de cálculo**: documento vivo dentro de la app que explica la
  calculadora con valores actuales del singleton interpolados.

Referencias: `calculator.ts`, `calculator-labels.ts`, `ProposalDefaults`
(Prisma), `FASE_F_SPEC.md`, `FASE_E_SPEC.md`.
