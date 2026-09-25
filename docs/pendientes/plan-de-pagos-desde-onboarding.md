# Plan de pagos desde Onboarding (lo crea el asesor)

> Pedido por Nicolás el 24-09-2026, al revisar el manual de posventa.
> **No empezado.** Acá está el problema, la decisión tomada y lo que hay que tocar.

## El problema

**53 de los 68 proyectos activos no tienen plan de pagos cargado** (medido en
producción el 24-09-2026; solo 15 lo tienen). Experiencia Solar tiene que salir a
cobrar y **no sabe qué cobrar**.

La causa es dónde está la herramienta: crear el plan de pagos vive **solo en
Finanzas** (`FINANZAS:EDIT`). Experiencia Solar lo ve pero no lo crea, y el
asesor comercial —que es quien acordó la forma de pago con el cliente— ni lo ve.
Queda en tierra de nadie y no se hace.

## La decisión

**Que el plan de pagos se cree desde Onboarding, en la subetapa "Modalidad de
pago definida"**, que es exactamente donde el asesor ya define cómo paga el
cliente y donde ya está el botón de la proforma al banco.

- Si es **financiación bancaria** → proforma al banco (ya existe).
- Si es **pago directo** → plan de pagos (esto es lo que falta).

Las dos herramientas, una al lado de la otra, en el momento en que se toma la
decisión.

## Qué hay que tocar

| Pieza | Estado hoy | Qué hacer |
|---|---|---|
| `GET/POST /api/finance/plan-pagos` | `FINANZAS:VIEW` / `FINANZAS:EDIT` | Abrir con `authorizeAny` para que entre también el asesor (`ONBOARDING:EDIT`) |
| `client/src/components/finance/PlanPagosModal.tsx` | Recibe `projectId` + `projectName` + `onClose` | **Ya es reusable tal cual**, no hay que tocarlo |
| `client/src/components/project/StageDrawer.tsx` | La subetapa "Modalidad de pago definida" ya tiene el botón de proforma | Sumar el botón del plan de pagos, con el mismo gate `ONBOARDING:EDIT` |
| `planPagos.service.ts` | Requiere `budgetUsd > 0` en el proyecto | Verificar qué pasa si el asesor lo abre antes de que haya presupuesto |

## A definir antes de construir

- **¿El botón aparece siempre o solo si la modalidad es pago directo?** El campo
  `modalidadPago` del proyecto ya distingue `FINANCIACION_BANCARIA`, y los ítems
  del checklist de esa subetapa ya se muestran condicionados por él.
- **¿El asesor puede editar un plan ya creado, o solo crearlo?** Hoy crear
  reemplaza el plan entero.
- **¿Qué pasa con los 53 proyectos que ya están sin plan?** Cargarlos a mano o
  un backfill asistido.

## Contexto relacionado

- El plan de pagos son los cobros previstos del proyecto (`FinanceMovement` con
  `status=PREVISTO`, `sourceType=MANUAL`). Ver `planPagos.service.ts`.
- Experiencia Solar tiene su pestaña Cobros (ver/registrar/marcar pagado) vía
  `authorizeAny`, sin ver el resto de Finanzas: **ese es el precedente exacto**
  de cómo abrir esto sin darle Finanzas al asesor.
