# 08 · Finanzas

> **Capítulo parcial.** Solo está escrita la sección de *Pagos a instaladores
> tercerizados*. El resto del módulo existe y está en producción, pero todavía
> sin documentar.

Movimientos, cobros, pagos a proveedores, facturación, flujo de fondos y resultados.

---

## Pagos a instaladores tercerizados

### Para qué existe

Voltia terceriza parte de la instalación. Antes, lo que se le debía a cada
cuadrilla vivía en WhatsApp y en una planilla: no había forma de saber cuánto se
le debía a quién, ni el instalador tenía dónde consultarlo.

Es el espejo de las comisiones del asesor, del lado del gasto, con dos
diferencias: admite **pagos parciales** y el instalador se asigna **a mano**.

### Cómo se usa

**Al ganarse un proyecto** se crea solo el pago, con el monto congelado de la
propuesta ganadora y **sin instalador asignado**.

Desde **Finanzas → Instaladores** (o `/pagos-instalador`), quien gestiona:

1. **Asigna** el instalador y, si hace falta, corrige el monto.
2. **Registra los pagos**, totales o parciales. Cada uno pide monto, fecha y una
   nota opcional.
3. Puede **cargar pagos a mano** para trabajos que no salen de un proyecto (una
   reparación en garantía, una obra anterior a esta funcionalidad).
4. Puede **filtrar por instalador** y copiar un **resumen para WhatsApp**.

**El resumen de WhatsApp** (`resumenWhatsApp.ts`) lista las obras en curso con lo
que falta de cada una, y de las saldadas **solo la última**: un instalador con
veinte obras cerradas generaría un mensaje ilegible, y lo que importa es dónde
quedó la cuenta. Los pagos sin instalador asignado quedan afuera.

El instalador entra por **el menú de su cuenta → "Mis cobros"** y ve sus
trabajos, lo cobrado y el saldo. Es solo lectura.

### Cómo funciona

**El monto** sale de `calc.manoDeObraUsdSinIva` del snapshot de la última
propuesta **publicada** del lead, multiplicado por **1,22**: el instalador
factura, así que se le paga con IVA. Si la propuesta no trae mano de obra (las
viejas, o proyectos cargados a mano), el pago nace en **0** y marcado
`origenManual` para que se note que hay que cargarlo.

`readManoDeObraFromSnapshot()` en `installer-payment.service.ts`.

**El congelamiento** ocurre en la conversión lead → proyecto (`api.routes.ts`,
junto a `moveLeadMediaToProject`) y es **idempotente** por `projectId`:
reintentar la conversión no duplica la deuda. Va en su propio `try`: si falla, el
proyecto igual se crea y el pago se puede cargar a mano.

**El saldo no se guarda**: se deriva de los movimientos con `calcularSaldo()`,
que es también el único lugar donde se decide el estado.

| Estado | Cuándo |
|---|---|
| `PENDIENTE` | no se entregó nada |
| `PARCIAL` | se entregó algo pero falta |
| `PAGADO` | el saldo llegó a cero |

**Cada entrega crea un `FinanceMovement`** (GASTO, `PROYECTO_SALIDA`,
subcategoría "Mano de obra", status `PAGADO`) atado por `installerPaymentId`. Así
entra solo al flujo de fondos, a las cuentas y a la conciliación, sin duplicar
esa maquinaria.

### Permisos

| Acción | Permiso |
|---|---|
| Ver los pagos propios | `PAGOS_INSTALADOR:VIEW` |
| Ver los de todos | `FINANZAS:VIEW` **o** `PAGOS_INSTALADOR:EDIT` |
| Cargar a mano | `FINANZAS:CREATE` |
| Asignar instalador / corregir monto | `FINANZAS:EDIT` |
| Registrar un pago | `FINANZAS:CREATE` |
| Borrar | `FINANZAS:DELETE` |

El rol **`INSTALADOR_TERCERIZADO`** clona a `CAPATAZ` y suma `PAGOS_INSTALADOR:VIEW`.
El capataz propio **no** lo lleva: cobra sueldo, no por obra.

`ADMIN` **no tiene atajo**: la autorización se resuelve contra filas reales de
`permissions`, así que el módulo nuevo hubo que dárselo explícitamente. Es el
error que más fácil se repite al agregar un módulo.

### Reglas y decisiones

- **El saldo pendiente no genera un movimiento previsto.** Un previsto por el
  total más un pagado por cada entrega contaría el gasto dos veces. La
  consecuencia: la deuda con los instaladores **no aparece como gasto futuro en
  el flujo de fondos**; se ve en la pantalla de Instaladores.
- **El instalador se asigna a mano y no se puede deducir.** `Team` —los equipos
  del calendario, que sí distinguen `PROPIO` de `TERCERIZADO`— **no tiene
  relación con `User`**. Sin ese vínculo no hay de dónde sacar qué persona hizo
  la obra.
- **El monto es editable** y queda marcado con `montoEditado`: lo que estima el
  cotizador no siempre es lo que se negocia.
- **No se puede pagar más que el saldo** (`SUPERA_EL_SALDO`) ni bajar el monto
  por debajo de lo ya entregado (`MONTO_MENOR_A_PAGADO`).
- **Borrar exige que no haya entregas.** Los movimientos de Finanzas nunca se
  tocan desde acá: es plata que salió, y borrarla descuadraría las cuentas.

### Casos borde

- **Proyecto sin propuesta v2**: nace en 0 con `origenManual`. El listado lo
  muestra como "falta cargar el monto".
- **Varias propuestas publicadas**: se toma la de mayor `versionNumber`
  (verificado: un lead con 15 versiones congeló la 15, no las viejas).
- **Se paga y después se baja el monto desde Finanzas**: el saldo puede quedar
  negativo; el estado igual reporta `PAGADO` en vez de romperse.
- **El IVA está duplicado** entre el cotizador (`proposal/calculator.ts`) y este
  servicio. Si cambia la tasa hay que tocar los dos.
- **Las fechas se formatean desde la string, no con `Date`.** Llegan como
  medianoche UTC (así las arma `parseDateOnly`), y pasarlas por `Date` las corre
  un día para atrás en Uruguay (-03): un pago del 20 se mostraba como 19. Mismo
  criterio que `formatDate` en `utils/date.ts`.

---

## Qué falta cubrir de este capítulo

- Movimientos: tipos, fuentes y comprobantes
- Cobros a clientes y el plan de pagos
- Pagos a proveedores y la aplicación FIFO a facturas
- Facturación al cliente: qué lleva factura y su estado
- Flujo de fondos: proyección de costos fijos y filtros
- Estado de resultados: por qué es de caja y por qué en dólares
- Cotización del dólar: origen BCU y carga manual

---

## Plantilla

Al escribirlo, seguir la estructura común (ver `README.md`):

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
