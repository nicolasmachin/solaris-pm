# Memoria de cálculo de propuestas

Este documento explica, paso a paso, cómo la calculadora arma una propuesta: de
los datos que carga el asesor hasta el precio final, el ahorro del cliente y las
cuotas. Los recuadros como `[Panel: 100 USD]` muestran el **valor actual** de cada
variable configurable desde *Defaults de propuestas* — si cambiás una ahí, cambia
en todas las propuestas nuevas.

Como ejemplo usamos el caso **Jose Gonzalez**: 11 paneles de 590 W, inversor de
6 kW trifásico, dólar a $40, tarifa Simple.

---

## 1. Datos que carga el asesor

No son cálculos: son la entrada. Cantidad de paneles, potencia por panel (W),
potencia del inversor (kW), tipo de suministro (mono/trifásico), cotización del
dólar, markup, distancia a la instalación, lo que paga hoy de UTE, y la tarifa.

Todo lo demás de este documento se calcula a partir de estos datos + las
variables de configuración.

## 2. Dimensionado del sistema

**Potencia total (kWp)** = cantidad de paneles × potencia por panel ÷ 1000.
Gonzalez: 11 × 590 ÷ 1000 = **6,49 kWp**.

**Energía anual (kWh)** = potencia total × **1479**. Ese 1479 es la generación
anual estimada por cada kWp instalado en Uruguay (valor típico de rendimiento).
Gonzalez: 6,49 × 1479 = **9.599 kWh/año**.

**Generación mes a mes** (el gráfico de barras): reparte la energía anual entre
los 12 meses con factores estacionales (más en verano, menos en invierno) que
suman 1. Es el detalle mensual real que ve el cliente.

**Metros cuadrados de paneles** = cantidad de paneles × **3** (m² por panel
aproximado). Gonzalez: 11 × 3 = **33 m²**.

> Nota técnica: existe además un valor interno `energiaMensualKwh` (potencia ×
> 900) que **no se muestra en la propuesta**. Para el detalle mensual se usa el
> gráfico de generación mes a mes (arriba), no ese valor. Queda como dato heredado.

## 3. Costos

### Equipamiento (lo que cuesta comprar el sistema, sin IVA)

Suma de: paneles ({{singleton:precioPanelUsdSinIva}} × cantidad) + estructuras
({{singleton:precioEstructuraUsdSinIva}} × cantidad) + la parte eléctrica
({{singleton:precioElectricaTriUsdSinIva}} si es trifásico,
{{singleton:precioElectricaMonoUsdSinIva}} si es monofásico) + el inversor (según
red y potencia) + el medidor ({{singleton:precioMeterTriUsd}} /
{{singleton:precioMeterMonoUsd}}). Gonzalez: **USD 4.810**.

Si subís los precios de equipamiento, sube el costo y (más adelante) el precio final.

### Costos fijos asignados

Es la parte de los costos fijos del negocio ({{singleton:costoFijoTotalPesosMes}}
por mes) que se le carga a **este** proyecto: se divide por el dólar y por la
cantidad de negocios promedio por mes ({{singleton:negociosPromedioMes}}).
Gonzalez: 300.834 ÷ 40 ÷ 4 = **USD 1.880**.

> Los costos fijos (alquiler, sueldos administrativos, BPS, etc.) no se compran
> con IVA que se pueda descontar, así que el monto asignado por proyecto no lleva
> IVA (con IVA ≈ sin IVA). Es un detalle contable, no un error.

### Costos variables

Gastos de la instalación puntual: flete ({{singleton:costoFletePorKm}} × km) +
nafta ({{singleton:costoNaftaTotalPesos}}) + alojamiento
({{singleton:costoAlojamientoPesos}}) + viáticos ({{singleton:costoViaticosPesos}})
+ otros ({{singleton:costoOtrosPesos}}), todo dividido por el dólar. Gonzalez:
**USD 282,50**.

### Mano de obra

Suma de las tarifas horarias de la cuadrilla (electricista
{{singleton:tarifaCatAPorHora}} + capataz {{singleton:tarifaCatCPorHora}} + CAT D
{{singleton:tarifaCatDPorHora}}) × las horas por instalación
({{singleton:horasManoDeObraPorInstalacion}}) × la cuadrilla (cuántos operarios,
escalonado por cantidad de paneles) ÷ el dólar. Gonzalez: (814 + 947 + 543) × 10
× 2 ÷ 40 = **USD 1.152**.

El escalón de cuadrilla crece con el tamaño: hasta 12 paneles = 2, hasta 18 = 3,
hasta 30 = 4, y así. Gonzalez (11 paneles) usa 2.

**Costo total** = equipamiento + costos fijos + costos variables. Gonzalez:
**USD 6.972,71**.

## 4. Precio (pricing)

**Markup** = (costo total + mano de obra) × {{singleton:markupPorcentajeDefault}}.
El markup se expresa en porcentaje (por ejemplo 20 = 20%). Gonzalez con 20%:
**USD 1.624,94**. Subir el markup sube directamente la ganancia y el precio final.

**Comisiones**: sobre la base (costo + mano de obra + markup) se calculan la
comisión del vendedor ({{singleton:comisionVendedorPorcentaje}}) y la de BBVA
({{singleton:comisionBbvaPorcentaje}}). Gonzalez: **USD 390** cada una.

**Comisión del vendedor en propuestas a empresas (B2B).** En el cotizador B2B la
comisión deja de ser un porcentaje fijo: se le suma una tajada del markup que el
asesor consiga por encima de un piso.

```
comisión = {{singleton:b2b.comisionBasePorcentaje}} × (costo + mano de obra + markup)
         + {{singleton:b2b.comisionExcedentePorcentaje}} × markup excedente
```

donde el **markup excedente** es lo que supera el markup de referencia
({{singleton:b2b.markupReferenciaPorcentaje}}), medido en dólares sobre (costo +
mano de obra). Por debajo de la referencia el excedente es cero y la comisión es
la de siempre.

Ejemplo con la base de Gonzalez (costo + mano de obra = USD 8.125) y markup 30%:
markup excedente = 10 puntos × 8.125 = **USD 812**; comisión = 4% × 10.562 +
30% × 812 = 422 + 244 = **USD 666** (6,31% efectivo, contra 422 del esquema
plano). Las propuestas residenciales no cambian.

La comisión sigue siendo un **costo dentro del precio**, no un descuento sobre la
ganancia: el excedente lo paga el cliente y la ganancia de la empresa sigue
siendo el markup completo (ver §8).

El porcentaje que se congela al ganar el lead es el **efectivo** de esa
propuesta, no el del singleton.

**Subtotal sin IVA** = costo total + mano de obra + markup + las dos comisiones.
Gonzalez: **USD 10.529,62**.

**Total con IVA** = subtotal × 1,22 (IVA 22%). Gonzalez: **USD 12.846,14**.

Si el cliente suma **ítems adicionales**, se agregan (con su IVA) para dar el
**total final**.

## 5. Ahorro del cliente

**Ahorro mensual** = potencia total (en watts) × un factor que depende de la
tarifa: Simple {{singleton:factorAhorroSimple}}, Doble {{singleton:factorAhorroDoble}},
Triple {{singleton:factorAhorroTriple}}. Gonzalez (Simple): 6.490 × 1,05 =
**$6.815/mes**. El ahorro anual es eso × 12.

> El factor de la tarifa **Triple** hoy usa el mismo valor que Doble (0,88) como
> **placeholder**: el valor real está pendiente de definirse con datos históricos
> de UTE. Cuando se defina, se cambia desde *Defaults* sin tocar código.

## 6. Retorno de la inversión

**TIR** (rentabilidad) = ahorro anual en dólares ÷ total con IVA. Gonzalez:
**15,9%**.

**PRI** (período de recupero) = total con IVA ÷ ahorro mensual en dólares.
Gonzalez: **≈ 6,3 años**. La curva de 15 años arranca en menos el total y suma
el ahorro anual cada año hasta cruzar a positivo.

## 7. Financiación BBVA (cuotas)

Las cuotas se calculan en **Unidades Indexadas (UI)** y se pasan a pesos:

1. El monto a financiar se pasa a UI usando la cotización de la UI
   ({{singleton:cotizacionUI}}).
2. Se le suma un porcentaje de gastos administrativos, distinto por plazo
   ({{singleton:bbva24mGastosAdminCapital}} / {{singleton:bbva36mGastosAdminCapital}}
   / {{singleton:bbva60mGastosAdminCapital}}).
3. Se calcula la cuota con la fórmula de préstamo francés (PMT), usando la tasa
   anual de cada plazo ({{singleton:bbva24mInteresUI}} /
   {{singleton:bbva36mInteresUI}} / {{singleton:bbva60mInteresUI}}).
4. Se aplica un factor final por plazo ({{singleton:bbva24mFactorCuota}} /
   {{singleton:bbva36mFactorCuota}} / {{singleton:bbva60mFactorCuota}}) y se vuelve
   a pesos con la UI.

Gonzalez: **$22.450** (24 cuotas) · **$15.453** (36) · **$10.543** (60).

## 8. Flujo financiero interno (solo administración)

Esta sección es la trazabilidad del negocio para Voltia, no se muestra al cliente.

> **Convención de signos:** los cobros (lo que entra) y la devolución de IVA son
> **positivos**; los pagos (proveedor, mano de obra, IVA, comisiones) son
> **negativos**. La ganancia final es la suma de todos.

Gonzalez: cobro adelanto +6.423 · cobro saldo +6.423 · pago proveedor −8.093 ·
pago mano de obra −1.152 · pago IVA −2.317 · devolución IVA +1.120 · pago vendedor
−390 · pago BBVA −390 = **ganancia final USD 1.625**. El **margen** es esa
ganancia sobre el subtotal sin IVA: **15,4%**.
