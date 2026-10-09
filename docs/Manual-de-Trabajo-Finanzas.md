# Manual de trabajo de Finanzas

**Voltia · Uruguay** · Versión 0.4 — 9 de octubre de 2026 · *en armado*

> Este manual es **el procedimiento, los lineamientos y las herramientas de
> Finanzas, juntos**: qué se hace, quién lo hace, en qué plazo, con qué criterio,
> y en qué pantalla de Voltia PM se hace. Sigue el mismo modelo que el Manual de
> trabajo de Experiencia Solar.
>
> Lo que conecta a Finanzas con las demás áreas está en el **Procedimiento
> General de Trabajo (PGT) de Voltia**. Acá va el detalle del área.
>
> **Estado:** esqueleto. Se va completando con cada ajuste que toque a Finanzas.

---

## 1 · Para qué existe Finanzas

*Por escribir.*

## 2 · Qué hace y dónde termina su trabajo

*Por escribir.*

## 3 · Procedimiento

*Por escribir.*

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

## 5 · Las herramientas y cómo se usan

### Cuentas por pagar

Se entra desde **Finanzas → Cuentas por pagar**. Arriba están los totales: cuánto
se debe en total, cuánto está **vencido**, cuánto **vence en los próximos 7 días**
y cuánto **entre 8 y 30 días**. Abajo, una fila por proveedor con lo mismo, el
saldo a favor (pagos hechos que todavía no se aplicaron a ninguna factura) y cuánto
del límite de crédito está usado. Tocando un proveedor se ven sus facturas, cada
una con su vencimiento y cuántos días le faltan.

### La bandeja de facturas recibidas

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

### Facturas de proveedores

Se entra desde **Finanzas → Facturas de proveedores**. Es el registro de **todas**
las facturas de proveedores, para buscar cualquiera: las que llegaron por la
facturación electrónica —en cualquier estado, también las descartadas y las de
empresas sin dar de alta— y las que se cargaron a mano. Se filtra por proveedor
(o por **Sin proveedor en el sistema**), por fechas, por origen y con un buscador.
Cada factura muestra neto, IVA, total, vencimiento y en qué está: por revisar,
a pagar, pagada o descartada.

### Plazo y límite de un proveedor

Se cargan al crear o editar el proveedor, en **Finanzas → Proveedores**: **Plazo
(días)**, **Límite de crédito** (vacío si no tiene) y la moneda del límite.

## 6 · Cuando algo sale mal

*Por escribir.*

---

## Temas a documentar

Temas de Finanzas que ya aparecieron en el trabajo con Voltia PM. **Están
nombrados, no descriptos**: antes de escribir cada uno hay que verificar cómo
funciona hoy, porque varios cambiaron desde que se armaron.

- Cobros a clientes y plan de pagos (que ahora arma el asesor en el onboarding).
  Ya establecido: la lista de Cobros muestra **todos** los proyectos vendidos,
  estén en obra o ya habilitados, porque que la obra esté habilitada no dice si
  el cliente terminó de pagar. Solo quedan afuera las ventas caídas (proyectos
  archivados) y lo que todavía no se vendió. Se filtra por cómo está el pago:
  pendiente, parcial, completo, excedido o sin presupuesto.
- Cobros que gestiona Experiencia Solar sin ver el resto de Finanzas
- Facturación al cliente: qué proyectos llevan factura y cuáles quedan pendientes de emitir
- Facturas y pagos a proveedores, y cómo se aplica un pago a las facturas
- Comisiones del asesor: cómo se generan al ganar la venta y cómo se pagan
- Pagos a instaladores
- Estado de resultados (es de caja) y flujo de fondos, con los costos fijos proyectados
- Indicadores de Finanzas en el reporte semanal

---

## Anexo · Registro de cambios

| Versión | Fecha | Qué se agregó o modificó |
|---|---|---|
| 0.4 | 9 de octubre de 2026 | Plazo y límite de crédito por proveedor; las facturas de proveedores llegan solas de la facturación electrónica a una bandeja que Finanzas revisa; nuevas pantallas Cuentas por pagar y Facturas de proveedores. |
| 0.3 | 9 de octubre de 2026 | Dos lineamientos nuevos: las compras de materiales ya no se proyectan (la deuda con un proveedor entra con su factura) y ningún proyecto sale del onboarding sin la modalidad de pago y lo que pide. |
| 0.2 | 9 de octubre de 2026 | Primer lineamiento: las aprobaciones de gastos no frenan una obra. La fecha de obra confirmada se defiende, y si se mueve por algo de Finanzas, el atraso lo explica Finanzas. La lista de Cobros muestra todos los proyectos vendidos, también los ya habilitados: se filtra solo por cómo está el pago. |
| 0.1 | 28 de septiembre de 2026 | Se crea el manual con su estructura y la lista de temas a documentar. |
