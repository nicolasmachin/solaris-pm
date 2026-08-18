# Pagos a instaladores tercerizados

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Es el plan que se acordó *antes* de construir la funcionalidad. Puede diferir de
> lo que finalmente se implementó. Sirve para entender por qué se decidió cada
> cosa, no para saber cómo funciona hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

## Contexto

Hoy Voltia le paga la mano de obra a instaladores tercerizados sin que la app lo
registre: no hay forma de saber cuánto se le debe a cada uno, qué ya se le pagó ni
qué saldo queda. El instalador tampoco tiene dónde consultarlo, así que la
conciliación es por WhatsApp y planilla.

La referencia es lo que ya funciona para los asesores comerciales: cada venta
ganada congela una `Commission`, se genera el pendiente en Finanzas, y el asesor
entra a `/comisiones` desde el menú de su cuenta a ver lo suyo. Queremos lo mismo
del lado de los pagos, con dos diferencias que pidió el usuario: **saldo parcial**
(total / pagado / restante, como los cobros a clientes) y **asignación manual** del
instalador.

### Decisiones tomadas con el usuario

- **Rol real nuevo** `INSTALADOR_TERCERIZADO`, no un sub-rol.
- **Pagos parciales** con saldo, no pendiente/pagado binario.
- **Monto automático pero editable**: se propone del cotizador y se puede corregir.
- El tercerizado ve **el nombre del cliente** de cada trabajo.

### Lo que ya existe y hay que reusar (verificado en el repo)

| Pieza | Dónde | Cómo se usa acá |
|---|---|---|
| Modelo `Commission` + `FinanceMovement` linkeado | `schema.prisma:3352`, `commission.service.ts:237` | Molde exacto del modelo y del congelamiento |
| `readComisionFromSnapshot()` | `commission.service.ts:35` | Molde para leer el monto del snapshot |
| `canSeeAll()` + `/commissions/mine` | `commission.routes.ts:34,189` | Molde del scoping "los míos vs todos" |
| `manoDeObraUsdSinIva` | `calculator.ts:140`, `types.ts:75` | **Ya se calcula y ya viaja en el snapshot** |
| `IVA = 0.22` | `calculator.ts:4` | El instalador factura, así que el pago va con IVA |
| Página `/comisiones` + link en el menú de cuenta | `ComisionesAsesor.tsx`, `Topbar.tsx:252` | Molde de la pantalla y de dónde cuelga |
| Patrón total/pagado/saldo | `FinanceCobros.tsx`, `/finance/cobros-by-project` | Molde del cálculo de saldo |
| Punto de conversión lead→proyecto | `api.routes.ts:7496` | Hook donde se crea el pago automáticamente |

**Hallazgo que cambia el diseño:** `Team` (equipos instaladores, con
`type: TERCERIZADO`) **no tiene relación con `User`**. Por eso la asignación manual
que pidió el usuario no es una simplificación sino la única opción sin inventar ese
vínculo. En producción hay 2 equipos tercerizados (Fernando 8 obras, Mario 5).

**Advertencia registrada:** el mecanismo de sub-roles de Operaciones se eliminó a
propósito en julio de 2026 (`20260731180000_drop_subroles_operaciones`) porque nunca
se asignaba y el ruteo pasó a ser 100% por rol real. Por eso el rol nuevo es real.

## Diseño

### Schema

```prisma
model InstallerPayment {
  id        String  @id @default(cuid())
  projectId String  @unique          // un pago por proyecto
  project   Project @relation(...)

  // Null hasta que el admin lo asigna. Es el estado normal al crearse.
  installerId String?
  installer   User?  @relation("InstallerPaymentInstaller", ...)

  montoUsd     Decimal @db.Decimal(14, 2)   // mano de obra + IVA
  origenManual Boolean @default(false)      // true si no hubo snapshot
  montoEditado Boolean @default(false)      // el admin lo corrigió a mano

  fechaTrabajo DateTime  @db.Timestamptz(6)
  dueDate      DateTime  @db.Date
  status       InstallerPaymentStatus @default(PENDIENTE) // PENDIENTE|PARCIAL|PAGADO
  notas        String?

  movimientos FinanceMovement[]   // los pagos parciales
  // + createdById, timestamps, deletedAt
  @@index([installerId]) @@index([status]) @@index([deletedAt])
  @@map("installer_payments")
}
```

- `FinanceMovement` suma `installerPaymentId String?` + relación. Cada pago parcial
  es un movimiento propio, igual que los cobros: así entra solo al flujo de fondos,
  a las cuentas y a la conciliación, sin duplicar maquinaria.
- **`status` se deriva, no se setea a mano**: `saldo = montoUsd − Σ(movimientos
  pagados)`. Una sola función lo calcula y la usan todas las vistas.
- `AuditEntityType` suma `installer_payment`.
- `Module` suma `PAGOS_INSTALADOR`.

### Backend

Nuevo `server/src/services/installer-payment.service.ts`, espejo de
`commission.service.ts`:

- `readManoDeObraFromSnapshot(snapshot)` — lee `calc.manoDeObraUsdSinIva` y devuelve
  `× 1.22`. Si no hay snapshot devuelve `null` → el pago se crea en 0 y
  `origenManual: true`.
- `createInstallerPaymentForProject({ projectId, userId })` — idempotente por
  `projectId`. Se llama desde la conversión lead→proyecto (`api.routes.ts:7496`,
  justo donde ya se llama `moveLeadMediaToProject`).
- `assignInstaller({ paymentId, installerId, montoUsd? })` — asignación manual, con
  auditoría. Corregir el monto marca `montoEditado`.
- `registrarPago(...)` — crea el `FinanceMovement` del pago parcial y recalcula el
  status.
- `listInstallerPayments({ installerId?, status?, year? })` + `getMetrics(...)`.

Nuevo `server/src/routes/installer-payment.routes.ts`:

| Endpoint | Permiso |
|---|---|
| `GET /installer-payments/mine` | `PAGOS_INSTALADOR:VIEW` — siempre scopeado al usuario |
| `GET /installer-payments` | `PAGOS_INSTALADOR:VIEW`; degrada a los propios si no puede ver todo |
| `POST /installer-payments` (manual, sin proyecto) | `FINANZAS:CREATE` |
| `PATCH /installer-payments/:id` (asignar / corregir monto) | `FINANZAS:EDIT` |
| `POST /installer-payments/:id/pagos` (pago parcial) | `FINANZAS:CREATE` |
| `DELETE /installer-payments/:id` | `FINANZAS:DELETE` |

`canSeeAll()` se copia de `commission.routes.ts:34`: `FINANZAS:VIEW` **o**
`PAGOS_INSTALADOR:EDIT`.

### Rol y permisos

`INSTALADOR_TERCERIZADO` = misma matriz que `CAPATAZ` **más** `PAGOS_INSTALADOR:VIEW`.
`CAPATAZ` no lo lleva: el propio no cobra por obra.

Script idempotente `server/scripts/seed-instalador-tercerizado.ts` para producción,
siguiendo `seed-nuevos-roles.ts`. `PAGOS_INSTALADOR` se suma al
`PERMISSION_CATALOG` (`api.routes.ts:5460`) y a `MODULE_LABELS` (`Admin.tsx:456`).

### Frontend

- `client/src/pages/PagosInstalador.tsx` — calcado de `ComisionesAsesor.tsx`: tiles
  (total, pagado, saldo), filtro por estado y año, tabla. El admin ve un selector de
  instalador y el botón de carga manual; el tercerizado ve solo lo suyo.
- Ruta `/pagos-instalador` con `<PermissionRoute module="PAGOS_INSTALADOR" action="VIEW">`,
  y link en el menú de cuenta del `Topbar` al lado del de comisiones.
- `client/src/components/pagos-instalador/` — `AsignarInstaladorModal`,
  `RegistrarPagoModal`, `ManualPaymentModal`.
- Pestaña **"Instaladores"** en Finanzas para el admin, junto a Cobros.

## Verificación

1. `docker compose exec server npx prisma migrate dev` + reiniciar el server
   (no tiene watch).
2. **Congelamiento**: convertir un lead ganado con propuesta v2 a proyecto y
   confirmar que se crea el `InstallerPayment` con `montoUsd ≈ manoDeObraUsdSinIva ×
   1,22`, sin instalador y en `PENDIENTE`. Repetir con un lead sin propuesta nueva:
   debe quedar en 0 con `origenManual: true`.
3. **Idempotencia**: reconvertir / reintentar no debe duplicar el pago.
4. **Saldo**: asignar instalador, registrar dos pagos parciales y confirmar
   `PENDIENTE → PARCIAL → PAGADO`, con el saldo cuadrando en cada paso.
5. **Aislamiento (lo más importante)**: loguearse como un `INSTALADOR_TERCERIZADO` y
   confirmar por API que `GET /installer-payments` devuelve **solo los suyos**, que
   no puede asignar ni editar montos, y que no ve Finanzas. Probar con dos
   tercerizados distintos que ninguno ve lo del otro.
6. **Test unitario** de `readManoDeObraFromSnapshot` (snapshot con mano de obra, sin
   ella, y malformado) y del cálculo de saldo/estado, al estilo de
   `commission.service.test.ts`. Sumar `test:installer-payment` a los scripts.
7. Verificar que los pagos aparecen en el flujo de fondos y en el estado de
   resultados sin romper los totales.
8. Revisar permisos al cerrar: listar qué rol queda adentro y afuera de cada
   endpoint nuevo contra la matriz **de producción**, no la local.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El monto del cotizador no es lo que realmente se le paga al instalador | Por eso es editable y queda `montoEditado`. Conviene contrastar el primer caso real antes de confiar en el automático |
| Pagos que quedan sin instalador asignado y se olvidan | La pantalla de Finanzas los muestra primero, como "sin asignar" |
| Un tercerizado viendo datos de otro | Punto 5 de la verificación, probado por API con dos usuarios |
| El rol nuevo no existe en producción | Script idempotente + correrlo en el deploy, igual que `seed-nuevos-roles.ts` |

## Fuera de alcance

- Vincular `Team` con `User` (los equipos siguen siendo etiquetas del calendario).
- Que el instalador cargue su propia factura o comprobante.
- Retenciones, IRPF o cualquier cálculo impositivo más allá del IVA.
