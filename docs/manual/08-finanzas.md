# 08 · Finanzas

> **Capítulo parcial.** Están escritas las secciones de abajo. Lo que todavía
> falta está al final, en "Qué falta cubrir de este capítulo".

Cobros, facturación, deuda con proveedores, pagos, banco, tarjetas, flujo de
fondos, resultados y cierre de mes. Las secciones siguen el orden del menú.

---

## Menú de Finanzas

### Para qué existe

Finanzas creció pestaña por pestaña hasta tener pantallas repetidas (la
posición arriba de dos informes, "cuentas por pagar" separada de proveedores,
el banco dentro de Movimientos). El 21-oct-2026 se reordenó por **qué se está
haciendo**: vender, comprar, mover plata, mirar números.

### Cómo se usa

Menú lateral a la izquierda (`FinanceLayout.tsx` → `GRUPOS`): cada grupo con
su título y sus pantallas, con un ícono cada una; el contenido va a la derecha.
Junto a Inicio, el total de "Para hacer hoy" (`GET /finance/para-hacer-hoy/total`).
En el celular (menos de `md`) el menú es un `<select>` con `optgroup` por grupo.
Cambió el 22-oct-2026: la fila única de pestañas con separadores quedaba
entreverada.

| Grupo | Pestañas (ruta bajo `/finanzas/`) |
|---|---|
| — | **Inicio** (`inicio`, entrada por defecto) |
| Ventas | Cobros (`cobros`), Facturación (`facturacion`) |
| Compras | Facturas (`facturas-proveedores`), Proveedores (`proveedores`), Instaladores (`instaladores`), Costos fijos (`costos-fijos`), Comisiones (`comisiones`) |
| Bancos | Banco (`banco`), Tarjetas (`tarjetas`), Movimientos (`movimientos`), Cuentas (`cuentas`) |
| Informes | Flujo (`flujo`), Resultados (`resultados`), Cierre (`cierre`), Historial (`historial`) |

Las fichas (`/finanzas/proveedores/:id`, `/finanzas/cobros/:id`) viven fuera
del layout de pestañas. Todo el layout pide `FINANZAS:VIEW`
(`<PermissionRoute>` en `App.tsx`). **Comisiones** es la misma pantalla que
`/comisiones` del menú general (`ComisionesAsesor` con `enFinanzas`, que saca el
margen y baja el título); además pide `COMISIONES:VIEW`, que es lo que piden sus
endpoints.

### Reglas y decisiones

- **Redirecciones que quedan** (en `App.tsx`): `/finanzas` → `inicio`;
  `/finanzas/pendientes` → `inicio` (Pendientes vive dentro del Inicio);
  `/finanzas/cuentas-por-pagar` → `proveedores` (el resumen de lo que se debe
  está arriba de Proveedores).
- **Pantallas viejas borradas** el 21-oct-2026 (solo se enlazaban entre ellas):
  `Finance.tsx` (`/finanzas-legacy`), `FinanceMovements.tsx`
  (`/finanzas/movimientos-legacy`), `FinanceAPagar.tsx` (`/finanzas/a-pagar`),
  `FinancePayments.tsx` (`/finanzas/pagos`), `FinanceIncomeStatement.tsx`
  (`/finanzas/resultado`), `FinanceReports.tsx` (`/finanzas/reportes`) y la
  ruta `/finanzas/proveedores-legacy`. Esas URLs ya no existen (no redirigen).
  Las rutas de backend que usaban algunas siguen vivas (ver "Estado de
  resultados", casos borde).

---

## Inicio y "Por conciliar"

### Para qué existe

Una sola pantalla con **lo urgente**: cómo está parada la empresa (posición),
**todo lo que falta que se encuentre** (por conciliar) y los pendientes.
Reemplaza al cuadro "Falta cargar" que estaba en Movimientos y a la pestaña
Pendientes.

### Cómo se usa

`FinanceInicioTab.tsx` apila cuatro bloques: `ParaHacerHoy`,
`PosicionFinanciera`, `PorConciliar` y `FinancePendientesTab` (la pantalla de
pendientes de antes, montada adentro).

**Para hacer hoy** (`components/finance/ParaHacerHoy.tsx`,
`services/finance/para-hacer-hoy.service.ts` → `paraHacerHoy()`,
`GET /finance/para-hacer-hoy`, FINANZAS:VIEW): una lista con todo lo pendiente
de todas las pantallas del módulo, cada renglón con la cantidad y el enlace a
donde se resuelve. Se calcula al pedirla: lo resuelto desaparece solo, no se
tilda nada. Gravedad: **VENCIDO** (facturas por revisar con más de una semana,
deuda vencida con proveedores, costos fijos vencidos sin pagar, cobros vencidos
sin cobrar —con fecha vencida, o cuotas del plan con su momento cumplido hace
más de 10 días; sin proyectos archivados ni prospectos—, CFE emitidos rechazados
o dudosos de los últimos 30 días, el mes
anterior sin cerrar desde el día 10), **HOY** (clientes listos para cobrar una
cuota del plan, facturas por revisar, deuda que
vence en 7 días, lo del banco sin cargar, lo cargado que el banco no muestra,
posibles duplicados, gastos de tarjeta sin titular o sin decidir, obras que
llevan factura con cobros y sin facturar) y **AVISO** (facturas que entraron
solas en los últimos 7 días, proveedores pasados del límite, pagos a
instaladores y comisiones pendientes, proveedores de cuenta corriente sin
conciliar hace más de 30 días, cuentas que el lector del banco no leyó en 30
horas, adelantos por descontar). Lo vencido va primero.
Cada ítem lleva a la pantalla donde se resuelve (comisiones → `comisiones`,
costos fijos vencidos → `costos-fijos`, cobros vencidos y listos para cobrar →
`cobros?filtro=listos`). Los que se resuelven en el mismo Inicio
(movimientos que el banco no muestra, posibles duplicados) llevan a
`inicio#por-conciliar` y `ParaHacerHoy.tsx` baja hasta ese cuadro: un link al
Inicio sin ancla no hacía nada visible, porque ya se estaba ahí.

- **Número en el menú:** `Topbar.tsx` → `FinanzasNavLink` pide
  `GET /finance/para-hacer-hoy/total` (cuenta vencidos + hoy, no los avisos);
  rojo si hay algo vencido. Se refresca cada 5 minutos.
- **Mail diario:** `digest/daily-digest.job.ts` suma la sección "Finanzas: para
  hacer hoy" (`emailDailyDigest` → `finanzasHoy`). Rol FINANZAS: vencido + hoy;
  GERENTE_FINANZAS y ADMIN: solo lo vencido. Sale aunque no haya otras
  novedades. Los roles están fijos en el job (`ROLES_FINANZAS_COMPLETO`,
  `ROLES_FINANZAS_VENCIDO`), no en la matriz del resumen.
- **Limitación:** "entraron solas esta semana" no se puede marcar como
  revisadas: el aviso dura 7 días desde que entraron.

**Por conciliar** (`components/finance/PorConciliar.tsx`) muestra, en orden:

1. **Lo del banco sin cargar** (`FaltaCargarBanco.tsx`), con **Cargar** (abre
   Nuevo movimiento en Movimientos con tipo, cuenta, fecha, monto y
   descripción precargados vía query string `?new=1&…`) y **No va** (con
   motivo).
2. **Lo cargado en Voltia PM que el banco no muestra**: lo pagado o cobrado
   desde una cuenta con banco, de hace más de 3 días, sin pareja en lo leído.
3. **Facturas de proveedores por revisar**: total, cuántas son de un RUT sin
   proveedor y cuántas tienen más de una semana. Enlaza a Compras → Facturas.
4. **Posibles duplicados**: dos gastos del mismo proveedor, misma moneda y
   mismo monto a ±7 días.

### Cómo funciona

`GET /finance/por-conciliar` (en `conciliacion-banco.routes.ts`) →
`services/finance/por-conciliar.service.ts` → `porConciliar()`. **Se calcula
al mirar**: no hay nada guardado, así que lo que se carga o confirma se refleja
en la próxima consulta.

- **Banco → Voltia PM**: `pendientesPorCuenta()` de
  `bank-reconciliation.service.ts`; se devuelve cuántos faltan por cuenta y
  la última lectura.
- **Voltia PM → banco** (la "tercera punta"): `sinBancoPorCuenta()`. Solo
  cuentas con `numeroCuentaBanco` **y al menos una lectura** (`bancoLeidoEn`):
  sin lectura no hay contra qué comparar. Del lado de Voltia PM va lo mismo que
  mueve el saldo de la cuenta (ver "Banco"). Se deja afuera lo de los últimos
  `DIAS_TOLERANCIA` (3) días, porque el banco acredita después, y lo anterior a
  `CONCILIAR_DESDE`.
- **Facturas por revisar**: `FacturaRecibida` en `PENDIENTE`; "atrasada" =
  más de 7 días desde la emisión.
- **Duplicados**: `posiblesDuplicados()` mira GASTO con proveedor de los
  últimos 120 días, sin `PREVISTO`, agrupa por proveedor + moneda + monto
  exacto y empareja los que están a ≤ 7 días. Si los dos tienen
  `invoiceNumber` y son distintos, no es duplicado.

### Permisos

`GET /finance/por-conciliar` → `FINANZAS:VIEW`. Cargar y "No va" usan las
rutas de Movimientos (`FINANZAS:CREATE`) y de Banco (`FINANZAS:EDIT`).

### Casos borde

- Los duplicados **no se pueden descartar**: un par que no es duplicado sigue
  apareciendo hasta que alguno de los dos cambie de monto, de fecha o reciba un
  número de factura distinto.
- La lista de duplicados se recalcula entera cada vez (pares n² por grupo);
  con el volumen de hoy no pesa, pero no tiene paginado.
- "Cargado en Voltia PM que el banco no muestra" es **solo una lista** (las
  primeras 15 y "y N más"), sin botones: se corrige desde Movimientos o se
  fija la pareja en Banco.
- Cada consulta de Por conciliar corre el emparejador **dos veces por cuenta**
  con banco (`pendientesPorCuenta()` y `sinBancoPorCuenta()` llaman cada una a
  `conciliarCuenta()`). Con dos o tres cuentas no se nota.

---

## Posición financiera (nos deben / debemos)

`services/finance/posicion.service.ts` → `getPosicionFinanciera()`, expuesta en
`GET /finance/posicion` (`FINANZAS:VIEW`, en `api.routes.ts`, que le suma la
caja con `computeAccountBalance()`). Se muestra con `PosicionFinanciera.tsx`
**solo en el Inicio** de Finanzas (hasta el 21-oct-2026 estaba repetida arriba
de Flujo y de Resultados; se sacó de ahí). Todo en USD, con `ultimoUsdToUyu()`.

- **Nos deben** = `saldoPendienteUSD` de `listarCobrosPorProyecto()`, el mismo
  número que la pantalla Cobros. La parte con fecha sale de los INGRESO PREVISTO
  no cobrados (sin Plan granizo, sin archivados ni prospectos), topeados al saldo
  de la obra; las cuotas atadas a un momento de la obra van por su fecha
  esperada (`fechaDeCobro()`, ver "Cobros a clientes") y sin ella a `SIN_FECHA`. Lo que la obra debe por encima de sus previstos va a `SIN_FECHA`
  (`obrasSinPlanCompleto` las cuenta).
- **Debemos** = cuatro partes:
  - proveedores (`getCuentasPorPagar()`, por vencimiento);
  - otros compromisos (GASTO COMPROMETIDO o A_PAGAR sin proveedor);
  - comisiones `PENDIENTE` (por `dueDate`);
  - pagos a instaladores PENDIENTE o PARCIAL (monto − entregas pagadas).

  Se descuenta el saldo a favor con proveedores (que no cuenta los ajustes:
  un ajuste siempre se aplica entero, nunca deja saldo a favor).
- **Neto** = nos deben − debemos; `netoConCaja` le suma la caja.
- Los costos fijos no entran: no son deuda hasta el mes.
- **Diferencia a propósito con el Flujo de fondos**: el flujo no proyecta
  comisiones, compromisos sin proveedor ni instaladores, y saltea los cobros
  vencidos. La posición los incluye.

---

## Cobros a clientes y el plan de pagos

### Para qué existe

Cada proyecto tiene una vista de **Cobros** que muestra, sobre el presupuesto,
cuánto se cobró y cuánto falta. El **plan de pagos** deja cargados los cobros
previstos (seña + cuotas). Las cuotas del plan de siempre **no tienen fecha**:
cada una está atada a un momento de la obra y queda **lista para cobrar** sola
cuando ese momento llega, así Finanzas sabe a quién cobrarle sin mirar el
calendario.

### Cómo se usa

- **Listado** (`FinanceCobros.tsx`): arriba, si hay clientes con una cuota
  lista, un aviso verde "N clientes están listos para cobrar una cuota · M con
  la cuota vencida" con **Ver solo esos**. Junto al estado de cobro, la
  etiqueta **Listo para cobrar** (verde) o **Cuota vencida** (roja), y esos
  clientes van arriba. Filtro por defecto **Por cobrar (sin los completos)**;
  además **Listos para cobrar**, **Todos, también los completos** y los estados
  de siempre. El filtro se recuerda por navegador (`finance-cobros-filters-v2`);
  `?filtro=listos` (el enlace de "Para hacer hoy") manda sobre lo recordado.
- Se entra al detalle de cobros de un proyecto (desde Finanzas → Cobros o desde
  la vista de Cobros del módulo Experiencia Solar). Las cuotas sin cobrar de un
  momento de la obra muestran el momento en la columna de fecha ("Previo a la
  obra") y la etiqueta **Lista para cobrar**, **Vencida** o **Previsto**
  (`components/finance/HitoCuota.tsx`). El resumen de WhatsApp pone el momento
  en lugar de la fecha.
- Con el botón de plan de pagos se abre un modal que **precarga una sugerencia**
  (seña + 3 cuotas) sobre el saldo pendiente, editable fila por fila
  (descripción, monto, %, **cuándo se cobra**: Al firmar, Previo a la obra, Obra
  finalizada, Habilitación finalizada o **En una fecha fija**, que pide la
  fecha). Al confirmar se crean los cobros previstos.
- Cada cobro se puede marcar pagado, editarle el monto o **eliminarlo** (papelera,
  con confirmación). Todo se refleja en Movimientos y en los totales.

### Cómo funciona

- El plan **no es una entidad aparte**: el plan de un proyecto = **todos sus
  cobros previstos vigentes** (`FinanceMovement` INGRESO / PROYECTO_ENTRADA /
  status PREVISTO / sourceType MANUAL / no borrados). No hace falta un marcador
  durable. Ver `planPagos.service.ts` (`getPlanPagos`, `createPlanPagos`).
- Las cuotas guardan su descripción con prefijo **`[PLAN] `** literal, que la UI
  **strippea al mostrar** (el usuario ve "Seña", no "[PLAN] Seña").
- Crear/editar el plan es **atómico**: soft-deletea todos los previstos vigentes
  del proyecto y crea el nuevo set en una transacción. Así "editar el plan"
  reconcilia sin duplicar. **No toca** los cobros ya cobrados (status != PREVISTO).
- Sugerencia por defecto (`buildDefaultPlan` en `PlanPagosModal.tsx`): **50/30/20**
  con **seña fija USD 500** sobre el saldo pendiente: "Seña", "Cuota 1 · previo a
  la obra", "Cuota 2 · obra finalizada" y "Cuota 3 · habilitación finalizada",
  cada una atada a su momento y sin fecha.
- **Cuotas atadas a un momento** (`FinanceMovement.hitoCobro`, enum `HitoCobro`;
  null = cuota con fecha fija). Se guardan con `dueDate` null; `fecha`, que es
  obligatoria en la tabla, queda la del día de creación y no significa nada
  hasta que se cobra (al marcarla pagada se reemplaza por la fecha del cobro).
  Cuándo queda lista se **calcula al pedirlo** con el estado del proyecto, nada
  se sincroniza (`services/finance/hitos-cobro.service.ts`: `hitosDeProyectos()`
  junta los momentos de varios proyectos en una tanda, `infoCuota()` calcula una
  cuota, `fechaDeCobro()` da la fecha para proyectar, `cuotasListasPorProyecto()`
  arma el "listo para cobrar" del listado y de "Para hacer hoy"):
  - `SENIA`: desde que se crea la cuota (`createdAt`).
  - `PREVIO_OBRA`: `DIAS_ANTES_OBRA` (10) antes del primer día de obra agendado
    (el `startDate` más chico de los `InstallationSegment` de la agenda no
    borrada). Si la obra se reagenda, se corre sola. Sin agenda, no tiene fecha.
  - `OBRA_FINALIZADA`: cuando la etapa `EJECUCION_OBRA` está COMPLETED
    (`actualEndDate`, o `updatedAt` si falta). No se usa
    `InstallationSchedule.actualWorkEnd`: nada lo escribe.
  - `HABILITACION`: `Project.postHabilitacionInicioEn`, que pone
    `marcarHabilitacionEnProyecto()` al finalizar todos los trámites UTE (el
    mismo momento del aviso "puede encender").
  - **Vence** `DIAS_PARA_VENCER` (10) días después de quedar lista; para la
    cuota 1 coincide con el primer día de obra.
- **Fecha para proyectar** (`fechaDeCobro()`): la de siempre para las de fecha
  fija; para las de un momento, el vencimiento si ya está lista, y si no una
  estimación (cuota 2 = último día de obra agendado; cuota 3 = último día + 30;
  la cuota 1 y la seña no se estiman). Una fecha movida a mano en el flujo
  (`expectedDate`) manda sobre la estimación. Sin estimación = sin fecha.
- Dónde se usa esa fecha:
  - **Flujo de fondos** (`GET /finance/cashflow`): las cuotas de un momento van
    en su fecha esperada; si ya está lista o vencida, hoy (es plata cobrable
    ya); sin fecha, no se proyectan y vuelven aparte en `cobrosSinFecha`, que la
    pantalla muestra en el cuadro **Cobros sin fecha**.
  - **Posición financiera**: tramos por esa fecha; sin fecha → `SIN_FECHA`.
  - **Pendientes** (`getPendingItemsCore()`): una cuota de un momento entra
    recién cuando está lista, con su vencimiento como fecha.
  - El aviso de "fecha pasada sin pagar" al guardar un movimiento
    (`detectPastDateNotPaidWarning()`) no aplica a estas cuotas, y volver una a
    PREVISTO no le pone `dueDate`.
  - `GET /finance/cobros-by-project/:projectId` devuelve `fecha` null y `hito`
    (`serializarInfo()`) en las cuotas sin cobrar de un momento; van al final,
    en el orden de la obra. La lista devuelve `listoParaCobrar` por proyecto.
  - El conector (cap. 13) las muestra con el momento que esperan.
- La suma de las cuotas debe coincidir con el **saldo pendiente** (presupuesto −
  ya cobrado) con tolerancia de **USD 1** (`SUM_TOLERANCE_USD`), no contra el
  presupuesto bruto — así el plan se puede reabrir después de cobrar algo.

### Permisos

- Ver/registrar/editar/eliminar cobros: `authorizeAny` de **FINANZAS** o
  **EXPERIENCIA_CLIENTES** (VIEW / CREATE / EDIT). Es lo que deja a Experiencia
  Solar operar cobros sin ver el resto de Finanzas.
- Crear/editar el plan de pagos (`/finance/plan-pagos`): **FINANZAS:EDIT**.
- Las rutas de escritura de cobros solo tocan ingresos de proyecto (INGRESO +
  PROYECTO_ENTRADA); sobre cualquier otro movimiento responden `NOT_A_COBRO`.

### Reglas y decisiones

- **La primera cuota puede ser igual al saldo pendiente** (un pago único por el
  total es un plan válido). Solo se rechaza si lo **supera** (`SENIA_GTE_SALDO`).
  Antes bloqueaba con "mayor o igual", lo que impedía el pago único.
- El plan admite **una sola cuota**.
- **"Listo para cobrar" es solo para las cuotas del plan atadas a un momento.**
  Los clientes sin plan (por ejemplo, financiación bancaria) o con otro acuerdo
  cargado en fechas fijas siguen como antes: vencen por su fecha.
- Decidido por Gerencia el 22-oct-2026: las cuotas se cobran por momento de la
  obra porque así lo dice el contrato (la cuota 1 entre 10 y 15 días antes de
  la obra, la 2 al terminarla, la 3 con la habilitación); una fecha inventada
  al armar el plan no servía para nada.
- Si el proyecto no tiene presupuesto, no se puede armar plan (`BUDGET_REQUIRED`).
- Si no queda saldo pendiente, no hay nada que planificar (`SALDO_PENDIENTE_INVALID`).
- **El plan es obligatorio para salir del onboarding** si la modalidad es pago
  directo (ver cap. 03, "El Onboarding no cierra sin saber cómo paga el
  cliente"). Para esa regla, un proyecto cuyo cobrado en USD ya cubre el 99 % del
  presupuesto cuenta como "con plan" aunque no le queden previstos.

### Las compras de materiales no se proyectan (desde oct-2026)

Hasta el 9-oct-2026 la lista de materiales del proyecto tenía un botón
**Generar previstos** que le ponía una fecha de compra a cada `ProjectMaterial`
(`expectedDate`), y esos renglones aparecían como "Material proyectado" en
`/finance/pending` (`projectMaterialGroups`) y en `/finance/cashflow` (eventos
`PROJECT_MATERIAL`). Se sacó todo por decisión de Gerencia: la deuda con un
proveedor existe desde su factura (`FinanceMovement` A_PAGAR con `dueDate`), no
desde la lista de materiales.

- Se borraron los endpoints `generate-previsto`, `regenerate-previsto` y
  `regenerate-impact` y el modal del cliente.
- `getPendingItemsCore()` devuelve `projectMaterialGroups: []` por
  compatibilidad; el cashflow ya no consulta `ProjectMaterial`.
- **Los `expectedDate` que ya estaban cargados quedan en la base**, pero nada
  los lee. Las rutas que editan o quitan la fecha de un evento
  `PROJECT_MATERIAL` siguen existiendo y no tienen quién las llame.
- El **costo previsto de la ficha de costos** del proyecto
  (`/projects/:id/cost-summary`) **no** se tocó: es la estimación del margen, no
  plata que sale.

### Casos borde

- **Los cobros del Plan de Protección contra Granizo no son cobros de la obra.**
  La categoría `SEGURO_GRANIZO` se excluye del cobrado y de los previstos de
  `listarCobrosPorProyecto()` y de `/finance/cobros-by-project/:projectId`: la
  anualidad del plan no salda el presupuesto. Se gestionan desde Experiencia
  Solar → Plan granizo (cap. 09), y las rutas de cobros de esta pantalla no los
  pueden tocar (`NOT_A_COBRO`).
- **Cobros excluye proyectos ARCHIVADOS y PROSPECTOS.** `listarCobrosPorProyecto()`
  filtra siempre esos estados: una venta caída (archivada) o un prospecto no es
  algo a cobrar, así que no aparece en el listado ni suma al total pendiente.
  Archivar un proyecto es la forma de sacarlo de Cobros. Todo lo demás (ACTIVE,
  PAUSED, COMPLETED) aparece siempre. **No hay filtro "solo activos"**: existió
  hasta el 9-oct-2026 en Finanzas → Cobros y en Experiencia Solar → Cobros, y
  venía prendido, así que dejaba afuera a los clientes con obra habilitada
  (COMPLETED) aunque debieran plata. El único filtro es el de estado de cobro.
  (El detalle por `:projectId` sí abre cualquier proyecto, incluso archivado, si
  se entra directo.)
- **"Cobrado" y "saldo" de la lista de Cobros no usan el mismo criterio que el
  plan.** La lista (`services/finance/cobros.service.ts` →
  `listarCobrosPorProyecto()`, compartida con el conector) cuenta todo ingreso
  marcado como cobrado, en cualquier moneda y categoría; el plan cuenta solo
  cobros PAGADO en dólares. Por eso la suma de las cuotas vencidas de todos los
  planes puede no coincidir exacto con el saldo de las obras con plan.
- Seña > 50% del saldo: **warning** (no bloquea), para confirmar que es intencional.
- Editar el plan cuando ya hubo cobros parciales: la suma se valida contra el
  saldo pendiente actual, no contra el presupuesto original.
- **Planes armados antes del 22-oct-2026**: `scripts/backfill-hitos-cobro.ts`
  (simulación por defecto, `--apply`) ata las cuotas PREVISTAS con los nombres
  del plan viejo ("Seña", "Pago previo…", "Pago obra terminada/finalizada…",
  "Pago obra habilitada…") a su momento, las renombra y les saca la fecha. Las
  de otro nombre ("Cuota 2", "Saldo", acuerdos especiales) quedan con su fecha
  y el script las lista para revisarlas a mano.
- Una cuota con el momento cumplido hace tiempo (por ejemplo, una seña de un
  plan viejo nunca cobrada) aparece directamente **vencida**.
- La cuota 2 depende de que se complete la etapa de ejecución de obra en Voltia
  PM: si la obra terminó y nadie cerró la etapa, la cuota no queda lista.

---

## Facturación al cliente (emisión por Biller)

### Para qué existe

Emitir la factura de cada obra al cliente desde Voltia PM, como comprobante
fiscal electrónico (CFE) ante DGI, sin entrar a Biller. Biller es solo el motor
fiscal: firma, numera y manda a DGI. Qué lleva factura, su estado y el archivo
viven en Voltia PM.

### Cómo se usa

**Dónde:** Finanzas → Ventas → Facturación. Lista los proyectos que **llevan
factura** (se decide al crear el proyecto, ver «Qué se le factura» abajo).

Columnas: cliente, vendedor con la fecha de venta debajo, **Presupuesto (con
IVA)** —lo que paga el cliente—, **A facturar (con IVA)** —con el monto sin IVA y
«Normal» u «Otro monto» debajo, y un lápiz para corregirlo; «A definir» con el
botón **Definir** en los proyectos viejos—, **Facturado**, **Falta facturar**
(a facturar con IVA − facturado, nunca negativo), nota, estado y factura.

- **Emitir factura** (solo si Biller está habilitado, ver más abajo): abre el
  borrador en dos pasos.
  1. **Datos**: primero, **¿cuánto se factura?** (monto sin IVA —lo que falta
     facturar de lo acordado al vender, con lo acordado y lo ya facturado
     escritos arriba— y porcentaje, 100 por defecto) y **¿a nombre de quién?** (el
     cliente del proyecto u otra persona o empresa; no viene elegido y el resto
     del formulario no aparece hasta contestarlo). Después: tipo (e-Ticket con
     cédula o e-Factura con RUT), documento, nombre o razón social, dirección,
     ciudad, departamento, fecha de emisión, forma de pago (contado / crédito
     con vencimiento), renglones con precio **sin IVA**, adenda y si Biller le
     manda el PDF al cliente. Arriba se muestra la nota de facturación del
     proyecto. Con un RUT, **Traer de DGI** completa razón social, domicilio
     fiscal y mail.
  2. **Confirmar**: muestra exactamente lo que se manda. Hay que tildar "Revisé
     los datos" para que se habilite **Emitir**.
- **Nota de crédito** (en una factura emitida por Biller): total (copia los
  renglones y anula la factura) o parcial (un renglón "Nota de crédito" por el
  monto sin IVA). El motivo es obligatorio.
- **Refrescar** (ícono): consulta el estado ante DGI en el momento.
- **Marcar emitida / Revertir**: para facturas hechas por fuera de Voltia PM.
  **Revertir** se bloquea si la factura se emitió por Biller
  (`FACTURA_EMITIDA_POR_BILLER`): eso se corrige con nota de crédito.
- **Adjuntar factura** (ícono de subir): para las hechas por fuera. Con Biller,
  el PDF oficial se guarda solo y reemplaza al adjunto manual.

### Cómo funciona

Código: `services/biller/cfe-emitidos.service.ts`, rutas en
`routes/facturacion-cliente.routes.ts`, job en `cfe-emitidos.job.ts`, pantalla
`FinanceFacturacionTab.tsx` + `components/finance/EmitirCfeModal.tsx`.

- **Modelo** `CfeEmitido` (`cfes_emitidos`): una fila por comprobante (factura
  101/111 o NC 102/112 con `referenciaId` a su factura). Guarda el borrador
  confirmado y el cuerpo exacto mandado (`payload.borrador` / `payload.cuerpo`),
  la respuesta, `billerId`, serie, número, hash, `estadoDgi` (texto de Biller)
  y el PDF (`pdfAttachmentId`).
- **Borrador** (`armarBorradorFactura()`): `ciCliente` de 12 dígitos (o
  `empresa` con un documento que no es cédula) → e-Factura con RUT; si no,
  e-Ticket con cédula. Nombre = `nombreCliente` o `clientName`; dirección =
  `calle` + `numCalle` o `clientAddress`; ciudad/departamento = `locationCity` /
  `locationProvince`; mail = `clientEmail`. Contado por defecto. Devuelve también
  `clienteProyecto` (para volver a esos datos si se cambia el receptor) y `base`.
- **Monto** (`armarBorradorFactura()` → `base`): lo que **falta facturar** de lo
  acordado = `montoAFacturar(p).sinIva` (ver «Qué se le factura») menos
  `netoFacturado()` (CFE vivos en USD, facturas menos notas de crédito, dividido
  1,22 porque el comprobante guarda el total con IVA), nunca negativo
  (`fuente: "A_FACTURAR"`). El borrador devuelve además `acordado`
  (`modo`, `sinIva`, `conIva`, `yaFacturadoSinIva`) para mostrarlo. Solo si el
  proyecto está **a definir**, como antes: `montoSinIvaCotizacion()` (última
  `ProposalV2Version` PUBLISHED del lead convertido,
  `calc.subtotalSinIva + calc.itemsAdicionalesTotalSinIva`) o, sin cotización,
  `budgetUsd / 1,22`, con el rótulo «falta definir cuánto se factura». El
  renglón = monto × porcentaje. `baseSinIva` y `porcentaje` se guardan en
  `CfeEmitido` como dato; lo que se emite son los renglones.
- **Lectura del monto en la ventana** (`EmitirCfeModal.tsx` → `aNumero()`):
  acepta «10.013,48» y «10013.48»; un punto seguido de 1 o 2 decimales es la
  coma decimal. Hasta el 22-oct-2026 se borraba como separador de miles y un
  monto con decimales quedaba 100 veces más grande (no se emitió ninguna
  factura con el error).
- **Receptor**: `receptor` = `CLIENTE` o `TERCERO` en el borrador, guardado como
  `CfeEmitido.aNombreDeTercero`; en la lista se ve "A nombre de …" y el
  porcentaje si es menor a 100. `GET /finance/facturacion/dgi-rut?rut=` arma
  razón social, dirección, ciudad, departamento y mail desde
  `/v2/dgi/empresas/datos-entidad` (`datosRutDgi()`).
- **IVA**: los precios van **sin IVA** con `montos_brutos: 0` e indicador 3
  (tasa básica): Biller suma el 22 %. El total que se guarda lo calcula
  `totalesBorrador()` redondeando IVA por renglón, igual que Biller. La tasa de
  cambio no se manda: Biller toma la del cierre del día anterior a la emisión.
- **Nombre del receptor en Biller**: Biller guarda el cliente por documento la
  primera vez y **en las siguientes emisiones ignora el nombre que viene en el
  comprobante** (la dirección sí la toma). Visto en test el 14-oct-2026. Por eso
  `emitirCfe()` llama antes a `POST /v2/clientes/crear` con los datos del
  borrador (`actualizarClienteBiller()`), que sí actualiza el nombre guardado.
  Si esa llamada falla, no se emite (`BILLER_CLIENTE`). Ojo: `comprobantes/obtener`
  devuelve el cliente **como está hoy** en Biller, no lo que quedó impreso.
- **Validación** (`validarBorrador()`): e-Factura ↔ RUT de 12 dígitos, e-Ticket
  ↔ cédula con dígito verificador válido (`esCiUruguayaValida()`), crédito con
  vencimiento, emisión hasta dos meses a futuro. `POST /finance/facturacion/revisar`
  la corre sin tocar Biller.
- **Emisión sin duplicados** (`emitirCfe()`), porque Biller no tiene
  idempotency key:
  1. Se crea la fila en `EMITIENDO` con `numeroInterno = <código del
     proyecto>-<id de la fila>` (`@unique`).
  2. `POST /v3/comprobantes/emitir`. 201 → `ESPERANDO_DGI`.
  3. 422 "Número interno no puede estar repetido" o corte de red / 5xx → se
     busca por `numero_interno` (`/v2/comprobantes/obtener`); si está, se adopta;
     si no, `DUDOSO`. Otro 4xx → `ERROR` (no se emitió; se puede reintentar).
  4. Mientras un proyecto tenga un CFE `EMITIENDO` o `DUDOSO` no se deja emitir
     otro (`CFE_EN_CURSO`).
  5. Todo pasa por una cola en memoria de un pedido a la vez con 1,1 s entre
     pedidos (Biller admite 1 por segundo al emitir).
- **Seguimiento** (job cada 5 minutos, `CRON_BILLER_CFE`, solo si hay
  `BILLER_TOKEN`): consulta `/v3/comprobantes/detalle` de los `ESPERANDO_DGI` de
  los últimos 30 días, re-busca los `DUDOSO` (y los `EMITIENDO` de más de 5
  minutos, que son pedidos cortados por un reinicio). Un dudoso que no aparece en
  30 minutos pasa a `ERROR`. **El job nunca emite.**
- **Estados DGI** (`actualizarEstadoDgi()`): "Aceptado DGI" → `ACEPTADO`;
  "Envío no corresponde" → `ACEPTADO` (e-Ticket chico que va en el reporte
  diario de DGI, no uno por uno; visto en test el 14-oct-2026); texto con
  "rechaz" → `RECHAZADO`; cualquier otro → sigue `ESPERANDO_DGI` y se loguea.
- **Efectos en el proyecto**: factura emitida → `facturaEmitida = true`. NC que
  completa el total de la factura, o factura rechazada → `facturaEmitida =
  false` (vuelve a pendientes y se puede emitir otra).
- **PDF**: al quedar aceptado (o al pedirlo con `GET /finance/cfe/:id/pdf`) se
  baja de Biller una sola vez y se guarda como `FileAttachment` con `toolSource`
  `factura-cliente` (reemplaza al adjunto manual) o `nota-credito-cliente`.
- **Auditoría**: cada emisión y cada rechazo crean una entrada
  `AuditEntityType.cfe_emitido` con el número, el total y el cliente.

### Configuración

- `BILLER_TOKEN`, `BILLER_URL` y `BILLER_SUCURSAL` (ver `docs/DEPLOY.md`).
  Sin sucursal no se emite.
- **Contra el Biller productivo solo emite el servidor de producción**
  (`NODE_ENV=production`): un desarrollo con el token real no puede emitir
  (`estadoEmision()`).
- **En test nunca se manda el mail al cliente**, aunque se tilde: la base de
  desarrollo tiene mails reales. La pantalla avisa que es ambiente de prueba.

### Permisos

| Acción | Endpoint | Permiso |
|---|---|---|
| Listado (incluye `cfes`, `aFacturar` y `emision`) | `GET /finance/facturacion` | `FINANZAS:VIEW` |
| Definir o corregir qué se factura (`facturacion`), nota, marcar emitida | `PATCH /finance/facturacion/:projectId` | `FINANZAS:EDIT` |
| CFEs del proyecto | `GET /finance/facturacion/:projectId/cfes` | `FINANZAS:VIEW` |
| Borrador de factura | `GET /finance/facturacion/:projectId/borrador` | `FINANZAS:EDIT` |
| Datos de un RUT en DGI | `GET /finance/facturacion/dgi-rut?rut=` | `FINANZAS:EDIT` |
| Revisar borrador (sin emitir) | `POST /finance/facturacion/revisar` | `FINANZAS:EDIT` |
| Emitir factura (`confirmado: true`) | `POST /finance/facturacion/:projectId/emitir` | `FINANZAS:EDIT` |
| Borrador de NC | `GET /finance/cfe/:id/borrador-nota-credito[?monto=]` | `FINANZAS:EDIT` |
| Emitir NC (`confirmado: true`) | `POST /finance/cfe/:id/nota-credito` | `FINANZAS:EDIT` |
| Consultar estado DGI | `POST /finance/cfe/:id/actualizar` | `FINANZAS:VIEW` |
| PDF | `GET /finance/cfe/:id/pdf[?descargar=true]` | `FINANZAS:VIEW` |
| Adjuntar factura manual | `POST /finance/facturacion/:projectId/factura` | `FINANZAS:EDIT` |
| Ver factura manual | `GET /finance/facturacion/:projectId/factura` | `FINANZAS:VIEW` |

Sin guards por rol: todo sale de la matriz `FINANZAS`. El adjunto manual va por
Finanzas y no por `/files/:id/download` porque ese pide permiso de Operaciones.

### Reglas y decisiones

- **Nada fiscal se emite sin confirmación** de una persona (decidido el
  30-sep-2026): el endpoint exige `confirmado: true` y ningún job emite.
- **Una factura por proyecto** (decidido el 14-oct-2026). Para facturar de nuevo
  hay que anular la anterior con una NC total.
- **Lo que se factura lo define el asesor al ganar el lead**, en dólares sin IVA
  (decidido el 22-oct-2026). Reemplaza a la regla del 14-oct-2026 («un
  porcentaje del monto sin IVA de la cotización»): la cotización no tiene los
  descuentos de último momento y no coincidía con el presupuesto. La cotización
  queda solo como respaldo para los proyectos «a definir».
- **El receptor se pregunta siempre**: el cliente del proyecto puede querer la
  factura a nombre de su empresa u otra persona.
- **Contado por defecto**: los cobros todavía no emiten recibo. Si un recibo
  (CFE de cobranza) o un pago registrado en Biller es lo que corresponde está
  pendiente con el contador; hasta entonces, los cobros siguen como antes y no
  tocan Biller.
- NC siempre por `/v3/comprobantes/emitir` con `referencias: [billerId]`, no por
  `/v2/comprobantes/anular` (que falla si el comprobante tiene otros asociados).
  La suma de las NC no puede pasar el total de la factura (`NC_SUPERA`).

### Casos borde

- **e-Ticket de más de 5.000 UI exige receptor**: por eso el e-Ticket siempre
  lleva cédula y dirección.
- **Nombre de persona**: va como `nombre_fantasia`, que Biller corta a 30
  caracteres. Razón social de RUT: hasta 70.
- **Nombre del rechazo de DGI no confirmado**: solo cuenta como rechazo lo que
  dice "rechaz". Un estado desconocido queda esperando con el texto de Biller
  (se ve al pasar el mouse sobre el estado).
- **La cola es en memoria**: con un solo servidor alcanza. Un reinicio en medio
  de una emisión deja la fila en `EMITIENDO`, que el job trata como dudosa a los
  5 minutos.
- Si se pide el PDF antes de que DGI acepte, se guarda igual (ya trae CAE y
  código de seguridad).

### Qué se le factura (definido al ganar el lead)

**Para qué existe.** El presupuesto es lo que paga el cliente, con IVA; lo que
se le factura puede ser otra cosa (un descuento, una parte que financia el
banco, una parte a nombre de su empresa). Antes se adivinaba con una nota libre
y el monto sin IVA de la cotización.

**Cómo se usa.** El bloque **«¿Qué se le factura?»**
(`components/finance/FacturacionCampos.tsx`) aparece en tres lugares: al crear
el proyecto desde el lead ganado (`LeadToProjectModal.tsx`, obligatorio), al
editar el proyecto (`ProjectDetail.tsx`, en lugar de «Lleva factura» + nota; si
no se toca, no se manda) y en Facturación con el lápiz o **Definir**.

- Casilla **«Facturación normal»**: se factura todo el presupuesto. Nota
  opcional (RUT, razón social).
- Sin tildar: **Sin IVA (USD)** (obligatorio), **Con IVA (USD)** y **% del
  presupuesto**; al escribir en uno se calculan los otros dos (IVA 22 %; el
  porcentaje es sobre el presupuesto, que es con IVA). **Motivo** obligatorio.
  Monto 0 = no lleva factura.

**Cómo funciona.** `services/finance/a-facturar.service.ts`:

- Campos en `Project`: `facturacionNormal` (`true` normal, `false` otro monto,
  `null` a definir) y `facturarSinIvaUsd`. `datosFacturacion()` deriva
  `llevaFactura` (normal, o monto > 0) y `facturaNota` (el motivo o la nota).
- `facturacionSchema` (zod) valida: sin normal, monto y motivo de al menos 3
  letras. Lo aceptan `POST /leads/:id/convert` (**obligatorio**: sin él responde
  `MISSING_PROJECT_FIELDS` «qué se le factura al cliente»), `POST /projects`,
  `PATCH /projects/:id` (opcional; pisa `llevaFactura` y la nota) y
  `PATCH /finance/facturacion/:projectId` (con entrada de auditoría).
- `montoAFacturar()`: normal → `budgetUsd / 1,22` sin IVA y `budgetUsd` con IVA;
  otro monto → `facturarSinIvaUsd` y ×1,22; a definir → nulos.
- Migraciones `20261022210000_monto_a_facturar` (columnas) y
  `20261022210100_facturacion_normal_existentes`: los proyectos que ya llevaban
  factura **sin nota** pasan a facturación normal; los que tenían nota quedan
  **a definir** para que Finanzas cargue el monto (en producción eran 3).

**Casos borde.**

- Facturación normal toma el presupuesto **de hoy**: si se cambia el
  presupuesto, cambia lo que hay que facturar. Otro monto queda fijo.
- «Falta facturar» compara con lo facturado por Biller; las facturas marcadas a
  mano no tienen monto y no descuentan.
- Un proyecto con monto 0 no lleva factura y no aparece en Facturación.

### Cobrado vs facturado

**Para qué existe.** Facturar un porcentaje de lo vendido deja abierto el
riesgo fiscal más grande: cobrar plata que no tiene comprobante. El aviso lo
muestra obra por obra.

**Cómo funciona.** `GET /finance/facturacion` devuelve por proyecto
`cobradoUsd` (suma de INGRESO `cobrado = true` en **USD** del proyecto, solo
categorías `PROYECTO_ENTRADA` y `COBRO_CLIENTE`) y `facturadoUsd` (CFE vivos en USD —`EMITIENDO`, `DUDOSO`,
`ESPERANDO_DGI`, `ACEPTADO`—, facturas menos notas de crédito). Si
`cobradoUsd − facturadoUsd > 1`, la columna de estado de `FinanceFacturacionTab`
→ `EstadoCfes` muestra "Cobrado … · facturado …: hay cobro sin factura".

**Casos borde.**

- **Solo se ve si la obra tiene al menos un CFE emitido por Biller.** Las
  facturas marcadas a mano no tienen monto y una obra sin factura no muestra el
  aviso, aunque haya cobrado (ahí el aviso es la propia fila pendiente).
- Los cobros en **pesos** no cuentan, y los CFE en pesos tampoco.
- La cuenta productiva no se probó todavía al escribir esto (14-oct-2026):
  todo lo de arriba está verificado contra test.biller.uy.

---

## Facturas de proveedores (bandeja, registro y carga)

### Para qué existe

Para que ninguna factura de proveedor se pierda ni se cargue dos veces: las
facturas que le emiten a Voltia se traen solas de la facturación electrónica
(Biller), se revisan en una bandeja y desde ahí pasan a deuda. Es también el
**único formulario** para cargar una factura de proveedor a mano.

### Cómo se usa

**Finanzas → Compras → Facturas** (`FinanceFacturasProveedoresTab.tsx`):

- **Arriba, la bandeja** de facturas recibidas (`BandejaRecibidas`, exportada
  desde `FinanceCuentasPorPagarTab.tsx`). Por defecto muestra las **por
  revisar**; un selector deja ver las cargadas como deuda, las descartadas o
  todas. Debajo, filtros que se aplican en el navegador sobre lo que trajo esa
  vista: proveedor (la clave es `supplier.id` o, sin proveedor, el RUT emisor,
  así aparecen los no dados de alta), tipo (factura / nota de crédito), fecha
  de emisión desde/hasta y texto (serie-número, RUT, razón social, proveedor). Por fila: **Cargar como deuda** (o **Descontar de la deuda** si es una
  nota de crédito), vincular a un gasto ya cargado (sugerencias por puntaje:
  `sugerir-gasto.service.ts` → `sugerirGastos()`/`puntuar()`; gastos sin
  factura del mismo proveedor o sin proveedor a ±30 días; puntúa número,
  monto exacto / sin IVA / en la otra moneda con la última cotización (±2,5 %)
  / parecido, días de diferencia, proveedor y palabras de la descripción o del
  rubro; mínimo 55, hasta 3; vincular admite otra moneda y le pone al gasto el
  proveedor de la factura), **«Ya está registrada»** (`YaRegistradaModal.tsx`:
  `GET /finance/facturas-recibidas/:id/gastos?buscar=` para elegir el gasto a
  mano —sin factura, mismo proveedor o sin proveedor, ±90 días, sin
  transferencias ni ajustes—; `POST …/crear-gasto` crea el GASTO PAGADO con la
  factura vinculada, convertido si la cuenta es de otra moneda; `POST
  …/contemplada` deja la factura CONFIRMADA sin movimiento con
  `notaRegistro`, que `…/reabrir` puede devolver a PENDIENTE; las tres quedan
  en el libro de compras del cierre, que solo excluye las DESCARTADAS),
  descartar con motivo,
  **¿De qué proveedor es?**, crear el proveedor, ver el PDF. Las que pasaron
  solas a deuda llevan la marca **"entró sola"**.
- **Abajo, el registro** de todas las facturas, con filtros.

**Un solo formulario para cargar a mano.** "Cargar factura" (en la ficha del
proveedor) y "Nueva factura a pagar" (en Proveedores) abren
`CargarFacturaRecibidaModal`: tipo de CFE, serie, número, fechas, moneda,
**total con IVA** y **IVA (opcional)**, PDF. Tiene el control de duplicados por
RUT + tipo + serie + número. Un enlace al pie, **"¿Sin factura electrónica
(por ejemplo, un proveedor del exterior)? Cargar la deuda sin comprobante"**,
abre el formulario simple de antes (`NewSupplierInvoiceModal`, `POST
/finance/supplier-invoices`) para deudas sin CFE.

**Proveedor de cuenta corriente**: casilla en el formulario del proveedor
(`FinanceSuppliers.tsx` → `SupplierForm`). Plazo y límite de crédito, en el
mismo formulario.

**«¿De qué proveedor es?»** en una fila de la bandeja llama a
`POST /finance/facturas-recibidas/asignar-proveedor` con el RUT de la fila:
`resolverProveedor()` le guarda el RUT al proveedor si no tenía (o rechaza con
`RUT_NO_COINCIDE` si tiene otro) y se asigna a **todas** las facturas de ese
RUT sin proveedor. Por RUT y no por razón social. Audita como `supplier`. Las
que lleguen después se asignan solas en la sincronización (`proveedorPorRut`).

### Cómo funciona

**Datos.** Las facturas recibidas viven en `FacturaRecibida`
(`facturas_recibidas`), única por `rutEmisor + tipoCfe + serie + numero`, con
`raw` (el JSON tal cual vino) para no perder nada. Una confirmada apunta a su
`FinanceMovement` (`movementId @unique`); una nota de crédito descontada
apunta a su ajuste (`ajusteId @unique`). `cargadaSola` marca las que entraron
solas.

**Pasar a deuda: un solo código.** `services/finance/facturas-recibidas.service.ts`
→ `confirmarFactura()`. Lo usan el botón de la bandeja (`POST
…/:id/confirmar`), la carga a mano y la carga automática. Crea el
`FinanceMovement` GASTO / `PAGO_PROVEEDOR` / `A_PAGAR` con `invoiceNumber =
serie-numero`, vencimiento por plazo negociado (`calcularVencimiento()`, ver
"Proveedores") salvo que se indique otra fecha, y **copia `montoNeto` y
`montoIva`** de la factura.

**Sin carrera.** La sincronización y una persona pueden confirmar la misma
factura a la vez. Dentro de la transacción, `tomarPendiente()` "toma" la
factura con `updateMany where estado = PENDIENTE`; si devuelve 0 filas, otro
ya la resolvió y corta con `FACTURA_RECIBIDA_RESUELTA` (409), sin crear un
segundo movimiento. Vincular y descartar usan el mismo control.

**Neto e IVA de las compras.** `FinanceMovement.montoNeto` / `montoIva`, para
el crédito fiscal y el libro de compras del cierre. Se copian de
`FacturaRecibida.totalNeto` / `totalIva` al confirmar; la migración
`compras_neto_iva_nc` hizo el backfill de las ya confirmadas. En la carga a
mano, si se escribe el IVA, el neto se calcula como total − IVA. Lo que viene
de DGI trae neto e IVA; lo que viene **solo por mail** trae el IVA pero no el
neto (`desdeMail()` deja `totalNeto` en null).

**Notas de crédito recibidas.** Ya no se marcan "a mano": **Descontar de la
deuda** (mismo botón, `confirmarFactura()` → `confirmarNotaCredito()`) crea un
**ajuste** (ver "Ajustes de deuda con un proveedor") repartido FIFO sobre las
deudas abiertas del proveedor **en la moneda de la nota**, con motivo "Nota de
crédito serie-número del proveedor", y guarda `FacturaRecibida.ajusteId`. Si
la nota es **mayor que lo que se le debe**, no deja (`NC_SUPERA_DEUDA`): queda
por revisar con el aviso.

**Facturas que entran solas (cuenta corriente).** `Supplier.cuentaCorriente`
(casilla). `cargarSolasCuentaCorriente()` corre **después de cada
sincronización** con Biller (el job y el botón Sincronizar) y pasa a deuda las
`PENDIENTE` de esos proveedores, **salvo** que:

- sea una nota de crédito, o tenga total cero;
- exista un GASTO del mismo proveedor y moneda, **sin factura vinculada**, con
  `invoiceNumber` que contenga el número del CFE, o con el mismo monto a ±7
  días (sería la misma compra cargada a mano: se vincula, no se duplica).

Las que no pasan quedan por revisar para una persona. Las que pasan quedan
`cargadaSola` y se auditan como "Cargó sola como deuda…". **El actor es el
primer ADMIN** (`usuarioSistema()`: no hay usuario de sistema); si no hay
ninguno, no carga nada.

**Importación desde Biller.** `services/biller/recibidos.service.ts`:

- `sincronizarRecibidos(dias = 45)` pide dos endpoints y junta las filas en
  `guardarRecibidos()`:
  - `GET /v2/comprobantes/recibidos/obtener` (lo que tiene DGI: **todos** los CFE
    a nuestro RUT, con `rut_emisor`, total, neto e IVA);
  - `GET /v2/comprobantes/obtener?recibidos=1` (lo que llegó al mail publicado
    en DGI, con `fecha_vencimiento`). `desdeMail()` busca el emisor en
    `emisor.rut`, `rut_emisor` y `emisor_rut`, y si no está empareja con la fila
    de DGI por tipo/serie/número.
- Tipos: facturas y notas de débito (101/103/111/113/121/123 y contingencia)
  entran; notas de crédito (102/112/122…) entran marcadas; remitos y resguardos
  se ignoran.
- El nombre del emisor, que DGI no trae, se pide con
  `GET /v2/dgi/empresas/nombre-entidad?documento=<rut>&tipoDocumento=2`
  (`buscarRazonSocial()`), una vez por RUT.
- Upsert idempotente: correrlo dos veces no duplica. A una fila ya resuelta solo
  se le completan datos que faltaban.
- El proveedor se asigna **por RUT normalizado** (`normalizarRut()`, sin puntos
  ni guiones), nunca por nombre.
- Job `recibidos.job.ts` → `startBillerRecibidosJob()`: **cada 30 minutos, todo
  el día** (`CRON_BILLER_RECIBIDOS`, default `*/30 * * * *`, hora Uruguay;
  hasta el 21-oct-2026 era cada hora de 8 a 20). **No corre sin
  `BILLER_TOKEN`.** `BILLER_URL` elige test o producción. El resultado de la
  última corrida queda **en memoria** (`getUltimaSync()`): se pierde al
  reiniciar.

**Bandeja** (`routes/cuentas-por-pagar.routes.ts`):

- `confirmar`: `confirmarFactura()` (arriba). Si el proveedor elegido no tiene
  RUT, se le graba el del CFE; si tiene otro, `RUT_NO_COINCIDE`.
- `vincular`: la asocia a un movimiento ya cargado a mano (mismo proveedor y
  moneda), sin crear deuda. Las candidatas se proponen por número
  (`invoiceNumber` terminado en el número del CFE) o monto (±0,01).
- `descartar` exige motivo; `reabrir` solo desde DESCARTADA (una confirmada se
  corrige desde su movimiento).
- `crear-proveedor`: da de alta el proveedor con el RUT y la razón social, y le
  asigna las facturas que tenía sin proveedor.

**Registro.** `GET /finance/facturas-proveedores` une las `FacturaRecibida` (en
cualquier estado) con los GASTO con proveedor que **no** están vinculados a una
(`facturaRecibida: null`), de COMPROMETIDO a PAGADO. Filtros: `proveedor`
(`<id>`, `sin-proveedor`, `rut:<rut>`), `desde`/`hasta` (por emisión), `origen`,
`buscar`. Las notas de crédito van con signo negativo y los totales excluyen las
descartadas. Devuelve además `emisoresSinAlta`.

**Carga a mano (tercer camino).** `POST /finance/facturas-recibidas` crea una
`FacturaRecibida` con `enManual = true` y `cargadaPorId`:

- El RUT sale del proveedor elegido o se escribe; sin RUT no se carga
  (`RUT_REQUERIDO`), porque es la llave anti-duplicado.
- Si la clave `rutEmisor+tipoCfe+serie+numero` ya existe, devuelve 409
  `FACTURA_YA_CARGADA` diciendo por qué camino llegó y en qué estado está.
- Si hay GASTO del proveedor sin vincular con el mismo número o monto, no
  confirma: devuelve `candidatas` y queda PENDIENTE para vincular. Una nota de
  crédito no busca candidatas.
- Si no hay candidatas y viene `cargarComoDeuda` (default `true`), confirma en
  el mismo paso con `confirmarFactura()`. Si eso falla con un error de negocio
  (por ejemplo, una NC mayor que la deuda), la factura **queda guardada** por
  revisar y la respuesta trae el `aviso`.
- La sincronización posterior con Biller hace upsert sobre la misma clave: suma
  `enDgi` y `enMail` y no duplica.

**PDF.**

- `GET /finance/facturas-recibidas/:id/pdf` sirve `pdfUrl` si existe. Si no, y
  hay `billerId`, lo pide con `bajarPdfBiller()` (`/v2/comprobantes/pdf`,
  base64; valida que empiece con `%PDF`) y lo guarda en
  `storage/proveedores/recibidas/`. Si no hay forma, devuelve 404
  `PDF_NO_DISPONIBLE`.
- `POST …/pdf` (multipart) lo sube a mano (`pdfOrigen = manual`).
- **No verificado:** que Biller dé el PDF de un comprobante *recibido*. La
  documentación lo muestra solo para emitidos.

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/facturas-recibidas`, `GET /finance/facturas-proveedores`, `GET /finance/facturas-recibidas/:id/pdf` | `FINANZAS:VIEW` |
| `POST /finance/facturas-recibidas` (carga a mano), `POST …/:id/pdf` | `FINANZAS:EDIT` |
| `POST /finance/facturas-recibidas/sincronizar`, `/:id/confirmar`, `/:id/vincular`, `/:id/descartar`, `/:id/reabrir`, `/asignar-proveedor`, `/crear-proveedor` | `FINANZAS:EDIT` |

No hay guards por rol: todo pasa por la matriz. La carga automática no pasa
por permisos (corre en el job, a nombre del primer ADMIN).

### Reglas y decisiones

- **Ninguna factura entra a la deuda sin revisión, salvo las de proveedores de
  cuenta corriente.** Para el resto, una persona confirma (igual que en la
  emisión de CFE). Las que entran solas se revisan **una vez por semana**: para
  eso está la marca "entró sola".
- **Las notas de crédito se descuentan con un ajuste, no con un pago
  negativo.** Un `Payment` negativo no reduce deuda (`accumulateSupplierSaldoAFavor`
  ignora negativos) y pide cuenta bancaria; el ajuste baja la deuda sin mover
  plata.
- **Biller no da la forma de pago** (contado / crédito) de las recibidas, ni
  en la lista ni en el detalle (probado contra Biller productivo, solo lectura,
  el 21-oct-2026). Por eso "cuenta corriente" es una marca del **proveedor** y
  no de la factura. Sí da los **renglones** (concepto, cantidad, precio), que
  hoy no se usan.
- Monedas distintas de USD/UYU no se importan (el enum `Moneda` no las tiene).

### Casos borde

- **Una compra de contado a un proveedor de cuenta corriente** también pasa
  sola a deuda (no hay forma de saber que fue de contado) salvo que ya esté
  cargado el gasto con el mismo número o monto a ±7 días. Si el gasto se carga
  **después** de la sincronización, queda duplicado: lo detecta "Posibles
  duplicados" del Inicio.
- El filtro "mismo número" de la carga automática usa `endsWith` sobre
  `invoiceNumber` (los números se cargan como `A-1433`).
- **Borrar el ajuste de una nota de crédito** (desde los pagos del proveedor)
  devuelve la NC a la bandeja: el `DELETE /finance/payments/:id` de un ajuste
  pone en PENDIENTE la `FacturaRecibida` que lo tenía en `ajusteId` (probado).
- En la carga a mano de una NC, la respuesta trae el id del **ajuste** en el
  campo `movementId` (es lo que devuelve `confirmarFactura()`).
- La ventana de sincronización es de 45 días hacia atrás: una factura vieja
  que DGI recién registre después de eso no entra sola (hay que ampliar
  `dias`).
- Proveedores sin RUT cargado: sus facturas quedan "sin proveedor" hasta que se
  elige uno en la bandeja (y ahí se le graba el RUT).

---

## Proveedores: lo que se debe y un solo camino de pago

### Para qué existe

Para saber en todo momento cuánto se le debe a cada proveedor y para cuándo, y
para que cada pago a un proveedor **baje su deuda** en vez de quedar como un
gasto suelto al lado de una factura que sigue abierta.

### Cómo se usa

- **Finanzas → Compras → Proveedores** (`FinanceSuppliers.tsx`): arriba, **lo
  que se debe por vencimiento** (`CuentasPorPagarResumen`, exportado desde
  `FinanceCuentasPorPagarTab.tsx`; antes era la pestaña Cuentas por pagar):
  totales por tramo y una fila por proveedor, desplegable con sus facturas.
  Abajo, la lista de proveedores.
- **Pagarle a un proveedor**: **Registrar pago** en su ficha
  (`/finanzas/proveedores/:id`). El pago se aplica a sus facturas.
- **Columna Factura en Movimientos**: `GET /finance/movements` devuelve
  `factura` por fila (`facturaDeGasto()` / `facturaDePago()` en
  `api.routes.ts`): `ELECTRONICA` (tiene `facturaRecibida`), `ADJUNTO`
  (`comprobantes` o `archivoAdjuntoUrl`), `NUMERO` (solo `invoiceNumber`), `SIN`;
  null para ingresos y categorías que no son compra (TRANSFERENCIA,
  AJUSTE_CONCILIACION, CUENTA_SOCIO, ADELANTO_PERSONAL). Un pago toma el peor
  estado de los gastos que paga. El filtro "Gastos sin factura" (SIN + NUMERO) /
  "con factura" se aplica en el navegador. Las filas de pago traen además
  `montoCuenta`/`tipoCambio` y, si vienen, el monto se muestra en la moneda de la
  cuenta.
- En **Nuevo movimiento** (Movimientos) la categoría **"Pago proveedor" ya no
  se ofrece al crear** (`FinanceMovementsTab.tsx` →
  `categoriasDisponibles`). Si se elige un proveedor que tiene deuda abierta en
  esa moneda, aparece el aviso "Se le deben … a este proveedor. Si esto es un
  pago de esa deuda, cargalo con Registrar pago en su ficha", con el enlace.
  Un gasto con proveedor cargado desde Movimientos es, entonces, una **compra
  de contado**.

### Cómo funciona

**Datos.** `Supplier` suma `plazoCreditoDias` (default 30), `limiteCredito`
(null = sin límite), `limiteCreditoMoneda`, `cuentaCorriente` y `cuentaDesde`
(informativo, lo graba "Arrancar cuenta"). La migración
`20261009232500_plazo_credito_efergia` deja a EFERGIA en 10.

**Vencimiento.** `cuentas-por-pagar.service.ts` → `calcularVencimiento()` =
emisión + `plazoCreditoDias`. Lo usan `POST /finance/supplier-invoices` cuando no
viene `fechaVencimiento` (opcional) y `confirmarFactura()`. **Manda el plazo
negociado, no el vencimiento del CFE**; la bandeja muestra los dos cuando
difieren (`fechaVencimientoCfe` vs `vencimientoPorPlazo`).

**Deuda por tramos.** `getCuentasPorPagar()`: GASTO con proveedor en
COMPROMETIDO / A_PAGAR / PARCIALMENTE_PAGADO por su saldo (monto − aplicaciones
de pagos vigentes, ajustes incluidos), vencimiento `dueDate ?? expectedDate ??
fecha` (mismo criterio que el cashflow), tramos `VENCIDO` / `HASTA_7` /
`HASTA_30` / `MAS_30` (`tramoDe()`). El saldo a favor sale de
`accumulateSupplierSaldoAFavor()` (sin ajustes) y se muestra aparte. El límite
se compara contra la deuda neta **en la moneda del límite**, sin convertir.

**Estado de cada deuda.** `services/finance/deuda-proveedor.service.ts` →
`recalcMovementStatus()` (antes estaba en `api.routes.ts`): saldo 0 →
`PAGADO` con la fecha del último pago; algo pagado → `PARCIALMENTE_PAGADO`;
nada → vuelve a `A_PAGAR` (si tiene `dueDate`) o `COMPROMETIDO`. **Una deuda
saldada solo por ajustes conserva su fecha**: la fecha se toma del último pago
que **no** sea ajuste.

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/cuentas-por-pagar` | `FINANZAS:VIEW` |
| `GET /finance/suppliers/:id/deudas-abiertas?moneda=` (lo usa el aviso de Nuevo movimiento) | `FINANZAS:VIEW` |
| `POST /finance/payments` (Registrar pago) | `FINANZAS:CREATE` |

### Casos borde

- La categoría `PAGO_PROVEEDOR` sigue existiendo y la usan las facturas
  confirmadas; solo se sacó del selector al **crear** un movimiento. Los
  movimientos viejos con esa categoría se siguen viendo y editando.
- El aviso de deuda abierta es solo un aviso: nada impide guardar el gasto
  igual, y en ese caso la factura sigue abierta.

---

## Pago a proveedor desde una cuenta de otra moneda

`Payment.monto`/`moneda` siguen siendo **de la deuda** (FIFO, saldo a favor y
aplicaciones no cambian). Si la cuenta es de otra moneda, `POST/PATCH
/finance/payments` exige `tipoCambio` (pesos por dólar) y
`validateAccountForPayment()` guarda `montoCuenta` (lo que sale de la cuenta, en
su moneda) y `tipoCambio`; misma moneda → ambos null. Lo usan el saldo de la
cuenta (`/accounts/:id/balance` suma `montoCuenta ?? monto`) y la conciliación
con el banco (`bank-reconciliation.service.ts`). Resultados y flujo convierten
`monto` en la moneda de la deuda, como siempre. La ventana
(`NewPaymentForSupplierModal.tsx`) lista las cuentas de otra moneda aparte,
propone la última cotización cargada y muestra lo que sale de la cuenta.
Migración `20261022230000_pago_otra_moneda` (aditiva).

## Ajustes de deuda con un proveedor (y "Arrancar cuenta")

### Para qué existe

Para ordenar la deuda con un proveedor **sin inventar plata**: cerrar deudas
viejas que ya se pagaron por fuera o estaban mal cargadas, dejar la cuenta
igual al estado de cuenta del proveedor en una fecha ("arrancar limpio"), bajar
una diferencia que no se explica, y descontar notas de crédito.

### Cómo se usa

En la **ficha del proveedor** y en el resultado de la **Conciliación** con su
estado de cuenta:

- **Arrancar cuenta** (`components/finance/ArrancarCuentaModal.tsx`): se elige
  moneda, fecha y **el saldo que dice el estado de cuenta**. Se listan las
  deudas abiertas en esa moneda y se tildan **las que siguen vigentes**; por
  defecto vienen tildadas las que salen de una factura electrónica
  (`deFacturaRecibida`) o tienen fecha desde el 1-oct-2026 (`DESDE_BILLER`,
  fijo en el componente). La pantalla muestra la cuenta antes de confirmar.
- **Ajustar** / **Ajustar diferencia** (`components/finance/AjusteProveedorModal.tsx`):
  moneda, fecha, monto y motivo (mínimo 5 caracteres). Se reparte FIFO, de la
  deuda más vieja a la más nueva.

### Cómo funciona

**Un ajuste es un `Payment`** con `metodo = AJUSTE`, **sin cuenta**
(`accountId` null), el motivo en `notas` (y `referencia` = "Ajuste: …"),
aplicado a deudas con `PaymentApplication`. Lo crea
`deuda-proveedor.service.ts` → `crearAjusteEnTx()`, que valida que cada deuda
siga abierta (`DEUDA_NO_ABIERTA`) y que no se le aplique más que su saldo
(`AJUSTE_SUPERA`), y después llama a `recalcMovementStatus()` por cada una.
`repartirFifo()` reparte un monto sobre `deudasAbiertasProveedor()` (ordenadas
por fecha); si sobra, `AJUSTE_SUPERA_DEUDA`.

**Ajuste suelto**: `POST /finance/suppliers/:id/ajustes` con `moneda`,
`fecha` (default hoy), `motivo` y **o** `monto` (FIFO) **o** `aplicaciones`
puntuales (`[{movementId, monto}]`; la pantalla solo usa `monto`). Audita como
`payment`.

**Arrancar cuenta**: `POST /finance/suppliers/:id/arrancar-cuenta` con
`moneda`, `fecha`, `saldoEstadoCuenta`, `cerrar` (ids de las deudas que **no**
siguen vigentes) y `nota` opcional. En una transacción:

0. `cerrarSaldoAFavorEnTx()` (`deuda-proveedor.service.ts`): lo que sobra sin
   aplicar de los pagos de esa moneda con fecha ≤ la del arranque (saldo a
   favor) se cierra con un GASTO `PAGO_PROVEEDOR` "Saldo a favor anterior,
   cerrado al arrancar la cuenta el …", `impactaFlujo: false`, sin cuenta,
   aplicado entero por esos pagos (queda PAGADO). No cuenta de nuevo en caja,
   resultados ni flujo porque esos lados excluyen los movimientos con
   aplicaciones (el hecho de caja es el pago). Antes del 22-oct no se cerraba
   y el saldo a favor quedaba para la próxima factura (caso FIVISA); volver a
   arrancar la cuenta lo corrige.
1. Las deudas de `cerrar` se cierran por su saldo entero con **un** ajuste,
   motivo "Cerrada al arrancar la cuenta el dd/mm/aaaa".
2. Se compara el saldo del estado de cuenta con la deuda vigente que queda:
   - **Diferencia positiva** (el proveedor dice que se le debe más): se crea un
     GASTO `PAGO_PROVEEDOR` `A_PAGAR` "Saldo anterior según estado de cuenta al
     dd/mm/aaaa", **fechado un día antes de la deuda vigente más vieja** (o de
     la fecha elegida, la que sea anterior), así el próximo pago FIFO lo
     cancela primero.
   - **Diferencia negativa**: otro ajuste FIFO, motivo "Diferencia con el
     estado de cuenta al …".
3. Graba `Supplier.cuentaDesde` (informativo, no limita nada).

Audita como `supplier` con el resumen de lo que hizo. Los movimientos de caja
no se tocan.

**Qué no ve un ajuste** (porque no es plata): el estado de resultados (los tres
cálculos y la herramienta `estado_resultados` del conector), el recorrido de
saldos de Movimientos (`paymentWhere`), la historia del flujo de fondos
(`pastPayments`), el saldo a favor (lista de proveedores, cuentas por pagar,
flujo y los endpoints de saldo a favor), y por no tener cuenta, la caja y la
conciliación del banco. Sí lo ve la deuda con el proveedor, la conciliación
con su estado de cuenta (como pago) y la hoja "Ajustes" del archivo para la
contadora.

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/suppliers/:id/deudas-abiertas?moneda=` | `FINANZAS:VIEW` |
| `POST /finance/suppliers/:id/ajustes` | `FINANZAS:EDIT` |
| `POST /finance/suppliers/:id/arrancar-cuenta` | `FINANZAS:EDIT` |
| Borrar un ajuste (`DELETE /finance/payments/:id`) | `FINANZAS:DELETE` |

### Reglas y decisiones

- **No se crea por la ruta común de pagos**: `paymentCreateSchema` y
  `paymentPatchSchema` rechazan `metodo = AJUSTE` ("Un ajuste se hace desde la
  ficha del proveedor").
- **No se edita ni se re-aplica**: `rechazarSiAjuste()` corta con
  `AJUSTE_NO_EDITABLE` en `PATCH /finance/payments/:id` y en las rutas de
  aplicaciones (`POST`, `PATCH` y `DELETE /finance/payments/:id/applications…`).
  Si está mal, **se borra y se hace de nuevo**.
- **Se aplica siempre entero**: nunca queda saldo a favor.
- Las fechas de ajustes y de "Arrancar cuenta" respetan el cierre de mes
  (`assertFechaAbierta()`).
- Primero conviene corregir la causa (cargar la factura que falta, vincular el
  pago); el ajuste es para lo que no tiene explicación, y por eso el motivo es
  obligatorio y va a la contadora.

### Casos borde

- **"Arrancar cuenta" no se deshace de un golpe**: deja hasta dos ajustes y un
  movimiento "Saldo anterior" separados; para volver atrás hay que borrar cada
  uno.
- Se puede arrancar la cuenta más de una vez; `cuentaDesde` queda con la
  última fecha.
- Probado con un proveedor de prueba que reproduce el caso real de Tiempo al
  Tiempo: quedó en 13.663,70 exacto (registro del 21-oct-2026).

---

## Conciliación con el estado de cuenta del proveedor

### Para qué existe

Para comprobar, cada vez que se pide el estado de cuenta a un proveedor, que
coincida con lo que tiene Voltia PM, y ver exactamente dónde no.

### Cómo funciona

`services/finance/conciliacion-proveedor.service.ts`, en dos pasos:

1. **`extraerEstadoDeCuenta()`**: la IA (`CONCILIACION_MODEL`, default
   `claude-sonnet-4-5-20250929`, feature `conciliacion_proveedor` en `ai_usage`)
   pasa el documento a `EstadoDeCuentaSchema`: proveedor, RUT, moneda, fecha de
   corte, saldos inicial y final y renglones `{fecha, tipo, numero, descripcion,
   importe}`. Los tipos son FACTURA, NOTA_CREDITO, PAGO u OTRO, y el importe va
   siempre positivo. El PDF va entero como documento (lee también escaneados); el
   Excel y las fotos pasan por `leerContenidoAdjunto()`.
2. **`compararConVoltia()`**, determinística. Lado Voltia: GASTO del proveedor
   (de COMPROMETIDO a PAGADO) y `Payment`, en la moneda del estado de cuenta,
   hasta la fecha de corte. **Saldo Voltia** = facturas − pagos hasta esa fecha.
   **Saldo proveedor** = `saldoFinal`, o `saldoInicial` ± renglones.
   `emparejar()`:
   - Factura o NC por número (`numeroComparable()`: solo dígitos y sin ceros
     adelante; acepta que uno termine en el otro). Si el número coincide pero el
     monto no, va a `diferenciasMonto`.
   - Sin número que coincida: importe exacto (±0,01) y fecha ±7 días; los pagos,
     ±5 días.
   - Segunda pasada: una factura suelta del proveedor y una de Voltia del mismo
     día (±2) se emparejan como diferencia de monto.
   - Se empareja solo dentro del período que cubre el estado de cuenta (desde
     su primer renglón).

Se guarda en `ConciliacionProveedor` (`conciliaciones_proveedor`), con el
archivo en `storage/proveedores/<supplierId>/`, la extracción, el resultado y el
costo. `recomparar` repite el paso 2 sin IA.

**Rutas** (`cuentas-por-pagar.routes.ts`):

| Endpoint | Permiso |
|---|---|
| `POST /finance/suppliers/:id/conciliaciones` (multipart; `?moneda=` y `?fechaCorte=` opcionales) | `FINANZAS:EDIT` |
| `GET /finance/suppliers/:id/conciliaciones`, `GET /finance/conciliaciones/:id`, `GET …/:id/archivo` | `FINANZAS:VIEW` |
| `POST /finance/conciliaciones/:id/recomparar` | `FINANZAS:EDIT` |

**UI:** pestaña **Conciliación** de la ficha del proveedor
(`components/finance/ConciliacionProveedor.tsx`). Desde el resultado de una
comparación (solo con `FINANZAS:EDIT`) se abren:

- **Arrancar la cuenta con este estado de cuenta** (`ArrancarCuentaModal`,
  precargado con la moneda, el saldo del proveedor y la fecha de corte), cuando
  los saldos no cuadran;
- **Ajustar diferencia** (`AjusteProveedorModal`, precargado con el monto y el
  motivo "Diferencia con el estado de cuenta al …"), solo cuando Voltia PM
  tiene **más** deuda que la que dice el proveedor (`diferenciaSaldo` < 0). Si
  el proveedor dice que se le debe más, no se ajusta: falta cargar algo.

Al cerrar cualquiera de los dos se vuelve a comparar solo. Ver "Ajustes de
deuda con un proveedor".

### Casos borde

- Archivos aceptados: PDF, `.xlsx` e imágenes. Un `.xls` viejo o un CSV no
  entran: hay que exportarlo como `.xlsx` o PDF.
- Las notas de crédito del proveedor buscan pareja entre las **facturas** de
  Voltia PM, con signo negativo. Pero en Voltia PM una nota de crédito es un
  **ajuste**, y los ajustes son `Payment`: entran del lado de los **pagos**
  (`compararConVoltia()` trae todos los `Payment` del proveedor, ajustes
  incluidos). Resultado: el **saldo cierra**, pero la NC del proveedor y el
  ajuste de Voltia PM quedan sueltos cada uno de su lado.
- Los ajustes cuentan como pagos para el saldo de Voltia PM (bajan la deuda),
  que es lo correcto: un "Arrancar cuenta" o un "Ajustar diferencia" hecho
  desde acá se refleja en la próxima comparación (`recomparar`).
- Un GASTO PAGADO con proveedor cargado como pago directo (sin factura) cuenta
  como factura del lado Voltia. Si el proveedor lo lista como factura + recibo,
  aparece como pago que "el proveedor no tiene".
- Probado con un estado de cuenta generado; no con uno real de un proveedor.

---

## Pagos a instaladores tercerizados

### Para qué existe

Voltia terceriza parte de la instalación. Antes, lo que se le debía a cada
cuadrilla vivía en WhatsApp y en una planilla: no había forma de saber cuánto se
le debía a quién, ni el instalador tenía dónde consultarlo.

Es el espejo de las comisiones del asesor, del lado del gasto, con dos
diferencias: admite **pagos parciales** y el instalador sale **del equipo con
que se agenda la obra en el calendario**.

### Cómo se usa

**El pago lo crea el calendario.** La **primera vez** que una obra se agenda con
un equipo **tercerizado**, se crea solo, con el monto congelado de la propuesta
ganadora, asignado a **quien cobra por ese equipo** y con la fecha de trabajo =
el primer día de obra. Después no se toca más. Cada equipo tercerizado tiene su "quién cobra" en **Admin →
Equipos** (`Team.installerUserId`). Las obras de **equipo propio** no generan
pago: no se paga aparte.

Desde **Finanzas → Instaladores** (o `/pagos-instalador`), quien gestiona:

1. **Corrige** el instalador o el monto si hace falta (el camino normal es que
   ya venga asignado desde el calendario).
2. **Registra los pagos**, totales o parciales. Cada uno pide monto, fecha y una
   nota opcional.
3. Puede **cargar pagos a mano** para trabajos que no salen de un proyecto (una
   reparación en garantía, una obra anterior a esta funcionalidad).
4. Puede **filtrar por instalador** y copiar un **resumen para WhatsApp**
   (`resumenWhatsApp.ts` → `buildResumenInstalador()`): las últimas tres
   saldadas salen por `paidAt` (fecha de la entrega que las saldó), con
   `fechaTrabajo` de respaldo; hasta el 16-oct-2026 iban por fecha de obra y una
   obra vieja pagada hoy no aparecía.

**El resumen de WhatsApp** (`resumenWhatsApp.ts`) lista las obras en curso con lo
que falta de cada una, y de las saldadas **las últimas tres** (ordenadas por
fecha de obra): un instalador con veinte obras cerradas generaría un mensaje
ilegible, y lo que importa es dónde quedó la cuenta. Los pagos sin instalador
asignado quedan afuera. En el listado, cada instalador se muestra con un **color
estable** (derivado de su id) para identificarlo de un vistazo.

El instalador entra por **el menú de su cuenta → "Mis cobros"** y ve sus
trabajos, lo cobrado y el saldo. Es solo lectura.

### Cómo funciona

**El monto** sale de `calc.manoDeObraUsdSinIva` del snapshot de la última
propuesta **publicada** del lead, multiplicado por **1,22**: el instalador
factura, así que se le paga con IVA. Si la propuesta no trae mano de obra (las
viejas, o proyectos cargados a mano), el pago nace en **0** y marcado
`origenManual` para que se note que hay que cargarlo.

`readManoDeObraFromSnapshot()` en `installer-payment.service.ts`.

**El monto antes de agendar.** El gerente de Operaciones le informa el
presupuesto al tercerizado **antes** de agendar la obra, y el pago recién nace al
agendar. Para eso, Validación de Operaciones tiene la subetapa **"Presupuesto al
instalador tercerizado"** (`PRESUPUESTO_MANO_DE_OBRA` en
`pipeline-definitions.ts`), con el panel `PresupuestoManoDeObraPanel` en el
`StageDrawer`. El dato sale de `GET /projects/:projectId/mano-de-obra`
(lo ve quien pasa `canSeeAll()` —FINANZAS:VIEW o PAGOS_INSTALADOR:EDIT—: el gerente de Operaciones, Finanzas y Admin, decisión de Nicolás del 10-oct-2026; para eso el script le da a GERENTE_OPERACIONES PAGOS_INSTALADOR:EDIT, que en este módulo solo significa "ver todos". El tercerizado, que tiene PAGOS_INSTALADOR:VIEW para Mis cobros, solo ve el de una obra cuyo pago ya es suyo. No va con OPERACIONES:VIEW: lo tienen casi todos los roles, asesores incluidos) →
`presupuestoManoDeObra()`: si el pago ya existe manda su `montoUsd` (puede estar
corregido a mano), si no, el de la propuesta ganadora calculado en el momento
con `buscarManoDeObraPropuesta()`, la misma búsqueda que usa
`createInstallerPaymentForProject()`. Con equipo propio la subetapa se marca
**No aplica** (`NO_APLICA`, que el cliente no ofrecía hasta el 10-oct-2026). No se
marca sola según el equipo: lo hace el gerente. El gerente no negocia el monto:
pagar más lo autoriza Gerencia. La subetapa se sumó a los proyectos con
Validación abierta y a la plantilla guardada en settings con
`prisma/scripts/add-subetapa-presupuesto-tercerizado.ts` (`--apply`).

**Quién crea el pago:** `crearPagoAlAgendar()` en `installer-payment.service.ts`,
llamado desde `POST /calendar` y desde `PATCH /calendar/:id` cuando cambia el
equipo (helper `pagoInstaladorAlAgendar()` en `api.routes.ts`, best-effort: si
falla, la agenda igual queda guardada).

- **Solo la primera vez**: si la obra queda con un equipo tercerizado y el
  proyecto **nunca tuvo pago**, se crea con el monto de la propuesta, asignado a
  quien cobra por el equipo (sin asignar si el equipo no tiene a nadie) y con
  `fechaTrabajo` = primer tramo (vence el 1.º del mes siguiente).
- **Después no se toca más** (decisión de Nicolás, 10-oct-2026): reagendar,
  cambiar de equipo, pasar a equipo propio o borrar la agenda **no mueve ni
  quita el pago**. Si hay que corregirlo, se corrige a mano en Pagos a
  instaladores.
- Si el proyecto ya tuvo un pago alguna vez, **aunque esté borrado**, no se crea
  otro (`projectId` es `@unique`, y además es la regla: solo la primera vez).
- Al configurar quién cobra por un equipo (`PATCH /teams/:id`),
  `asignarPagosSinInstaladorDelEquipo()` asigna los pagos de sus obras que
  nacieron **sin** instalador. Los ya asignados no se tocan.

El monto se congela con `createInstallerPaymentForProject()`, idempotente por
`projectId`.

**Hasta el 10-oct-2026 el pago se creaba al ganar la venta**, para todas las
obras y sin instalador: quedaban "sin asignar" también las de equipo propio, y
faltaban las de tercerizados vendidas antes del módulo. Lo de antes se ordena
una sola vez con `server/prisma/scripts/sync-pagos-instalador-calendario.ts`
(idempotente, `--dry-run`): (1) vincula cada equipo tercerizado con el
instalador cuyo nombre empieza igual ("Fernando" → "Fernando Leal"); (2) quita
los pagos sin asignar, sin entregas, de obras que no están agendadas con un
tercerizado; (3) crea el pago de las obras tercerizadas que no lo tienen, solo
desde `--desde`. **Nicolás decidió "de ahora en adelante"**: en prod se corre con
`--desde 2026-10-10 --incluir PRY-2026-047` (Antonella Brondo, excepción pedida:
obra del 7-oct, a Fernando Leal). Las obras anteriores se pagaron por fuera (el
módulo existe desde el 20-ago); si hace falta alguna, se carga a mano.

**Qué pagos se ven** (`PAGO_VISIBLE_WHERE` en `installer-payment.service.ts`,
aplicado en `listInstallerPayments()`, `installerPaymentMetrics()` y en lo que
se debe a instaladores de `posicion.service.ts`): los de obras con
`InstallationSchedule` vigente y equipo tercerizado (`team.type`, o `teamType`
si no hay equipo), más los que no tienen proyecto (cargados a mano) y los que ya
tienen alguna entrega. Decidido el 16-oct-2026: el instalador toma el cargo desde
el calendario. Choca a propósito con "después no se toca": si la obra sale del
calendario o pasa a equipo propio, el pago **no se borra pero deja de verse**
(salvo que tenga entregas), y vuelve si se agenda de nuevo con un tercerizado.
Los pagos ocultos siguen existiendo, así que bloquean la creación de otro
(`projectId` `@unique`). El conector MCP (`pagos_instaladores`) usa las mismas
funciones y ve lo mismo.

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
| Corregir una entrega ya registrada | `FINANZAS:EDIT` |
| Anular una entrega ya registrada | `FINANZAS:DELETE` |
| Borrar el trabajo entero | `FINANZAS:DELETE` |
| Crear el pago al agendar la obra | el de la ruta del calendario (`OPERACIONES:CREATE`/`EDIT`) |
| Configurar quién cobra por un equipo | `CONFIGURACION:CREATE`/`EDIT` (Admin → Equipos) |

Quien agenda en el calendario **no necesita permisos de Finanzas** para que el
pago se cree: es un efecto de agendar, no una acción sobre el pago.

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
- **Una entrega ya registrada se puede corregir o anular** (`editarEntrega` /
  `borrarEntrega`) desde el modal de pagos, incluso con el trabajo saldado.
  Opera **sobre el `FinanceMovement`** de esa entrega (le cambia el monto/fecha o
  lo soft-borra) y `recalcularStatus` reajusta saldo y estado. Como toca el
  movimiento, el cambio **se refleja en Finanzas** (Movimientos, flujo,
  resultados). Corregir no puede dejar el total entregado por encima del monto
  del trabajo (`SUPERA_EL_MONTO`).
- **Borrar el trabajo entero exige que no queden entregas vivas**: primero se
  anulan las entregas (que soft-borran sus movimientos) y recién ahí se borra.

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

## Costos fijos en Finanzas

La pestaña **Finanzas → Costos fijos** monta el mismo `TabCostosFijos`
(`AdminCostosFijos.tsx`) que Administración. Los endpoints `/admin/fixed-costs*`
ya pedían `FINANZAS:*`, así que no cambió ningún permiso: antes un usuario de
Finanzas sin acceso a `/admin` no tenía cómo llegar a la pantalla.

---

## Banco: lector, registro y parejas

### Para qué existe

Para comparar todos los días lo que pasó en el banco con lo cargado en Voltia
PM, en los dos sentidos: lo del banco que nadie cargó, y lo cargado que el
banco no muestra.

### Cómo se usa

**Finanzas → Bancos → Banco** (`FinanceBancoTab.tsx`):

- **Tarjetas por cuenta**: saldo del banco, última lectura, cuántos
  movimientos tienen pareja y cuántos faltan.
- **Registro** de todo lo leído del banco, con filtros por cuenta, fechas
  (default: el mes en curso) y estado, y su pareja en Voltia PM. Estados:

  | Estado | Qué quiere decir |
  |---|---|
  | **Confirmada** | una persona fijó la pareja |
  | **Coincide** | el emparejador propone una pareja (se recalcula al mirar) |
  | **Falta cargar** | no hay nada en Voltia PM |
  | **No va** | se decidió no cargarlo (con motivo) |
  | **Antes de comparar** | anterior a la fecha desde la que se compara |

- Acciones (con `FINANZAS:EDIT`): **Confirmar** (fija la pareja propuesta),
  **Soltar** (la libera), **Cargar** (abre Nuevo movimiento precargado),
  **No va** (pide motivo), **Volver a comparar** (deshace un No va).

### Cómo funciona

**El lector.** Un robot aparte (proyecto `~/Dev/lector-banco`, fuera de este
repo, en la VPS de desarrollo) entra a eBROU Empresas con el operador de solo
consulta, lee los movimientos del **mes anterior y del actual** de cada cuenta
(sufijos `-00001` pesos y `-00002` dólares) y los manda a
`POST /api/banco/lectura`. `leer.mjs`: un solo intento de ingreso, frena si el
formulario cambió, navega con clics (saltar de pantalla por URL hace que el
banco cierre la sesión), la lista no es una `<table>` (se arma cada fila desde
la celda con fecha) y va de a 10 por página (`ul.pagination`, botón "Go to next
page" hasta que queda `disabled`); siempre cierra la sesión con Salir. Corre por
cron de lunes a viernes 8:00 y 18:00 (`correr.sh`, salida en
`capturas/corridas.log`); `--prueba` lee sin mandar y `--reenviar` manda la
última lectura sin entrar al banco. La URL y el token de Voltia PM están en
`~/.config/voltia-banco/voltia-pm.env`; las claves del banco, en
`brou-empresa.env` (600). Primera lectura en producción: 29-oct-2026. **Asunto**: el robot abre el
detalle de cada movimiento (clic en la fecha → "Detalle de un movimiento" →
vuelve con la flecha) y lo guarda en `capturas/asuntos.json` para no reabrirlo;
el banco corta la sesión a los ~6 min de entrar aunque haya actividad, así que
abre detalles solo los primeros 3,5 min y sigue en la próxima corrida.
`BankMovement.asunto`; `registrarLectura()` lo completa también en filas ya
guardadas.

**Sugerencias y "Es este".** `sugerir-banco.service.ts` → `sugerenciasBanco()`
(lo usan `pendientesPorCuenta({ sugerencias: true })` y `registroBanco()` para
las FALTA_CARGAR). Candidatos de la misma moneda: movimientos PAGADO sin banco
ni aplicaciones, sin cuenta / en esta / en una cuenta sin lector
(`numeroCuentaBanco` null); deudas a pagar y saldo por proveedor; costos fijos
del mes y del anterior sin pagar; cobros PREVISTO; facturas recibidas
PENDIENTE. Puntaje: mismo monto 35 / parecido 25 / cercano 8; nombre propio del
asunto 45 (dos palabras 55; palabras genéricas como "sueldo", meses o "pago" no
cuentan; tolera errores de tipeo con distancia de edición); fecha 15/8/2;
−30 si el monto es menos de la mitad o más del doble; ±10/−20 según el mes que
nombre el asunto. Mínimo 45, hasta 3. `resolver-banco.service.ts` →
`resolverBanco()` (`POST /finance/banco/movimientos/:id/resolver` {clave}) y
`cargarCargosBancarios()` (`POST /finance/banco/cargos-bancarios`).
`interpretarConIa()` (`POST /finance/banco/interpretar`, feature IA
`conciliacion_banco`) manda de a 15 filas sin sugerencia fuerte (<70) con sus 8
candidatos más cercanos sin umbral; guarda `BankMovement.sugerenciaIa`
{opcion, queEs, confianza}. UI: `SugerenciasBanco.tsx` en `FaltaCargarBanco` y
`FinanceBancoTab`. Esa ruta **no usa sesión de usuario**: se
autentica con `BANCO_LECTOR_TOKEN` en `Authorization: Bearer …`
(comparación en tiempo constante); si la variable no está, responde 404. La
cuenta se reconoce por `Account.numeroCuentaBanco`.

**Guardado sin repetir.** `bank-reconciliation.service.ts` →
`registrarLectura()` guarda en `BankMovement` con `createMany(skipDuplicates)`
sobre `claveUnica` = hash de cuenta + fecha + **descripción y documento
normalizados** (`normalizarTexto()`: mayúsculas, sin acentos, sin espacios de
más) + sentido + monto + un **ordinal** entre movimientos idénticos del mismo
día (dos comisiones iguales son dos movimientos, y releer la misma ventana da
las mismas claves). La normalización evita que un espacio o un acento distinto
entre dos lecturas duplique el movimiento. También guarda `bancoLeidoEn` y
`bancoSaldo` en la cuenta.

**Emparejar.** `conciliarCuenta()`:

- Desde `CONCILIAR_DESDE` (env `BANCO_CONCILIAR_DESDE`, default
  `2026-10-01`): lo anterior en el banco no está cargado en Voltia PM.
- Del lado de Voltia PM va lo mismo que mueve el saldo de la cuenta: INGRESO
  cobrado, GASTO pagado **sin** `Payment` aplicado (los que tienen pago se
  cuentan por el pago), y los `Payment` de la cuenta (uno negativo es una
  devolución: entra plata). Los ajustes no tienen cuenta, así que no
  aparecen.
- **Primero las parejas confirmadas** (`BankMovement.movementId` o
  `paymentId`, ambos `@unique`, con `vinculadoAt` / `vinculadoPorId`): quedan
  fijas y sus dos lados salen del juego.
- **Después, `emparejar()` propone para el resto**: mismo sentido, diferencia
  de monto hasta `MARGEN` (USD 5 / $ 10, en la moneda de la cuenta, sin
  convertir) y fecha a ≤ `DIAS_TOLERANCIA` (3) días. Gana la más parecida
  (monto, después fecha) y, empatadas, por id: la misma consulta da siempre
  las mismas parejas. Un movimiento cargado después **no le "roba" la pareja**
  a una confirmada.
- Lo que sobra del lado de Voltia PM, con más de 3 días, es "cargado que el
  banco no muestra" (`sinBancoPorCuenta()`, ver "Inicio").

**Fijar y soltar.** `vincularBanco()` valida que el movimiento sea de la misma
cuenta y del mismo sentido (o que el pago sea de la misma cuenta); si ese
movimiento ya estaba fijado a otra línea del banco, lo suelta de ahí; y limpia
un "No va" que hubiera. `desvincularBanco()` lo libera. Todo se audita como
`bank_movement`.

### Permisos

| Endpoint | Permiso |
|---|---|
| `POST /banco/lectura` | token `BANCO_LECTOR_TOKEN` (sin usuario) |
| `GET /finance/banco/pendientes`, `GET /finance/banco/movimientos`, `GET /finance/por-conciliar` | `FINANZAS:VIEW` |
| `POST /finance/banco/movimientos/:id/no-va`, `/deshacer-no-va`, `/vincular`, `/desvincular` | `FINANZAS:EDIT` |

### Reglas y decisiones

- **El robot de BROU corre desde la VPS de desarrollo**, no desde producción:
  ahí están las claves del banco, y producción tiene pendiente cerrar su
  seguridad (ingreso por contraseña y como root). Si la VPS de desarrollo está
  apagada, ese día no hay lectura (la tarjeta muestra la hora de la última).
- El banco cierra la sesión a los ~5 minutos sin actividad: el robot entra, lee
  y sale en menos de un minuto; no se mantiene abierta.
- **BBVA bloquea el navegador automático desde la VPS** (403 en bbva.com.uy y
  bbvanet.bbva.com.uy, probado el 21-oct-2026; no se intentó evadir). Net Cash
  no descarga el detalle. Decisión: el robot de BBVA va a correr **en la Mac
  de Nicolás**, con su Chrome y su sesión, lanzado por él; se arma con él
  presente.
- Para que una cuenta se compare necesita `numeroCuentaBanco` (Admin →
  Cuentas). Las de BROU en producción todavía no lo tienen cargado (pendiente
  del deploy).
- El comentario de cabecera de `bank-reconciliation.service.ts` todavía dice
  "La pareja no se guarda". **Ya no es así**: las propuestas se recalculan,
  pero las confirmadas se guardan.

### Casos borde

- Una lectura con un número de cuenta que ninguna cuenta tiene no falla: vuelve
  con `error: "Ninguna cuenta tiene ese número de banco"` para esa cuenta.
- "Confirmar" en la pantalla fija la pareja **propuesta**; la API acepta
  cualquier movimiento o pago de la cuenta, pero hoy no hay pantalla para
  elegir otro a mano.
- Un movimiento del banco que es la suma de varios cargados (o al revés) no se
  empareja: el emparejador es uno a uno.

---

## Conciliación mensual de una cuenta

`POST /accounts/:id/reconcile` (`FINANZAS:EDIT`, en `api.routes.ts`), desde
Finanzas → Bancos → Cuentas. Se carga el saldo real del banco a una fecha; si
difiere del calculado (`computeAccountBalance()`), **se reinicia el saldo de la
cuenta desde esa fecha** (`saldoInicial` / `fechaSaldoInicial`) y queda el
registro en `AccountReconciliation`. No se crea movimiento de ajuste.

**Desde el 21-oct-2026, si hay diferencia (> 0,01) el motivo es obligatorio**
(`MOTIVO_REQUERIDO`, mínimo 5 caracteres en `notas`), en el servidor y en la
pantalla: una diferencia corre el saldo de la cuenta y tiene que quedar
explicada. El mecanismo no cambió.

---

## Tarjetas, cuenta del socio y adelantos

### Para qué existe

Para rendir cada tarjeta de crédito todos los meses: qué gasto es de Voltia y
cuál es personal, que lo personal no se cuente como gasto de la empresa, y que
lo que el socio o un empleado deben quede anotado hasta que se devuelva o se
descuente del sueldo.

### Cómo se usa

**Finanzas → Bancos → Tarjetas** (`FinanceTarjetasTab.tsx`): se elige tarjeta
y mes.

- **Quién usa la tarjeta**: titular y adicionales, cada uno con su **regla**
  (de Voltia / personal / mixta) y a dónde va lo personal (cuenta del socio o
  adelanto a descontar).
- **Totales del mes**: de Voltia, personal del socio, a descontar, pagado a
  la tarjeta, y el saldo (si queda en cero después del pago, "cierra").
- **Gastos** con "quién" y los botones **Es personal** / **Es de Voltia**. En
  una tarjeta de la empresa, pasar un gasto a personal pide **quién
  autorizó**.
- **Cuenta del socio** (saldo por moneda) y **adelantos a descontar**, con
  **Descontado**.

Los gastos se cargan como cualquier movimiento, con la tarjeta como cuenta; el
pago de la tarjeta es una **transferencia** banco → tarjeta (Movimientos →
Transferencia).

### Cómo funciona

- **Una tarjeta es una cuenta** (`Account` tipo `TARJETA`). Su saldo
  (`saldoTarjeta()` en `tarjetas.routes.ts`) es saldo inicial + ingresos
  cobrados − gastos pagados desde `fechaSaldoInicial`; negativo = se debe.
- **`TarjetaTitular`** (`tarjeta_titulares`): `nombre`, `regla`
  (`ReglaTarjeta`: `VOLTIA` / `PERSONAL` / `MIXTA`) y `personalComo`
  (`CUENTA_SOCIO` o `ADELANTO_PERSONAL`). El movimiento lo referencia con
  `tarjetaTitularId`.
- **Clasificar** (`PATCH /finance/tarjetas/movimientos/:id`): al elegir el
  titular se aplica su regla (PERSONAL → personal, VOLTIA → de Voltia; MIXTA no
  decide). Pasar a personal cambia `categoriaPrincipal` a la `personalComo`
  del titular (exige titular: `TITULAR_REQUERIDO`; en un titular de regla
  VOLTIA exige `autorizadoPor`: `AUTORIZACION_REQUERIDA`, guardado en
  `personalAutorizadoPor`). Volver a "de Voltia" pone la categoría indicada o
  `VARIABLE` y limpia descontado y autorización.
- **Categorías nuevas** `CUENTA_SOCIO` (gasto personal del socio pagado por
  Voltia; como INGRESO, la devolución) y `ADELANTO_PERSONAL` (gasto personal
  autorizado de un empleado, a descontar del sueldo; `descontadoAt` /
  `descontadoPorId`). **Ninguna entra al resultado.**
- **Cuenta del socio** (`GET /finance/personales` → `saldoSocio`): suma de
  GASTO `CUENTA_SOCIO` menos INGRESO `CUENTA_SOCIO`, por moneda.

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/tarjetas`, `GET /finance/tarjetas/:accountId/resumen?anio=&mes=`, `GET /finance/personales` | `FINANZAS:VIEW` |
| `POST /finance/tarjetas/:accountId/titulares`, `PATCH /finance/tarjetas/titulares/:id`, `PATCH /finance/tarjetas/movimientos/:id`, `POST /finance/personales/:id/descontado` | `FINANZAS:EDIT` |

Clasificar respeta el cierre de mes (`assertFechaAbierta()` con la fecha del
gasto). Todo se audita (`account` o `finance_movement`).

### Casos borde

- **Un gasto de un titular de regla MIXTA** queda "Por decidir"
  (`SIN_DECIDIR`, `FinanceMovement.tarjetaDecididoAt` null) hasta que se marca
  de Voltia o personal. Mientras tanto **cuenta como gasto de Voltia en el
  resultado** (su categoría sigue siendo la de Voltia).
- Un gasto **sin titular** también cuenta como gasto de Voltia en el resultado.
  La pantalla avisa arriba de la tabla cuánto falta decidir
  (`totales.sinTitular` y `totales.sinDecidir`).
- `saldoSocio` y la lista de adelantos toman **todos** los movimientos de esas
  categorías (sin filtro de estado ni de cuenta); la lista de adelantos trae
  los últimos 300.
- Los titulares no se borran: se desactivan (`activo`).
- Probado solo con datos de prueba ("PRUEBA Tarjeta BBVA").

---

## Estado de resultados

### Para qué existe

Responde "¿cuánto ganamos (o perdimos) en tal período?" con la plata que
efectivamente entró y salió. Se ve en Finanzas → Informes → Resultados (por mes,
trimestre o año) y desde el chat con la herramienta `estado_resultados` del
conector (cap. 13), que además acepta cualquier rango de fechas.

### Cómo funciona

- Toda la cuenta vive en `services/finance/resultados.service.ts` →
  `calcularEstadoResultados(fechaInicio, fechaFin)`. La ruta `GET /finance/results`
  solo traduce mes/trimestre/año a fechas (`rangeForPeriod()`) y llama al
  servicio; el conector llama al mismo servicio. Al extraerlo se comparó la
  respuesta de la pantalla antes y después en 10 períodos: idéntica.
- **Criterio de caja**: entran los movimientos con estado PAGADO cuya fecha cae
  en el período. Los gastos que se pagaron contra facturas de proveedor no se
  cuentan por el movimiento sino por el **pago** real del período, para que un
  pago parcial caiga en el mes en que salió la plata.
- **Qué no entra** (ni a ingresos ni a egresos):
  - las categorías `AJUSTE_CONCILIACION`, `TRANSFERENCIA`, `CUENTA_SOCIO` y
    `ADELANTO_PERSONAL` (filtro `notIn` sobre `categoriaPrincipal`);
  - los **ajustes de deuda** (`Payment` con `metodo = AJUSTE`): no son plata
    (ver "Ajustes de deuda con un proveedor").
  
  El mismo filtro está en las tres cuentas de resultado que hay en el código:
  `calcularEstadoResultados()`, `calculateIncomeStatement()` y la ruta
  `/finance/income-statement/yearly-breakdown` (las dos últimas en
  `api.routes.ts`). El prompt del asistente IA (text-to-SQL,
  `ai-assistant.service.ts`) también dice que `metodo = 'AJUSTE'` se excluye
  siempre.
- Los egresos se agrupan en costos fijos, costos variables, salidas por obra
  (agrupadas por proyecto; lo que no tiene proyecto aparece como "Sin
  proyecto"), pagos a proveedores, compras de stock y otros.
- **Todo en dólares.** Los pesos se convierten con la **última cotización
  cargada** (`services/finance/tipo-cambio.ts` → `ultimoUsdToUyu()`).
- **Plan de Protección contra Granizo:** los movimientos de la categoría
  `SEGURO_GRANIZO` (las anualidades cobradas son INGRESO y las reposiciones son
  GASTO) no entran en ingresos ni en egresos. Van en el bloque `planGranizo`
  (`ingresos`, `reposiciones` y `neto`) y sí suman al `resultado`. El reporte
  anual (`/finance/reports/results`) los muestra en la columna `planGranizo`,
  sólo con lo PAGADO. Ver cap. 09, "Plan de Protección contra Granizo".

### Permisos

`FINANZAS:VIEW`, en la pantalla y en el chat.

### Casos borde

- ⚠️ **El resultado de un mes pasado cambia un poco cada vez que se carga una
  cotización nueva**, porque los pesos se convierten con la última y no con la
  del movimiento ni la del mes. Es el comportamiento heredado de la pantalla y
  se conservó a propósito para que el chat dé el mismo número; es una decisión a
  revisar.
- Hay **otras cuentas de resultados** en el código (`calculateIncomeStatement()`
  detrás de `/finance/income-statement*`, y `/finance/reports/results`) con
  criterios distintos. La que manda es esta, la de la pestaña Resultados.
  Desde que se borraron las pantallas viejas (21-oct-2026) **ninguna pantalla
  del cliente llama a esas rutas** (verificado con grep en `client/src`); quedan
  solo como API.
- ⚠️ **Las transferencias entre cuentas cambian los totales históricos.** Hasta
  el 21-oct-2026 `TRANSFERENCIA` entraba de los dos lados (la entrada como
  ingreso y la salida como egreso): el resultado neto daba igual, pero inflaba
  ingresos y egresos. Al excluirla, **los ingresos y egresos de los meses con
  transferencias bajan** respecto de lo que se veía antes; el resultado neto no
  cambia.
- Lo que se le debe a un instalador tercerizado no aparece hasta que se le paga.
- Un gasto de tarjeta marcado como personal (cuenta del socio o adelanto) sale
  del resultado; si después se vuelve a marcar "de Voltia", vuelve a entrar.

---

## Cierre de mes y archivo para la contadora

### Para qué existe

Para que un mes revisado **no cambie después**: que lo que se le mandó a la
contadora y lo que se miró como resultado sigan siendo verdad. Y para tener,
antes de cerrar, una lista de lo que falta revisar.

### Cómo se usa

**Finanzas → Informes → Cierre** (`FinanceCierreTab.tsx`): se elige el mes.

1. **Lista de control**: cinco puntos que se calculan solos y cuatro que
   tilda una persona.
2. **Archivo para la contadora**: baja un Excel del mes.
3. **Cerrar el mes**: con algo sin resolver se puede cerrar igual,
   escribiendo por qué (mínimo 10 caracteres).
4. Un mes cerrado muestra quién y cuándo lo cerró, la nota, y **Reabrir** (con
   motivo de al menos 10 caracteres).

Cerrar y reabrir solo aparecen con `FINANZAS:COMPLETE`.

### Cómo funciona

`services/finance/cierre-mes.service.ts`, rutas en `api.routes.ts` (bloque
"Cierre de mes"). Modelo `CierreMes` (`cierres_mes`): `anio`, `mes`, quién y
cuándo cerró, `notaCierre`, `foto` (JSON), `checklist` (JSON), y
`reabiertoAt` / `reabiertoPorId` / `motivoReapertura`.

**Fecha de cierre** (`fechaDeCierre()`): el último día del mes cerrado **más
reciente** sin reabrir. Es una sola fecha: todo lo anterior queda cerrado
aunque un mes del medio no se haya cerrado nunca.

**Qué frena** (`assertFechaAbierta()`, error 409 `MES_CERRADO`): crear, editar
y borrar movimientos (`/finance/movements`) y pagos (`/finance/payments`), los
ajustes, "Arrancar cuenta" y clasificar un gasto de tarjeta, con fecha (vieja
o nueva) en un mes cerrado.

**Lista de control** (`listaDeControl()`), calculada sobre el mes:

| Clave | Punto | Cómo se calcula |
|---|---|---|
| `banco` | Todo lo del banco está cargado | ningún "falta cargar" con fecha del mes, y todas las cuentas con banco tienen al menos una lectura |
| `sin_banco` | Lo cargado aparece en el banco | ningún "cargado que el banco no muestra" con fecha del mes |
| `facturas` | Facturas de proveedores del mes revisadas | ninguna `FacturaRecibida` PENDIENTE emitida en el mes |
| `fijos` | Costos fijos del mes pagados | ningún GASTO con `fixedCostId`, no pagado, no previsto, del mes |
| `facturacion` | Obras que llevan factura, facturadas | ningún proyecto con `llevaFactura` y sin `facturaEmitida` vendido antes del fin del mes |

Más `CONTROLES_MANUALES`: estados de cuenta de los proveedores principales
comparados; tarjetas rendidas; descuentos a empleados y cuenta del socio
revisados; revisión del dueño.

**Cerrar** (`POST /finance/cierres`): rechaza un mes que no terminó
(`MES_EN_CURSO`) o ya cerrado (`MES_YA_CERRADO`); con puntos sin resolver exige
nota (`CIERRE_CON_PENDIENTES`). Guarda la lista tal como estaba y una
**foto**: caja por cuenta, posición y resultado del mes
(`calcularEstadoResultados()`). Audita como `cierre_mes`.

**Reabrir** (`POST /finance/cierres/:id/reabrir`): **reabre también todos los
meses posteriores** cerrados (la fecha de cierre es una sola), con el mismo
motivo. Queda auditado.

**Archivo para la contadora** (`archivoContadora()`, Excel con ExcelJS):

| Hoja | Qué tiene |
|---|---|
| Compras | libro de compras: `FacturaRecibida` del mes no descartadas, con RUT, comprobante, neto, IVA, total y si está cargada o por revisar; **notas de crédito en negativo** |
| Ventas | lo emitido por Biller (`CfeEmitido` aceptado o esperando DGI), NC en negativo, con tasa de cambio |
| Ajustes | los ajustes de deuda del mes, con motivo y quién |
| Movimientos | todos los movimientos del mes (sin previstos) |

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/cierres`, `GET /finance/cierres/control?anio=&mes=`, `GET /finance/cierres/archivo?anio=&mes=` | `FINANZAS:VIEW` |
| `POST /finance/cierres`, `POST /finance/cierres/:id/reabrir` | **`FINANZAS:COMPLETE`** |

`FINANZAS:COMPLETE` es nuevo en el catálogo. El script
`server/scripts/seed-cierre-mes-permiso.ts` se lo da a ADMIN y FINANZAS
(corrido en desarrollo; falta en producción). La idea es darlo solo a quien
cierra (el dueño y la contadora).

### Reglas y decisiones

- **Un mes cerrado no cambia por la mano de una persona**, pero sí se puede
  reabrir, con motivo y registro.
- Se puede cerrar con puntos sin resolver: la lista ayuda, no bloquea.

### Casos borde

- ⚠️ **El cierre no frena lo que crean otros caminos.** No pasan por
  `assertFechaAbierta()`: confirmar facturas recibidas (a mano o la carga
  automática de cuenta corriente) y descontar notas de crédito, las
  comisiones, los cobros de Experiencia Solar y los pagos a instaladores. Las
  transferencias entre cuentas sí se frenan. Una factura con
  fecha de un mes cerrado que se confirma después entra igual.
- ⚠️ **La foto no es "al fin de mes"**: la caja y la posición son las del
  momento en que se cierra (`computeAccountBalance()` y
  `getPosicionFinanciera()` de hoy); solo el resultado es el del mes.
- **Reabrir un mes viejo reabre todos los posteriores.** Hay que volver a
  cerrarlos uno por uno.
- La foto convierte a dólares con la última cotización del momento (como todo
  el resultado), así que no coincide exacto con un resultado del mismo mes
  mirado otro día.
- El control `facturacion` mira todas las obras vendidas hasta ese mes, no
  solo las del mes: una obra vieja sin facturar lo deja en rojo en todos los
  meses siguientes.

---

## Historial (auditoría de Finanzas)

`services/finance/auditoria.service.ts` → `registrarCambios()`. Por cada campo
que cambia deja una fila en `audit_logs`, con `fieldChanged`, `oldValue` y
`newValue`. Los valores van legibles: fechas en aaaa-mm-dd, montos como número, y
cuentas, proveedores y proyectos por su nombre.

- Se llama en `PATCH /finance/movements/:id`, en `PATCH /finance/cobros/:id`
  (Experiencia Solar), en la transición de estado (además de su fila
  `status_changed`) y en `PATCH /finance/payments/:id`.
- Si no cambió nada, queda una sola fila "sin cambios".
- Altas y bajas ya se auditaban.

`GET /finance/historial` (`FINANZAS:VIEW`) lee `audit_logs` de
`ENTIDADES_FINANZAS`, con filtros `desde`/`hasta` (días de Uruguay), `userId`,
`entidad`, `accion`, `buscar` y `entityId`, y páginas de 100. La pestaña es
`FinanceHistorialTab.tsx`.

**Agujeros conocidos:** no todos los caminos que modifican plata pasan por
`registrarCambios()`. Quedan afuera:

- el cambio de fecha desde Pendientes o el cashflow (`/finance/cashflow/events/...`);
- las ediciones de comisiones e instaladores, que tienen su propia auditoría
  descriptiva;
- el plan de pagos, que reemplaza los previstos con borrado lógico.

**Qué se ve en Historial:** `ENTIDADES_FINANZAS` incluye también
`bank_movement` (No va, confirmar o soltar una pareja), `cierre_mes` (cierres y
reaperturas) y `cfe_emitido` (facturas y notas de crédito emitidas). Los ajustes (`payment`),
"Arrancar cuenta" (`supplier`), las facturas que entran solas
(`factura_recibida`) y lo de tarjetas (`account`, `finance_movement`) sí
aparecen.

---

## Qué falta cubrir de este capítulo

- Movimientos: tipos, fuentes y comprobantes
- Pagos a proveedores y la aplicación FIFO a facturas
- Flujo de fondos: proyección de costos fijos y filtros
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
