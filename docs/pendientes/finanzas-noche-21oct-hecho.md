# Finanzas — lo construido la noche del 20 al 21 de octubre de 2026

Todo en desarrollo (VPS dev), **sin deploy**. Plan de origen: `docs/pendientes/plan-finanzas-conciliacion.md`
y la revisión de 4 expertos (contador, controller, arquitecto, simplicidad).

## Fase 0 — Recibir lo de la otra sesión y limpiar
- Guardado lo que la otra sesión dejó sin guardar (registro del banco, "deshacer No va").
- **Borradas 6 pantallas viejas de Finanzas** (~4.000 líneas) y sus rutas: `Finance.tsx` (/finanzas-legacy),
  `FinanceMovements.tsx` (/finanzas/movimientos-legacy), `FinanceAPagar.tsx` (/finanzas/a-pagar),
  `FinancePayments.tsx` (/finanzas/pagos), `FinanceIncomeStatement.tsx` (/finanzas/resultado),
  `FinanceReports.tsx` (/finanzas/reportes), más la ruta /finanzas/proveedores-legacy. Solo se enlazaban entre ellas.
- **Confirmar una factura recibida sin carrera**: la lógica pasó a `services/finance/facturas-recibidas.service.ts`
  (`confirmarFactura`, `tomarPendiente`, `resolverProveedor`, `cargarPendiente`, `etiquetaCfe`). Dentro de la
  transacción la factura se "toma" con `updateMany where estado=PENDIENTE`; si otro ya la tomó, corta
  (`FACTURA_RECIBIDA_RESUELTA`). Vincular y descartar usan el mismo control.

## Fase 1 — Arranque limpio: ajustes de deuda
- **Ajuste** = `Payment` con `metodo = AJUSTE`, sin cuenta (`accountId` null), motivo en `notas`, aplicado a deudas
  por `PaymentApplication`. Baja lo que se le debe a un proveedor **sin ser plata**.
  - Excluido de: estado de resultados (los 3 cálculos: `calculateIncomeStatement`, yearly-breakdown,
    `resultados.service.calcularEstadoResultados` → también MCP `estado_resultados`), recorrido de saldos de
    Movimientos (`paymentWhere`), historia del flujo de fondos (`pastPayments`), saldo a favor (lista de proveedores,
    cuentas por pagar, flujo, endpoints de saldo a favor). Caja y conciliación del banco ya lo excluían por cuenta null.
  - No se crea por la ruta común de pagos (`paymentCreateSchema`/`paymentPatchSchema` lo rechazan) ni se edita ni se
    re-aplica (`rechazarSiAjuste` en PATCH pago y en las rutas de aplicaciones). Se borra y se hace de nuevo.
  - Siempre se aplica entero: nunca queda saldo a favor.
  - Una deuda saldada solo por ajuste **conserva su fecha** (`recalcMovementStatus` toma la fecha del último pago
    que no sea ajuste).
  - Prompt del asistente IA (text-to-SQL): regla para excluir `metodo = 'AJUSTE'`.
- Servicio `services/finance/deuda-proveedor.service.ts`: `sumApplications`, `recalcMovementStatus` (movido desde
  api.routes), `deudasAbiertasProveedor`, `crearAjusteEnTx`, `repartirFifo`.
- Endpoints (FINANZAS): `GET /finance/suppliers/:id/deudas-abiertas?moneda=` (VIEW),
  `POST /finance/suppliers/:id/ajustes` (EDIT; monto FIFO o aplicaciones puntuales; motivo ≥5),
  `POST /finance/suppliers/:id/arrancar-cuenta` (EDIT).
- **Arrancar cuenta** (ficha del proveedor y desde la Conciliación con el estado de cuenta): se elige moneda, fecha y
  el saldo que dice el estado de cuenta; se tildan las deudas abiertas que siguen vigentes (por defecto las que vienen
  de factura electrónica o son de octubre en adelante). Las no tildadas se cierran con un ajuste ("Cerrada al arrancar
  la cuenta el dd/mm"). Diferencia positiva → movimiento "Saldo anterior según estado de cuenta al dd/mm" (GASTO a
  pagar del proveedor, fechado un día antes de la deuda vigente más vieja, así el pago lo cancela primero). Diferencia
  negativa → otro ajuste FIFO. Guarda `Supplier.cuentaDesde` (informativo). Muestra la cuenta antes de confirmar.
- **Ajustar diferencia** (ficha y Conciliación): ajuste suelto FIFO con motivo.
- Probado con un proveedor de prueba que reproduce Tiempo al Tiempo: queda en 13.663,70 exacto.
- **Un solo formulario de factura de proveedor**: "Cargar factura" (ficha) y "Nueva factura a pagar" (Proveedores)
  abren el formulario de la bandeja (control de duplicados por RUT/tipo/serie/número, PDF). Desde ahí, un enlace
  "Sin factura electrónica" abre el formulario simple de antes (proveedores del exterior, deudas sin CFE).
- **Un solo camino para pagarle a un proveedor**: en Nuevo movimiento se sacó la categoría "Pago proveedor" al crear,
  y si se elige un proveedor con deuda abierta aparece un aviso que lleva a "Registrar pago" en su ficha.

## Fase 2 — Menú y fusiones
- Menú de Finanzas en una fila con grupos rotulados: **Inicio** · *Ventas*: Cobros, Facturación · *Compras*: Facturas,
  Proveedores, Instaladores, Costos fijos · *Bancos*: Banco, Tarjetas, Movimientos, Cuentas · *Informes*: Flujo,
  Resultados, Cierre, Historial. Entrada por defecto: Inicio.
- **Inicio** = Posición (sacada de Flujo y de Resultados, donde estaba repetida) + **Por conciliar** + Pendientes.
  `/finanzas/pendientes` redirige a Inicio.
- **Proveedores** suma arriba "lo que se debe por vencimiento" (lo que era Cuentas por pagar);
  `/finanzas/cuentas-por-pagar` redirige a Proveedores.
- **Facturas** suma arriba la bandeja de facturas recibidas (por revisar), y abajo el registro.
- El cuadro "Falta cargar" del banco salió de Movimientos y está en el Inicio.

## Fase 3 — Banco
- Pantalla **Banco**: registro de todo lo leído del banco con su estado (Confirmada · Coincide · Falta cargar · No va ·
  Antes de comparar) y su pareja en Voltia PM; filtros por cuenta, fechas y estado; tarjetas por cuenta con saldo del
  banco, última lectura, cuántos tienen pareja y cuántos faltan. Acciones: Confirmar, Soltar, Cargar, No va, Volver a
  comparar.
- **Pareja confirmada guardada**: `BankMovement.movementId` / `paymentId` (únicos) + `vinculadoAt`/`vinculadoPorId`.
  El emparejador respeta las confirmadas y solo propone para el resto; un movimiento cargado después no se la "roba"
  (probado). Desempate estable por id. Endpoints `POST /finance/banco/movimientos/:id/vincular` y `/desvincular`
  (EDIT, auditados).
- **Llave del banco con texto normalizado** (mayúsculas, sin acentos ni espacios de más) para no duplicar si cambia un
  espacio entre lecturas.
- **Conciliación mensual de cuenta**: si hay diferencia con el banco, el motivo es obligatorio (servidor y pantalla).
  El mecanismo (reiniciar el saldo desde esa fecha + registro en `AccountReconciliation`) no se cambió.
- **BBVA**: probado el 21-oct. bbva.com.uy y bbvanet.bbva.com.uy bloquean el navegador automático desde la VPS (403);
  no se intentó evadir. Net Cash no descarga el detalle. Decisión: robot en la Mac de Nicolás con su Chrome y su
  sesión, que él lanza; se arma con él presente. Claves guardadas en `~/.config/voltia-banco/bbva-empresa.env`.
- El robot de BROU sigue como lo dejó la otra sesión (llega a la tabla, falta leerla y mandarla). No se tocó: correrlo
  contra el banco sin Nicolás presente arriesga bloquear al operador.

## Fase 4 — Las tres puntas
- **Por conciliar** (Inicio), `GET /finance/por-conciliar` (VIEW, `services/finance/por-conciliar.service.ts`):
  1. Lo del banco sin cargar (con Cargar / No va).
  2. **Lo cargado en Voltia PM que el banco no muestra** (pagado o cobrado desde una cuenta con banco, hace más de 3
     días, sin pareja) — la tercera punta, nueva.
  3. Facturas por revisar (total, de RUT sin proveedor, con más de una semana).
  4. **Posibles duplicados**: dos gastos del mismo proveedor, moneda y monto a ±7 días (si los dos tienen número de
     factura distinto, no).
- **Neto e IVA de las compras**: `FinanceMovement.montoNeto` / `montoIva`, que se copian de la factura electrónica al
  confirmarla (migración con backfill de las ya confirmadas). La carga a mano calcula el neto si se escribe el IVA.
- **Notas de crédito recibidas**: "Descontar de la deuda" en la bandeja crea un ajuste FIFO en la moneda de la nota
  (`FacturaRecibida.ajusteId`). Si la nota es mayor que la deuda, no deja (queda por revisar con el aviso).
- **Cobrado vs facturado**: en Facturación, si una obra cobró en dólares más de lo facturado por Biller (facturas −
  notas de crédito), aparece el aviso "hay cobro sin factura". Solo cuando la factura salió por Biller.
- Probado contra Biller productivo (solo lectura): **Biller no da la forma de pago** (contado/crédito) de las
  recibidas, ni en la lista ni en el detalle. Sí da los **renglones** (concepto, cantidad, precio) — sirve para la base
  de costos de la segunda etapa.

## Fase 5 — Cierre de mes
- Modelo `CierreMes` (anio, mes, foto, checklist, nota, reapertura con motivo). Pantalla **Cierre**.
- **Fecha de cierre** = último día del mes cerrado más reciente sin reabrir. `assertFechaAbierta` frena crear, editar
  y borrar movimientos y pagos, ajustes y "Arrancar cuenta" con fecha en un mes cerrado (`MES_CERRADO`). No frena lo
  que crean otros procesos automáticos (confirmar facturas recibidas, comisiones, cobros de ES, pagos a instaladores).
- **Lista de control** calculada sola (banco cargado, lo cargado aparece en el banco, facturas del mes revisadas,
  costos fijos pagados, obras que llevan factura facturadas) + 4 tildes manuales (estados de cuenta de proveedores,
  tarjetas rendidas, descuentos a empleados y cuenta del socio, revisión del dueño). Con algo sin resolver se puede
  cerrar igual escribiendo por qué.
- **Foto** al cerrar: caja por cuenta, posición y resultado del mes.
- **Archivo para la contadora** (Excel): hojas Compras (libro de compras con neto/IVA, NC en negativo), Ventas (lo
  emitido por Biller), Ajustes (con motivo y quién), Movimientos del mes.
- Reabrir un mes reabre también los posteriores; queda auditado.
- Permiso: **FINANZAS:COMPLETE** (nuevo en el catálogo). Script `server/scripts/seed-cierre-mes-permiso.ts` lo da a
  ADMIN y FINANZAS (corrido en dev; falta en prod).

## Fase 6 — Facturas de cuenta corriente que entran solas
- `Supplier.cuentaCorriente` (casilla en el formulario del proveedor).
- `cargarSolasCuentaCorriente()`: después de cada sincronización con Biller (job y botón), las facturas por revisar
  de proveedores de cuenta corriente pasan solas a deuda, salvo: notas de crédito, total cero, o un gasto del mismo
  proveedor/moneda con el mismo número o mismo monto a ±7 días sin factura vinculada (quedan por revisar).
  Quedan marcadas `cargadaSola` ("entró sola") para la revisión semanal. Actor: el primer ADMIN.
- **Sincronización con Biller cada 30 minutos, todo el día** (`CRON_BILLER_RECIBIDOS` default `*/30 * * * *`; antes
  cada hora de 8 a 20).

## Fase 7 — Tarjetas, cuenta del socio y adelantos
- Una **tarjeta es una cuenta** (`Account` tipo TARJETA, ya existía). Gastos = movimientos de esa cuenta; pago =
  transferencia banco → tarjeta (ya existía). Saldo en cero después del pago = cierra.
- `TarjetaTitular` (titular o adicional) con **regla** VOLTIA / PERSONAL / MIXTA y a dónde va lo personal
  (CUENTA_SOCIO o ADELANTO_PERSONAL).
- Categorías nuevas **CUENTA_SOCIO** (gasto personal del socio pagado por Voltia; como ingreso = devolución) y
  **ADELANTO_PERSONAL** (gasto personal autorizado de un empleado, a descontar del sueldo; `descontadoAt`,
  `personalAutorizadoPor`). **No entran al resultado.**
- Pantalla **Tarjetas**: elegir tarjeta y mes; quién usa la tarjeta (agregar titulares/adicionales con su regla);
  totales (de Voltia, personal del socio, a descontar, pagado, saldo/cierra); tabla de gastos con "quién" y "Es
  personal" / "Es de Voltia" (en una tarjeta de la empresa pide quién autorizó); cuenta del socio; adelantos a
  descontar con "Descontado".
- Endpoints `routes/tarjetas.routes.ts`: `GET /finance/tarjetas`, `POST /finance/tarjetas/:accountId/titulares`,
  `PATCH /finance/tarjetas/titulares/:id`, `GET /finance/tarjetas/:accountId/resumen`, `PATCH
  /finance/tarjetas/movimientos/:id`, `GET /finance/personales`, `POST /finance/personales/:id/descontado`.
- **Arreglo que salió de acá**: las **transferencias entre cuentas** entraban al estado de resultados de los dos lados
  (la entrada como ingreso, la salida como egreso). El neto daba igual, pero inflaba ingresos y egresos. Ahora
  TRANSFERENCIA se excluye de los 3 cálculos del resultado. **Cambia los totales de ingresos y egresos de meses con
  transferencias en producción (el resultado neto no cambia).**

## Migraciones nuevas (todas aditivas)
`finanzas_ajuste_arranque`, `banco_vinculo_confirmado`, `compras_neto_iva_nc` (con backfill de neto/IVA),
`cierre_mes`, `proveedor_cuenta_corriente`, `categorias_personales` (solo valores de enum, va sola),
`tarjetas_titulares`, `personal_autorizado_por`. Más las de la otra sesión: `lector_banco_movimientos`.

## Para el deploy
1. `./deploy.sh` (migraciones).
2. `npx tsx scripts/seed-cierre-mes-permiso.ts` y reiniciar el server.
3. `BANCO_LECTOR_TOKEN` en el `.env` de prod (de la otra sesión) y `numeroCuentaBanco` en BROU Pesos
   (`110875272-00001`) y BROU Dólares (`110875272-00002`) desde Admin → Cuentas.

## Datos de prueba que quedaron en la base de desarrollo (para revisar las pantallas)
Proveedor "PRUEBA Arranque TAT", cuenta "PRUEBA Tarjeta BBVA" con titulares "PRUEBA …", movimientos "PRUEBA …",
lecturas del banco "PRUEBA …", facturas recibidas `test-cc-*` y NC A-999/A-1000. Se borran cuando Nicolás termine
de revisar.
