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
diferencias: admite **pagos parciales** y el instalador sale **del equipo con
que se agenda la obra en el calendario**.

### Cómo se usa

**El pago lo crea el calendario.** Al agendar una obra con un equipo
**tercerizado**, se crea solo, con el monto congelado de la propuesta ganadora,
asignado a **quien cobra por ese equipo** y con la fecha de trabajo = el primer
día de obra. Cada equipo tercerizado tiene su "quién cobra" en **Admin →
Equipos** (`Team.installerUserId`). Las obras de **equipo propio** no generan
pago: no se paga aparte.

Desde **Finanzas → Instaladores** (o `/pagos-instalador`), quien gestiona:

1. **Corrige** el instalador o el monto si hace falta (el camino normal es que
   ya venga asignado desde el calendario).
2. **Registra los pagos**, totales o parciales. Cada uno pide monto, fecha y una
   nota opcional.
3. Puede **cargar pagos a mano** para trabajos que no salen de un proyecto (una
   reparación en garantía, una obra anterior a esta funcionalidad).
4. Puede **filtrar por instalador** y copiar un **resumen para WhatsApp**.

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

**Quién crea, mueve y quita el pago:** `syncInstallerPaymentForProject()` en
`installer-payment.service.ts`. Lo llaman todas las rutas del calendario que
tocan la agenda (`POST /calendar`, `PATCH /calendar/:id`, `/reschedule`, los
tramos y `DELETE /calendar/:id`) por el helper `syncPagoInstalador()` de
`api.routes.ts`, y `PATCH /teams/:id` cuando cambia quién cobra o el tipo del
equipo (`syncInstallerPaymentsForTeam()`). Es best-effort: si falla, la agenda
igual queda guardada.

| Situación de la obra | Qué pasa con el pago |
|---|---|
| Agendada con equipo tercerizado | Existe, asignado a quien cobra por el equipo (o sin asignar si el equipo no tiene a nadie), `fechaTrabajo` = primer tramo, vence el 1.º del mes siguiente |
| Agendada con equipo propio | Se quita |
| Se borra la agenda | Se quita |
| Sin agenda (nunca se agendó) | Se quita solo si nadie lo asignó; uno asignado a mano se respeta |
| **Tiene entregas** | **No se toca nunca**: ni se quita ni se reasigna |

"Quitar" es soft-delete (`deletedAt`). Como `projectId` es `@unique`, si la obra
vuelve a un tercerizado se **reactiva el mismo pago**, con su monto (y su
edición, si la tuvo). El monto se congela con `createInstallerPaymentForProject()`,
idempotente por `projectId`.

**Hasta el 10-oct-2026 el pago se creaba al ganar la venta**, para todas las
obras y sin instalador: quedaban "sin asignar" también las de equipo propio, y
faltaban las de tercerizados vendidas antes del módulo (ej. Antonella Brondo,
agendada con Fernando y sin pago). Lo de antes se ordenó con
`server/prisma/scripts/sync-pagos-instalador-calendario.ts` (idempotente,
`--dry-run`, `--desde AAAA-MM-DD`): vincula cada equipo tercerizado con el
instalador cuyo nombre empieza igual ("Fernando" → "Fernando Leal") y corre la
sincronización en cada proyecto con agenda o con pago. **Decisión de Nicolás
(10-oct): rige de ahora en adelante**, así que en prod se corre con `--desde
2026-10-10`: a las obras tercerizadas anteriores sin pago no se les crea (se
pagaron por fuera, y el módulo recién existe desde el 20-ago); si hace falta
alguna, se carga a mano. Quitar los "sin asignar" sobrantes se hace en todas.

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
| Crear / mover / quitar el pago al agendar la obra | el de la ruta del calendario (`OPERACIONES:CREATE`/`EDIT`/`DELETE`) |
| Configurar quién cobra por un equipo | `CONFIGURACION:CREATE`/`EDIT` (Admin → Equipos) |

Quien agenda en el calendario **no necesita permisos de Finanzas** para que el
pago se cree o se mueva: es un efecto de agendar, no una acción sobre el pago.

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

## Estado de resultados

### Para qué existe

Responde "¿cuánto ganamos (o perdimos) en tal período?" con la plata que
efectivamente entró y salió. Se ve en Finanzas → Estado de resultados (por mes,
trimestre o año) y desde el chat con la herramienta `estado_resultados` del
conector (cap. 13), que además acepta cualquier rango de fechas.

### Cómo funciona

- Toda la cuenta vive en `services/finance/resultados.service.ts` →
  `calcularEstadoResultados(fechaInicio, fechaFin)`. La ruta `GET /finance/results`
  solo traduce mes/trimestre/año a fechas (`rangeForPeriod()`) y llama al
  servicio; el conector llama al mismo servicio. Al extraerlo se comparó la
  respuesta de la pantalla antes y después en 10 períodos: idéntica.
- **Criterio de caja**: entran los movimientos con estado PAGADO cuya fecha cae
  en el período, sin los ajustes de conciliación. Los gastos que se pagaron
  contra facturas de proveedor no se cuentan por el movimiento sino por el
  **pago** real del período, para que un pago parcial caiga en el mes en que
  salió la plata.
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
- Hay **otras dos cuentas de resultados** en el código (`calculateIncomeStatement`
  y la ruta vieja de reportes) con criterios distintos. La que manda es esta,
  la de la pestaña Estado de resultados.
- Lo que se le debe a un instalador tercerizado no aparece hasta que se le paga.

---

## Cobros a clientes y el plan de pagos

### Para qué existe

Cada proyecto tiene una vista de **Cobros** que muestra, sobre el presupuesto,
cuánto se cobró y cuánto falta. El **plan de pagos** permite dejar agendados los
cobros previstos (seña + cuotas) para que aparezcan como pendientes hasta que
entra la plata.

### Cómo se usa

- Se entra al detalle de cobros de un proyecto (desde Finanzas → Cobros o desde
  la vista de Cobros del módulo Experiencia Solar).
- Con el botón de plan de pagos se abre un modal que **precarga una sugerencia**
  (seña + 3 cuotas) sobre el saldo pendiente, editable fila por fila (descripción,
  monto, %, fecha). Al confirmar se crean los cobros previstos.
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
  con **seña fija USD 500** sobre el saldo pendiente. Las 3 cuotas vienen nombradas
  "Pago previo 50%", "Pago obra terminada 30%" y "Pago obra habilitada 20%".
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

---

## Cuentas por pagar y facturas recibidas (Biller)

### Para qué existe

Para saber en todo momento cuánto se le debe a cada proveedor y para cuándo, y
que ninguna factura de proveedor se pierda: las facturas que le emiten a Voltia
se traen solas de la facturación electrónica (Biller) y se revisan en una bandeja.

### Cómo se usa

- **Finanzas → Cuentas por pagar** (`FinanceCuentasPorPagarTab.tsx`): totales
  por tramo, una fila por proveedor (desplegable con sus facturas) y, abajo, la
  bandeja **Facturas recibidas**.
- **Finanzas → Facturas de proveedores** (`FinanceFacturasProveedoresTab.tsx`):
  registro de todas las facturas, con filtros.
- Plazo y límite: en el formulario de proveedor (`FinanceSuppliers.tsx` →
  `SupplierForm`).

### Cómo funciona

**Datos.** `Supplier` suma `plazoCreditoDias` (default 30), `limiteCredito`
(null = sin límite) y `limiteCreditoMoneda`. La migración
`20261009232500_plazo_credito_efergia` deja a EFERGIA en 10. Las facturas
recibidas viven en `FacturaRecibida` (`facturas_recibidas`), única por
`rutEmisor + tipoCfe + serie + numero`, con `raw` (el JSON tal cual vino) para no
perder nada. Una confirmada apunta a su `FinanceMovement` (`movementId @unique`).

**Vencimiento.** `cuentas-por-pagar.service.ts` → `calcularVencimiento()` =
emisión + `plazoCreditoDias`. Lo usan `POST /finance/supplier-invoices` cuando no
viene `fechaVencimiento` (ahora opcional) y la confirmación de la bandeja. **Manda
el plazo negociado, no el vencimiento del CFE**; la bandeja muestra los dos
cuando difieren (`fechaVencimientoCfe` vs `vencimientoPorPlazo`).

**Deuda por tramos.** `getCuentasPorPagar()`: GASTO con proveedor en
COMPROMETIDO / A_PAGAR / PARCIALMENTE_PAGADO por su saldo (monto − aplicaciones
de pagos vigentes), vencimiento `dueDate ?? expectedDate ?? fecha` (mismo
criterio que el cashflow), tramos `VENCIDO` / `HASTA_7` / `HASTA_30` / `MAS_30`
(`tramoDe()`). El saldo a favor sale de `accumulateSupplierSaldoAFavor()` y se
muestra aparte. El límite se compara contra la deuda neta **en la moneda del
límite**, sin convertir.

**Importación desde Biller.** `services/biller/recibidos.service.ts`:

- `sincronizarRecibidos(dias = 45)` pide dos endpoints y junta las filas en
  `guardarRecibidos()`:
  - `GET /v2/comprobantes/recibidos/obtener` (lo que tiene DGI: **todos** los CFE
    a nuestro RUT, solo totales, con `rut_emisor`);
  - `GET /v2/comprobantes/obtener?recibidos=1` (lo que llegó al mail publicado
    en DGI, con `fecha_vencimiento`). La documentación no muestra dónde viene el
    emisor en esta respuesta: `desdeMail()` lo busca en `emisor.rut`,
    `rut_emisor` y `emisor_rut`, y si no está empareja con la fila de DGI por
    tipo/serie/número. **No verificado con datos reales** (la cuenta de test
    devuelve `[]`).
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
- Job `recibidos.job.ts` → `startBillerRecibidosJob()`: `15 8-20 * * 1-6` hora
  Uruguay (`CRON_BILLER_RECIBIDOS`). **No corre sin `BILLER_TOKEN`.**
  `BILLER_URL` elige test o producción. El resultado de la última corrida queda
  **en memoria** (`getUltimaSync()`): se pierde al reiniciar.

**Bandeja** (`routes/cuentas-por-pagar.routes.ts`):

- `confirmar`: crea el `FinanceMovement` GASTO / PAGO_PROVEEDOR / A_PAGAR con
  `invoiceNumber = serie-numero`. Si el proveedor elegido no tiene RUT, se le
  graba el del CFE; si tiene otro, `RUT_NO_COINCIDE`.
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

### Permisos

| Endpoint | Permiso |
|---|---|
| `GET /finance/cuentas-por-pagar`, `GET /finance/facturas-recibidas`, `GET /finance/facturas-proveedores` | `FINANZAS:VIEW` |
| `POST /finance/facturas-recibidas/sincronizar`, `/:id/confirmar`, `/:id/vincular`, `/:id/descartar`, `/:id/reabrir`, `/crear-proveedor` | `FINANZAS:EDIT` |

No hay guards por rol: todo pasa por la matriz.

### Reglas y decisiones

- **Nada entra a la deuda solo.** Igual que en la emisión de CFE (ver
  `docs/pendientes/facturacion-biller/README.md`), una persona confirma.
- **Notas de crédito: a mano por ahora.** El sistema modela una NC como un
  `Payment` negativo, que no reduce deuda (`accumulateSupplierSaldoAFavor`
  ignora negativos) y pide cuenta bancaria. Hasta definir el tratamiento con el
  contador, la bandeja no las convierte: se marcan como registradas con el motivo.
- Monedas distintas de USD/UYU no se importan (el enum `Moneda` no las tiene).

### Casos borde

- En la cuenta de **test** de Biller los endpoints de recibidos devuelven `[]`:
  la forma real de la respuesta de mail queda por confirmar con la cuenta de
  producción (falta el certificado de VOLTIA SAS).
- La ventana es de 45 días hacia atrás: una factura vieja que DGI recién
  registre después de eso no entra sola (hay que ampliar `dias`).
- Proveedores sin RUT cargado: sus facturas quedan "sin proveedor" hasta que se
  elige uno en la bandeja (y ahí se le graba el RUT).

---

## Qué falta cubrir de este capítulo

- Movimientos: tipos, fuentes y comprobantes
- Pagos a proveedores y la aplicación FIFO a facturas
- Facturación al cliente: qué lleva factura y su estado
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
## La factura que se le emite al cliente

**Dónde:** Finanzas → Facturación al cliente, columna **Factura**.

El archivo se guarda como un `FileAttachment` del proyecto con
`toolSource = "factura-cliente"`. **Hay una sola por proyecto**: subir una nueva
soft-deletea la anterior (`deletedAt`), así que el reemplazo queda en la base pero
la pantalla muestra una.

| Acción | Endpoint | Permiso |
|---|---|---|
| Adjuntar | `POST /finance/facturacion/:projectId/factura` (multipart) | `FINANZAS:EDIT` |
| Ver / descargar | `GET /finance/facturacion/:projectId/factura[?descargar=true]` | `FINANZAS:VIEW` |

**Por qué no usa el endpoint general de archivos** (`/files/:id/download`): ese
pide permiso de **Operaciones**, y quien factura puede no tenerlo. El de acá va
por Finanzas, que es quien trabaja en esa pantalla.

`descargar=true` cambia el `Content-Disposition` de `inline` a `attachment`: la
misma ruta sirve para la vista previa en el navegador y para bajar el archivo.

El listado de facturación (`GET /finance/facturacion`) devuelve `factura: {id,
filename, mimeType, subidaEn} | null`, que es lo que decide qué ícono se muestra.

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
