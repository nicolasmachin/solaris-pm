# Manual de trabajo de Finanzas

**Voltia · Uruguay** · Versión 0.7 · vigente desde el 10 de octubre de 2026 · *borrador en revisión*

> Este manual es **el procedimiento, los lineamientos y las herramientas de
> Finanzas, juntos**: qué se hace, quién lo hace, en qué plazo, con qué criterio,
> y en qué pantalla de Voltia PM se hace. No hay un documento aparte para "el
> proceso" y otro para "el sistema": el sistema existe para sostener el proceso.
>
> Lo que conecta a Finanzas con las demás áreas está en el **Procedimiento
> General de Trabajo (PGT) de Voltia**. Acá va el detalle del área.
>
> **Describe cómo se trabaja, no cómo están las cuentas hoy.** Acá no van cuánto
> se debe ni cuántos clientes están atrasados: eso envejece en una semana. Los
> números del momento van a los informes.

---

## 0 · Quién lo tiene que leer

| Quién | Lee sí o sí | Consulta cuando lo necesita |
|---|---|---|
| **Finanzas** | Todo | — |
| **Gerencia** | 1, 2, 4, 6 | Todo |
| **Experiencia Solar** | 2, 4 (cobros), 5.9 (Cobros que gestiona Experiencia Solar), 5.17 (Plan granizo) | 5.7 |
| **Ventas (asesores comerciales)** | 2, 4 («Ningún proyecto avanza sin saber cómo y cuándo paga el cliente»), 5.10 (Comisiones) | 5.7 |
| **Operaciones y Logística** | 2, 4 («Las aprobaciones de gastos no frenan una obra»), 5.11 (Pagos a instaladores) | 5.3 a 5.5 |

## Qué es y qué no es este documento

**Es** la guía de trabajo de Finanzas: qué hace el área, qué recibe de las
demás, qué les entrega, con qué criterio decide y cómo usa cada pantalla de
**Voltia PM**, el sistema interno donde trabajan todas las áreas de Voltia.

**No es** un manual contable ni impositivo: cómo se registra cada cosa ante DGI o
en la contabilidad formal lo define el contador. Tampoco explica cómo trabajan
las otras áreas: de ellas trae solo lo que Finanzas necesita saber, repetido a
propósito para que nadie tenga que salir a buscarlo en otro manual.

Las palabras propias de Voltia (Voltia PM, UTE, etapa, onboarding, CFE, plan de
pagos…) se explican la primera vez que aparecen y están todas en el
**Glosario**, al final.

---

## 1 · Para qué existe Finanzas

Finanzas existe para que Voltia pueda decir **en todo momento** dos cosas:
**cuánto le debe Voltia a cada proveedor y para qué fecha**, y **cuánto le deben
los clientes a Voltia y para qué fecha**. Con eso se puede saber si la plata
alcanza (el **flujo de fondos**) y si la empresa gana o pierde (el **estado de
resultados**).

Para que esos números sirvan, tienen que salir de **documentos reales**: una
deuda con un proveedor existe cuando llega su factura; lo que debe un cliente
sale del **plan de pagos** que se acordó con él. Lo proyectado "a ojo" no se
carga como deuda.

Además, Finanzas es quien **paga**: a los proveedores, a los instaladores
tercerizados y las comisiones de los asesores; y quien **emite las facturas** a
los clientes que las llevan.

## 2 · Qué hace y dónde termina su trabajo

**Qué hace.** Cobra a los clientes según el plan de pagos que dejó armado Ventas,
paga a los proveedores, a los instaladores y las comisiones, emite las facturas
y lleva los resultados de la empresa.

**Dónde termina su trabajo.** Con un proyecto, cuando está **cobrado entero y
sus gastos, pagados**. Con la empresa en general, no termina: los costos fijos,
las cuentas y los resultados se llevan todos los meses.

### Qué recibe de cada área

| De | Qué recibe | Dónde lo ve en Voltia PM |
|---|---|---|
| **Ventas** (el asesor comercial) | Cada proyecto vendido llega con su **modalidad de pago** y lo que esa modalidad pide: el plan de pagos, la proforma para el banco o la explicación escrita de lo acordado. También indica si el proyecto **lleva factura** | Finanzas → Cobros; Finanzas → Facturación |
| **Ventas** (al ganar la venta) | La **comisión del asesor**, que se registra sola con el precio de la última propuesta publicada | Comisiones; Finanzas → Pendientes |
| **Operaciones** (al agendar la obra con un equipo tercerizado) | El **pago de la mano de obra** al instalador, a nombre de quien cobra por ese equipo | Finanzas → Instaladores |
| **Logística** | Los **gastos de compras** para aprobar | En ninguna: **los gastos de compras no se aprueban** por ahora (es una decisión de Gerencia, que lo deja para más adelante). Lo que sí se exige es que todo gasto quede **auditable**: ver 5.19 |
| **Proveedores** (por la facturación electrónica) | Las **facturas** que le emiten a Voltia | Finanzas → Cuentas por pagar → Facturas recibidas |
| **Experiencia Solar** | Los cobros que registra o marca pagados en su propia pestaña, y las anualidades del **Plan de Protección contra Granizo** | Finanzas → Cobros y Movimientos (es la misma información) |

### Qué entrega

| A | Qué entrega |
|---|---|
| **Todas las áreas** | La respuesta a «¿entró la seña?», «¿cómo se le cobra?», «¿hay aprobación para este gasto?». Son las consultas que el PGT manda a Finanzas |
| **Logística** | La **aprobación de los gastos** de compras, a tiempo para no frenar la obra (ver lineamientos) |
| **Experiencia Solar** | Los cobros al día: lo que Finanzas registra se ve al instante en la pestaña Cobros de Experiencia Solar y en el historial del cliente |
| **Asesores** | Las comisiones pagadas: al marcarlas pagadas en Finanzas, el asesor las ve como «Pagada» |
| **Instaladores tercerizados** | Los pagos registrados, que el instalador ve en **Mis cobros** |
| **Gerencia** | El flujo de fondos, el estado de resultados y los números de Finanzas del reporte semanal |

### A quién le pregunta qué

| Si hace falta saber… | Se le pregunta a… |
|---|---|
| Qué se le prometió al cliente sobre cómo y cuándo paga | Al **asesor comercial** del proyecto |
| Si el banco ya aprobó el crédito de un cliente | Al **asesor comercial**: él sigue el trámite con el banco |
| Qué equipo hizo una obra o cuándo se hizo | Al **gerente de Operaciones** |
| Qué compró Logística y para qué obra | A **Logística** |
| Cómo se registra algo ante DGI o en la contabilidad formal | Al **contador** |
| Algo del cliente que no es de plata | A **Experiencia Solar** |

---

## 3 · Procedimiento

Lo que sigue es el orden en que se trabaja. **Los plazos marcados como
«pendiente de definir» no tienen todavía una regla escrita**: hasta que Gerencia
los fije, se trabaja con criterio y se avisa si algo se demora.

### 3.1 · Lo que se hace todos los días

1. **Revisar la bandeja de facturas recibidas** (Finanzas → Cuentas por pagar →
   Facturas recibidas). Voltia PM trae las facturas solas cada hora, de lunes a
   sábado; ninguna suma a la deuda hasta que Finanzas la revisa. Plazo para
   revisarlas: *pendiente de definir*.
2. **Aprobar los gastos de compras** que pide Logística. Logística tiene 5 días
   hábiles para comprar y recibir el material de una obra con fecha confirmada:
   cada día que demora una aprobación es un día menos. **Por ahora los gastos
   de compras no pasan por una aprobación**: Gerencia lo dejó para más
   adelante. Mientras tanto, cada gasto queda registrado con quién lo cargó,
   cuándo y cada cambio que se le hizo (ver 5.19, Historial).
3. **Registrar lo que entró y lo que salió**: cada cobro que entra se marca
   pagado con **la fecha real** del pago; cada pago a un proveedor, a un
   instalador o de una comisión se registra cuando sale la plata.
4. **Mirar Pendientes**: lo que vence hoy o ya venció, de un lado y del otro.

### 3.2 · Lo que se hace cada semana

- **Revisar Cobros**: qué cuotas vencieron sin cobrar. Si una cuota está
  vencida, se le pregunta al asesor qué pasó antes de reclamarle al cliente.
  **El reclamo al cliente lo hace Experiencia Solar**, que es quien habla con
  él. Está decidido que pase al **área de Administración** (la contadora)
  cuando esa área se haga cargo de Finanzas en Voltia PM; ese día se corrige
  este manual.
- **Revisar Cuentas por pagar**: lo vencido y lo que vence en los próximos 7
  días, para programar los pagos.
- **Revisar el Flujo de fondos**: si la plata alcanza para lo que vence.
- **El reporte semanal** llega por correo los lunes a primera hora, con la
  cantidad de gastos registrados en la semana, entre otros indicadores (ver
  5.18). Que el número sea real depende de que los gastos se carguen en la
  semana en que ocurren.

### 3.3 · Lo que se hace cada mes

- **Pagar las comisiones** del mes: cada comisión vence el **día 1 del mes
  siguiente** a la venta.
- **Revisar los costos fijos** del mes y marcarlos pagados.
- **Conciliar las cuentas bancarias** con el saldo real del banco, **una vez
  por mes** (ver 5.13).
- **Cerrar el estado de resultados** del mes.
- **Controlar la facturación al cliente**: que no queden facturas pendientes de
  emitir de proyectos que ya cobraron. Plazo para emitir: *pendiente de
  definir*.
- **Comparar con el estado de cuenta de cada proveedor**: se sube el estado de
  cuenta que manda el proveedor en su ficha y Voltia PM lo compara con lo
  cargado (ver 5.4, «Conciliación con el estado de cuenta»). **Una vez por mes, a mano**: Finanzas le pide el estado de cuenta a cada proveedor con el que tiene cuenta a crédito, lo sube y revisa las diferencias. Voltia PM no lo pide ni lo sube solo: la comparación la hace al subirlo.

### 3.4 · El recorrido de la plata de un proyecto

1. **El asesor gana la venta.** Se registra sola la **comisión**, como un
   pendiente en Finanzas.
2. **Onboarding** (la etapa del proyecto en la que el asesor confirma la venta,
   firma el contrato y cobra la seña). El asesor deja definida la modalidad de
   pago: con **pago directo**, el plan de pagos; con **financiación bancaria**,
   la proforma; con **otro**, la explicación. Sin eso el proyecto no avanza.
3. **Se cobra la seña** y, con pago directo, **el 50 % entre 10 y 15 días antes
   de la obra**. **Sin el 50 % pago no se da fecha de obra.** Con financiación
   bancaria, la condición es el crédito aprobado.
4. **Logística compra**; Finanzas aprueba los gastos y, cuando llegan, revisa
   las facturas de los proveedores en la bandeja.
5. **Operaciones agenda la obra.** Si es con un equipo tercerizado, aparece solo
   el pago de la mano de obra al instalador.
6. **Obra terminada**: se cobra el **30 %**.
7. **UTE habilita** la instalación: se cobra el **20 %**.
8. Si el proyecto **lleva factura**, Finanzas la emite y la marca emitida.
9. El trabajo de Finanzas con el proyecto termina cuando está **cobrado entero y
   sus gastos pagados**.

---

## 4 · Lineamientos

### Las aprobaciones de gastos no frenan una obra

Finanzas aprueba los gastos de las compras. Logística tiene 5 días hábiles para
comprar y recibir todo el material de una obra cuya fecha ya está confirmada y
que el cliente ya sabe. Esa fecha **se defiende**: moverla es la excepción. Por
eso una aprobación que demora es un día menos para comprar, y puede terminar en
una obra que se mueve, que es plata (una cuadrilla organizada, una vuelta más,
la obra de otro cliente que no se hizo).

Si la fecha se mueve por algo que dependía de Finanzas, **el atraso lo explica
Finanzas**. Gerencia revisa una vez por mes cuántas fechas se movieron y por qué
área.

### Lo que se le debe a un proveedor entra con su factura, no antes

Voltia PM ya **no proyecta las compras de materiales** de cada obra. Antes, al
armar la lista de materiales de un proyecto se podía cargar una fecha estimada
de compra, y ese gasto aparecía en **Pendientes** y en el **Flujo de fondos**
como «Material proyectado». Ya no: lo que Voltia le debe a un proveedor existe
desde que llega **su factura**, con su fecha de vencimiento. Así, lo que se ve
como deuda es deuda real, y se puede comparar con el estado de cuenta que manda
el proveedor.

### Cada proveedor tiene su plazo y, si corresponde, su límite

El **plazo de crédito** es la cantidad de días que el proveedor le da a Voltia
para pagar una factura, contados desde que la emite. Es el que se negoció con
cada uno: hoy son **30 días para todos, salvo EFERGIA, que da 10**. Con ese plazo
Voltia PM calcula solo el vencimiento de cada factura.

El **límite de crédito** es el tope de deuda que el proveedor acepta (por
ejemplo, FIVISA o MGI). Hay proveedores sin límite, como Tiempo al Tiempo. Cuando
lo que se le debe a un proveedor pasa su límite, Voltia PM lo marca en rojo.

Si el vencimiento que trae la factura no coincide con el plazo acordado, **manda
el plazo acordado**, y Voltia PM avisa de la diferencia para hablarlo con el
proveedor.

### Ninguna factura entra a la deuda sin que alguien la mire

Las facturas que los proveedores le emiten a Voltia llegan solas desde la
facturación electrónica (ver el capítulo 5), pero **quedan en una bandeja hasta
que alguien de Finanzas las revisa**. Ahí se decide si es deuda nueva, si ya se
había cargado a mano (y se vinculan, para no contarla dos veces) o si se descarta
—por ejemplo, porque no es de Voltia—, escribiendo siempre el motivo.

Las **notas de crédito** (cuando el proveedor descuenta algo de lo facturado)
llegan a la bandeja, pero por ahora se registran a mano y después se marcan como
registradas.

### Ningún proyecto avanza sin saber cómo y cuándo paga el cliente

El asesor de ventas no puede cerrar el onboarding (la primera etapa del
proyecto, cuando se confirma la venta) sin dejar definida la **modalidad de
pago** y lo que esa modalidad pide:

| Modalidad | Lo que tiene que quedar hecho |
|---|---|
| **Pago directo** con Voltia | El **plan de pagos**, con la fecha y el monto de cada cobro |
| **Financiación bancaria** | La **proforma** para el banco |
| **Otro** (un canje, una condición negociada) | La explicación escrita de qué se acordó |

Para Finanzas esto quiere decir que cada proyecto vendido llega con sus cobros
previstos y sus fechas, y que en **Cobros** se ve qué se espera cobrar y cuándo.
La regla vale también para los proyectos que ya estaban en onboarding.

### El plan de pagos lo arma el asesor; Finanzas lo cobra

El plan de pagos lo arma el asesor en el onboarding, porque es quien lo acordó
con el cliente. Finanzas también lo puede crear o editar desde Cobros. **Los
montos y las fechas de cobro salen siempre del plan de pagos**, nunca de
memoria: un número mal dicho sobre plata es de lo que más cuesta arreglar.

### Un cobro se marca pagado con la fecha en que entró la plata

No con la fecha en que se carga. El estado de resultados y el Plan de Protección
contra Granizo toman esa fecha como la del pago: una fecha mal puesta cambia el
mes del resultado y, en el plan granizo, desde cuándo cubre.

### El estado de resultados es de caja

Cuenta **solo lo que efectivamente entró y salió** en el período: lo pagado. Lo
previsto, lo que está a pagar y lo que se le debe a un instalador todavía no
pagado **no aparece**. Por eso un mes «bueno» en resultados puede tener deudas
grandes por vencer: para eso está el flujo de fondos.

### La plata del Plan de Protección contra Granizo no es ganancia

Es la reserva para reponer paneles cuando una tormenta pega en varias obras el
mismo día. Va en una línea propia y **no suma al saldo de la obra**: la
anualidad del plan no salda el presupuesto de la instalación. **No se le dice
«seguro»**, ni por escrito ni en voz alta: se dice *plan*, *anualidad* y *daño
por granizo*. Cómo se registra contablemente lo define el contador.

### La comisión sale de la propuesta, no al revés

El precio de una venta es un dato de la propuesta que aceptó el cliente. La
comisión se calcula de ahí y se registra sola al ganar la venta, sin que nadie
confirme nada: es preferible una comisión de más, que después no se paga, a una
venta sin monto.

### Al instalador tercerizado se le debe la obra que se le agenda

El pago de la mano de obra nace la primera vez que la obra se agenda con un
equipo tercerizado, y después no cambia solo. Si la obra se reagenda o cambia
de equipo, **la corrección la hace Finanzas a mano**. Las obras de equipo propio
no se pagan aparte.

---

## 5 · Las herramientas y cómo se usan

Todo se hace en **Voltia PM**, menú **Finanzas**. Arriba hay una fila de
pestañas: **Movimientos**, **Pendientes**, **Proveedores**, **Cuentas por
pagar**, **Facturas de proveedores**, **Cobros**, **Instaladores**,
**Facturación**, **Flujo de fondos**, **Estado de resultados** y **Cuentas**.
Las **Comisiones** tienen su propia sección en el menú.

En el celular, las listas de Finanzas se ven como tarjetas y las ventanas se
abren como un panel desde abajo; en la computadora se ven como tablas.

### 5.1 · Movimientos

Un **movimiento** es cada entrada o salida de plata. Todo lo demás de Finanzas
(cobros, facturas de proveedores, comisiones, pagos a instaladores, costos
fijos) termina siendo un movimiento, por eso lo que se cambia en una pantalla se
ve en las otras.

**La pestaña Movimientos muestra solo lo que ya pasó**: la plata que ya entró o
ya salió, más los pagos a proveedores. Lo que todavía se espera (cobros
previstos, facturas a pagar, comisiones sin pagar) no está acá: está en
**Pendientes** (5.3). Arriba se ven el **saldo actual en pesos** y el **saldo
actual en dólares**.

**«Nuevo movimiento»** carga algo que ya ocurrió: al guardarlo queda como
pagado. El formulario no tiene campo de estado. Pide:

- **Tipo**: **Ingreso** o **Gasto**.
- **Categoría**. Para un ingreso: **Entrada proyecto**, **Cobro cliente** u
  **Otro**. Para un gasto: **Salida proyecto**, **Costo fijo**, **Costo
  variable**, **Compra stock**, **Consumo stock**, **Pago proveedor** u
  **Otro**. Al cargar un gasto viene por defecto **«Salida proyecto»**, la más
  habitual. Si se elige **Costo fijo**, aparece la lista de costos fijos del mes
  para elegir a cuál corresponde (ver 5.2).
- **Descripción**, **monto** y **moneda** (dólares por defecto, o pesos).
- **Cuenta (opcional)**: si se elige una, la moneda pasa a ser la de la cuenta.
- **Fecha**.
- **Proveedor (opcional)**, solo en los gastos, y **Proyecto (opcional)**.

**«Transferencia»** pasa plata de una cuenta a otra de la misma moneda: queda
una salida en la cuenta de origen y una entrada en la de destino.

**Cómo se ve.** La pestaña arranca mostrando **todo el año en curso**; con
**«Año en curso» / «Por mes»** se cambia a un solo mes, y se puede elegir el
año. Se filtra por tipo (**Todos los tipos**, **Ingresos**, **Gastos**) y hay un
buscador por descripción, proveedor, cliente, cuenta o monto. Arriba de la lista
dice cuántos movimientos hay.

Los **pagos a proveedores** aparecen en la lista, pero no se editan desde acá:
se editan desde la ficha del proveedor (5.4).

**Cómo se borra.** Con la papelera de la fila, o al abrir un movimiento para
editarlo, abajo, con **«Eliminar movimiento»**. Las dos piden confirmación. Un
movimiento atado a una comisión **no se puede borrar** desde Finanzas: se
gestiona desde Comisiones.

### 5.2 · Costos fijos

Los **costos fijos** son los gastos que se repiten (alquiler, contador,
servicios). Se configuran una vez en **Finanzas → Costos fijos**, con
**«Agregar costo fijo»**: nombre, descripción
(opcional), **periodicidad** —**mensual**, **bimensual** (en los meses pares o
en los impares) o **anual** (en un mes elegido)—, el **día del mes de pago** y un
**monto de referencia** con su moneda. Los carga Finanzas (y también un administrador).

**No generan movimientos solos.** Cada costo fijo figura en **Pendientes**
desde que empieza el mes que le toca, y el **Flujo de fondos** los proyecta
para los próximos 3 meses. Sale de Pendientes cuando:

- se registra el pago: **«Marcar pagado»** en Pendientes abre el formulario de
  **Nuevo movimiento** ya completado con la categoría **Costo fijo** y ese
  costo elegido; se pone el **monto real** y se guarda. Ese monto pasa a ser el
  que Voltia PM sugiere la próxima vez;
- o se usa **«Saltear este mes»**, cuando ese mes no corresponde. Afecta solo
  ese mes: el costo fijo sigue activo para los siguientes.

Un costo fijo no se puede reagendar desde Pendientes: su fecha es la del día del
mes configurado, y se cambia desde Finanzas → Costos fijos.

### 5.3 · Pendientes

Es la lista de **todo lo que está por entrar o por salir**. Cada renglón lleva
una marca que dice qué es:

- **Costo fijo**: los costos fijos del mes que todavía no se pagaron.
- **Factura proveedor**: las facturas a pagar a proveedores.
- **Compromiso manual**: lo que está a pagar y no es de un proveedor.
- **Pendiente manual**: todo lo previsto, es decir, lo que se espera que
  ocurra: las cuotas del plan de pagos de los clientes, las comisiones de los
  asesores, las anualidades del plan granizo y los que se agendan a mano.

- **Filtros**: por tipo (**Costos fijos**, **Deuda proveedores**, **Otros
  compromisos**, **Pendientes manuales**), por proyecto y por proveedor.
- **«Marcar pagado»**: en un pendiente manual pide la **fecha** real (no puede
  ser futura) y la **cuenta** donde entró o de donde salió la plata, que es
  obligatoria. En una factura de proveedor lleva a la ficha del proveedor, donde
  se registra el pago. En un costo fijo, ver 5.2.
- **Cambiar una fecha**: tocando la fecha de un pendiente se abre un calendario
  para reagendarlo (por ejemplo, una cuota que el cliente pidió mover). Los
  costos fijos no se reagendan así.
- **Acciones** de cada pendiente: marcar pagado, editar, cambiar la fecha y
  eliminar (la papelera).
  El texto de eliminar cambia según qué es: «Saltear este mes» en un costo
  fijo, «Anular factura» en una factura de proveedor. Eliminar un previsto lo
  saca también del flujo de fondos.
- **«+ Pendiente manual»**: para agendar un gasto o un cobro que se sabe que
  viene pero todavía no tiene factura ni movimiento. Se elige **Gasto** o
  **Cobro**, descripción, monto, moneda, fecha esperada y proyecto (obligatorio
  si es un cobro). Aparecen con la marca **«Pendiente manual»**.

Ya no aparecen los «Materiales proyectados»: ver el lineamiento «Lo que se le
debe a un proveedor entra con su factura, no antes».

### 5.4 · Proveedores, facturas a pagar y pagos

**El listado de proveedores** (Finanzas → Proveedores) muestra cada proveedor
con su saldo. Desde ahí se da de alta uno nuevo y se carga una factura con
**«+ Nueva factura a pagar»**.

**Plazo y límite de un proveedor.** Se cargan al crear o editar el proveedor:
**Plazo (días)**, **Límite de crédito** (vacío si no tiene) y la moneda del
límite. Conviene que cada proveedor tenga su **RUT** cargado: la facturación
electrónica lo reconoce por el RUT, nunca por el nombre.

**La ficha de un proveedor** (tocando uno en el listado) muestra arriba el
**total adeudado**, el **saldo a favor** y el **saldo neto**, y tiene cuatro
pestañas: **Facturas**, **Pagos**, **Estado de cuenta** (todos los movimientos
con el saldo que va quedando; no se puede exportar) y **Conciliación** (ver más
abajo). Los botones principales son **«Cargar factura»** y **«Registrar
pago»**; también están **«Editar»** (los datos del proveedor) y **«Nuevo
gasto»**.

**Cargar una factura a mano.** Se piden el proveedor, la descripción, el número
de factura (opcional), el monto, la moneda, la fecha de emisión, la fecha de
vencimiento y el proyecto (opcional). Si no se pone vencimiento, **vence sola**
a los días de plazo del proveedor. Lo normal hoy es que la factura llegue sola
por la bandeja de facturas recibidas (5.6); a mano se carga lo que no llega así.
Cada factura se puede **editar** o **eliminar** desde la ficha.

**El monto de una factura se carga siempre con IVA incluido**: es el total
que figura en la factura y el que se le paga al proveedor. El desglose del IVA
no se carga por ahora.

**Registrar un pago.** Se piden la fecha, el monto y la moneda, la **cuenta de
donde sale la plata** (obligatoria, y de la misma moneda que el pago), el
método (transferencia, efectivo, cheque, tarjeta…), una referencia y notas.
Viene marcada la casilla **«Aplicar automáticamente a las facturas más
viejas»**: así el pago **se descuenta solo de las facturas que se le deben, de
la más vieja a la más nueva**, sin elegir factura por factura. Solo se descuenta
de facturas en la misma moneda del pago. Cuando una factura queda pagada entera,
toma como fecha de pago la del último pago que la saldó. Un pago con **monto
negativo** equivale a una nota de crédito o una devolución del proveedor.

**Saldo a favor.** Si el pago es más de lo que se debe, el sobrante queda **a
favor del proveedor**. **No se aplica solo** a las facturas que lleguen
después: la factura nueva queda a pagar, y el saldo a favor se descuenta a mano.
Para eso, en la pestaña **Pagos** se toca el pago que tiene saldo (lleva la
marca «Saldo: …») y se usa **«Aplicar a más facturas»**. Lo que sí hace Voltia PM
es mostrar el **saldo neto** del proveedor y proyectar su deuda en el flujo de
fondos ya descontado el saldo a favor. También queda saldo a favor si se
**elimina** una factura que ya tenía pagos: esos pagos no se pierden, quedan a
favor para reaplicar (Voltia PM avisa cuántos se liberaron).

**Pagar una factura puntual.** Al registrar el pago se destilda **«Aplicar
automáticamente a las facturas más viejas»**: al guardar se abre **«Aplicar pago
a facturas»**, donde se elige a qué facturas y cuánto a cada una. Desde el
detalle de un pago (tocándolo en la pestaña Pagos) también se puede quitar una
aplicación, **«Aplicar a más facturas»** y **«Anular»** el pago.

**Conciliación con el estado de cuenta.** El saldo de la ficha es lo que Voltia
le debe al proveedor, ya descontado el saldo a favor. Para compararlo con el
estado de cuenta que manda el proveedor está la pestaña **Conciliación** de la
ficha:

1. Se sube el estado de cuenta con **«Subir estado de cuenta»**: sirve en
   **PDF, Excel o una foto**. Solo si el documento no lo dice claro, se indica
   la moneda y la fecha del corte («Al día»).
2. La inteligencia artificial de Voltia PM lo lee y lo pasa a renglones
   (facturas, notas de crédito y pagos). Tarda unos segundos.
3. Voltia PM compara esos renglones con lo cargado para ese proveedor y muestra
   el **saldo según el proveedor**, el **saldo según Voltia PM** y la
   **diferencia** (si es positiva, el proveedor dice que se le debe más de lo
   que figura en Voltia PM; si no hay diferencia, dice «Cuadra»).
4. Abajo, en cuatro listas: lo que **coincide**; los **montos distintos** (el
   mismo comprobante, con distinto importe de cada lado); lo que **falta cargar
   en Voltia PM** (está en el estado de cuenta y no en Voltia PM: se revisa la
   bandeja de facturas recibidas o se carga); y lo que **el proveedor no tiene**
   (está en Voltia PM y no en su estado de cuenta: puede ser un pago que el
   proveedor no imputó o algo cargado de más).
5. Después de corregir lo que faltaba, **«Volver a comparar»** repite la
   comparación con lo cargado hoy, **sin volver a leer el archivo**.

Cada conciliación queda guardada en la ficha, con el archivo original para
volver a verlo.

### 5.5 · Cuentas por pagar

Se entra desde **Finanzas → Cuentas por pagar**. Arriba están los totales: cuánto
se debe en total, cuánto está **vencido**, cuánto **vence en los próximos 7 días**
y cuánto **entre 8 y 30 días**. Abajo, una fila por proveedor con lo mismo, el
saldo a favor (pagos hechos que todavía no se aplicaron a ninguna factura) y cuánto
del límite de crédito está usado. Tocando un proveedor se ven sus facturas, cada
una con su vencimiento y cuántos días le faltan.

### 5.6 · La bandeja de facturas recibidas

En la misma pantalla, más abajo, está **Facturas recibidas**: las que trajo la
facturación electrónica y nadie revisó todavía. Voltia PM consulta cada hora, de
lunes a sábado; el botón **Buscar facturas nuevas** consulta en el momento. Trae
**todas las facturas que DGI tiene registradas a nombre de Voltia** —así no se
pierde ninguna aunque el mail no haya llegado— y las que llegaron por mail. Por
cada una, la persona de Finanzas elige:

- **Cargar como deuda**: pasa a ser una factura a pagar del proveedor, con el
  vencimiento según su plazo.
- **Ya cargada: …**: aparece cuando ya había una factura cargada a mano del mismo
  proveedor con el mismo número o el mismo monto. Se vinculan y no se duplica la
  deuda.
- **Descartar**: pide escribir el motivo.
- **Dar de alta proveedor**: cuando la factura es de una empresa que todavía no
  está en Voltia PM. Propone el nombre registrado en DGI.

El proveedor se reconoce **por el RUT**, nunca por el nombre. Por eso conviene
que cada proveedor tenga su RUT cargado.

### 5.7 · Facturas de proveedores

Se entra desde **Finanzas → Facturas de proveedores**. Es el registro de **todas**
las facturas de proveedores, para buscar cualquiera: las que llegaron por la
facturación electrónica —en cualquier estado, también las descartadas y las de
empresas sin dar de alta— y las que se cargaron a mano. Se filtra por proveedor
(o por **Sin proveedor en el sistema**), por fechas, por origen y con un buscador.
Cada factura muestra neto, IVA, total, vencimiento y en qué está: por revisar,
a pagar, pagada o descartada.

### 5.8 · Cobros a clientes y plan de pagos

**La lista.** Se entra desde **Finanzas → Cobros**. Muestra **todos** los
proyectos vendidos, estén en obra o ya habilitados, porque que la obra esté
habilitada no dice si el cliente terminó de pagar. Solo quedan afuera las ventas
caídas (proyectos archivados) y lo que todavía no se vendió. Por cada proyecto:
el presupuesto, lo cobrado y lo pendiente. Se filtra por cómo está el pago:
**Pendientes**, **Parciales**, **Completos**, **Excedidos** o **Sin
presupuesto** (o **Todos los estados**).

**El detalle de un cliente** (tocando un proyecto) muestra los cobros ya
recibidos y los **previstos** del plan, ordenados por fecha. Los previstos se
distinguen con la etiqueta **PREVISTO**. Los totales cuentan solo lo
efectivamente cobrado: lo previsto no infla el «Cobrado». El detalle tiene dos
pestañas, **Cobros** y **Estado de cuenta**. Desde el detalle se puede:

- **«Registrar cobro»**, eligiendo **Cobrado** (ya entró la plata; pide la
  cuenta donde entró, obligatoria) o **Previsto** (pide la fecha en que se
  espera).
- **«Marcar pagado»** un previsto: pide la **fecha del cobro** (no puede ser
  futura) y la **cuenta donde entró el dinero**, que es obligatoria.
- Editar el monto de un cobro, si el cliente pagó de más o de menos.
- **Eliminar** un cobro con la papelera, que pide confirmación.
- **«Copiar resumen»**: copia un mensaje para pegarle al cliente por WhatsApp.
  Es el mismo mensaje que copia Experiencia Solar desde su pestaña. Sale así
  (los asteriscos son la negrita de WhatsApp; los totales van en dólares y cada
  pago en su moneda):

  > <small>\*Resumen de pagos — [nombre del cliente]\*<br>
  > Obra [código del proyecto] · [potencia] kWp<br>
  > <br>
  > 💰 \*Presupuesto:\* [presupuesto en USD]<br>
  > ✅ \*Cobrado:\* [lo cobrado en USD]<br>
  > ⏳ \*Pendiente:\* [lo que falta en USD]<br>
  > <br>
  > \*Pagos recibidos\*<br>
  > ✅ [fecha] · [descripción del cobro] · [monto]<br>
  > <br>
  > \*Próximos pagos\*<br>
  > ⏳ [fecha] · [descripción de la cuota] · [monto]</small>

  Va un renglón por cada pago recibido y por cada cuota prevista, ordenados por
  fecha. Si el proyecto no tiene potencia cargada, la segunda línea dice solo
  «Obra [código]». Si no hay pagos recibidos o no quedan cuotas, ese bloque no
  aparece. **Ojo:** el «Cobrado» del resumen suma solo lo cobrado en dólares;
  si el cliente pagó algo en pesos, ese pago aparece en la lista pero no en el
  total.

**El plan de pagos.** Es el conjunto de **todos los cobros previstos** del
proyecto. Si un proyecto tiene presupuesto y todavía no tiene cobros previstos,
aparece el aviso con **«Crear plan de pagos →»**. La ventana viene con una
sugerencia sobre lo que falta cobrar: una seña de USD 500 a los 7 días y tres
cuotas, **«Pago previo 50%»** (completa el 50 %, a los 30 días), **«Pago obra
terminada 30%»** (a los 60 días) y **«Pago obra habilitada 20%»** (a los 90
días). Las fechas sugeridas son solo un punto de partida: se ponen las que se
acordaron con el cliente.
Cada cuota se puede cambiar (descripción, monto, porcentaje, fecha), agregar o
quitar. Reglas:

- La suma de las cuotas tiene que dar **lo que falta cobrar** (presupuesto menos
  lo ya cobrado), con un margen de USD 1. Si no cierra, no se puede confirmar.
- Una sola cuota por el total es un plan válido.
- Sin presupuesto cargado no se puede armar un plan.
- Si la seña es más de la mitad de lo que falta, Voltia PM avisa, pero deja
  seguir.
- Editar el plan reemplaza los cobros previstos, **sin tocar los ya cobrados**.

**La regla del onboarding.** Con pago directo, el onboarding no se cierra sin
plan de pagos. Un proyecto que ya tiene cobrado el 99 % del presupuesto cuenta
como «con plan» aunque no le queden previstos.

**Ojo:** «Cobrado» y «Pendiente» de la lista no se calculan igual que el plan:
la lista suma todo lo cobrado, pasando los pesos a dólares; el plan cuenta solo
los cobros en dólares de entrada de proyecto. Por eso a veces no coinciden
exacto.

### 5.9 · Cobros que gestiona Experiencia Solar

Experiencia Solar tiene su propia pestaña **Cobros**, dentro de su módulo, para
gestionar los pagos de los clientes **sin entrar a Finanzas**: no ve gastos,
cuentas ni resultados. Puede ver lo cobrado y lo pendiente de cada cliente,
registrar un cobro nuevo (cobrado o previsto), marcarlo pagado, editar el
monto, eliminarlo y **«Copiar resumen (WhatsApp)»**, que copia el mismo mensaje
*Resumen de pagos* de 5.8. Desde su pestaña **no se crea ni se edita el plan de
pagos**: eso se hace en el onboarding (o Finanzas, desde Cobros).

Dos diferencias con Finanzas que Finanzas tiene que conocer:

- **No elige cuenta**: los cobros que registra o marca pagados Experiencia Solar
  quedan **sin cuenta**. Finanzas les asigna la cuenta editando el movimiento en
  Movimientos; hasta entonces no suman al saldo de ninguna cuenta.
- **Al marcar pagado un previsto se confirman la fecha y el monto**: Voltia PM
  propone la fecha de hoy y el monto previsto, y quien lo registra los corrige
  si el cliente pagó otro día u otro monto. **La fecha y el monto los pone quien
  ingresa el cobro**; no hay una revisión posterior.

**Es la misma información que Finanzas**: lo que cambia uno lo ve el otro al
instante. En el historial del cliente aparecen solos **los cobros efectivos**,
no los previstos.

### 5.10 · Comisiones del asesor

**Cómo nace.** Al marcar un lead como **ganado** (un *lead* es un cliente
potencial en el pipeline comercial), Voltia PM toma el precio de la **última
propuesta publicada** y congela la comisión del asesor con ese número. Al mismo
tiempo crea un **pendiente en Finanzas**, un gasto previsto «Comisión venta
[cliente] — [asesor]», por el monto **sin IVA** y con vencimiento el **día 1 del
mes siguiente** a la venta. Las propuestas residenciales llevan un porcentaje fijo;
las de empresas, un porcentaje base más una parte de lo que el asesor consiga
por encima del markup de referencia. Los porcentajes se configuran en
**Administración → Defaults de propuestas**, y cada comisión queda con el que
regía cuando se publicó la propuesta.

Si el cliente aceptó otra versión de la propuesta, el asesor la cambia en la
ventana que aparece al ganar, y la comisión y el pendiente se recalculan. Una
comisión ya pagada no se recalcula así.

**Ventas sin propuesta.** Si la venta se cerró sin ninguna propuesta publicada en
Voltia PM, no hay de dónde sacar el monto: la comisión se carga a mano.

**La pantalla Comisiones** (en el menú): cada asesor ve solo las suyas; la
gerencia comercial, Administración y Finanzas ven las de todos y filtran por
asesor. Muestra el saldo a cobrar, lo cobrado en el año, la cantidad de ventas,
un gráfico por mes y la tabla con filtros (todas, pendientes, pagas).

**Cómo se paga.** Desde **Finanzas → Pendientes**: la comisión aparece como
**Pendiente manual**, con vencimiento el día 1 del mes siguiente a la venta. Se
usa **«Marcar pagado»**, que pide la fecha del pago y la cuenta de donde salió.
La comisión pasa sola a **Pagada** en la pantalla Comisiones, con esa fecha.

**Correcciones.** Solo el administrador puede editar (monto, fecha de venta,
fecha de pago prevista) o borrar una comisión, con el botón **«Editar»** de la
fila. Cada cambio queda registrado y la comisión muestra la marca «editada».
También se puede cargar una **comisión suelta** a un asesor, sin lead, con
**«Agregar comisión manual»** en la pantalla Comisiones (lo puede hacer quien
puede cargar movimientos en Finanzas). La tarjeta de comisión de la ficha del
proyecto que sugiere un porcentaje sirve solo para esa carga manual.

### 5.11 · Pagos a instaladores tercerizados

Se entra desde **Finanzas → Instaladores**. Muestra cada trabajo con el
instalador, la fecha de la obra, el monto, lo pagado, el saldo y el estado
(**pendiente**, **parcial** o **pagado**).

**El pago lo genera el calendario.** La primera vez que Operaciones agenda una
obra con un equipo **tercerizado**, el pago aparece solo, a nombre de la persona
que cobra por ese equipo (se configura una vez, en Admin → Equipos). El monto es
la mano de obra de la propuesta ganadora **con IVA**, porque el instalador
factura. Si la propuesta no traía mano de obra, el pago nace en cero y marcado
para cargar el monto. Las obras de equipo propio no tienen pago aparte.

**Después no cambia solo**: si la obra se reagenda o cambia de equipo, Finanzas
corrige el instalador o el monto a mano.

Finanzas:

- **«Asignar»** o **«Editar»** un trabajo: el instalador y el monto.
- **Registra los pagos** con **«Pagar»**, totales o parciales: monto, fecha y una
  nota. No se puede pagar más que el saldo. No se elige cuenta.
- **Corrige o anula una entrega** ya registrada, incluso con el trabajo saldado.
- **Carga a mano** trabajos que no salen de un proyecto (una reparación en
  garantía, una obra anterior), con **«Cargar pago manual»**.
- **Filtra por instalador** y copia un **resumen para WhatsApp** con las obras en
  curso y lo que falta de cada una, más las últimas tres saldadas. El botón
  aparece solo con un instalador elegido, y arma el mensaje con lo que muestra
  la lista: para que salga completo, el filtro de estado tiene que estar en
  **Todos**. Sale así:

  > <small>\*Pagos — [nombre del instalador]\*<br>
  > <br>
  > ⏳ \*Pendiente: [total que se le debe, en US$]\*<br>
  > <br>
  > \*En curso y por cobrar\*<br>
  > • [código del proyecto] · [cliente] — [monto de la obra]<br>
  > • [código del proyecto] · [cliente] — [monto de la obra] — cobrado [lo ya entregado], falta [lo que queda]<br>
  > <br>
  > \*Últimos trabajos saldados\*<br>
  > ✅ [código del proyecto] · [cliente] — [monto] ([día y mes de la obra])</small>

  Va un renglón por obra; el detalle «cobrado…, falta…» aparece solo si ya se le
  entregó una parte. Si no se le debe nada, en lugar del pendiente dice
  «✅ \*No queda nada pendiente.\*». Si hay una sola obra saldada, el título es
  «\*Último trabajo saldado\*». Si el instalador no tiene trabajos, dice «No hay
  trabajos registrados.». Los trabajos cargados a mano sin proyecto muestran solo
  el nombre del cliente.

Cada pago registrado es un gasto pagado «Mano de obra», **sin cuenta**, que
entra solo a Movimientos y al estado de resultados. **Lo que se le debe al instalador no
aparece como gasto futuro en el flujo de fondos**: se ve solo en esta pantalla.

El instalador ve sus trabajos, lo cobrado y el saldo en **Mis cobros**, desde el
menú de su cuenta. Solo puede mirar.

### 5.12 · Facturación al cliente

No todos los clientes llevan factura. Cada proyecto tiene la casilla **«Lleva
factura»** y una **nota** libre (para anotar RUT, razón social o a nombre de
quién facturar). Se cargan al crear el proyecto y se editan desde su ficha.

En **Finanzas → Facturación** están los proyectos que llevan factura, con
**Pendientes**, **Emitidas** y **Todas**. Cuando se emite una factura se usa
**«Marcar emitida»**, que registra la fecha y la saca de pendientes; si fue un
error, **«Revertir»**. La nota se edita desde la lista.

La columna **Factura** sirve para adjuntar el archivo (PDF o imagen): ícono de
subir si no tiene, y de ver y descargar si tiene. **Hay una sola por proyecto**:
subir otra reemplaza la anterior.

La factura se emite **por fuera de Voltia PM**: Voltia PM no emite facturas, solo
lleva el control de cuáles faltan y guarda el archivo.

### 5.13 · Cuentas bancarias y conciliación

En **Finanzas → Cuentas** están las cuentas bancarias de Voltia, una tarjeta
por cuenta con su saldo. Las cuentas se dan de alta en **Administración →
Cuentas**. Las transferencias entre cuentas se hacen desde Movimientos (5.1).

**Conciliar una cuenta** es comparar el saldo que muestra Voltia PM con el real
del banco. Se carga el **saldo real** que da el home banking y **su fecha**. Si
hay diferencia, Voltia PM **ajusta el saldo de la cuenta a ese valor desde esa
fecha**. **No se crea ningún movimiento de ajuste**: la diferencia no aparece
como ingreso ni como gasto, así que no explica de dónde salió. Cada cuenta
guarda el historial de sus conciliaciones.

**Dónde se pide la cuenta y dónde no.** Es obligatoria al registrar un pago a un
proveedor y al marcar pagado un cobro o un pendiente manual. En **Nuevo
movimiento** es opcional: un movimiento sin cuenta no mueve el saldo de ninguna
cuenta.

Cuando el saldo de las cuentas no coincide con el flujo de fondos, todas las
pantallas de Finanzas muestran un aviso («Hay un descalce…») con el botón
**«Conciliar cuentas»**.

### 5.14 · Cotización del dólar

Voltia PM trabaja en dólares, pero hay movimientos en pesos. Para pasarlos a
dólares (en el estado de resultados, por ejemplo) usa **la última cotización
cargada**. La cotización **se toma sola del Banco Central del Uruguay (BCU)**,
el dólar interbancario, todos los días a las 14:00 hora de Uruguay. Nadie la
carga a mano: no hay una pantalla para eso.

**Ojo:** como se usa la última cotización y no la del día del movimiento, **el
resultado de un mes ya cerrado cambia un poco cada vez que se carga una
cotización nueva**. Es una decisión a revisar.

### 5.15 · Flujo de fondos

Muestra **cuánta plata va a haber** día a día: el saldo de hoy más lo que se
espera cobrar y menos lo que hay que pagar. Proyecta **solo tres cosas**: los
cobros pendientes de los clientes (las cuotas del plan de pagos y las
anualidades del plan granizo), la deuda con proveedores y los costos fijos de
cada mes.

- La deuda con un proveedor se proyecta **ya descontado su saldo a favor**, por
  moneda, empezando por la factura que vence primero.
- Con el **filtro por tipo de movimiento** se prenden o apagan los tipos, con
  los atajos **«Todos»** y **«Ninguno»**; afecta el listado, el gráfico y los
  totales.
- La fecha de un evento proyectado se puede cambiar tocándola.
- **No aparecen**: las comisiones de los asesores, los compromisos a pagar que
  no son de un proveedor, lo que se le debe a los instaladores, las compras de
  materiales que todavía no tienen factura, ni los cobros previstos que ya
  vencieron sin cobrarse. Por eso el flujo puede verse mejor de lo que es: esas
  salidas existen igual.

**Qué período abarca.** Arranca hoy, con el **saldo actual** —la suma de todas
las cuentas activas, con los pesos pasados a dólares—, y proyecta **los próximos
3 meses**. No hay un saldo inicial por cuenta: se ve el total. Lo que ya venció
y no se pagó a un proveedor se muestra como si saliera hoy. El gráfico muestra la evolución del
saldo de los últimos 3 meses y de los próximos 3, y avisa si el saldo proyectado
cae por debajo de cero.

**La posición.** Arriba del flujo de fondos y del estado de resultados está el
bloque **Posición**, todo en dólares: la **caja** (lo que hay en las cuentas),
**lo que nos deben** —separado en vencido, próximos 7 días, de 8 a 30 días, más
de 30 días y **sin fecha** (lo que una obra todavía debe sin tener una cuota
prevista)—, **lo que debemos** —proveedores, otros compromisos, comisiones e
instaladores, también por vencimiento— y el **neto**, con caja y sin caja. A
diferencia del flujo, la posición **sí** cuenta las comisiones y lo que se le
debe a los instaladores.

### 5.16 · Estado de resultados

Responde **«¿cuánto ganamos o perdimos en tal período?»** con la plata que
efectivamente entró y salió. Se elige **mes, trimestre o año**. Todo se muestra
**en dólares**.

- Cuenta solo lo **pagado**, con la fecha en que se pagó.
- Los pagos a proveedores cuentan **por la fecha y el monto de cada pago**: si
  se paga una parte de una factura grande, esa parte cae en el mes en que salió
  la plata.
- Primero los **ingresos**; después los gastos, agrupados en costos fijos,
  costos variables, salidas por obra (desglosadas por proyecto), pagos a
  proveedores, compras de stock y otros, con su total.
- El **Plan de Protección contra Granizo** va en un bloque propio: lo cobrado de
  anualidades menos lo gastado en reposiciones. Suma al resultado, pero no a los
  ingresos ni a los gastos de las obras.
- Al final, el **resultado** y la **rentabilidad**.
- Los pesos se pasan a dólares con la última cotización (ver 5.14).

También se puede pedir desde el chat de Claude conectado a Voltia PM, para
cualquier rango de fechas; da los mismos números.

### 5.17 · El Plan de Protección contra Granizo, en lo que toca a Finanzas

El plan lo maneja **Experiencia Solar** (Experiencia Solar → Plan granizo). Por
USD 12 por panel por año, IVA incluido, Voltia repone los paneles que rompa el
granizo. A Finanzas le toca:

- **La anualidad se genera sola** 30 días antes del vencimiento, con su cobro en
  Finanzas, al precio vigente: un cobro previsto «Plan granizo · anualidad …»,
  que aparece en Pendientes y en el flujo de fondos.
- **Marcar cobrada una anualidad**: lo puede hacer Experiencia Solar desde el
  plan o Finanzas. Siempre con **la fecha real del pago**: el plan se activa con
  el pago, y la fecha decide desde cuándo cubre. Si la marca Experiencia Solar,
  queda **sin cuenta** (ver 5.9), y Finanzas se la asigna.
- **Las reposiciones** (cuando se reponen paneles dañados) quedan como gasto del
  plan, con su costo real: un gasto «Plan granizo · reposición …».
- **Si Finanzas borra el cobro** de una anualidad, el plan la muestra «Sin cobro
  en Finanzas» y ofrece regenerarlo.
- Los cobros del plan **no aparecen en Cobros** de la obra ni cuentan para su
  saldo.

### 5.18 · Los indicadores del reporte semanal

Todos los lunes a las 00:01 sale un correo, a una casilla fija, con los
indicadores de la semana anterior (de lunes a domingo). También se ve en
Métricas → Reporte semanal, desde donde un administrador lo puede mandar a mano.
De lo que toca a Finanzas:

- **Registro de gastos**: cuántos gastos se cargaron con fecha en la semana (la
  cantidad, sin montos).
- **Nuevas ventas**, listadas con su monto (el precio con IVA de la propuesta
  ganadora), y la **facturación vendida**, que es la suma.

Los **cobros de la semana todavía no están** en el reporte: falta definir qué
fecha cuenta como cobro. No hay otros indicadores de Finanzas.

El **día 1 de cada mes** llega además un reporte mensual con los mismos
indicadores, del mes que acaba de cerrar comparado con el anterior.

---

### 5.19 · Historial: auditar lo que se hizo

Se entra desde **Finanzas → Historial**. Es el registro de **todo lo que se
cargó, cambió o borró** en Finanzas: movimientos y cobros, pagos a proveedores y
cómo se aplicaron, proveedores, cuentas, comisiones, pagos a instaladores,
facturas recibidas y conciliaciones.

Cada renglón dice **cuándo**, **quién**, **qué** (alta, cambio, baja o cambio de
estado) y el detalle. Cuando es un cambio, muestra **el valor de antes y el de
después**: si alguien corrigió el monto de una factura de 1.220 a 1.250, queda
escrito así, con su nombre y la hora.

Se filtra por fechas, por persona, por tipo (movimientos, pagos, proveedores…),
por alta/cambio/baja, y con un buscador sobre el detalle.

No se puede editar ni borrar: es la constancia de lo que pasó. Es la herramienta
para revisar los gastos mientras no exista un circuito de aprobación.

## 6 · Cuando algo sale mal

### Un proyecto aparece en Cobros sin plan de pagos

Con pago directo no debería pasar: el onboarding no cierra sin plan. Puede ser un
proyecto viejo, de antes de la regla, o uno con otra modalidad. Se le pregunta al
**asesor** qué se acordó con el cliente y se arma el plan desde el detalle del
cliente. No se inventan fechas.

### Una cuota venció y el cliente no pagó

Se mira primero si el pago entró y no se registró. Si no entró, se le pregunta
al asesor si hubo algún cambio acordado. El reclamo al cliente lo hace
Experiencia Solar, que es quien habla con él (va a pasar al área de
Administración cuando esa área se haga cargo de Finanzas en Voltia PM).

### El saldo de un proveedor no coincide con su estado de cuenta

Se revisa en **Facturas de proveedores** si falta alguna factura (por ejemplo,
una descartada por error o de un proveedor «sin proveedor en el sistema») y en
la ficha del proveedor si hay pagos que quedaron como saldo a favor. Si el
vencimiento de una factura no coincide con el plazo acordado, se habla con el
proveedor: manda el plazo acordado.

### Una factura del proveedor no llegó a la bandeja

La bandeja trae las facturas de los últimos 45 días. Una factura más vieja, o una
que DGI registró tarde, puede no entrar sola: se carga a mano desde la ficha del
proveedor.

### Una factura quedó cargada dos veces

Si se cargó a mano y además llegó por la bandeja, en la bandeja se elige **«Ya
cargada»** para vincularlas. Si ya se cargó dos veces como deuda, se elimina una
desde la ficha del proveedor; si tenía pagos, quedan como saldo a favor.

### Una obra se reagendó con otro equipo y el pago al instalador quedó mal

El pago no cambia solo. Se corrige a mano en **Finanzas → Instaladores**: el
instalador, el monto o ambos.

### Una venta quedó sin comisión o con una comisión equivocada

Si no tiene propuesta publicada, la comisión se carga a mano. Si se tomó una
propuesta que no era, el asesor la cambia; si ya estaba pagada, la corrige el
administrador.

### El resultado de un mes cerrado cambió

Puede ser por una cotización del dólar nueva (5.14) o porque alguien cargó o
corrigió un movimiento con fecha de ese mes. Voltia PM registra **quién editó
o borró cada movimiento y cuándo**, pero **no qué dato cambió** (el monto
anterior, la fecha anterior). Ese registro no se ve en Movimientos: si el
movimiento es de un proyecto, aparece en el historial del proyecto.

### La fecha de una obra se movió por algo de Finanzas

Lo explica Finanzas: qué pasó, cuántos días y qué se intentó. Gerencia lo revisa
una vez por mes.

---

## Glosario

| Palabra | Qué es |
|---|---|
| **Voltia PM** | El sistema interno donde trabajan todas las áreas de Voltia: proyectos, clientes, calendario, finanzas. |
| **Portal de Voltia** | Lo que ve el cliente: avance, documentación, reportes y reclamos. |
| **Área de Administración** | El área de la contadora. Va a usar el módulo de Finanzas de Voltia PM y a hacerse cargo de reclamar los pagos atrasados. No confundir con **Administración** de Voltia PM, el menú de configuración del sistema. |
| **UTE** | La empresa estatal de electricidad. Tiene que aprobar y **habilitar** la instalación para que el cliente pueda encenderla. |
| **DGI** | La Dirección General Impositiva. Registra todas las facturas electrónicas. |
| **CFE** | Comprobante fiscal electrónico: la factura electrónica (o nota de crédito, o nota de débito). |
| **Facturación electrónica** | El servicio por el que Voltia emite y recibe los CFE. De ahí llegan solas las facturas de los proveedores. |
| **RUT** | El número de identificación tributaria de una empresa. Voltia PM reconoce a cada proveedor por su RUT. |
| **Etapa** | Cada uno de los ocho tramos de un proyecto, de Venta a Trámite UTE. |
| **Onboarding** | La etapa del proyecto, después de cerrar la venta, en la que el asesor confirma la venta, firma el contrato, cobra la seña y define cómo va a pagar el cliente. |
| **Lead** | Un cliente potencial, en el pipeline comercial. Cuando se gana la venta, se crea el proyecto. |
| **Propuesta** | La cotización que se le presenta al cliente. De la última publicada salen el precio de la venta, la comisión y el pago al instalador. |
| **Seña** | El primer pago del cliente, que se cobra al confirmar la venta. |
| **Modalidad de pago** | Cómo paga el cliente: pago directo, financiación bancaria u otro. |
| **Plan de pagos** | Los cobros previstos de un proyecto, con su fecha y su monto. |
| **Proforma** | El documento que se le da al cliente para presentar al banco cuando paga con financiación bancaria. |
| **Movimiento** | Cada entrada o salida de plata registrada en Voltia PM, pasada o futura. |
| **Previsto** | Un movimiento que se espera que ocurra pero todavía no ocurrió. |
| **A pagar** | Una factura que se debe y tiene vencimiento. |
| **Costo fijo** | Un gasto que se repite todos los meses, el mismo día. |
| **Pendiente manual** | Un gasto o cobro que se agenda a mano porque todavía no tiene factura ni movimiento. |
| **Plazo de crédito** | Los días que un proveedor le da a Voltia para pagar una factura. |
| **Límite de crédito** | El tope de deuda que acepta un proveedor. |
| **Saldo a favor** | Plata pagada a un proveedor que todavía no se descontó de ninguna factura. |
| **Nota de crédito** | Un comprobante con el que el proveedor descuenta algo de lo facturado. |
| **Conciliar** | Comparar lo que dice Voltia PM con lo que dice el banco (o el proveedor) y corregir las diferencias. |
| **Flujo de fondos** | La proyección de cuánta plata va a haber, con lo que se espera cobrar y pagar. |
| **Estado de resultados** | Cuánto se ganó o perdió en un período, con lo efectivamente cobrado y pagado (de caja). |
| **De caja** | Que cuenta solo lo que ya se cobró o se pagó, no lo que se debe. |
| **Comisión** | Lo que cobra el asesor por cada venta que cierra. |
| **Instalador tercerizado** | Un equipo de obra que no es de Voltia y cobra por obra. |
| **Experiencia Solar** | El área que acompaña al cliente desde que termina el onboarding, para siempre. Es su referente. |
| **Plan de Protección contra Granizo** | El servicio de reposición de paneles por granizo de Voltia. **No es un seguro**, y no se le dice así. |
| **Anualidad** | Lo que paga el cliente por un año de plan granizo: USD 12 por panel, IVA incluido. |

---

## Anexo · Registro de cambios

| Versión | Fecha | Qué se agregó o modificó |
|---|---|---|
| 0.7 | 10 de octubre de 2026 | Se responden las dudas de Gerencia: los gastos de compras no se aprueban por ahora pero quedan auditables, con la pantalla nueva Historial; el reclamo de pagos atrasados lo hace Experiencia Solar y pasará a Administración; las cuentas bancarias se concilian una vez por mes; los costos fijos los carga Finanzas desde su propia pestaña; las facturas de proveedores se cargan con IVA incluido; al marcar pagado un cobro se confirman la fecha y el monto.; la conciliación con cada proveedor se hace una vez por mes, a mano |
| 0.6 | 10 de octubre de 2026 | Se revisa todo el manual contra Voltia PM: qué muestra cada pestaña, cómo se pagan los costos fijos y las comisiones, cómo se aplica el saldo a favor de un proveedor, la nueva conciliación con el estado de cuenta del proveedor, cómo se concilian las cuentas, de dónde sale la cotización del dólar y qué abarca el flujo de fondos. Se citan enteros los resúmenes de WhatsApp de cobros y de instaladores. Se aclara que no hay un circuito de aprobación de gastos en Voltia PM. |
| 0.5 | 10 de octubre de 2026 | Pagos a instaladores: el pago lo genera el calendario al agendar la obra con un equipo tercerizado, a nombre de quien cobra por ese equipo; las obras de equipo propio no tienen pago aparte. |
| 0.4 | 9 de octubre de 2026 | Plazo y límite de crédito por proveedor; las facturas de proveedores llegan solas de la facturación electrónica a una bandeja que Finanzas revisa; nuevas pantallas Cuentas por pagar y Facturas de proveedores. |
| 0.3 | 9 de octubre de 2026 | Dos lineamientos nuevos: las compras de materiales ya no se proyectan (la deuda con un proveedor entra con su factura) y ningún proyecto sale del onboarding sin la modalidad de pago y lo que pide. |
| 0.2 | 9 de octubre de 2026 | Primer lineamiento: las aprobaciones de gastos no frenan una obra. La fecha de obra confirmada se defiende, y si se mueve por algo de Finanzas, el atraso lo explica Finanzas. La lista de Cobros muestra todos los proyectos vendidos, también los ya habilitados: se filtra solo por cómo está el pago. |
| 0.1 | 28 de septiembre de 2026 | Se crea el manual con su estructura y la lista de temas a documentar. |
