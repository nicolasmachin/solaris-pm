# Manual de trabajo de Finanzas

**Voltia · Uruguay** · Versión 0.20 · del 22/10/26 · *borrador en revisión*

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
| **Experiencia Solar** | 2, 4 (cobros), 5.3 (Cobros que gestiona Experiencia Solar), 5.19 (Plan granizo) | 5.2 |
| **Ventas (asesores comerciales)** | 2, 4 («Ningún proyecto avanza sin saber cómo y cuándo paga el cliente»), 5.17 (Comisiones) | 5.2 |
| **Operaciones y Logística** | 2, 4 («Las aprobaciones de gastos no frenan una obra»), 5.7 (Pagos a instaladores) | 5.5 y 5.6 |
| **Quien usa una tarjeta de Voltia** | 4 («Lo personal no es gasto de Voltia»), 5.10 (Tarjetas) | — |

## Qué es y qué no es este documento

**Es** la guía de trabajo de Finanzas: qué hace el área, qué recibe de las
demás, qué les entrega, con qué criterio decide y cómo usa cada pantalla de
**Voltia PM**, el sistema interno donde trabajan todas las áreas de Voltia.

**No es** un manual contable ni impositivo: cómo se registra cada cosa ante DGI o
en la contabilidad formal lo define el contador. Tampoco explica cómo trabajan
las otras áreas: de ellas trae solo lo que Finanzas necesita saber, repetido a
propósito para que nadie tenga que salir a buscarlo en otro manual.

Las palabras propias de Voltia (Voltia PM, UTE, etapa, onboarding, CFE, plan de
pagos, ajuste, cierre de mes…) se explican la primera vez que aparecen y están
todas en el **Glosario**, al final.

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
carga como deuda. Y lo que dice Voltia PM tiene que **coincidir con el banco**:
cada movimiento del banco tiene su movimiento cargado, y al revés.

Además, Finanzas es quien **paga**: a los proveedores, a los instaladores
tercerizados y las comisiones de los asesores; quien **emite las facturas** a
los clientes que las llevan; y quien **cierra cada mes** y le entrega a la
contadora lo que necesita.

## 2 · Qué hace y dónde termina su trabajo

**Qué hace.** Cobra a los clientes según el plan de pagos que dejó armado Ventas,
paga a los proveedores, a los instaladores y las comisiones, emite las facturas,
concilia lo cargado con el banco y lleva los resultados de la empresa.

**Dónde termina su trabajo.** Con un proyecto, cuando está **cobrado entero y
sus gastos, pagados**. Con la empresa en general, no termina: los costos fijos,
las cuentas, las tarjetas y los resultados se llevan todos los meses, y cada mes
termina con su **cierre**.

### Qué recibe de cada área

| De | Qué recibe | Dónde lo ve en Voltia PM |
|---|---|---|
| **Ventas** (el asesor comercial) | Cada proyecto vendido llega con su **modalidad de pago** y lo que esa modalidad pide: el plan de pagos, la proforma para el banco o la explicación escrita de lo acordado. También deja dicho **qué se le factura**: todo el presupuesto («facturación normal») u otro monto, con el motivo | Finanzas → Cobros; Finanzas → Facturación |
| **Ventas** (al ganar la venta) | La **comisión del asesor**, que se registra sola con el precio de la última propuesta publicada | Comisiones; Finanzas → Inicio (Pendientes) |
| **Operaciones** (al agendar la obra con un equipo tercerizado) | El **pago de la mano de obra** al instalador, a nombre de quien cobra por ese equipo | Finanzas → Instaladores |
| **Logística** | Las **compras fuera de la lista de materiales** de más de USD 200 por gasto (hasta ese monto las aprueba el gerente de Operaciones, con rendición de cuentas) | Las aprueba Finanzas o Gerencia. Lo de la lista lo compra directo el encargado de compras. Todo gasto queda **auditable**: ver 5.16 |
| **Proveedores** (por la facturación electrónica) | Las **facturas** que le emiten a Voltia | Finanzas → Facturas |
| **Proveedores** (una vez por mes) | El **estado de cuenta**, que Finanzas le pide | Se sube en la ficha del proveedor (Finanzas → Proveedores) |
| **Experiencia Solar** | Los cobros que registra o marca pagados en su propia pestaña, y las anualidades del **Plan de Protección contra Granizo** | Finanzas → Cobros y Movimientos (es la misma información) |
| **Quien usa una tarjeta de Voltia** | Qué gasto hizo, si fue de Voltia o personal y, si es personal con una tarjeta de la empresa, quién lo autorizó | Finanzas → Tarjetas |

### Qué entrega

| A | Qué entrega |
|---|---|
| **Todas las áreas** | La respuesta a «¿entró la seña?», «¿cómo se le cobra?», «¿hay aprobación para este gasto?». Son las consultas que el PGT manda a Finanzas |
| **Logística** | La **aprobación de los gastos** de compras, a tiempo para no frenar la obra (ver lineamientos) |
| **Experiencia Solar** | Los cobros al día: lo que Finanzas registra se ve al instante en la pestaña Cobros de Experiencia Solar y en el historial del cliente |
| **Asesores** | Las comisiones pagadas: al marcarlas pagadas en Finanzas, el asesor las ve como «Pagada» |
| **Instaladores tercerizados** | Los pagos registrados, que el instalador ve en **Mis cobros** |
| **La contadora** (área de Administración) | Cada mes cerrado, el **archivo para la contadora**: compras con neto e IVA, ventas, ajustes y movimientos del mes. Y lo que hay para descontar de los sueldos y el saldo de la cuenta del socio |
| **Gerencia** | El flujo de fondos, el estado de resultados, el cierre de cada mes y los números de Finanzas del reporte semanal |

### A quién le pregunta qué

| Si hace falta saber… | Se le pregunta a… |
|---|---|
| Qué se le prometió al cliente sobre cómo y cuándo paga | Al **asesor comercial** del proyecto |
| Si el banco ya aprobó el crédito de un cliente | Al **asesor comercial**: él sigue el trámite con el banco |
| Qué equipo hizo una obra o cuándo se hizo | Al **gerente de Operaciones** |
| Qué compró Logística y para qué obra | A **Logística** |
| Si un gasto de tarjeta fue de Voltia o personal | A **quien usa la tarjeta**; si es personal con una tarjeta de la empresa, también a quien lo autorizó |
| Cómo se registra algo ante DGI o en la contabilidad formal | Al **contador** |
| Algo del cliente que no es de plata | A **Experiencia Solar** |

---

## 3 · Procedimiento

Lo que sigue es el orden en que se trabaja. **Los plazos marcados como
«pendiente de definir» no tienen todavía una regla escrita**: hasta que Gerencia
los fije, se trabaja con criterio y se avisa si algo se demora.

### 3.1 · Lo que se hace todos los días

1. **Mirar "Para hacer hoy"**, arriba del Inicio de Finanzas (5.1): una sola
   lista con todo lo pendiente de todas las pantallas, primero lo vencido. Cada
   renglón lleva a donde se resuelve, y cuando se resuelve desaparece solo. La
   misma lista llega cada mañana por mail a quien trabaja en Finanzas, y el
   número rojo junto a "Finanzas" en el menú dice cuántas cosas hay para hoy.
   Después, la posición, lo que está **por conciliar** y los **pendientes**.
2. **Revisar las facturas de proveedores por revisar** (Finanzas → Facturas).
   Voltia PM trae las facturas solas cada media hora. Las de los proveedores de
   **cuenta corriente** pasan solas a la deuda y se revisan una vez por semana
   (3.2); las demás no suman a la deuda hasta que Finanzas las revisa. Plazo
   para revisarlas: *pendiente de definir*; Voltia PM marca las que tienen más
   de una semana.
3. **Aprobar las compras que le tocan.** Lo que está en la lista de materiales
   de Ingeniería lo compra directo el encargado de compras. Lo que no está en
   la lista lo aprueba el gerente de Operaciones hasta USD 200 por gasto, en
   cualquier obra y sin tope total, con rendición de cuentas: cada gasto queda
   cargado asignado a la obra y con su motivo. **Lo que pasa ese monto lo
   aprueba Finanzas o Gerencia**, y rápido: Logística tiene 5 días
   hábiles para comprar y recibir el material de una obra con fecha confirmada,
   y cada día que demora una aprobación es un día menos. Cada gasto queda
   registrado con quién lo cargó, cuándo y cada cambio que se le hizo (ver
   5.16, Historial).
4. **Registrar lo que entró y lo que salió**: cada cobro que entra se marca
   pagado con **la fecha real** del pago; cada pago a un proveedor, a un
   instalador o de una comisión se registra cuando sale la plata. Lo que el
   banco muestra y no está cargado se carga desde **Por conciliar** o desde
   **Banco** (5.9).

### 3.2 · Lo que se hace cada semana

- **Revisar las facturas que entraron solas** (las de proveedores de cuenta
  corriente, marcadas «entró sola» en Finanzas → Facturas): que sean de Voltia,
  que el monto y la obra estén bien. Una vez por semana.
- **Revisar los posibles gastos cargados dos veces** que muestra Por conciliar.
- **Revisar Cobros**: qué clientes están **listos para cobrar** una cuota y
  qué cuotas vencieron sin cobrar (los dos aparecen también en «Para hacer
  hoy», todos los días). Si una cuota está
  vencida, se le pregunta al asesor qué pasó antes de reclamarle al cliente.
  **El reclamo al cliente lo hace Experiencia Solar**, que es quien habla con
  él. Está decidido que pase al **área de Administración** (la contadora)
  cuando esa área se haga cargo de Finanzas en Voltia PM; ese día se corrige
  este manual.
- **Revisar lo que se le debe a cada proveedor por vencimiento** (arriba de
  Finanzas → Proveedores): lo vencido y lo que vence en los próximos 7 días,
  para programar los pagos.
- **Revisar el Flujo de fondos**: si la plata alcanza para lo que vence.
- **El reporte semanal** llega por correo los lunes a primera hora, con la
  cantidad de gastos registrados en la semana, entre otros indicadores (ver
  5.20). Que el número sea real depende de que los gastos se carguen en la
  semana en que ocurren.

### 3.3 · Lo que se hace cada mes

En los primeros días del mes se deja en orden el mes que terminó y se lo
**cierra**. El orden es este:

1. **Pagar las comisiones** del mes: cada comisión vence el **día 1 del mes
   siguiente** a la venta.
2. **Revisar los costos fijos** del mes y marcarlos pagados.
3. **Rendir las tarjetas** (5.10): cada gasto del mes con quién lo hizo y si es
   de Voltia o personal; el pago a la tarjeta cargado como transferencia desde
   el banco, y el saldo que cierra en cero después del pago.
4. **Revisar lo personal**: lo que hay para **descontar del sueldo** a los
   empleados (lo marca descontado el encargado de Finanzas, la contadora, que es
   quien liquida los sueldos) y el saldo de la **cuenta del socio**.
5. **Conciliar las cuentas bancarias** con el saldo real del banco (5.12). Si no
   coincide, se escribe el motivo.
6. **Comparar con el estado de cuenta de cada proveedor**: Finanzas le pide el
   estado de cuenta a cada proveedor con el que tiene cuenta a crédito, lo sube
   en su ficha y Voltia PM lo compara con lo cargado (5.6, «Conciliación con el
   estado de cuenta»). **Es a mano**: Voltia PM no lo pide ni lo sube solo. La
   primera vez con cada proveedor, o cuando lo viejo no tiene arreglo, se
   **arranca la cuenta** con ese estado de cuenta (5.6).
7. **Controlar la facturación al cliente**: que no queden facturas pendientes de
   emitir de proyectos que ya cobraron, ni obras con el aviso «hay cobro sin
   factura». Plazo para emitir: *pendiente de definir*.
8. **Cerrar el mes** (5.15): se revisa la **lista de control**, se baja el
   **archivo para la contadora** y se cierra. Desde ese momento nada con fecha
   de ese mes se carga, se edita ni se borra.

### 3.4 · El recorrido de la plata de un proyecto

1. **El asesor gana la venta.** Se registra sola la **comisión**, como un
   pendiente en Finanzas. Si la propuesta se cotizó sin comisión del vendedor
   (se la puede sacar en el costeo), no aparece ningún pendiente.
2. **Onboarding** (la etapa del proyecto en la que el asesor confirma la venta,
   firma el contrato y cobra la seña). El asesor deja definida la modalidad de
   pago: con **pago directo**, el plan de pagos; con **financiación bancaria**,
   la proforma; con **otro**, la explicación. Sin eso el proyecto no avanza.
3. **Se cobra la seña** y, con pago directo, **el 50 % entre 10 y 15 días antes
   de la obra**. Esa cuota queda **lista para cobrar** sola 10 días antes del
   primer día de obra agendado en el calendario. **Sin el 50 % pago no se da fecha de obra.** Con financiación
   bancaria, la condición es el crédito aprobado. La gestión con el banco la sigue
   el asesor hasta que termina.
4. **Logística compra**; Finanzas aprueba lo que pasa los topes. Las facturas de
   los proveedores llegan solas: las de cuenta corriente entran a la deuda y las
   demás las revisa Finanzas.
5. **Operaciones agenda la obra.** Si es con un equipo tercerizado, aparece solo
   el pago de la mano de obra al instalador.
6. **Obra terminada**: se cobra el **30 %**. La cuota queda lista para cobrar
   cuando Operaciones da por terminada la etapa de ejecución de obra en Voltia PM.
7. **UTE habilita** la instalación: se cobra el **20 %**. La cuota queda lista
   para cobrar cuando se finaliza la habilitación, el mismo momento en que
   Experiencia Solar recibe el aviso de que el cliente puede encender.
8. Si el proyecto **lleva factura**, Finanzas la emite desde Voltia PM por lo que
   dejó definido el asesor al vender (ver 5.4).
9. El trabajo de Finanzas con el proyecto termina cuando está **cobrado entero y
   sus gastos pagados**.

---

## 4 · Lineamientos

### Las aprobaciones de gastos no frenan una obra

Finanzas aprueba las compras que pasan los topes del gerente de Operaciones. Logística tiene 5 días hábiles para
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

### Las facturas de proveedores se revisan; las de cuenta corriente, una vez por semana

Las facturas que los proveedores le emiten a Voltia llegan solas desde la
facturación electrónica (ver 5.5). Qué pasa con cada una depende del proveedor:

- **Proveedor de cuenta corriente** (se le compra a crédito y se le paga contra
  su estado de cuenta; se marca en su ficha): sus facturas **entran solas a la
  deuda**, marcadas «entró sola», y Finanzas las revisa **una vez por semana**.
  No entran solas, y quedan por revisar, las notas de crédito, las facturas en
  cero y las que se parecen a un gasto ya cargado a mano (mismo número, o mismo
  monto con menos de una semana de diferencia), para no contar dos veces lo
  mismo.
- **Los demás proveedores**: la factura **queda por revisar hasta que alguien de
  Finanzas la mira**. Ahí se decide si es deuda nueva, si ya se había cargado a
  mano (y se vinculan, para no contarla dos veces) o si se descarta —por
  ejemplo, porque no es de Voltia—, escribiendo siempre el motivo.

El porqué: a los proveedores de cuenta corriente se les compra todas las
semanas y su estado de cuenta se controla cada mes; revisar factura por factura
antes de que sume a la deuda solo atrasaba la deuda real. Con los demás, una
factura que no se esperaba es más probable que sea un error.

Las **notas de crédito** que manda un proveedor (cuando descuenta algo de lo
facturado) se descuentan de la deuda desde la misma lista, con **«Descontar de
la deuda»** (ver 5.5).

### Una factura se carga por un solo lugar; a un proveedor se le paga por un solo camino

- **Una factura de proveedor se carga siempre con el mismo formulario**, el de
  las facturas recibidas, entre por donde entre («Cargar factura a mano» en
  Facturas, «Cargar factura» en la ficha del proveedor o «Nueva factura a pagar»
  en Proveedores). Ese formulario controla que la misma factura no se cargue dos
  veces. Solo lo que no tiene factura electrónica (un proveedor del exterior,
  una deuda sin comprobante) se carga sin comprobante, desde un enlace del mismo
  formulario.
- **A un proveedor se le paga siempre con «Registrar pago» en su ficha.** Así el
  pago se descuenta de sus facturas y la deuda no queda abierta.
- **El gasto con un proveedor** («Nuevo movimiento» eligiendo el proveedor) es
  **solo para compras de contado**, que no dejan deuda. Si el proveedor elegido
  tiene deuda abierta, Voltia PM avisa y manda a «Registrar pago».

El porqué: con dos caminos para lo mismo, una factura termina cargada dos veces
o un pago queda suelto sin descontar la deuda, y el saldo del proveedor deja de
coincidir con su estado de cuenta.

### Borrón y cuenta nueva con cada proveedor

Lo que se le debe a un proveedor **arranca de cero el día que se concilia con su
estado de cuenta**: Voltia PM queda debiendo exactamente lo que el proveedor dice
en ese estado de cuenta (ver «Arrancar cuenta», 5.6).

- **Los movimientos de caja no se tocan**: los pagos y gastos ya cargados quedan
  como están, porque esa plata salió de verdad.
- **Lo viejo que ya no corresponde se cierra con un ajuste**, siempre con su
  motivo. Un **ajuste** baja lo que se le debe a un proveedor **sin ser plata**:
  no sale de ninguna cuenta, no es gasto ni ingreso y no aparece en el estado de
  resultados.
- **Las deudas viejas de la empresa unipersonal** con Tiempo al Tiempo se
  registran como compra de la SAS. Lo decidió Gerencia sabiendo que el contador
  marcó un riesgo fiscal, que queda para revisar con la contadora.

El porqué: lo viejo tenía facturas sin cargar, pagos sin aplicar y deudas
cargadas dos veces; arreglarlo renglón por renglón no termina nunca. Lo que
importa es que desde hoy lo que dice Voltia PM coincida con lo que dice el
proveedor.

### Lo personal no es gasto de Voltia

Cuando Voltia paga algo que no es de la empresa, no se carga como gasto:

- **Un gasto personal del socio** pagado con plata de Voltia (con una tarjeta o
  de una cuenta) va a la **cuenta del socio**: queda como algo que el socio le
  debe a Voltia. **No se carga como sueldo**: así lo recomendó el contador. La
  contadora la cancela con sueldo formal, con utilidades o con la devolución de
  la plata.
- **Un gasto personal de un empleado** con una tarjeta de la empresa, si fue
  **autorizado**, queda como **adelanto a descontar** del sueldo, con el nombre
  de quien lo autorizó. Lo marca descontado el encargado de Finanzas (la
  contadora), que es quien liquida los sueldos.

Ni la cuenta del socio ni los adelantos entran al estado de resultados.

### Un mes cerrado no se toca

Cuando un mes se cierra (5.15), **nada con fecha de ese mes se carga, se edita
ni se borra**, y sus números quedan fijos: lo que se le mandó a la contadora es
lo que hay. Si hace falta corregir algo, se **reabre** el mes, escribiendo el
motivo, que queda registrado con quién lo reabrió y cuándo. Reabrir un mes
reabre también los meses cerrados posteriores.

Cierran y reabren el **dueño** y **Finanzas**. Con algo sin resolver en la lista
de control se puede cerrar igual, pero escribiendo por qué.

### Ningún proyecto avanza sin saber cómo y cuándo paga el cliente

El asesor de ventas no puede cerrar el onboarding (la primera etapa del
proyecto, cuando se confirma la venta) sin dejar definida la **modalidad de
pago** y lo que esa modalidad pide:

| Modalidad | Lo que tiene que quedar hecho |
|---|---|
| **Pago directo** con Voltia | El **plan de pagos**, con el monto de cada cobro y en qué momento de la obra se cobra |
| **Financiación bancaria** | La **proforma** para el banco |
| **Otro** (un canje, una condición negociada) | La explicación escrita de qué se acordó |

Para Finanzas esto quiere decir que cada proyecto vendido llega con sus cobros
previstos, y que en **Cobros** se ve qué se espera cobrar y cuándo se puede
cobrar.
La regla vale también para los proyectos que ya estaban en onboarding.

### El plan de pagos lo arma el asesor; Finanzas lo cobra

El plan de pagos lo arma el asesor en el onboarding, porque es quien lo acordó
con el cliente. Finanzas también lo puede crear o editar desde Cobros. **Los
montos y los momentos de cobro salen siempre del plan de pagos**, nunca de
memoria: un número mal dicho sobre plata es de lo que más cuesta arreglar.

### Las cuotas se cobran cuando llega su momento de la obra, no en una fecha

Las cuotas del plan de siempre **no tienen fecha**, porque el contrato no las
ata a una fecha sino a lo que pasa en la obra: la seña al firmar, el 50 % antes
de la obra, el 30 % con la obra terminada y el 20 % con la habilitación de UTE.
Voltia PM marca cada cuota **«Lista para cobrar»** cuando llega su momento y la
marca **vencida** si pasaron **10 días** sin cobrarla (para la cuota previa a la
obra, eso cae justo en el primer día de obra). La fecha se completa cuando se
cobra. Para un acuerdo distinto, la cuota se carga **en una fecha fija** y
vence por esa fecha, como cualquier cobro.

### Un cobro se marca pagado con la fecha en que entró la plata

No con la fecha en que se carga. El estado de resultados y el Plan de Protección
contra Granizo toman esa fecha como la del pago: una fecha mal puesta cambia el
mes del resultado y, en el plan granizo, desde cuándo cubre.

### El estado de resultados es de caja

Cuenta **solo lo que efectivamente entró y salió** en el período: lo pagado. Lo
previsto, lo que está a pagar y lo que se le debe a un instalador todavía no
pagado **no aparece**. Por eso un mes «bueno» en resultados puede tener deudas
grandes por vencer: para eso está el flujo de fondos.

Tampoco cuenta lo que no es ni ganancia ni gasto de la empresa: los **ajustes**
de deuda con proveedores (no son plata), las **transferencias entre cuentas
propias** (la plata solo cambia de cuenta) y lo **personal** (cuenta del socio y
adelantos a descontar).

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

**En Instaladores solo aparecen las obras agendadas en el calendario con un
equipo tercerizado**, porque el instalador toma el cargo desde ahí. Una obra que
todavía no se agendó, o que va con equipo propio, no figura ni cuenta como lo que
se le debe a nadie. Si una obra se saca del calendario o pasa a equipo propio, su
pago deja de verse (no se borra) y vuelve a aparecer si se agenda otra vez con un
tercerizado. Siguen a la vista los pagos que ya tienen algo pagado y los cargados
a mano para trabajos que no son de una obra.

### Nada que va a DGI sale sin que una persona lo confirme

Una factura o una nota de crédito al cliente se emite solo después de que quien
factura ve el borrador completo y confirma. Ningún automatismo de Voltia PM
emite por su cuenta. El motivo: **lo emitido no se edita**. Una factura con un
error se corrige con una nota de crédito, y las dos quedan registradas en DGI.
Es más barato revisar antes que corregir después.

**Una factura por proyecto.** Puede ser por todo el presupuesto o por una parte:
se factura lo que dejó definido el asesor al ganar la venta. Si hay que
rehacerla, se anula entera con una nota de crédito y se emite otra.

**Lo que se factura lo define quien vendió.** El presupuesto es lo que paga el
cliente, con IVA. Lo que se le factura puede ser menos: un descuento, una parte
que financia el banco, una parte a nombre de su empresa. Lo sabe el asesor,
porque lo acordó él, y lo deja escrito al crear el proyecto. Finanzas no lo
adivina ni lo saca de la cotización.

**La factura puede ir a nombre de otro.** El cliente del proyecto es siempre la
persona con la que se trabajó, pero la factura puede salir a nombre de su
empresa o de otra persona. Por eso se pregunta en cada factura.

---

## 5 · Las herramientas y cómo se usan

Todo se hace en **Voltia PM**, menú **Finanzas**. A la izquierda hay un menú
con las pantallas agrupadas como en los programas de contabilidad, cada grupo
con su título; en el celular, el menú es un desplegable arriba. Junto a
**Inicio** se ve cuántas cosas hay para hacer hoy:

| Grupo | Pantallas | Para qué |
|---|---|---|
| — | **Inicio** | Lo urgente: cómo se está (posición), lo que falta conciliar y lo que hay que pagar y cobrar |
| **Ventas** | **Cobros**, **Facturación** | Lo que entra: los cobros a los clientes y las facturas que se les emiten |
| **Compras** | **Facturas**, **Proveedores**, **Instaladores**, **Costos fijos**, **Comisiones** | Lo que sale: las facturas de los proveedores, lo que se les debe y se les paga, los instaladores tercerizados, los gastos de todos los meses y las comisiones de los asesores |
| **Bancos** | **Banco**, **Tarjetas**, **Movimientos**, **Cuentas** | Dónde está la plata: lo que dice el banco, las tarjetas de crédito, cada entrada y salida, y las cuentas |
| **Informes** | **Flujo**, **Resultados**, **Cierre**, **Historial** | Qué dice todo junto: el flujo de fondos, el estado de resultados, el cierre de cada mes y el registro de todo lo que se hizo |

Al entrar a Finanzas se abre el **Inicio**. Las **Comisiones** están en el grupo
Compras y también en el menú de la cuenta de cada usuario, para que los asesores
vean las suyas (5.17).

En el celular, las listas de Finanzas se ven como tarjetas y las ventanas se
abren como un panel desde abajo; en la computadora se ven como tablas.

Un **movimiento** es cada entrada o salida de plata registrada en Voltia PM.
Casi todo lo de Finanzas (cobros, facturas de proveedores, comisiones, pagos a
instaladores, costos fijos, gastos de tarjeta) termina siendo un movimiento, por
eso lo que se cambia en una pantalla se ve en las otras.

### 5.1 · Inicio: para hacer hoy, posición, por conciliar y pendientes

Es la primera pantalla de Finanzas y tiene cuatro partes, de arriba abajo.

**Para hacer hoy.** La lista de todo lo que falta en Finanzas, junta: facturas
de proveedores por revisar, deudas que vencen o ya vencieron, lo del banco sin
cargar, cobros atrasados, clientes listos para cobrar una cuota, obras que cobraron y no se facturaron, gastos de
tarjeta sin decidir, costos fijos sin pagar, el cierre del mes anterior, y más.
Cada renglón dice cuántos hay y lleva a la pantalla donde se resuelve. Lo
vencido va primero, en rojo; lo de hoy, en amarillo; y lo que es para mirar
cuando se pueda, en celeste. No se tilda nada: cuando se resuelve, desaparece.
Cada mañana le llega por mail a quien trabaja en Finanzas (lo vencido y lo de
hoy); a Gerencia le llega solo lo vencido.

**La posición.** Todo en dólares: la **caja** (lo que hay en las cuentas), **lo
que nos deben** —separado en vencido, próximos 7 días, de 8 a 30 días, más de
30 días y **sin fecha** (lo que una obra todavía debe sin tener una cuota
prevista, y las cuotas de un momento de la obra que todavía no tiene fecha)—, **lo que debemos** —proveedores, otros compromisos, comisiones e
instaladores, también por vencimiento— y el **neto**, con caja y sin caja. A
diferencia del flujo de fondos, la posición **sí** cuenta las comisiones y lo que
se le debe a los instaladores.

**Por conciliar.** Todo lo que falta que se encuentre, en una sola lista. Si no
hay nada, dice «Todo conciliado».

1. **Falta cargar** (por cuenta): movimientos que el banco muestra y no están
   cargados en Voltia PM. Cada uno tiene **«Cargar»**, que abre «Nuevo
   movimiento» ya completado con la cuenta, la fecha, la descripción y el monto
   del banco, y **«No va»**, para lo que no se carga (por ejemplo, una
   transferencia entre cuentas propias que ya está cargada), que pide escribir
   el motivo.
2. **Cargado en Voltia PM que el banco no muestra**: lo que figura pagado o
   cobrado desde una cuenta del banco hace más de 3 días y no tiene un
   movimiento del banco que coincida. Puede tener mal la cuenta, la fecha o el
   monto, o estar cargado dos veces.
3. **Facturas de proveedores por revisar**: cuántas hay, cuántas son de un RUT
   que no es de ningún proveedor y cuántas tienen más de una semana. Lleva a
   Facturas.
4. **Posibles gastos cargados dos veces**: dos gastos del mismo proveedor, en la
   misma moneda y por el mismo monto, con menos de una semana de diferencia
   (salvo que los dos tengan números de factura distintos). Suele ser una compra
   cargada a mano que además llegó por su factura.

**Pendientes.** Es la lista de **todo lo que está por entrar o por salir**.
Cada renglón lleva una marca que dice qué es:

- **Costo fijo**: los costos fijos del mes que todavía no se pagaron.
- **Factura proveedor**: las facturas a pagar a proveedores.
- **Compromiso manual**: lo que está a pagar y no es de un proveedor.
- **Pendiente manual**: todo lo previsto, es decir, lo que se espera que
  ocurra: las cuotas del plan de pagos de los clientes, las comisiones de los
  asesores, las anualidades del plan granizo y los que se agendan a mano.

Lo que se puede hacer:

- **Filtros**: por tipo (**Costos fijos**, **Deuda proveedores**, **Otros
  compromisos**, **Pendientes manuales**), por proyecto y por proveedor.
- **«Marcar pagado»**: en un pendiente manual pide la **fecha** real (no puede
  ser futura) y la **cuenta** donde entró o de donde salió la plata, que es
  obligatoria. En una factura de proveedor lleva a la ficha del proveedor, donde
  se registra el pago. En un costo fijo, ver 5.8.
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

### 5.2 · Cobros a clientes y plan de pagos

**La lista.** Se entra desde **Finanzas → Cobros**. Muestra **todos** los
proyectos vendidos, estén en obra o ya habilitados, porque que la obra esté
habilitada no dice si el cliente terminó de pagar. Solo quedan afuera las ventas
caídas (proyectos archivados) y lo que todavía no se vendió. Por cada proyecto:
el presupuesto, lo cobrado y lo pendiente.

- Al entrar se ven solo los que **tienen algo por cobrar**: los que ya pagaron
  todo no aparecen, salvo que se elija **«Todos, también los completos»** o
  **«Completos»** en el filtro. El filtro también tiene **«Listos para
  cobrar»**, **Pendientes**, **Parciales**, **Excedidos** y **Sin
  presupuesto**. Voltia PM recuerda el último filtro elegido.
- Si algún cliente tiene una cuota lista para cobrar, arriba aparece un aviso
  verde con cuántos son (y cuántos tienen la cuota vencida) y el botón **«Ver
  solo esos»**.
- En la lista, esos clientes llevan junto al estado la etiqueta **«Listo para
  cobrar»** (verde) o **«Cuota vencida»** (roja), y van primero.

**Comentarios y archivos del cobro.** Al pie del detalle de cada cliente está
el bloque **Comentarios y archivos**: ahí Finanzas anota lo que se acordó con el
cliente sobre los pagos y sube los comprobantes, sin ir a la pantalla del
proyecto. Queda en el proyecto y en la ficha del cliente, marcado como de
Finanzas.

**El detalle de un cliente** (tocando un proyecto) muestra los cobros ya
recibidos y los **previstos** del plan. Las cuotas de un momento de la obra no
tienen fecha: en la columna de fecha dice el momento («Previo a la obra»,
«Obra finalizada»…) y van al final, en el orden de la obra. Cada previsto lleva
una etiqueta: **LISTA PARA COBRAR** (ya llegó su momento), **VENCIDA** (pasaron
10 días) o **PREVISTO** (todavía no). Los totales cuentan solo lo
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
  > ⏳ [fecha o momento de la obra] · [descripción de la cuota] · [monto]</small>

  Va un renglón por cada pago recibido y por cada cuota prevista. En las cuotas
  que se cobran en un momento de la obra, en lugar de la fecha va el momento
  (por ejemplo, «Obra finalizada»). Si el proyecto no tiene potencia cargada, la segunda línea dice solo
  «Obra [código]». Si no hay pagos recibidos o no quedan cuotas, ese bloque no
  aparece. **Ojo:** el «Cobrado» del resumen suma solo lo cobrado en dólares;
  si el cliente pagó algo en pesos, ese pago aparece en la lista pero no en el
  total.

**El plan de pagos.** Es el conjunto de **todos los cobros previstos** del
proyecto. Si un proyecto tiene presupuesto y todavía no tiene cobros previstos,
aparece el aviso con **«Crear plan de pagos →»**. La ventana viene con una
sugerencia sobre lo que falta cobrar, **sin fechas**: una **«Seña»** de USD 500
(al firmar) y tres cuotas, **«Cuota 1 · previo a la obra»** (completa el 50 %),
**«Cuota 2 · obra finalizada»** (30 %) y **«Cuota 3 · habilitación
finalizada»** (20 %). La columna **«Cuándo se cobra»** dice el momento de cada
una: **Al firmar**, **Previo a la obra**, **Obra finalizada**, **Habilitación
finalizada** o **En una fecha fija**, que pide la fecha (para lo que se acordó
distinto con el cliente).
Cada cuota se puede cambiar (descripción, monto, porcentaje, cuándo se cobra),
agregar o quitar. Una cuota nueva viene «en una fecha fija». Reglas:

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

**Cuándo queda lista cada cuota.**

| Cuota | Queda lista para cobrar | Vence |
|---|---|---|
| Seña | Desde que se crea el plan | 10 días después |
| Previo a la obra | 10 días antes del primer día de obra agendado en el calendario; si la obra se reagenda, se corre sola | El primer día de obra |
| Obra finalizada | Cuando se da por terminada la etapa de ejecución de obra | 10 días después |
| Habilitación finalizada | Cuando se finaliza la habilitación de UTE | 10 días después |
| En una fecha fija | No se marca «lista»: vence en su fecha, como siempre | Su fecha |

Si la obra terminó pero nadie dio por terminada la etapa en Voltia PM, la cuota
2 no queda lista: vale la pena preguntarle a Operaciones. Los clientes **sin
plan de pagos** (por ejemplo, los que pagan con un crédito del banco) no tienen
cuotas y nunca aparecen como listos para cobrar.

**Ojo:** «Cobrado» y «Pendiente» de la lista no se calculan igual que el plan:
la lista suma todo lo cobrado, pasando los pesos a dólares; el plan cuenta solo
los cobros en dólares de entrada de proyecto. Por eso a veces no coinciden
exacto.

### 5.3 · Cobros que gestiona Experiencia Solar

Experiencia Solar tiene su propia pestaña **Cobros**, dentro de su módulo, para
gestionar los pagos de los clientes **sin entrar a Finanzas**: no ve gastos,
cuentas ni resultados. Puede ver lo cobrado y lo pendiente de cada cliente,
registrar un cobro nuevo (cobrado o previsto), marcarlo pagado, editar el
monto, eliminarlo y **«Copiar resumen (WhatsApp)»**, que copia el mismo mensaje
*Resumen de pagos* de 5.2. Desde su pestaña **no se crea ni se edita el plan de
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

### 5.4 · Facturación al cliente

**Qué se le factura a cada cliente.** Al ganar la venta, cuando crea el
proyecto, el asesor contesta **«¿Qué se le factura?»**. No se puede crear el
proyecto sin contestarlo:

- **«Facturación normal»**: se le factura todo el presupuesto. Se puede dejar
  una nota (por ejemplo, el RUT o la razón social a la que va la factura).
- Si no es normal, se carga **el monto a facturar** y **el motivo**. El monto se
  puede escribir de tres formas, y al llenar una las otras dos se completan
  solas: **sin IVA**, **con IVA** o **como porcentaje del presupuesto** (por
  ejemplo, 50). Si el monto es cero, el proyecto queda como que **no lleva
  factura**.

Lo mismo se corrige desde la ficha del proyecto o desde la lista de
Facturación (el lápiz junto al monto).

En **Finanzas → Facturación** están los proyectos que llevan factura, con
**Pendientes**, **Emitidas** y **Todas**. Cada fila muestra por separado:

- **Presupuesto (con IVA)**: lo que paga el cliente en total.
- **A facturar (con IVA)**: lo que hay que facturarle; abajo, el mismo monto sin
  IVA y si es «Normal» u «Otro monto».
- **Facturado**: lo que ya se le facturó desde Voltia PM.
- **Falta facturar**: la diferencia.

Los proyectos vendidos antes de este cambio que tenían una nota de facturación
aparecen **«A definir»**: Finanzas les carga el monto con **«Definir»**, mirando
la nota y preguntándole al asesor. La nota se sigue editando desde la lista.

**Cobrado contra facturado.** Si una obra cuya factura salió desde Voltia PM
cobró en dólares más de lo que se le facturó (las facturas menos las notas de
crédito), la fila muestra el aviso **«hay cobro sin factura»**, con lo cobrado y
lo facturado. Las facturas hechas por fuera de Voltia PM no entran en esta
comparación.

**Emitir la factura.** Voltia PM emite la factura electrónica directamente: no
hace falta entrar al sistema de facturación electrónica. Se toca **«Emitir
factura»** en el proyecto y se abre el borrador, en dos pasos:

1. **Datos.** Primero hay que contestar dos preguntas:
   - **¿Cuánto se factura?** Viene propuesto **lo que falta facturar** de lo
     que dejó definido el asesor, sin IVA, y arriba se lee lo acordado y lo ya
     facturado. Se puede elegir **qué porcentaje** de ese monto facturar (100 %
     por defecto). El IVA se suma encima. Si el proyecto está «A definir», se
     parte de la cotización sin IVA (o, sin cotización, del presupuesto sin IVA)
     y la pantalla avisa que falta definir cuánto se factura: conviene
     definirlo antes.
   - **¿A nombre de quién va la factura?** Del cliente del proyecto, o de otra
     persona o empresa: es común que el cliente la quiera a nombre de su
     empresa. No viene marcada ninguna opción: se pregunta siempre. Con otra
     empresa, se escribe su RUT y el botón **«Traer de DGI»** completa la razón
     social y la dirección fiscal.

   Después Voltia PM arma el resto con lo que tiene el proyecto, y todo se
   puede corregir:
   - **El tipo de comprobante.** A una persona se le hace un **e-Ticket**, con su
     cédula. A una empresa, una **e-Factura**, con su RUT. Si el RUT está
     registrado en DGI, se ofrece la razón social que figura ahí.
   - **El nombre, la dirección, la ciudad y el departamento** del cliente. Son
     obligatorios: DGI pide los datos del comprador en toda compra grande, y una
     instalación siempre lo es.
   - **La fecha de emisión** (puede ser anterior a hoy) y **la forma de pago**:
     contado o crédito, con su vencimiento.
   - **Los renglones**, con el precio **sin IVA**. Viene uno solo, por el
     porcentaje elegido. Abajo se ve cuánto es neto, cuánto IVA y el total.
   - **La adenda**: un texto libre que sale impreso en la factura. Viene con el
     código del proyecto.
   - **Si se le manda el PDF al cliente por mail**, y a qué dirección.

   Arriba se ve la nota de facturación del proyecto, para no olvidarse de lo
   que se anotó al venderlo.
2. **Confirmar.** Muestra exactamente lo que se va a emitir. Hay que tildar
   **«Revisé los datos»** para que se habilite el botón de emitir. Si hay algo
   mal (una cédula que no existe, una e-Factura sin RUT, una factura a crédito
   sin vencimiento), Voltia PM lo avisa antes y no deja pasar.

**Después de emitir.** La factura aparece en la lista con su número y su estado
ante DGI:

- **Esperando DGI**: la factura ya salió y DGI todavía no respondió. Suele tardar
  unos minutos. Voltia PM lo consulta solo cada cinco minutos; con el botón de
  refrescar se consulta en el momento.
- **Aceptada DGI**: quedó firme.
- **Rechazada DGI**: DGI no la aceptó. El proyecto vuelve a pendientes (ver el
  capítulo 6).
- **Verificando**: el sistema de facturación electrónica tardó en responder y
  todavía no se sabe si la factura salió. Voltia PM lo averigua solo en pocos
  minutos, y mientras tanto no deja emitir otra.

El PDF oficial queda guardado en el proyecto y se abre desde la columna
**Factura**.

**Corregir una factura: la nota de crédito.** Lo emitido no se edita. Con
**«Nota de crédito»**, en la misma fila, se elige:

- **Total**: anula la factura entera. El proyecto vuelve a pendientes y se puede
  emitir una nueva.
- **Parcial**: descuenta un monto (sin IVA; el IVA se descuenta solo), por
  ejemplo un descuento acordado después de facturar.

En los dos casos el **motivo** es obligatorio, y se confirma igual que la
factura.

**Facturas hechas por fuera de Voltia PM.** Si una factura se emitió en otro
lado, se usa **«Marcar emitida»**, que registra la fecha y la saca de
pendientes, y se adjunta el archivo desde la columna **Factura** (ícono de
subir). Si se marcó por error, **«Revertir»**. Una factura emitida desde Voltia
PM no se puede revertir así: se anula con una nota de crédito.

**Los cobros no emiten comprobantes.** Registrar un cobro sigue sin tocar la
facturación electrónica. Si cada cobro tiene que llevar su recibo electrónico
está pendiente de definir con el contador.

### 5.5 · Facturas de proveedores

Se entra desde **Finanzas → Facturas**. Tiene dos partes: arriba, las facturas
**por revisar**; abajo, el **registro** de todas.

**Cómo llegan.** Voltia PM consulta la facturación electrónica **cada media
hora, todos los días**; el botón **«Buscar facturas nuevas»** consulta en el
momento. Trae **todas las facturas que DGI tiene registradas a nombre de
Voltia** —así no se pierde ninguna aunque el mail no haya llegado— y las que
llegaron por mail a la casilla publicada en DGI. Además, se pueden **cargar a
mano** (ver más abajo). Los tres caminos terminan en la misma lista.

**Las de cuenta corriente entran solas.** Si el proveedor está marcado como de
**cuenta corriente** (5.6), después de cada consulta sus facturas pasan solas a
la deuda, con la marca **«entró sola»**, para la revisión de cada semana. No
entran solas, y quedan por revisar como las demás: las notas de crédito, las
facturas en cero y las que se parecen a un gasto de ese proveedor ya cargado a
mano (mismo número, o mismo monto con menos de una semana de diferencia).

**Cómo se busca una factura.** Arriba de la lista hay filtros: por proveedor
(aparecen también las empresas que todavía no están dadas de alta, con su razón
social), por tipo (facturas o notas de crédito), por fecha de emisión (desde y
hasta) y un buscador por número, RUT o razón social. Al lado se ve cuántas
quedan de cuántas hay; **«Limpiar filtros»** vuelve a mostrar todas.

**Las facturas por revisar.** Por cada una, la persona de Finanzas elige:

- **Cargar como deuda**: pasa a ser una factura a pagar del proveedor, con el
  vencimiento según su plazo.
- **«¿Ya está cargada? Gastos parecidos»**: Voltia PM busca entre los gastos ya
  cargados a mano (del mismo proveedor o cargados **sin proveedor**, como el
  combustible) los que más se parecen a la factura, y los muestra del más
  probable al menos, marcados **«Muy probable»** o **«Probable»** y con el porqué:
  mismo número, mismo monto, igual al monto sin IVA, el mismo monto en la otra
  moneda, a cuántos días, si la descripción nombra al proveedor o es del rubro.
  Si es esa compra, se toca y se vinculan: no se duplica nada, y el gasto toma el
  proveedor y el número de la factura. Si no aparece ninguno, es que esa compra
  **no se cargó**: se carga como deuda (y, si ya se pagó, se registra el pago).
- **Descartar**: pide escribir el motivo. Una factura descartada se puede
  **«Volver a la bandeja»**.
- **Dar de alta proveedor**: cuando la factura es de una empresa que todavía no
  está en Voltia PM. Propone el nombre registrado en DGI.

**Notas de crédito de un proveedor.** En lugar de «Cargar como deuda» aparece
**«Descontar de la deuda»**: baja lo que se le debe a ese proveedor, en la
moneda de la nota, empezando por la deuda más vieja, **sin mover plata** (es un
**ajuste**, ver 5.6). Si la nota es mayor que lo que se le debe, Voltia PM no la
descuenta y la deja por revisar con el aviso. Si ya se había descontado a mano,
se usa **«Marcar registrada»** y se anota cómo.

**El proveedor se reconoce por el RUT**, nunca por el nombre. Por eso conviene
que cada proveedor tenga su RUT cargado. Cuando una factura llega de un RUT que
ningún proveedor tiene, se elige de qué proveedor es en **«¿De qué proveedor
es?»**: queda asignado a **todas** las facturas por revisar con ese RUT, y el
proveedor se queda con el RUT, así las siguientes llegan ya asignadas. Si el
proveedor elegido tiene otro RUT, Voltia PM no deja asignarlo.

**Cargar una factura a mano.** Es **el único formulario** para cargar una
factura de proveedor: abre el mismo desde **«Cargar factura a mano»** (acá),
desde **«Cargar factura»** en la ficha del proveedor y desde **«Nueva factura a
pagar»** en Proveedores. Se completa proveedor (o su RUT, si todavía no está
dado de alta), tipo de comprobante, serie, número, fecha, moneda, **total con
IVA incluido** y, si se quiere, el IVA, el vencimiento, la obra y el PDF. Si se
escribe el IVA, Voltia PM calcula el neto. La casilla **Cargarla como deuda
ahora** la confirma en el mismo paso.

Para lo que **no tiene factura electrónica** (un proveedor del exterior, una
deuda sin comprobante), el mismo formulario tiene el enlace **«¿Sin factura
electrónica? Cargar la deuda sin comprobante»**, que abre el formulario simple:
proveedor, descripción, número (opcional), monto, moneda, fechas de emisión y de
vencimiento, y proyecto (opcional). El monto va con IVA incluido. Si no se pone
vencimiento, **vence sola** a los días de plazo del proveedor.

**Una factura nunca se carga dos veces.** Cada comprobante se identifica por el
RUT de quien lo emite, el tipo, la serie y el número:

- Si ya está en Voltia PM, por cualquiera de los tres caminos, Voltia PM no la
  carga y avisa por dónde llegó y en qué estado está.
- Si se carga a mano y después la trae la facturación electrónica, se reconoce
  como la misma.
- Si ya había una deuda de ese proveedor cargada sin comprobante que parece la
  misma —mismo número o mismo monto—, no se crea otra: queda por revisar para
  vincularla.
- Si dos personas resuelven la misma factura a la vez, la primera la toma y a la
  segunda Voltia PM le avisa que ya está resuelta.

**El neto y el IVA.** El monto de una factura se carga siempre **con IVA
incluido**: es el total que figura en la factura y el que se le paga al
proveedor. Cuando la factura llega por la facturación electrónica, la deuda se
queda además con su **neto** y su **IVA**; cuando se carga a mano con el
formulario de la factura, si se escribe el IVA Voltia PM calcula el neto. Son los
que van al libro de compras del archivo para la contadora (5.15).

**El PDF.** Cada factura tiene **Ver PDF**. Si llegó por mail, Voltia PM se lo
pide a la facturación electrónica y lo guarda. Si llegó solo por DGI, que no
guarda el PDF, o si no se consiguió, aparece **Subir PDF** para cargar el que
mandó el proveedor.

**El registro.** Abajo está el registro de **todas** las facturas de
proveedores, para buscar cualquiera: las que llegaron por la facturación
electrónica —en cualquier estado, también las descartadas y las de empresas sin
dar de alta— y las que se cargaron a mano. Se filtra por proveedor (o por **Sin
proveedor en el sistema**), por fechas, por origen y con un buscador. Cada
factura muestra neto, IVA, total, vencimiento, por dónde llegó (DGI, mail o a
mano), en qué está —por revisar, a pagar, pagada o descartada— y su PDF.

### 5.6 · Proveedores: lo que se les debe, sus facturas y sus pagos

**Lo que se debe por vencimiento.** Arriba de **Finanzas → Proveedores** están
los totales: cuánto se debe en total, cuánto está **vencido**, cuánto **vence en
los próximos 7 días** y cuánto **entre 8 y 30 días**. Abajo, una fila por
proveedor con lo mismo, el saldo a favor (pagos hechos que todavía no se
aplicaron a ninguna factura) y cuánto del límite de crédito está usado. Tocando
un proveedor se ven sus facturas, cada una con su vencimiento y cuántos días le
faltan.

**El listado de proveedores**, más abajo, muestra cada proveedor con su saldo.
Desde ahí se da de alta uno nuevo y se carga una factura con **«Nueva factura a
pagar»** (el mismo formulario de 5.5).

**Datos de un proveedor.** Se cargan al crear o editar el proveedor:
**Plazo (días)**, **Límite de crédito** (vacío si no tiene) y la moneda del
límite, y la casilla **Cuenta corriente**: se tilda cuando a ese proveedor se le
compra a crédito y se le paga contra su estado de cuenta; sus facturas
electrónicas entran solas a la deuda (5.5). Sin tildar, quedan por revisar.
Conviene que cada proveedor tenga su **RUT** cargado: la facturación electrónica
lo reconoce por el RUT, nunca por el nombre.

**La ficha de un proveedor** (tocando uno en el listado) muestra arriba el
**total adeudado**, el **saldo a favor** y el **saldo neto**, y tiene cuatro
pestañas: **Facturas**, **Pagos**, **Estado de cuenta** (todos los movimientos
con el saldo que va quedando; no se puede exportar) y **Conciliación** (ver más
abajo). Los botones son **«Cargar factura»**, **«Registrar pago»**, **«Arrancar
cuenta»**, **«Ajustar»**, **«Editar»** (los datos del proveedor) y **«Nuevo
gasto»**, que es solo para una compra de contado (ver el lineamiento «Una factura
se carga por un solo lugar; a un proveedor se le paga por un solo camino»).
Cada factura se puede **editar** o **eliminar** desde la ficha.

**Registrar un pago.** Es **el único camino** para pagarle a un proveedor. Se
piden la fecha, el monto y la moneda **de la deuda**, la **cuenta de donde sale
la plata** (obligatoria), el método (transferencia,
efectivo, cheque, tarjeta…), una referencia y notas. Viene marcada la casilla
**«Aplicar automáticamente a las facturas más viejas»**: así el pago **se
descuenta solo de las facturas que se le deben, de la más vieja a la más
nueva**, sin elegir factura por factura. Solo se descuenta de facturas en la
misma moneda del pago. Cuando una factura queda pagada entera, toma como fecha
de pago la del último pago que la saldó (un ajuste no cuenta como pago: si una
factura se salda solo con ajustes, conserva la fecha que tenía).

**Pagar desde una cuenta de otra moneda.** Una deuda en pesos se puede pagar
desde una cuenta en dólares, y al revés: en la lista de cuentas aparecen aparte,
como «En otra moneda». Al elegir una, Voltia PM pide la **cotización** (pesos
por dólar; viene la del día y se cambia por la que usó el banco) y muestra cuánto
**sale de la cuenta**. La deuda baja en su moneda por el monto cargado; de la
cuenta sale el equivalente, que es lo que se compara con el banco. En la lista de
pagos del proveedor, debajo del monto, se ve «salió … a …».

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

**Ajustar.** Un **ajuste** baja lo que se le debe a un proveedor **sin que sea
plata**: no sale de ninguna cuenta, no es gasto y no aparece en el estado de
resultados ni en el flujo de fondos. Sirve para cerrar una diferencia que no
tiene explicación o una deuda que ya no corresponde. **«Ajustar»** (en la ficha)
o **«Ajustar diferencia»** (en la Conciliación) piden el monto, la moneda, la
fecha y el **motivo**, que es obligatorio y queda registrado. El ajuste se
descuenta de la deuda más vieja a la más nueva y siempre se aplica entero: nunca
deja saldo a favor. En la pestaña Pagos aparece como **«Ajuste (no es
plata)»**. No se edita: si quedó mal, se anula y se hace de nuevo.

**Arrancar cuenta.** Deja lo que se le debe a un proveedor **igual a lo que dice
su estado de cuenta**, desde esa fecha (el porqué está en el lineamiento «Borrón y
cuenta nueva con cada proveedor»). Se abre con **«Arrancar cuenta»** en la ficha,
o con **«Arrancar la cuenta con este estado de cuenta»** desde la Conciliación,
que ya trae el saldo leído. Se completa:

1. La **moneda**, la **fecha del estado de cuenta** y el **saldo que dice**.
2. Las **deudas abiertas** en Voltia PM en esa moneda: se tildan las que **siguen
   vigentes**. Vienen tildadas las que llegaron por factura electrónica y las de
   octubre de 2026 en adelante; las demás se proponen cerrar.
3. Una nota, si se quiere.

Debajo de las deudas aparecen los **pagos con saldo sin usar** hasta la fecha del
estado de cuenta (lo que sobró de un pago que no se usó entero), con cuánto
sobra de cada uno: se cierran, porque el estado de cuenta ya los descuenta.

Antes de confirmar, Voltia PM muestra la cuenta: la deuda vigente, cuántas
deudas se cierran y por cuánto, y la diferencia con el estado de cuenta. Al
confirmar, **lo que había quedado a favor de Voltia por pagos viejos** (lo que
sobró de un pago que no se usó entero) también se cierra: el estado de cuenta del
proveedor ya lo tiene en cuenta, y si quedara, se descontaría solo de la próxima
factura. Queda como **«Saldo a favor anterior, cerrado al arrancar la cuenta»**,
cancelado por esos mismos pagos (no es plata nueva). Además:

- Las deudas no tildadas **se cierran con un ajuste** («Cerrada al arrancar la
  cuenta el …»).
- Si el proveedor dice que se le debe **más**, la diferencia entra como una deuda
  «**Saldo anterior** según estado de cuenta al …», con fecha anterior a la deuda
  vigente más vieja, para que el próximo pago la cancele primero.
- Si dice que se le debe **menos**, la diferencia se baja con otro ajuste.
- **Los pagos y gastos ya cargados no se tocan.**

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
   en Voltia PM** (está en el estado de cuenta y no en Voltia PM: se revisan las
   facturas por revisar o se carga); y lo que **el proveedor no tiene** (está en
   Voltia PM y no en su estado de cuenta: puede ser un pago que el proveedor no
   imputó o algo cargado de más).
5. Después de corregir lo que faltaba, **«Volver a comparar»** repite la
   comparación con lo cargado hoy, **sin volver a leer el archivo**.
6. Lo que no se pueda explicar se resuelve con **«Ajustar diferencia»** o, si
   conviene empezar de cero, con **«Arrancar la cuenta con este estado de
   cuenta»**.

Cada conciliación queda guardada en la ficha, con el archivo original para
volver a verlo.

### 5.7 · Pagos a instaladores tercerizados

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

**Cuándo se le paga:** el **50 % al arrancar la obra** y el **50 % al
terminarla**. La orden de pago la da el responsable de Administración y Finanzas
o Gerencia, cuando en Voltia PM la etapa de Ejecución de obra figura terminada.
El monto no se negocia: el gerente de Operaciones se lo informa al tercerizado
antes de agendar, y pagar más lo autoriza solo Gerencia.

**Un gasto de obra que no estaba previsto** se carga en Finanzas asignado a la
obra y se suma a su costeo. Quién lo aprueba está en el paso 3 del
procedimiento diario (3.1).

Finanzas:

- **«Asignar»** o **«Editar»** un trabajo: el instalador y el monto.
- **Registra los pagos** con **«Pagar»**, totales o parciales: monto, fecha y una
  nota. No se puede pagar más que el saldo. No se elige cuenta.
- **Corrige o anula una entrega** ya registrada, incluso con el trabajo saldado.
- **Carga a mano** trabajos que no salen de un proyecto (una reparación en
  garantía, una obra anterior), con **«Cargar pago manual»**.
- **Filtra por instalador** y copia un **resumen para WhatsApp** con las obras en
  curso y lo que falta de cada una, más las últimas tres saldadas (las que se
  terminaron de pagar más recientemente, no las de obra más nueva). El botón
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
  > ✅ [código del proyecto] · [cliente] — [monto] (pagado el [día y mes en que se terminó de pagar])</small>

  Va un renglón por obra; el detalle «cobrado…, falta…» aparece solo si ya se le
  entregó una parte. Si no se le debe nada, en lugar del pendiente dice
  «✅ \*No queda nada pendiente.\*». Si hay una sola obra saldada, el título es
  «\*Último trabajo saldado\*». Si el instalador no tiene trabajos, dice «No hay
  trabajos registrados.». Los trabajos cargados a mano sin proyecto muestran solo
  el nombre del cliente.

Cada pago registrado es un gasto pagado «Mano de obra», **sin cuenta**, que
entra solo a Movimientos y al estado de resultados. **Lo que se le debe al instalador no
aparece como gasto futuro en el flujo de fondos**: se ve solo en esta pantalla
y en la posición del Inicio.

El instalador ve sus trabajos, lo cobrado y el saldo en **Mis cobros**, desde el
menú de su cuenta. Solo puede mirar.

### 5.8 · Costos fijos

Los **costos fijos** son los gastos que se repiten (alquiler, contador,
servicios). Se configuran una vez en **Finanzas → Costos fijos**, con
**«Agregar costo fijo»**: nombre, descripción
(opcional), **periodicidad** —**mensual**, **bimensual** (en los meses pares o
en los impares) o **anual** (en un mes elegido)—, el **día del mes de pago** y un
**monto de referencia** con su moneda. Los carga Finanzas (y también un administrador).

**No generan movimientos solos.** Cada costo fijo figura en **Pendientes** (en el
Inicio) desde que empieza el mes que le toca, y el **Flujo de fondos** los
proyecta para los próximos 3 meses. Sale de Pendientes cuando:

- se registra el pago: **«Marcar pagado»** en Pendientes abre el formulario de
  **Nuevo movimiento** ya completado con la categoría **Costo fijo** y ese
  costo elegido; se pone el **monto real** y se guarda. Ese monto pasa a ser el
  que Voltia PM sugiere la próxima vez;
- o se usa **«Saltear este mes»**, cuando ese mes no corresponde. Afecta solo
  ese mes: el costo fijo sigue activo para los siguientes.

Un costo fijo no se puede reagendar desde Pendientes: su fecha es la del día del
mes configurado, y se cambia desde Finanzas → Costos fijos.

### 5.9 · Banco

Se entra desde **Finanzas → Banco**. Es el registro de **todo lo que Voltia PM
leyó del banco**, cada movimiento con su **pareja** en Voltia PM (el movimiento o
el pago cargado que le corresponde). La regla es simple: **cada movimiento del
banco tiene que tener su movimiento cargado**.

Los movimientos del banco los trae el **lector del banco**, un programa que lee
los movimientos de cada cuenta en el home banking. Para saber de qué cuenta es
cada uno, la cuenta tiene que tener cargado su **número de cuenta del banco**
(en Administración → Cuentas). Una cuenta que el lector todavía no leyó dice
«todavía no se leyó»: esa cuenta se controla con la conciliación mensual (5.12).

**Arriba**, una tarjeta por cuenta: el **saldo en el banco** con la fecha y hora
de la última lectura, cuántos movimientos tienen pareja y cuántos faltan cargar.

**Abajo**, la lista, que se filtra por cuenta, por fechas y por estado. Cada
movimiento del banco está en uno de estos estados:

| Estado | Qué quiere decir | Qué se hace |
|---|---|---|
| **Coincide** | Voltia PM encontró una pareja (misma cuenta, monto y fecha cercana), pero nadie la confirmó | **«Confirmar»**: fija la pareja, que ya no se mueve aunque después se cargue algo parecido |
| **Confirmada** | Una persona confirmó la pareja | Si la pareja está mal, **«Soltar»** |
| **Falta cargar** | No hay nada cargado que coincida | **«Cargar»** abre «Nuevo movimiento» ya completado; **«No va»** pide el motivo, para lo que no se carga |
| **No va** | Alguien decidió que no se carga, con su motivo | Si fue un error, **«Volver a comparar»** |
| **Antes de comparar** | Es de antes de la fecha desde la que Voltia PM compara con el banco | Nada: se muestra, pero no se compara |

Lo que falta cargar aparece también en **Por conciliar**, en el Inicio (5.1).

### 5.10 · Tarjetas

Se entra desde **Finanzas → Tarjetas**. **Una tarjeta de crédito es una cuenta
más**: se da de alta como cualquier cuenta, con el tipo **«Tarjeta»**, una por
tarjeta. Así:

- **Cada gasto de la tarjeta** se carga en Movimientos como cualquier gasto,
  eligiendo la tarjeta como cuenta.
- **El pago de la tarjeta** es una **transferencia** desde la cuenta del banco a
  la tarjeta.
- Si después del pago el saldo de la tarjeta queda en cero, **cierra**.

**Quién usa la tarjeta.** Para cada tarjeta se cargan el titular y los
adicionales, cada uno con su **regla**: **Siempre de Voltia**, **Siempre
personal** o **Se decide gasto por gasto**. Al agregar a alguien se tilda **«Es
el socio»** si lo es: lo personal del socio va a la **cuenta del socio**; lo
personal de cualquier otro, a **adelanto a descontar** de su sueldo.

**La rendición del mes.** Se elige la tarjeta y el mes, y se ve:

- Los totales: **De Voltia**, **Personal del socio**, **A descontar**, **Pagado
  a la tarjeta** y el **saldo de la tarjeta** («Cierra en cero», o lo que se le
  debe hoy).
- La tabla de gastos, con la fecha, el gasto, el monto y **quién** lo hizo. Cada
  gasto se marca **«Es personal»** o **«Es de Voltia»**. Mientras no se sabe,
  figura **«¿Quién lo hizo?»** o **«Por decidir»**. Si se marca personal un gasto
  hecho con una tarjeta de la empresa (regla «Siempre de Voltia»), Voltia PM
  pregunta **quién autorizó** el gasto personal, y queda anotado.

**Cuenta del socio.** Lo que suman los gastos personales del socio pagados por
Voltia, menos lo que devolvió. La contadora la cancela con sueldo formal, con
utilidades o con la devolución (ver el lineamiento «Lo personal no es gasto de
Voltia»).

**A descontar del sueldo.** Los gastos personales autorizados de empleados con
una tarjeta de la empresa, todavía no descontados. Cuando se descuentan del
sueldo, quien liquida los sueldos (el encargado de Finanzas, la contadora) toca
**«Descontado»**.

### 5.11 · Movimientos

**La pestaña Movimientos muestra solo lo que ya pasó**: la plata que ya entró o
ya salió, más los pagos a proveedores. Lo que todavía se espera (cobros
previstos, facturas a pagar, comisiones sin pagar) no está acá: está en
**Pendientes**, en el Inicio (5.1). Arriba se ven el **saldo actual en pesos** y
el **saldo actual en dólares**.

**«Nuevo movimiento»** carga algo que ya ocurrió: al guardarlo queda como
pagado. El formulario no tiene campo de estado. Pide:

- **Tipo**: **Ingreso** o **Gasto**.
- **Categoría**. Para un ingreso: **Entrada proyecto**, **Cobro cliente**,
  **Cuenta del socio** (cuando el socio devuelve lo que Voltia le pagó) u
  **Otro**. Para un gasto: **Salida proyecto**, **Costo fijo**, **Costo
  variable**, **Compra stock**, **Consumo stock**, **Cuenta del socio** (un gasto
  personal del socio pagado por Voltia), **Adelanto a descontar** (un gasto
  personal autorizado de un empleado) u **Otro**. Al cargar un gasto viene por
  defecto **«Salida proyecto»**, la más habitual. Si se elige **Costo fijo**,
  aparece la lista de costos fijos del mes para elegir a cuál corresponde (ver
  5.8). **«Pago proveedor» no se ofrece**: a un proveedor se le paga con
  «Registrar pago» en su ficha (5.6).
- **Descripción**, **monto** y **moneda** (dólares por defecto, o pesos).
- **Cuenta (opcional)**: si se elige una, la moneda pasa a ser la de la cuenta.
  Para un gasto con tarjeta, se elige la tarjeta.
- **Fecha**.
- **Proveedor (opcional)**, solo en los gastos, y **Proyecto (opcional)**. Si
  el proveedor elegido tiene deuda abierta en esa moneda, Voltia PM avisa
  cuánto se le debe y que, si es un pago de esa deuda, se cargue con
  «Registrar pago» en su ficha. El gasto con proveedor es solo para compras de
  contado.

**«Transferencia»** pasa plata de una cuenta a otra de la misma moneda: queda
una salida en la cuenta de origen y una entrada en la de destino. Las
transferencias no cuentan en el estado de resultados. El pago de una tarjeta se
carga así.

**Cómo se ve.** La pestaña arranca mostrando **todo el año en curso**; con
**«Año en curso» / «Por mes»** se cambia a un solo mes, y se puede elegir el
año. Se filtra por tipo (**Todos los tipos**, **Ingresos**, **Gastos**) y hay un
buscador por descripción, proveedor, cliente, cuenta o monto. Arriba de la lista
dice cuántos movimientos hay.

Los **pagos a proveedores** aparecen en la lista, pero no se editan desde acá:
se editan desde la ficha del proveedor (5.6).

**Cómo se borra.** Con la papelera de la fila, o al abrir un movimiento para
editarlo, abajo, con **«Eliminar movimiento»**. Las dos piden confirmación. Un
movimiento atado a una comisión **no se puede borrar** desde Finanzas: se
gestiona desde Comisiones. Nada con fecha de un **mes cerrado** se carga, se
edita ni se borra (5.15).

### 5.12 · Cuentas y conciliación mensual

En **Finanzas → Cuentas** están las cuentas de Voltia (las bancarias y las
tarjetas), una tarjeta por cuenta con su saldo. Las cuentas se dan de alta en
**Administración → Cuentas**. Las transferencias entre cuentas se hacen desde
Movimientos (5.11).

**Conciliar una cuenta** es comparar el saldo que muestra Voltia PM con el real
del banco. Se hace **una vez por mes**. Se carga el **saldo real** que da el home
banking y **su fecha**. Si hay diferencia, el **motivo es obligatorio**: no se
puede guardar sin escribir por qué no coincide. Voltia PM **toma el saldo del
banco como bueno desde esa fecha**, sin crear ningún movimiento: la diferencia no
aparece como ingreso ni como gasto, y lo único que la explica es el motivo
escrito. Cada cuenta guarda el historial de sus conciliaciones.

Lo normal es que no haga falta corregir nada: si todo lo del banco se cargó
(5.9), el saldo coincide solo.

**Dónde se pide la cuenta y dónde no.** Es obligatoria al registrar un pago a un
proveedor y al marcar pagado un cobro o un pendiente manual. En **Nuevo
movimiento** es opcional: un movimiento sin cuenta no mueve el saldo de ninguna
cuenta.

Cuando el saldo de las cuentas no coincide con el flujo de fondos, todas las
pantallas de Finanzas muestran un aviso («Hay un descalce…») con el botón
**«Conciliar cuentas»**.

### 5.13 · Flujo de fondos

Se entra desde **Finanzas → Flujo**. Muestra **cuánta plata va a haber** día a
día: el saldo de hoy más lo que se espera cobrar y menos lo que hay que pagar.
Proyecta **solo tres cosas**: los cobros pendientes de los clientes (las cuotas
del plan de pagos y las anualidades del plan granizo), la deuda con proveedores
y los costos fijos de cada mes.

- Las cuotas que se cobran en un momento de la obra van en la fecha en que se
  espera cobrarlas: si ya están listas o vencidas, **hoy**; si no, una fecha
  estimada (la de obra terminada, el último día de obra agendado; la de
  habilitación, un mes después). Las de obras que todavía **no están
  agendadas** no se pueden ubicar: se listan abajo, en **«Cobros sin fecha»**,
  y no entran en la proyección.

- La deuda con un proveedor se proyecta **ya descontado su saldo a favor**, por
  moneda, empezando por la factura que vence primero.
- Con el **filtro por tipo de movimiento** se prenden o apagan los tipos, con
  los atajos **«Todos»** y **«Ninguno»**; afecta el listado, el gráfico y los
  totales.
- La fecha de un evento proyectado se puede cambiar tocándola.
- **No aparecen**: las comisiones de los asesores, los compromisos a pagar que
  no son de un proveedor, lo que se le debe a los instaladores, las compras de
  materiales que todavía no tienen factura, ni los cobros previstos con fecha fija que ya
  vencieron sin cobrarse. Por eso el flujo puede verse mejor de lo que es: esas
  salidas existen igual (la posición del Inicio sí las cuenta).
- Los ajustes de deuda con proveedores no son plata y no aparecen.

**Qué período abarca.** Arranca hoy, con el **saldo actual** —la suma de todas
las cuentas activas, con los pesos pasados a dólares—, y proyecta **los próximos
3 meses**. No hay un saldo inicial por cuenta: se ve el total. Lo que ya venció
y no se pagó a un proveedor se muestra como si saliera hoy. El gráfico muestra la evolución del
saldo de los últimos 3 meses y de los próximos 3, y avisa si el saldo proyectado
cae por debajo de cero.

### 5.14 · Estado de resultados

Se entra desde **Finanzas → Resultados**. Responde **«¿cuánto ganamos o perdimos
en tal período?»** con la plata que efectivamente entró y salió. Se elige **mes,
trimestre o año**. Todo se muestra **en dólares**.

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
- **No cuentan**: los ajustes de deuda con proveedores, las transferencias entre
  cuentas propias, la cuenta del socio y los adelantos a descontar.
- Al final, el **resultado** y la **rentabilidad**.
- Los pesos se pasan a dólares con la última cotización (ver 5.18).

También se puede pedir desde el chat de Claude conectado a Voltia PM, para
cualquier rango de fechas; da los mismos números.

### 5.15 · Cierre de mes

Se entra desde **Finanzas → Cierre**. **Cerrar un mes lo deja fijo**: nada con
fecha de ese mes se puede cargar, editar ni borrar, y sus números no se mueven
más. Arriba dice hasta qué día está cerrado. Por defecto se abre en el mes
anterior; se puede elegir otro mes y año.

**La lista de control.** Antes de cerrar se revisa. Cinco puntos los calcula
Voltia PM solo (con una marca verde si están bien, o el detalle de lo que falta):

- Todo lo del banco está cargado en Voltia PM.
- Lo cargado como pagado o cobrado aparece en el banco.
- Las facturas de proveedores del mes están revisadas.
- Los costos fijos del mes están pagados.
- Las obras vendidas que llevan factura están facturadas.

Y cuatro los tilda una persona:

- Los estados de cuenta de los proveedores principales, subidos y comparados.
- Las tarjetas rendidas: cada gasto marcado de Voltia o personal, y el pago
  cierra.
- Los descuentos a empleados y la cuenta del socio, revisados.
- La revisión del dueño.

**El archivo para la contadora.** El botón **«Archivo para la contadora»** baja
una planilla de Excel del mes con cuatro hojas: **Compras** (el libro de compras,
con neto e IVA; las notas de crédito, en negativo), **Ventas** (lo facturado desde
Voltia PM), **Ajustes** (cada ajuste de deuda con proveedores, con su motivo y
quién lo hizo) y **Movimientos del mes**. Se puede bajar antes o después de
cerrar.

**Cerrar.** El botón **«Cerrar [mes]»**. Si queda algún punto de la lista sin
resolver, se puede cerrar igual, pero hay que escribir por qué. Al cerrar, Voltia
PM guarda una **foto** del mes: la caja de cada cuenta, la posición y el
resultado del mes. El mes cerrado muestra quién lo cerró, cuándo, la nota y la
caja al cerrar.

**Reabrir.** Con **«Reabrir este mes»**, que pide el motivo (al menos diez
letras) y lo deja registrado. Reabrir un mes reabre también los meses cerrados
posteriores. Abajo está el **historial de cierres**, con cada cierre y cada
reapertura con su motivo.

Cierran y reabren el **dueño** y **Finanzas**; los demás ven la pantalla, pero no
pueden cerrar.

**Lo que el cierre no frena.** Lo que Voltia PM hace solo sigue entrando aunque
tenga fecha de un mes cerrado: una factura de proveedor que se confirma (o que
entra sola), una comisión que nace al ganar una venta, un cobro que registra
Experiencia Solar o un pago a un instalador. Si eso pasa, el número del mes ya no
coincide con la foto del cierre (ver el capítulo 6).

### 5.16 · Historial: auditar lo que se hizo

Se entra desde **Finanzas → Historial**. Es el registro de **todo lo que se
cargó, cambió o borró** en Finanzas: movimientos y cobros, pagos a proveedores y
cómo se aplicaron, ajustes, proveedores, cuentas, comisiones, pagos a
instaladores, facturas recibidas, lo confirmado contra el banco y las
conciliaciones.

Cada renglón dice **cuándo**, **quién**, **qué** (alta, cambio, baja o cambio de
estado) y el detalle. Cuando es un cambio, muestra **el valor de antes y el de
después**: si alguien corrigió el monto de una factura de 1.220 a 1.250, queda
escrito así, con su nombre y la hora.

Se filtra por fechas, por persona, por tipo (movimientos, pagos, proveedores…),
por alta/cambio/baja, y con un buscador sobre el detalle.

No se puede editar ni borrar: es la constancia de lo que pasó. Es la herramienta
para revisar los gastos mientras no exista un circuito de aprobación.

### 5.17 · Comisiones del asesor

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

**La pantalla Comisiones** (en Finanzas → Compras, y en el menú de la cuenta para los asesores): cada asesor
ve solo las suyas; la gerencia comercial, Administración y Finanzas ven las de
todos y filtran por asesor. Muestra el saldo a cobrar, lo cobrado en el año, la
cantidad de ventas, un gráfico por mes y la tabla con filtros (todas,
pendientes, pagas).

**Cómo se paga.** Desde **Pendientes**, en el Inicio de Finanzas: la comisión
aparece como **Pendiente manual**, con vencimiento el día 1 del mes siguiente a
la venta. Se usa **«Marcar pagado»**, que pide la fecha del pago y la cuenta de
donde salió. La comisión pasa sola a **Pagada** en la pantalla Comisiones, con
esa fecha.

**Correcciones.** Solo el administrador puede editar (monto, fecha de venta,
fecha de pago prevista) o borrar una comisión, con el botón **«Editar»** de la
fila. Cada cambio queda registrado y la comisión muestra la marca «editada».
También se puede cargar una **comisión suelta** a un asesor, sin lead, con
**«Agregar comisión manual»** en la pantalla Comisiones (lo puede hacer quien
puede cargar movimientos en Finanzas). La tarjeta de comisión de la ficha del
proyecto que sugiere un porcentaje sirve solo para esa carga manual.

### 5.18 · Cotización del dólar

Voltia PM trabaja en dólares, pero hay movimientos en pesos. Para pasarlos a
dólares (en el estado de resultados, por ejemplo) usa **la última cotización
cargada**. La cotización **se toma sola del Banco Central del Uruguay (BCU)**,
el dólar interbancario, todos los días a las 14:00 hora de Uruguay. Nadie la
carga a mano: no hay una pantalla para eso.

**Ojo:** como se usa la última cotización y no la del día del movimiento, **el
resultado en dólares de un mes ya cerrado cambia un poco cada vez que se carga
una cotización nueva**, aunque nadie toque nada. La foto que se guarda al cerrar
el mes conserva el resultado de ese momento. Es una decisión a revisar.

### 5.19 · El Plan de Protección contra Granizo, en lo que toca a Finanzas

El plan lo maneja **Experiencia Solar** (Experiencia Solar → Plan granizo). Por
USD 12 por panel por año, IVA incluido, Voltia repone los paneles que rompa el
granizo. A Finanzas le toca:

- **La anualidad se genera sola** 30 días antes del vencimiento, con su cobro en
  Finanzas, al precio vigente: un cobro previsto «Plan granizo · anualidad …»,
  que aparece en Pendientes y en el flujo de fondos.
- **Marcar cobrada una anualidad**: lo puede hacer Experiencia Solar desde el
  plan o Finanzas. Siempre con **la fecha real del pago**: el plan se activa con
  el pago, y la fecha decide desde cuándo cubre. Si la marca Experiencia Solar,
  queda **sin cuenta** (ver 5.3), y Finanzas se la asigna.
- **Las reposiciones** (cuando se reponen paneles dañados) quedan como gasto del
  plan, con su costo real: un gasto «Plan granizo · reposición …».
- **Si Finanzas borra el cobro** de una anualidad, el plan la muestra «Sin cobro
  en Finanzas» y ofrece regenerarlo.
- Los cobros del plan **no aparecen en Cobros** de la obra ni cuentan para su
  saldo.

### 5.20 · Los indicadores del reporte semanal

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

## 6 · Cuando algo sale mal

### Un proyecto aparece en Cobros sin plan de pagos

Con pago directo no debería pasar: el onboarding no cierra sin plan. Puede ser un
proyecto viejo, de antes de la regla, o uno con otra modalidad. Se le pregunta al
**asesor** qué se acordó con el cliente y se arma el plan desde el detalle del
cliente. No se inventan fechas.

### Una cuota venció y el cliente no pagó

Se mira primero si el pago entró y no se registró (en **Banco** o en **Por
conciliar**). Si no entró, se le pregunta al asesor si hubo algún cambio
acordado. El reclamo al cliente lo hace Experiencia Solar, que es quien habla con
él (va a pasar al área de Administración cuando esa área se haga cargo de
Finanzas en Voltia PM).

### Una obra muestra «hay cobro sin factura»

La obra cobró más de lo que se le facturó. Se mira cuánto había que facturarle
(la columna **A facturar** y su motivo, que dejó el asesor). Si falta facturar, se emite lo que corresponde; si se
facturó por fuera de Voltia PM, esa factura no entra en la comparación.

### El saldo de un proveedor no coincide con su estado de cuenta

Se sube el estado de cuenta en la **Conciliación** de su ficha y se mira cada
lista. Se revisa en **Facturas** si falta alguna factura (por ejemplo, una
descartada por error o de un proveedor «sin proveedor en el sistema») y en la
ficha si hay pagos que quedaron como saldo a favor. Lo que no tiene explicación
se cierra con **«Ajustar diferencia»**, con su motivo; si lo viejo no tiene
arreglo, se **arranca la cuenta** con ese estado de cuenta. Si el vencimiento de
una factura no coincide con el plazo acordado, se habla con el proveedor: manda
el plazo acordado.

### Una factura del proveedor no llegó

La facturación electrónica trae las facturas de los últimos 45 días. Una factura
más vieja, o una que DGI registró tarde, puede no entrar sola: se carga con
**«Cargar factura a mano»** en Facturas (o **«Cargar factura»** en la ficha del
proveedor, que es el mismo formulario).

### Una factura quedó cargada dos veces

Si se cargó a mano y además llegó por la facturación electrónica, en las
facturas por revisar se toca el gasto que aparece en **«¿Ya está cargada?»**
para vincularlas. Si ya se cargó
dos veces como deuda, se elimina una desde la ficha del proveedor; si tenía
pagos, quedan como saldo a favor. Por conciliar muestra los **posibles gastos
cargados dos veces** para encontrarlos.

### Una factura que entró sola no es de Voltia o está mal

Las facturas de proveedores de cuenta corriente entran solas a la deuda y se
revisan una vez por semana. Si una no corresponde, se elimina la deuda desde la
ficha del proveedor (si ya tenía pagos, quedan como saldo a favor) y se le avisa
al proveedor para que la anule con una nota de crédito.

### Una nota de crédito no se pudo descontar

Si la nota es mayor que lo que se le debe al proveedor en esa moneda, Voltia PM
no la descuenta y la deja por revisar. Se mira con el proveedor si hay facturas
sin cargar; si la nota quedó como plata a favor de Voltia, se habla con el
proveedor y se anota con **«Marcar registrada»** cómo se resolvió.

### Un movimiento del banco no se encuentra en Voltia PM, o al revés

Lo que el banco muestra y no está cargado aparece en **Falta cargar**: se carga
con «Cargar» o, si no va (por ejemplo, una transferencia entre cuentas propias ya
cargada), con «No va» y el motivo. Lo cargado que el banco no muestra suele
tener mal la cuenta, la fecha o el monto: se corrige el movimiento. Si una pareja
que Voltia PM propuso está mal, se la **suelta** en Banco.

### Un gasto de la tarjeta no se sabe de quién es

Queda como **«¿Quién lo hizo?»** o **«Por decidir»** en Tarjetas. Se le pregunta
al titular de la tarjeta. Mientras no se resuelva, la tarjeta no está rendida y
el punto de la lista de control del cierre no se tilda.

### Una obra se reagendó con otro equipo y el pago al instalador quedó mal

El pago no cambia solo. Se corrige a mano en **Finanzas → Instaladores**: el
instalador, el monto o ambos.

### Una venta quedó sin comisión o con una comisión equivocada

Si no tiene propuesta publicada, la comisión se carga a mano. Si se tomó una
propuesta que no era, el asesor la cambia; si ya estaba pagada, la corrige el
administrador.

### Hay que corregir algo de un mes cerrado

Voltia PM no deja cargar, editar ni borrar nada con fecha de un mes cerrado, y
avisa hasta qué día está cerrado. Si de verdad hay que corregirlo, el dueño o
Finanzas **reabre el mes** en Finanzas → Cierre, escribiendo el motivo (reabre
también los meses cerrados posteriores), se corrige, se vuelve a bajar el
archivo para la contadora y se cierra de nuevo. Si la contadora ya había
trabajado con el archivo anterior, se le avisa qué cambió.

### El resultado de un mes cerrado cambió

Puede ser por una cotización del dólar nueva (5.18) o por algo que Voltia PM
cargó solo con fecha de ese mes, que el cierre no frena (5.15). Quién cargó,
cambió o borró cada cosa, con el valor de antes y el de después, está en
**Historial** (5.16). La foto que se guardó al cerrar dice cómo estaba.

### DGI rechazó una factura

El proyecto vuelve solo a **Pendientes** de Facturación, y en la fila se ve el
motivo que dio DGI. Se corrige el dato que falló y se emite una factura nueva. Si
el motivo no se entiende, se consulta con el contador antes de volver a emitir.

### Una factura quedó «Verificando» mucho tiempo

Pasa cuando el sistema de facturación electrónica no respondió a tiempo. Voltia
PM lo resuelve solo: si la factura salió, la toma con su número; si a la media
hora no apareció, la marca como **No se emitió** y se puede volver a emitir.
**No se emite a mano por otro lado mientras tanto**: es la forma más segura de
terminar con dos facturas para la misma obra.

### La fecha de una obra se movió por algo de Finanzas

Lo explica Finanzas: qué pasó, cuántos días y qué se intentó. Gerencia lo revisa
una vez por mes.

---

## Glosario

| Palabra | Qué es |
|---|---|
| **Voltia PM** | El sistema interno donde trabajan todas las áreas de Voltia: proyectos, clientes, calendario, finanzas. |
| **Portal de Voltia** | Lo que ve el cliente: avance, documentación, reportes y reclamos. |
| **Área de Administración** | El área de la contadora. Va a usar el módulo de Finanzas de Voltia PM y a hacerse cargo de reclamar los pagos atrasados. Liquida los sueldos. No confundir con **Administración** de Voltia PM, el menú de configuración del sistema. |
| **UTE** | La empresa estatal de electricidad. Tiene que aprobar y **habilitar** la instalación para que el cliente pueda encenderla. |
| **DGI** | La Dirección General Impositiva. Registra todas las facturas electrónicas. |
| **CFE** | Comprobante fiscal electrónico: la factura electrónica (o nota de crédito, o nota de débito). |
| **A facturar** | Lo que hay que facturarle a un cliente: todo el presupuesto («facturación normal») u otro monto que dejó definido el asesor al vender, con su motivo. Puede ser menos que lo que paga el cliente. |
| **Facturación electrónica** | El servicio por el que Voltia emite y recibe los CFE. Voltia PM emite por ahí las facturas a los clientes, y de ahí llegan solas las facturas de los proveedores. |
| **e-Factura** | La factura electrónica a una empresa, con su RUT. |
| **e-Ticket** | La factura electrónica a una persona, con su cédula. |
| **RUT** | El número de identificación tributaria de una empresa. Voltia PM reconoce a cada proveedor por su RUT. |
| **SAS** | La sociedad por acciones simplificada: la empresa Voltia. No confundir con la empresa unipersonal con la que se trabajaba antes. |
| **Etapa** | Cada uno de los ocho tramos de un proyecto, de Venta a Trámite UTE. |
| **Onboarding** | La etapa del proyecto, después de cerrar la venta, en la que el asesor confirma la venta, firma el contrato, cobra la seña y define cómo va a pagar el cliente. |
| **Lead** | Un cliente potencial, en el pipeline comercial. Cuando se gana la venta, se crea el proyecto. |
| **Propuesta** | La cotización que se le presenta al cliente. De la última publicada salen el precio de la venta, la comisión y el pago al instalador. |
| **Seña** | El primer pago del cliente, que se cobra al confirmar la venta. |
| **Modalidad de pago** | Cómo paga el cliente: pago directo, financiación bancaria u otro. |
| **Plan de pagos** | Los cobros previstos de un proyecto, con su monto y en qué momento de la obra se cobra cada uno (o en qué fecha, si se acordó distinto). |
| **Lista para cobrar** | Una cuota del plan cuyo momento de la obra ya llegó. Si pasan 10 días sin cobrarla, queda vencida. |
| **Proforma** | El documento que se le da al cliente para presentar al banco cuando paga con financiación bancaria. |
| **Movimiento** | Cada entrada o salida de plata registrada en Voltia PM, pasada o futura. |
| **Previsto** | Un movimiento que se espera que ocurra pero todavía no ocurrió. |
| **A pagar** | Una factura que se debe y tiene vencimiento. |
| **Costo fijo** | Un gasto que se repite todos los meses, el mismo día. |
| **Pendiente manual** | Un gasto o cobro que se agenda a mano porque todavía no tiene factura ni movimiento. |
| **Posición** | La foto de cómo está la empresa hoy, en dólares: lo que hay en las cuentas, lo que le deben y lo que debe. Está en el Inicio de Finanzas. |
| **Cuenta corriente** (de un proveedor) | Un proveedor al que se le compra a crédito y se le paga contra su estado de cuenta. Sus facturas electrónicas entran solas a la deuda y se revisan una vez por semana. |
| **Estado de cuenta** | El resumen que manda el proveedor con sus facturas, notas de crédito, pagos y lo que dice que se le debe. |
| **Plazo de crédito** | Los días que un proveedor le da a Voltia para pagar una factura. |
| **Límite de crédito** | El tope de deuda que acepta un proveedor. |
| **Saldo a favor** | Plata pagada a un proveedor que todavía no se descontó de ninguna factura. |
| **Ajuste** | Lo que baja la deuda con un proveedor **sin ser plata**: no sale de ninguna cuenta, no es gasto ni aparece en el estado de resultados. Lleva siempre su motivo. Se usa para cerrar una diferencia sin explicación, al arrancar la cuenta y al descontar una nota de crédito. |
| **Arrancar la cuenta** | Dejar lo que se le debe a un proveedor igual a lo que dice su estado de cuenta en una fecha: lo viejo que no corresponde se cierra con ajustes, y los pagos ya cargados no se tocan. |
| **Nota de crédito** | Un comprobante que descuenta algo de una factura ya emitida, o la anula entera. La emite quien hizo la factura: el proveedor a Voltia, o Voltia a su cliente. |
| **Conciliar** | Comparar lo que dice Voltia PM con lo que dice el banco (o el proveedor) y corregir las diferencias. |
| **Por conciliar** | La lista del Inicio de Finanzas con todo lo que todavía no se encuentra: lo del banco sin cargar, lo cargado que el banco no muestra, las facturas por revisar y los posibles gastos cargados dos veces. |
| **Lector del banco** | El programa que lee los movimientos de las cuentas en el home banking y los trae a Voltia PM. |
| **Pareja** | El movimiento o pago cargado en Voltia PM que le corresponde a un movimiento del banco. |
| **Tarjeta** | Una tarjeta de crédito de Voltia. En Voltia PM es una cuenta más: los gastos se cargan con esa cuenta y el pago es una transferencia desde el banco. |
| **Rendir la tarjeta** | Dejar dicho, cada mes, quién hizo cada gasto de la tarjeta y si fue de Voltia o personal, y que el pago la deje en cero. |
| **Cuenta del socio** | Lo que el socio le debe a Voltia por gastos personales que Voltia pagó. No es sueldo ni gasto de la empresa; la contadora la cancela con sueldo formal, utilidades o devolución. |
| **Adelanto a descontar** | Un gasto personal autorizado de un empleado, hecho con una tarjeta de la empresa, que se le descuenta del sueldo. |
| **Cierre de mes** | Dejar fijo un mes ya revisado: después de cerrarlo, nada con fecha de ese mes se carga, se edita ni se borra, salvo que se reabra con motivo. |
| **Archivo para la contadora** | La planilla de Excel de cada mes con las compras (neto e IVA), las ventas, los ajustes y los movimientos. |
| **Neto e IVA** | El neto es el precio sin impuestos; el IVA, el impuesto que se le suma. El total de una factura es neto más IVA. |
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
| 0.20 | 22 de octubre de 2026 | Las cuotas del plan de pagos ya no tienen fecha: se cobran en un momento de la obra (al firmar, previo a la obra, obra finalizada, habilitación finalizada) y Voltia PM avisa cuándo un cliente está listo para cobrar y cuándo una cuota venció. Cobros muestra al entrar solo lo que falta cobrar, con el filtro nuevo «Listos para cobrar». Nueva tabla de cuándo queda lista cada cuota y cómo entran en el flujo de fondos. Lo que se le factura a cada cliente lo define el asesor al crear el proyecto (facturación normal u otro monto con su motivo); Facturación muestra por separado presupuesto, a facturar, facturado y lo que falta, y al emitir se propone lo que falta facturar. Palabra nueva en el glosario: «A facturar». La lista de facturas recibidas se puede filtrar por proveedor, tipo, fecha y número. Un pago a proveedor se puede hacer desde una cuenta de otra moneda, con la cotización del día. «Arrancar cuenta» también cierra lo que quedaba a favor por pagos viejos. En las facturas por revisar, Voltia PM sugiere los gastos ya cargados más parecidos (también los cargados sin proveedor), con el porqué. |
| 0.19 | 22 de octubre de 2026 | El menú de Finanzas pasa a la izquierda, con las pantallas agrupadas; en el celular es un desplegable. Comisiones se suma al grupo Compras. Cada aviso de «Para hacer hoy» lleva a la pantalla donde se resuelve. |
| 0.18 | 21 de octubre de 2026 | Se agrega «Para hacer hoy»: la lista con todo lo pendiente de Finanzas arriba del Inicio, el mail de cada mañana y el número junto a Finanzas en el menú. |
| 0.17 | 21 de octubre de 2026 | Se reordenan las herramientas según el menú nuevo de Finanzas: Inicio, Ventas, Compras, Bancos e Informes. Nuevas pantallas: Inicio (posición, lo que falta conciliar y pendientes), Banco, Tarjetas y Cierre. Cuentas por pagar pasa a estar arriba de Proveedores, y la bandeja de facturas recibidas, arriba de Facturas. Las facturas de proveedores de cuenta corriente entran solas a la deuda y se revisan una vez por semana; las facturas llegan cada media hora. Las notas de crédito de proveedores se descuentan de la deuda desde la misma lista. Una factura se carga por un solo formulario y a un proveedor se le paga solo con «Registrar pago». Nuevos ajustes de deuda (no son plata) y «Arrancar cuenta» con el estado de cuenta: borrón y cuenta nueva con cada proveedor. Lo personal (cuenta del socio y adelantos a descontar del sueldo) no es gasto de Voltia. Conciliar una cuenta con diferencia pide el motivo. Nuevo cierre de mes, con su lista de control y el archivo para la contadora, y la rendición de tarjetas en el procedimiento mensual. Las transferencias entre cuentas y los ajustes dejan de contar en el estado de resultados. Aviso «hay cobro sin factura» en Facturación. Nuevos casos en «Cuando algo sale mal» y palabras nuevas en el glosario. |
| 0.16 | 20 de octubre de 2026 | En la bandeja de facturas recibidas, elegir el proveedor de una factura lo asigna a todas las del mismo RUT. |
| 0.15 | 16 de octubre de 2026 | Una venta cotizada sin comisión del vendedor no deja un pago pendiente de comisión. |
| 0.14 | 16 de octubre de 2026 | En el resumen de WhatsApp al instalador, los últimos trabajos saldados son los que se terminaron de pagar más recientemente, con la fecha de ese pago. |
| 0.13 | 16 de octubre de 2026 | En Instaladores solo se ven las obras agendadas en el calendario con un equipo tercerizado; las demás no cuentan como deuda. |
| 0.12 | 14 de octubre de 2026 | Las facturas a los clientes se emiten desde Voltia PM, con borrador y confirmación, y se corrigen con nota de crédito. Se factura un porcentaje del total sin IVA de la cotización, y en cada factura se pregunta a nombre de quién va (el cliente u otra persona o empresa). Nuevo lineamiento: nada que va a DGI sale sin que una persona lo confirme, y una factura por proyecto. Qué hacer si DGI rechaza una factura o si queda «Verificando». |
| 0.11 | 12 de octubre de 2026 | En el detalle del cobro de cada cliente se agrega el bloque Comentarios y archivos, para anotar lo acordado y subir comprobantes desde ahí. |
| 0.10 | 11 de octubre de 2026 | Con financiación bancaria, la gestión con el banco la sigue el asesor hasta que termina. |
| 0.9 | 10 de octubre de 2026 | Pagos a instaladores: el 50 % al arrancar la obra y el 50 % al terminarla, con la orden del responsable de Administración y Finanzas o de Gerencia; el monto no se negocia. Quién aprueba las compras: lo de la lista de materiales, nadie (lo compra directo el encargado de compras); lo de fuera, el gerente de Operaciones hasta USD 200 por gasto, sin tope total y con rendición de cuentas, y por encima Finanzas o Gerencia. |
| 0.8 | 10 de octubre de 2026 | Las facturas recibidas también se cargan a mano, con el mismo control para no cargar dos veces la misma; cada factura tiene su PDF (de la facturación electrónica o subido a mano). |
| 0.7 | 10 de octubre de 2026 | Se responden las dudas de Gerencia: los gastos de compras no se aprueban por ahora pero quedan auditables, con la pantalla nueva Historial; el reclamo de pagos atrasados lo hace Experiencia Solar y pasará a Administración; las cuentas bancarias se concilian una vez por mes; los costos fijos los carga Finanzas desde su propia pestaña; las facturas de proveedores se cargan con IVA incluido; al marcar pagado un cobro se confirman la fecha y el monto.; la conciliación con cada proveedor se hace una vez por mes, a mano |
| 0.6 | 10 de octubre de 2026 | Se revisa todo el manual contra Voltia PM: qué muestra cada pestaña, cómo se pagan los costos fijos y las comisiones, cómo se aplica el saldo a favor de un proveedor, la nueva conciliación con el estado de cuenta del proveedor, cómo se concilian las cuentas, de dónde sale la cotización del dólar y qué abarca el flujo de fondos. Se citan enteros los resúmenes de WhatsApp de cobros y de instaladores. Se aclara que no hay un circuito de aprobación de gastos en Voltia PM. |
| 0.5 | 10 de octubre de 2026 | Pagos a instaladores: el pago lo genera el calendario al agendar la obra con un equipo tercerizado, a nombre de quien cobra por ese equipo; las obras de equipo propio no tienen pago aparte. |
| 0.4 | 9 de octubre de 2026 | Plazo y límite de crédito por proveedor; las facturas de proveedores llegan solas de la facturación electrónica a una bandeja que Finanzas revisa; nuevas pantallas Cuentas por pagar y Facturas de proveedores. |
| 0.3 | 9 de octubre de 2026 | Dos lineamientos nuevos: las compras de materiales ya no se proyectan (la deuda con un proveedor entra con su factura) y ningún proyecto sale del onboarding sin la modalidad de pago y lo que pide. |
| 0.2 | 9 de octubre de 2026 | Primer lineamiento: las aprobaciones de gastos no frenan una obra. La fecha de obra confirmada se defiende, y si se mueve por algo de Finanzas, el atraso lo explica Finanzas. La lista de Cobros muestra todos los proyectos vendidos, también los ya habilitados: se filtra solo por cómo está el pago. |
| 0.1 | 28 de septiembre de 2026 | Se crea el manual con su estructura y la lista de temas a documentar. |
