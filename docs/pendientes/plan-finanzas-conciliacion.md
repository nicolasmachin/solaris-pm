# Plan único de Finanzas: facturas, movimientos y banco

Armado el 20-oct-2026 juntando dos sesiones de trabajo (facturación Biller y
conciliación con el banco). Desde ahora todo Finanzas se trabaja en una sola
sesión, sobre este plan.

## La idea: tres puntas que se tienen que encontrar

| Punta | De dónde sale | Dónde se ve |
|---|---|---|
| **Factura** | DGI / Biller (las que nos emiten) | Finanzas → Facturas de proveedores |
| **Movimiento de Voltia PM** | lo que carga el equipo (gasto, deuda, pago, cobro) | Finanzas → Movimientos |
| **Movimiento del banco** | el lector del banco (robot en eBROU; después, los demás bancos) | Finanzas → Movimientos del banco *(a armar)* |

Reglas (Nicolás, 20-oct):

- **Todo movimiento del banco tiene un movimiento de Voltia PM.** Siempre. Si
  no, es "Falta cargar".
- **Un movimiento del banco puede no tener factura** (un servicio que no está a
  nombre de la empresa, por ejemplo).
- **Toda factura tiene un movimiento de Voltia PM** y, cuando se paga, una
  salida del banco.
- **Proveedores de cuenta corriente**: cada factura entra sola como deuda. No se
  pagan factura por factura: se paga contra el estado de cuenta y el pago se
  descuenta de las facturas.
- **Proveedores sin cuenta corriente** (se paga en el momento): la factura tiene
  que encontrar el gasto ya cargado. Si lo encuentra, queda marcada. Si no, queda
  sin marcar: se hizo la compra y nadie cargó el movimiento.
- **Las facturas no desaparecen** al cargarse como deuda: el registro las muestra
  todas, con su marca.
- **Se revisa solo cada media hora**: arreglar algo en una punta puede resolver
  otra.

Decisión de diseño: **las parejas no se guardan, se calculan al mirar** (como ya
hace la conciliación del banco). Así lo que se carga, edita o borra se refleja
al instante, sin esperar la media hora. Lo único que corre cada 30 minutos es lo
que **crea** cosas: traer las facturas de Biller y cargar como deuda las de
cuenta corriente.

## Estado al 20-oct-2026

### Hecho

- **Emisión de facturas a clientes por Biller** (factura + nota de crédito,
  porcentaje del sin IVA de la cotización, a nombre del cliente o de otro).
  Deployado el 14-oct con la cuenta productiva.
- **Bandeja de facturas recibidas**: Biller trae cada hora lo que DGI tiene a
  nombre de Voltia y lo que llegó por mail. Cargar como deuda, vincular con una ya
  cargada, descartar, dar de alta el proveedor. Registro "Facturas de
  proveedores".
- **Asignar el proveedor por RUT** a todas las facturas de ese RUT (20-oct, sin
  deploy).
- **Banco (otra sesión, en curso)**:
  - Tabla `BankMovement`; la cuenta de Voltia PM se ata a la del banco por
    `numeroCuentaBanco`.
  - `POST /banco/lectura` con `BANCO_LECTOR_TOKEN`: el robot manda lo que lee y se
    guarda sin repetir.
  - Pareja banco ↔ Voltia PM calculada: mismo sentido y cuenta, hasta USD 5 / $10
    de diferencia, ±3 días; contra gastos pagados, cobros y pagos a proveedor.
  - "Falta cargar" en Movimientos, con "No va" (motivo) para lo que no se carga a
    propósito.
  - Endpoint del **registro** de todo lo leído del banco con su estado y su pareja
    (`GET /finance/banco/movimientos`). **Falta su pantalla.**
- **Robot de eBROU** (`~/Dev/lector-banco`): todavía exploratorio. Entra con un
  operador de solo consulta (claves en `~/.config/voltia-banco/` de la VPS de
  desarrollo), pero **todavía no lee movimientos ni los manda**.

### Sin deploy

Lo del 20-oct: asignar por RUT y todo lo del banco (2 migraciones aditivas:
`lector_banco_movimientos` y la de login de la otra sesión ya deployada).

## Fases

1. **Cerrar el banco**: pantalla "Movimientos del banco" (registro con estado y
   pareja), robot que lea los movimientos y los mande una vez por día (definir
   dónde corre), deploy.
2. **Cuenta corriente**: casilla en la ficha del proveedor. Sus facturas entran
   solas como deuda. Biller se sincroniza cada 30 minutos.
3. **Factura ↔ movimiento**: la pareja de cada factura se calcula al mirar. Marcas
   en el registro de facturas: *Deuda en cuenta corriente*, *Con movimiento*,
   *Sin movimiento*, *Para revisar* (RUT sin proveedor, varias posibles), *Notas
   de crédito*, *Descartada*. La bandeja deja de ser una lista que se vacía.
4. **Las tres puntas juntas**: en cada pantalla se ven las otras dos (la factura
   muestra su movimiento y si salió del banco; el movimiento del banco muestra su
   movimiento y su factura). Un solo cuadro de "pendientes de conciliar" con lo
   que falta en cada punta.
5. **Otros bancos** con el mismo lector.

Cada fase cambia el manual de Finanzas y la regla de Gerencia "ninguna factura
recibida entra a la deuda sin que una persona la revise" (fase 2).

## Para definir

- El pago a un proveedor de cuenta corriente hoy se descuenta de la factura
  **más vieja** (FIFO). Nicolás dijo "descontando de la última factura": ¿la más
  vieja pendiente o la más nueva?
- Factura de contado ↔ gasto: ¿con qué margen de monto y de días se considera la
  misma? Propuesta: mismo proveedor, mismo número de factura o monto exacto, ±7
  días.
- El robot del banco: ¿corre en la VPS de desarrollo o en producción? Las claves
  hoy están en la de desarrollo.
