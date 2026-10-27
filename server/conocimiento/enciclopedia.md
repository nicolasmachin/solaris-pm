# Voltia — Base de conocimiento comercial y de ingeniería

**Versión:** 1.1 · **Fecha de corte:** 27/10/2026
**Compilado de:** conversaciones de trabajo con Claude (agosto–octubre 2026), memoria del proyecto Ventas, instrucciones del proyecto, skill de ingeniería FV (v3.5), skills de visita y de soporte Growatt, y la cotización modelo 2026-001.

> **Cómo usar este documento.** Es una enciclopedia de consulta: cómo funciona Voltia, qué criterios se tomaron y por qué. Los precios y costos tienen fecha: son referencias internas a la fecha indicada, no listas de precio. Donde un criterio surgió de un caso concreto, se cita el caso entre corchetes para poder rastrearlo.
>
> **Prioridad ante contradicciones:** lo que diga Nicolás en el momento > este documento > valores por defecto del cotizador.
>
> **Correcciones del 27/10/2026** (decisiones de Nicolás al revisar la base) quedan marcadas con **[Corregido 27/10]**. Lo que choca con un manual vigente y falta decidir, con **[A DECIDIR]**.
>
> **Mucho de esto es interno** (markup, costos, arbitrajes, errores, equipo). Sirve para que el asesor entienda y decida; **no se le dice al cliente**. Lo que sí se le dice al cliente está en §14–§17.

---

## Índice

1. La empresa
2. Equipo y roles
3. El ciclo comercial de punta a punta
4. Clasificación de pedidos y datos mínimos
5. El cotizador de Voltia PM: cómo piensa y dónde se equivoca
6. Precio, markup y margen
7. Criterios técnicos para cotizar (lo que se decide en venta)
8. Orientación, coplanar y paneles de cortesía
9. UTE: microgeneración, potencia contratada y trámites
10. Ahorro, proyecciones y cómo se explica
11. Garantías, mantenimiento, granizo y plazos
12. Formas de pago y financiación
13. Propuesta vs. contrato
14. Comunicación con clientes
15. Banco de respuestas a preguntas frecuentes
16. Plantillas de mensajes
17. Manejo de objeciones
18. Cotizaciones no estándar
19. Ingeniería FV: criterios generales
20. Ingeniería FV: estructuras por tipo de montaje
21. Ingeniería FV: viento
22. Ingeniería FV: cumplimiento UTE (Cap. XXVIII)
23. Ingeniería FV: entregables y control de coherencia
24. Visitas técnicas y relevamiento
25. Postventa y soporte técnico (Growatt)
26. Voltia PM y herramientas
27. Indicadores y metas
28. Casos de referencia
29. Errores que ya cometimos (no repetir)
30. Temas abiertos y datos a confirmar
31. Glosario

---

## 1. La empresa

| Dato | Valor |
|---|---|
| Razón social | Voltia SAS |
| RUT | 150733900014 |
| Dirección | Rondeau 2110, Montevideo |
| Inicio de actividad | 16/06/2022 |
| Teléfono comercial | 099 640 651 |
| Email | contacto@voltia.com.uy |
| App interna | Voltia PM — app.voltia.com.uy |
| Colores de marca | Azul Francia `#1836B2`, amarillo `#F5C400`, negro/tinta `#15171C`, blanco; gris de fondo `#F2F4F8` |
| Tipografía de documentos | Archivo (títulos) + IBM Plex Sans (texto) |

**Qué hace Voltia.** Soluciones de energía en Uruguay, con foco en microgeneración solar fotovoltaica on-grid llave en mano (residencial, comercial, edificios, rural). Además: ampliaciones, adecuaciones eléctricas, cargadores de vehículo eléctrico, trámites UTE, mantenimiento y diagnóstico, estructuras especiales, venta de equipos sueltos.

**Marcas con las que trabaja.**
- **Inversores:** Growatt (el caballo de batalla; Voltia es instalador registrado, código OSS `EBLNYD`), Fronius (Symo Advanced, Primo), Huawei (híbridos y comerciales en 400 V). Interés estratégico en **Deye** híbrido con baterías de marca blanca y segunda vida de baterías de autos eléctricos.
- **Paneles:** Resun 590 W (estándar 2026), JA Solar 620–625 W bifacial, históricamente AESolar 550/570 W y JA 460 W.
- **Medidores inteligentes:** Eastron SDM120CT (monofásico), Huawei DTSU71/DTSU666, Fronius Smart Meter.
- **Proveedores identificados:** Fivisa (materiales eléctricos), Bultech (fijaciones), CCM Estruturas (estructuras FV, Brasil, término EXW), Efergia, MGI S.A.; contactos de Intersolar 2026 (EPEVER, Aite Fuse, Art Sign).

**Diferencial que se busca transmitir.** Criterio técnico + claridad comercial + prolijidad en obra + acompañamiento. No vender humo: no prometer ahorros, plazos ni aprobaciones sin datos.

**Embudo típico (referencia histórica).** 400–500 consultas mensuales por WhatsApp/Instagram en temporada alta; cierre alto sobre visitas realizadas (~70% citado como referencia histórica). En setiembre 2026: 129 leads nuevos, 135 propuestas, conversión 36,7%.

---

## 2. Equipo y roles

| Persona | Rol | Notas útiles |
|---|---|---|
| **Nicolás Machín (Nico)** | Fundador y director, ingeniero electricista | Hace las visitas técnicas, dimensiona, fija markup y emite propuestas. Trabaja mucho por voz. |
| **Martín García** | Asesor comercial | Origina leads, maneja la relación por WhatsApp. Las visitas que figuran agendadas por "Stefani" (cra.stefaniferreira@gmail.com) las carga Martín desde ese Gmail. |
| **July Correa** | Asesora comercial | Muy eficiente en cierre (pocas pérdidas), hace pocas visitas. |
| **Gabriel Vera** | Encargado de Operaciones (desde abr-2026) | Ordena obra y equipo; pide que la ingeniería salga a tiempo para poder exigir plazos. |
| **Luna Toja** | Proyectista | Ciclo completo de ingeniería: preproyecto → proyecto final → tramitación UTE. Operaciones le entrega la instalación completa en Voltia PM antes de tramitar. |
| **Fidel** | Ingeniería | Resuelve dimensionado de cables, caídas, etc. después de la venta. |
| **Alejandra Yañez** | Experiencia solar / postventa | |
| **Fernando** | Instalador / capataz de obra | |
| Emir, Gonzalo, Julie, Miguel Ángel | Operaciones / ventas | |

**División del trabajo comercial.** El asesor capta y acompaña; Nicolás visita, dimensiona y emite. Los mensajes al cliente los suele mandar el asesor, por eso se escriben en primera persona de quien envía.

**Principio de delegación.** "Ahora estamos cotizando simplemente": la sección de cables, la caída de tensión y el detalle de ingeniería se resuelven después, en ingeniería. No se traban cotizaciones por esos temas.

---

## 3. El ciclo comercial de punta a punta

```
Consulta (IG/WA, Manychat) → Lead en Voltia PM → Propuesta v1 preliminar (asesor)
→ Agendar visita → Visita técnica (Nicolás) → Minuta (bot Telegram) → Visitado
→ Propuesta post-visita (vN) → Cotizado → Seguimiento → Cierre
→ Contrato → Proforma / financiación → Seña → Ingeniería (Luna/Fidel)
→ Consulta de suministro UTE → Obra → Validación de obra terminada
→ Habilitación UTE → Cobro final → Postventa / mantenimiento
```

### Etapas en Voltia PM
- **Nuevo → Agendar visita → Visitado → Cotizado → (Ganado / Perdido / En espera / Reclamado).**
- La etapa la mueve el **bot de minutas** automáticamente. No se mueven etapas a mano salvo pedido expreso.
- **"Visita agendada"** = fecha en que se puso en el calendario, **no** la fecha de la visita. La fecha real es **"Visita realizada"**, que se llena al pasar a Visitado.
- `publicar_propuesta` mueve el lead a **Cotizado**.
- Una obra cuenta en el mes en que se marca **"Validación de obra terminada"**, no por las fechas programadas.

### La visita técnica
- La agenda el asesor en el calendario **"VOLTIA externo"** (Google). A veces Nicolás pone la hora un poco antes de la real para darse margen (ej. 13:45 para una visita a las 14): en mensajes al cliente se usa la **hora real acordada**.
- Antes de la visita: ficha del cliente (skill `visita-cliente`) + mensaje de pre-visita (§16.1).
- Después: Nicolás dicta la minuta al bot de Telegram, que la sube al lead con fotos, videos y comentarios. **La minuta se comparte con el cliente el mismo día.**
- Con la minuta se revisan diferencias contra la propuesta y se emite la versión post-visita.

### Cuello de botella detectado (set-2026)
Propuesta → visita: **32,5 días promedio**. La propuesta sale en 2 días; el lead espera un mes a ser visitado.

---

## 4. Clasificación de pedidos y datos mínimos

Antes de cotizar, clasificar: (1) solar residencial, (2) solar comercial/industrial, (3) obra eléctrica o adecuación, (4) servicio técnico o mantenimiento, (5) trámite o gestión, (6) proyecto especial (baterías, EV, híbrido, suelo, rural, hotel, edificio), (7) cotización parcial (solo materiales, solo mano de obra, etc.). **No forzar todo hacia paneles.**

### Datos mínimos — sistema solar
Factura UTE (idealmente con el **gráfico de barras de 12–13 meses**), ubicación, tarifa, potencia contratada, **tipo de suministro** (monofásico / trifásico 230 V sin neutro / trifásico 400 V con neutro), fotos del techo, tipo de techo, sombras y obstáculos, orientación, espacio, objetivo del cliente, **cambios de consumo previstos** (auto eléctrico, bomba de calor, losa radiante).

### Datos mínimos — obra eléctrica
Trabajo, potencia, tensión, mono/trifásico, distancias, fotos del tablero y del recorrido, tipo de canalización, si incluye materiales, planos, exigencias de UTE/firma técnica/obra civil.

### Datos mínimos — mantenimiento / diagnóstico
Marca y modelo exacto del inversor, potencia, año, síntoma, fotos, capturas del portal, códigos de error, eventos recientes. **Para Growatt: el export `.xls` del día** (ver §25).

### Datos mínimos — estructuras
Techo o suelo, cantidad y medidas de paneles, orientación e inclinación, superficie, **altura del plano de módulos**, **distancia a costa/río**, rugosidad del entorno, dimensiones de la construcción, retiro a bordes, obstáculos con posición y altura.

### Estimación preliminar vs. cotización formal
Con datos faltantes se pueden dar rangos, siempre marcados como preliminares, con supuestos y pendientes listados. Nunca presentar un rango como precio cerrado.

---

## 5. El cotizador de Voltia PM

### Cómo calcula
- Costea **sistema llave en mano**: paneles, estructura, eléctrica (paquete), inversor, medidor, mano de obra, overhead, trámite, comisión bancaria. Aplica **markup** sobre el costo y suma IVA 22%.
- **Markup de arranque: 25 %** (20 % en empresas). [Corregido 27/10] Si el cotizador trae otro valor por defecto, se lleva a 25 %.
- **Generación:** siempre para paneles al **norte con 20° de inclinación**. Si el techo real es otro, la energía real difiere y hay que corregir el discurso (o compensar con paneles).
- **No aplica degradación de paneles ni suba de tarifas UTE.**
- **Estructura:** toma **~USD 90/panel** (estructura inclinada) para cualquier montaje.
- **Cableado incluido hasta ~15 m.**
- **Comisión bancaria (~3,5%)** incluida como costo.
- Calcula ahorro, factura nueva estimada, retorno y cuotas BBVA (24/36/60).
- Requiere `techo_m2` para devolver precio y ahorro.
- Validez de propuesta: 60 días (las propuestas viejas vencen y se re-emiten).

### Dónde se equivoca (y qué hacer)
| Situación | Qué pasa | Qué hacer |
|---|---|---|
| Montaje coplanar | Sobrecosta estructura (~90 vs ~50 en chapa/isopanel; ~45 coplanar en general) | El margen real es mayor que el registrado: se puede bajar markup o pagar paneles de cortesía. |
| Estructura ya construida por el cliente | Sigue cobrando 90/panel (real ~30) | Línea de descuento cargada desde la app, o bajar markup documentando. |
| Cliente financia BBVA a 60 cuotas | Cuenta 3,5% de comisión que Voltia no paga | Ese margen queda libre: se puede bajar markup. |
| Cliente paga contado | Igual cuenta comisión bancaria | Se puede sacar (bajar markup) para mejorar precio. Es el **descuento por pago directo** (§12). |
| Factura UTE cargada menor que la real | Ahorro > 100% y **factura negativa** en el PDF | Cargar la factura real (o la proyectada con cambios de consumo). Ver §10. |
| Tarifa doble vs. triple | El campo no parece afectar el cálculo de ahorro (observado oct-2026) | No confiar en que cambiar la tarifa cambie el número. |
| Inversor de 8 vs 10 kW | En un caso el precio no cambió | Verificar que tome el costo correcto. |
| Distancias > 15 m | No las costea | Sumar aparte (~USD 3 + IVA/m cable 10 mm² con canalización). |
| Ítems adicionales (wallbox, nicho, línea negativa) | El MCP no los agrega ni admite negativos | Se cargan desde la app de escritorio, o se absorbe con markup. |
| B2B / comercial grande | El cotizador B2B no está en el MCP | Usar residencial como borrador y terminar en la app. |

### Regla de consistencia
Las proyecciones que se mandan al cliente **tienen que ser coherentes con el cotizador**: no se cambia la cantidad de paneles para "acomodar" una proyección; se ajusta el **gasto UTE de referencia** (`paga_ute_mensual_pesos`) para que refleje el consumo real/proyectado.

---

## 6. Precio, markup y margen

*Todo este capítulo es interno.*

### Definiciones
- **Markup** = ganancia / costo. **Margen** = ganancia / precio de venta (sin IVA). Markup 20% ≈ margen 15,4%.
- **Siempre informar las dos cifras: markup % y ganancia en USD.** Nunca una sin la otra.
- El markup registrado puede diferir del margen real cuando los costos del cotizador están mal (estructura, cortesías, comisión). **Documentar la diferencia** en notas de la propuesta y comentario del lead.

### Rangos usados (referencia 2026)
| Situación | Markup típico |
|---|---|
| Estándar residencial | 25 % [Corregido 27/10] |
| Ajuste competitivo post-visita | 15–18% |
| Con cortesías / financiación 60 cuotas / coplanar (margen real compensa) | 7–12% registrado (real bastante mayor) |
| Proyecto grande que se ajusta a precio objetivo | lo que dé (ej. 30,29% para igualar precio anterior) |
| Amigo, sistema completo | 5% |
| Amigo, solo equipos | ≥15% sobre costo (o costo + 10% en materiales) |
| Opciones escalonadas al mismo cliente | markup creciente con el tamaño (ej. 7,9% / 19,3% / 24,6%) |

**Regla de los manuales (rige desde 11/10/2026):** el asesor puede bajar el markup hasta el 15 % por su cuenta; **por debajo del 15 % autoriza la Dirección**. Los registrados de 7–12 % de la tabla son casos donde el margen real es mayor (cortesías, comisión libre, coplanar) y los decidió la Dirección.

**Cómo se ajusta:** en pasos chicos (+1/+2 puntos), mirando precio, USD/W, ganancia y retorno en cada paso. Para igualar un precio objetivo se itera hasta clavarlo.

### Precio de referencia
- On-grid llave en mano residencial/mediano: **~USD 1,5–1,7/W IVA incluido** (ej. 1,61; 1,65; 1,66 USD/W en propuestas reales 2026). No es regla fija.
- Ticket promedio set-2026: ~USD 15.900.

### Costos internos de referencia (con fecha)
| Ítem | Costo | Fecha |
|---|---|---|
| Panel 590 W (Resun) | ~USD 120 + IVA | set-2026 |
| Panel JA 620 W | ~USD 130 + IVA | oct-2026 |
| Estructura inclinada (cotizador) | USD 90/panel | 2026 |
| Estructura coplanar real (chapa/isopanel) | ~USD 45–50/panel | 2026 |
| Cable 10 mm² + canalización | ~USD 3 + IVA/m | oct-2026 |
| Nicho de material para inversor | ~USD 300 | 2026 |
| Extensión de techo/estructura tubular nueva | ~USD 1.000–2.000 según tamaño | oct-2026 |
| Inversor Growatt 10 kW (reemplazo) | ~USD 2.000 | oct-2026 |
| Escuadras, caño galvanizado | ya en el costeo, no son extra | — |

### Cosas que se absorben dentro del markup (no se cobran aparte)
- Trámite UTE de cambio de suministro mono→trifásico y aumento de potencia (no le cuesta a Voltia).
- Nicho de material para inversor (~USD 300) cuando hace falta para cerrar.
- **Cualquier trámite que Voltia pueda hacer**: se incluye gratis como elemento de negociación.
- Cambio de inversor por uno superior (ej. cotizado 5 kW, se instala 6 kW) como "sensación de mejora".

### Cosas que NO se absorben (van aparte)
- Adecuación de la instalación interior (mono→trifásico de la casa).
- Instalación del cargador de auto eléctrico.
- Obra civil, zanjas, albañilería (salvo acuerdo).
- Cambios físicos de tablero/ICP que no haga UTE.

---

## 7. Criterios técnicos para cotizar

### Inversores
- **Growatt: mínimo 6 kW.** No se trabaja con el de 5 kW. (Si quedó una versión cotizada con 5 kW, se instala el de 6 sin costo.)
- **Trifásico 230 V sin neutro (red IT en triángulo, típica de Uruguay):** el inversor tiene que ser **Growatt**. Huawei dejó de traer equipos para esa red (su catálogo exige transformador de aislación). Fronius Symo Advanced 208-240 también soporta delta sin neutro de forma nativa. Voltia tiene método propio para adaptar inversores de 400 V a esa red.
- **Trifásico 400 V con neutro:** Huawei disponible, incluido híbrido.
- **Inversor de potencia mayor a la contratada: no es problema.** Se limita por software a la potencia habilitada por UTE. Es trámite de todos los días: **no se le menciona al cliente.**
- **Sobredimensionar inversor para futura ampliación** (ej. 10 kW con 7,6 kWp por auto eléctrico; 20 kW con 18 kW contratados) es válido; ojo que si la contratada queda baja, hoy no rinde más.
- **Relación DC/AC objetivo ≈ 1,18.** Más de ~1,4 empieza a recortar (clipping) en el pico.
- **Dos inversores** (iguales o distintos, ej. 8+6 kW) son posibles en el cotizador residencial. Para ampliaciones con un solo suministro se prefiere **un solo inversor más grande** (un nicho, un trámite de ampliación) [Barenof].
- **Todo inversor ofrecido on-grid se apaga ante corte de UTE.** No vender respaldo.

### Respaldo / baterías
- Híbrido que se ofrece hoy con respaldo: **Huawei, en trifásico 400 V.**
- **[Corregido 27/10] Trifásico 230 V sin neutro:** el híbrido **existe en el mercado, pero hoy Voltia no lo consigue en plaza**; se va a traer. Al cliente no se le dice "no hay en el mercado" ni "no lo conseguimos": ver la frase propuesta en `04-equipos.md`.
- **[Corregido 27/10] Criterio con quien compró híbrido:** se le instala un on-grid y, **cuando quiera conectar baterías, se le cambia por el híbrido sin costo**. Es un compromiso con cada uno de esos clientes: si compró híbrido, cuando quiera usar la función híbrida hay que dársela. Tiene que quedar anotado en su ficha.
- En monofásico: evaluar caso a caso.
- Si el cliente pide respaldo: relevar qué cargas quiere sostener y cuántas horas, y cotizar aparte.

### Potencia contratada
- La IMG (instalación de microgeneración) no puede superar la potencia contratada.
- **Aumento hasta 7 kW:** lo pide el titular desde la **app de UTE**, sin instaladora, y UTE no le cobra nada. Si entra por un instalador (Voltia o cualquiera), **UTE le cobra el trámite al cliente**; Voltia no cobra la gestión. Por eso, hasta 7 kW, se le sugiere que lo pida él. [Corregido 27/10]
- Aumentos mayores (y cambio mono→trifásico): **Voltia los gestiona incluidos** en el trámite de microgeneración, sin costo de gestión.
- **El cambio de ICP lo hace UTE** al pedir el aumento: no es costo de Voltia ni adecuación de tablero.
- **El aumento sube el cargo fijo mensual de forma permanente** (~$83,2/kW + IVA por mes, tarifa 2026). Hay que avisarlo al cliente como cambio estructural de su factura. Ej.: 7,5→15 kW ≈ $624 + IVA/mes; 19→25 kW ≈ $500 + IVA/mes (≈ $610 con IVA).
- **Tasa de conexión UTE mono→trifásico (15 kW): $12.493 + IVA**, única vez (tarifario 2026; verificar vigente).
- Los temas de potencia contratada y compatibilidad de fase **no bloquean una cotización**: se levantan como "a tener en cuenta", salvo que Nicolás diga lo contrario.

### Auto eléctrico y cargador (wallbox)
- El cargador es **una carga más** de la casa: no hay compatibilidad o incompatibilidad con el inversor. Se conecta desde la bornera de interconexión, no desde el ICP general.
- **Se cotiza siempre como ítem separado**, no dentro del sistema solar, ni en su rentabilidad.
- Ojo: diferencial tipo A vs. **tipo B** (el B cuesta varias veces más; depende del fabricante). Un cargador de 7 kW puede exigir aumento de potencia: dejarlo **excluido** del alcance salvo acuerdo.
- Referencia de consumo: ~18 kWh/100 km. 8.000 km/año ≈ 1.350 kWh ≈ 2 paneles.
- Con auto, **recomendar tarifa triple horario** (carga en valle).

### Cableado y distancias
- El cotizador incluye hasta ~15 m. Más largo: sumar costo.
- La sección y la caída de tensión **no se discuten al cotizar**: las resuelve ingeniería. (Sí vale anotar una alternativa de traza para ingeniería, ej. bajar en continua y llevar el inversor junto al medidor.)

### Anclaje en isopanel
**Siempre el mismo sistema:** pinzas/grampas que aprietan en el engrafe (junta alzada) del isopanel. **No se perfora el techo.**

---

## 8. Orientación, coplanar y paneles de cortesía

### Pérdidas de referencia
- **Paneles al sur:** ≈ **12–18%** menos de generación anual a latitudes uruguayas (10° → ~12%; 15° → ~18%). Se usa 20% como criterio conservador. La pérdida es mayor en invierno y chica en verano. (En el caso Ruiz, techo de 13°, se calculó 22 % menos: 658 contra 846 kWh por panel de 590 W.)
- **Coplanar (5–8°) vs. 20° norte:** pérdida moderada (el Manual de Ventas usa ~10 % como referencia para el cliente); además los paneles casi horizontales se autolimpian peor.
- Bajar de 30° a 20° en estructura reduce ~5% de generación anual (y ~29% de carga de viento).

### La compensación con paneles ("paneles de cortesía")
**Lógica comercial:** "Vos pagás por la energía de N paneles bien orientados, y esa es la energía que te vamos a entregar. La orientación del techo deja de ser un problema tuyo y pasa a ser nuestro."

- Regla práctica: **~10% más de paneles** a costo de Voltia en montajes coplanares; cálculo exacto cuando hay paneles al sur (ej. 34 norte + 12 sur = pérdida 5,2%; se compensan 4 paneles = 8,7%, 1,7 veces la pérdida) [Pablo Ruiz, hostel]. En la ingeniería de detalle de Ruiz se terminó en 52 paneles (6 de cortesía) por la sombra de un cartel.
- **Al cliente se le habla en porcentajes primero** ("se pierde 5%, compensamos 9%"), y los paneles son la consecuencia técnica. Arrancar por "te regalo 4 paneles" suena a descuento y habilita a pedir más.
- **Dónde va:** el panel de cortesía **no va en la propuesta comercial** (que garantiza la cantidad cotizada y su energía) sino **en el contrato**, al momento de la entrega. La energía comprometida sigue siendo la de la propuesta.
- **No se agregan cortesías ni se cambian condiciones** en mensajes o documentos al cliente sin confirmación explícita de Nicolás.

### El arbitraje interno (no se le dice al cliente)
El coplanar ahorra mano de obra y estructura (cotizador cobra ~90/panel inclinada; coplanar cuesta ~la mitad). Ese ahorro **suele pagar con creces** las cortesías (~USD 120 + IVA c/u, más su estructura). Ejemplo real: estructura +420, dos cortesías −240, 65 m de cable −195 → ganancia real prácticamente igual a la del cotizador [Gabriela Michelena].

### Contabilidad de cortesías
Las cortesías **erosionan el margen real** y no están costeadas en ningún lado: dejarlo escrito en el comentario del lead.

---

## 9. UTE: microgeneración, potencia contratada y trámites

### Régimen
- **Microgeneración** (Decreto 173/010), **Capítulo XXVIII** del Reglamento de Baja Tensión. No el XXIX (autoconsumo sin inyección).
- Límites de inyección: 100 kW en 230 V; 150 kW en 400 V. La IMG ≤ potencia contratada.
- UTE **no cobra** la habilitación de microgeneración.
- El contrato de microgeneración con UTE es **por 10 años**. Qué pasa después no se sabe (ver §15).

### Cómo liquida UTE (lo que se le explica al cliente)
- La energía generada se consume primero en el lugar (autoconsumo: ahorra el kWh completo).
- El excedente se inyecta y UTE lo **acredita al mismo precio al que vende, descontando IVA y 12% de IRPF** (nota de crédito).
- **Límite anual:** no se puede vender más energía de la que se compra en el año.
- El crédito se descuenta también de los cargos fijos.
- Siguen corriendo **cargo fijo y cargo por potencia contratada**.
- En **triple horario**, quien compra mucho en **valle** (auto eléctrico, losa radiante de madrugada) y vende de día a precio más alto puede llegar a **factura ≈ 0 en el año**, incluso con los fijos.
- El crédito **se arrastra entre meses** (clave en consumos estacionales).

### El trámite (secuencia)
1. Consulta de suministro (técnica) — Voltia la presenta.
2. UTE responde con la **"Comunicación de Presupuesto"** (ver abajo).
3. **60 días** de validez de la solución técnica: si la carpeta no se abre en plazo, hay que reconsultar (control interno).
4. Carpeta de microgeneración con firma instaladora y técnico categoría A o B: unifilar, plano de ubicación, información técnica, DAR.
5. Obra → ensayos (anti-isla, reconexión 3 min) → habilitación.
- IMG > 40 kW en 230 V o > 70 kW en 400 V: dos registros de calidad de onda.
- Corriente generada > 16 A (25 A en MRT): estudio de UTE de eventuales modificaciones de red.

### La "Comunicación de Presupuesto" (fuente de confusión crónica)
Es la **respuesta a la consulta de suministro** de microgeneración. Dice que la acometida soporta la potencia, que no requiere subestación ni nicho de CGP, que la obra (si hubiera) es de UTE y que el **costo de conexión es $0,00**. El encabezado ("Presupuesto") y el campo "Tipo de solicitud: Aumento de potencia / Potencia punta X kW" hacen creer al cliente que le van a cobrar o que le cambiaron el contrato. **No requiere ninguna acción del cliente; habilita a Voltia a avanzar con la obra.** Scripts en §16.4. Variante cuando la potencia contratada **sí** sube: §16.5.

### Plazos
**No se prometen plazos de UTE.** Se dan rangos: la consulta, alrededor de mes y medio; la habilitación, entre 2 y 4 semanas desde que termina la obra (Manual de Posventa). Ante demoras: dar hechos concretos (días de demora, reclamos hechos) y plazos concretos ("esta semana"), nunca "a la brevedad" [Hernán Almada: 11 días sin respuesta, dos reclamos].

### Contactos UTE para derivar clientes (saldo a favor, devoluciones)
Dep. **Seguimiento de Generadores Externos**, tel. (+598) **2155**. Orden sugerido:
1. **Marco Mora**, interno **22152** (el de más experiencia)
2. **Daniel Yáñez**, interno **22151**
3. **Ezequiel Perdomo**, interno **22154**
El interno **22150 no se pasa** a clientes.

### Tarifas UTE en juego
Residencial Simple, Doble horario, **Triple horario** (punta/llano/valle), General Simple, **Mediano Consumidor** (punta/llano/valle). El sol genera sobre todo en **llano**. Referencias 2026 (verificar): triple residencial punta ~$12,0/kWh, llano ~$5,2, valle ~$2,4; cargo por potencia ~$83,2/kW. Mediano Consumidor: llano ~$5,79, punta ~$13,18.

---

## 10. Ahorro, proyecciones y cómo se explica

### Reglas
- **Ahorro máximo típico: 85–90%.** En el equilibrio anual siguen cargo fijo y potencia contratada. Con auto cargando en valle puede acercarse al 100%. **No prometer factura cero.**
- **Dimensionado "ideal":** cubrir ~85% del consumo. Si el espacio no da, decirlo con honestidad (abre la puerta a una ampliación futura) [Masmio].
- **Los datos reales de factura mandan:** el gráfico de barras de la factura UTE reemplaza cualquier promedio cargado en el lead. Leer bien si la factura abarca uno o dos meses (deuda anterior, multas).
- **Si lo que declara el titular en la visita difiere de las facturas, vale lo que declara** sobre su situación actual (ej. "ahora tengo auto eléctrico").
- **Consumo estacional** (hoteles, casas de veraneo): simular mes a mes, no con promedio. El crédito de los meses bajos financia los altos. Ej.: hotel con 80% del consumo en ene–abr [Mabrinor].
- En proyecciones asumir que **UTE reconoce toda la energía inyectada** (el cliente va a consumir más).
- Si el cotizador da ahorro > 100% o factura negativa: **no se publica así**; se corrige la factura de referencia o se redimensiona.
- **La adecuación interior** (mono→trifásico de la casa) **no se suma a la inversión** al evaluar rentabilidad: el cliente la necesitaría igual por seguridad. Lo mismo, en buena medida, el pasaje a trifásico y el aumento de potencia cuando las cargas nuevas lo exigen con o sin paneles. El cargador EV tampoco entra en el ROI solar.
- **Siempre presentar como "estimado"**, nunca como número garantizado. [Corregido 27/10] La garantía de generación mínima **no es estándar** (§11).
- **Qué se firma y qué no:** la energía generada se puede comprometer; el ahorro en pesos se estima; la factura de UTE no se compromete, porque depende de cuánto consuma el cliente [Cameto].
- **El ahorro cambia con las estaciones:** en verano se genera casi el doble que en invierno. El número de la propuesta es el promedio de los 12 meses; un sistema se evalúa en el año, no en julio [Cameto].
- **Si sube el consumo, sube la factura** aunque el ahorro no cambie (efecto rebote). Y si el consumo de base sube, el **porcentaje** de ahorro baja aunque el ahorro en plata suba [Dutra, Wallbox].
- **Cuota contra ahorro:** si se financia en menos tiempo del que tarda en recuperarse la inversión, la cuota queda por encima del ahorro. Con un plazo más largo queda por debajo [Cameto].

### Degradación (argumento)
El cotizador no aplica degradación de paneles ni suba de tarifas. El aumento compuesto de las tarifas UTE suele superar la degradación (~0,4–0,5%/año), así que la estimación es **conservadora**.

### Autoconsumo
Depende de cuánto se consume en horas de sol. Casa típica: ~35% autoconsumo, el resto se inyecta. En edificios o comercios con consumo diurno alto, casi todo se autoconsume.

### Cuando el sistema es una reparación (no una inversión nueva)
No pegar el payback de un sistema nuevo. Encuadre: "la inversión **protege y restituye** el ahorro existente; primero la seguridad" [Masmio].

---

## 11. Garantías, mantenimiento, granizo y plazos

| Concepto | Criterio Voltia (oct-2026) |
|---|---|
| Garantía de paneles | 10 años de producto; **performance ≥ 80% a 25 años** (fabricante) |
| Garantía de inversor | 5 años (fabricante) |
| Garantía de componentes eléctricos | 3 años (contrato tipo) |
| Garantía de instalación Voltia | 3 años |
| Pérdida de garantía | Si el sistema lo interviene alguien ajeno a Voltia sin autorización (contrato tipo) |
| Mantenimiento | Anual, **sin cargo los primeros 2 años**; desde el 3.º, del orden de USD 100 por visita según distancia. Si se vuelan paneles, Voltia se hace cargo siempre que haya hecho un mantenimiento en el último año (Manual de Posventa) |
| Vida útil inversor | 10–15 años; reemplazo hoy ~USD 2.000 (10 kW, equipo) |
| **Garantía de generación mínima** | **[Corregido 27/10] No es estándar: es una herramienta de negociación.** El contrato tipo no la trae; se agregó para algunos clientes que la pidieron (Cameto, Ruiz, Rodríguez). La ofrece quien vende, no se ofrece por defecto. Cuando se dio: si el sistema no llega al **90% de la generación anual de la propuesta**, Voltia agrega paneles sin costo (a Ruiz, "los necesarios"; a Rodríguez, "un 10 % más"; se revisa cada año hasta que se cumpla). ⚠️ Se mide contra el número de la propuesta: si la propuesta sobreestima (techo al sur, sombras), queda cerca de activarse. |
| Monitoreo | App del fabricante (generación). Consumo e inyección requieren **medidor inteligente** (opcional). |
| **Plan de Protección contra Granizo** | **[Corregido 27/10] No es un seguro y nunca se le dice "seguro"** (ni póliza, prima, siniestro, asegurado): es un *plan*. **USD 12/panel/año IVA incluido**, siempre por todos los paneles; repone solo paneles rotos por granizo (no inversor, estructura ni cableado). **Vandalismo opcional** al mismo precio. Contratado con la obra, cubre desde la puesta en marcha; con la instalación ya hecha, 30 días después del primer pago. Interno: es pasamano + mano de obra, no negocio; lo que se cobra es reserva para tormentas que peguen en varias obras. Cobro integrado a Voltia PM. |
| Plazo de la compra a la obra | **4 a 6 semanas** [Corregido 27/10] |

---

## 12. Formas de pago y financiación

### Seña
**USD 500** al confirmar, para reservar la fecha. No se devuelve si el cliente desiste por decisión propia; se devuelve si el banco no aprueba el crédito o UTE no aprueba la instalación (contrato tipo, desde 11/10/2026).

### Pago directo con Voltia (estándar)
**Seña → completar 50% antes de la obra → 30% al terminar la obra → 20% al habilitar UTE.** Las cuotas se cobran por momento de la obra, no por fecha. Sin el 50 % pago no se da fecha de obra.

**Descuento por pago directo:** equivale a la comisión bancaria que Voltia se ahorra (~3,5 % que el cotizador incluye como costo). Ej.: USD 519 [Wallbox].

### Con financiación bancaria (BBVA)
- Se financia hasta el **80%**; el **20%** restante al contado contra habilitación UTE.
- Plazos: 24 / 36 / 60 cuotas.
- **Las condiciones del crédito (tasa, comisiones, seguros) las define el banco.** Voltia manda la **proforma** (incluso antes de confirmar la venta) y el banco habla con el cliente.
- A **60 cuotas Voltia no paga la comisión (~3,5%)** que el cotizador considera: ese margen queda libre para bajar markup.
- La proforma puede ir a nombre de un titular y la factura a otro (confirmar datos de facturación).
- La obra se agenda recién con el crédito aprobado.

### Obras de servicios (no solar)
Ej. cotización 2026-001: **50% de seña, 50% contra entrega** de la obra terminada.

### Proyectos en etapas
Se puede cobrar un porcentaje mayor en la primera etapa para cerrar (ej. 60% en etapa 1, 40% con la etapa 2) [Barenof].

### Señales de riesgo de cobro
Facturas UTE con multas, recargos y deuda anterior: tenerlo en cuenta al definir condiciones [Mabrinor].

---

## 13. Propuesta vs. contrato

- **La propuesta comercial** muestra la cantidad de paneles cotizada, su energía, precio, ahorro y retorno. Es lo que el cliente compara.
- **El contrato** es lo que manda en obra: **los equipos que se instalan son los del contrato**, no los de la propuesta. Cualquier cambio (marca de panel, inversor superior, panel de cortesía) se refleja en el contrato que firma el cliente, y así queda aprobado.
- **Versionado:** Voltia PM no depreca versiones viejas. Después de emitir, **siempre dejar un comentario en el lead** indicando cuál es la versión válida, qué cambió y qué quedó descartado (y notas internas que no van al cliente).
- **Cada versión genera dos PDF:** la propuesta completa y un **resumen**. El MCP solo devuelve el link de la completa; el resumen se baja desde la app.
- **Cláusulas de contrato:** cortas, un párrafo. Ej. wallbox provisto por el cliente:

> **Cargador de vehículo eléctrico:** se incluye la mano de obra de instalación de un wallbox provisto por el Cliente, junto con la instalación eléctrica asociada: tablero de protección, llave termomagnética, interruptor diferencial, cableado desde el tablero general (hasta [X] m) y puesta a tierra. No incluye el cargador ni su garantía, obra civil, ni trámites de aumento de potencia ante UTE en caso de requerirse.

---

## 14. Comunicación con clientes

### Tono
- WhatsApp/Instagram: cercano, uruguayo, voseo, corto. Email/propuesta: formal y ordenado. Con clientes que escriben con usted (o mayores), usted [Cameto].
- Ni vendedor desesperado ni ingeniero inentendible.
- **Sin cháchara de relleno.** No re-explicar pasos cumplidos. Hechos y plazos concretos.
- **No prometer lo que no está asegurado** (ej. "ajustamos la generación a tu techo real", entregables no definidos, llamadas de seguimiento).
- **Separar dato, estimación y opinión**, y marcar la opinión como opinión aunque convenga [Cameto].
- **No opinar sobre trabajos de otras empresas**: no se sabe cómo se calcularon. Sí darle al cliente cómo evaluarlos ("preguntale cuánto pagó en enero") [Cameto].
- Mensajes que acompañan un documento (minuta, propuesta): **un mensajito corto**, sin re-presentarse ni re-explicar el sistema si ya se habló en persona.
- Los mensajes se escriben en **primera persona de quien envía** (puede ser el asesor).
- Al mencionar al asesor, **presentarlo con su rol**: "Martín García, nuestro asesor comercial".
- Usar **"hoy"/"mañana"** explícito según el día real de envío (los mensajes de pre-visita a veces se mandan la noche anterior).
- Nada de jerga innecesaria (DC/AC, kWp, latitud) con el cliente final.
- Al cliente: ahorro como "estimado"; no mencionar que el inversor es más grande que la contratada; no mencionar el arbitraje de estructura.
- Nombres fijos: **el portal de Voltia** y **la aplicación del inversor**; nunca "la app" a secas.

### Cambios frente al cliente
- **Nunca presentar un cambio como si siempre hubiera existido.** Decir qué se había planteado antes y por qué cambia, y recién después mostrar lo nuevo.
- Justificar los cambios de alcance como **resultado de la ingeniería de detalle / de la visita**, para que no parezca que no se había calculado antes.
- Si una propuesta anterior tenía un número optimista (ej. 99% de ahorro), hay que reconciliarlo explícitamente, no solo mandar el nuevo [Mabrinor].
- Si el precio cambió entre versiones, explicarlo partida por partida y decir si el sistema cambió o no [Wallbox].
- Si el cliente es más de una persona (socios, pareja), hablarles en plural [Barenof].
- Cuando hay que pedir plata a un cliente con el que hubo comunicación despareja, **no mezclar** el pedido de cobro con otro tema: va en mensaje aparte [Barenof].

### Formato de entrega
- Mensajes listos para copiar y pegar; si es WhatsApp, **link `wa.me` con el texto precargado** (formato `https://wa.me/598XXXXXXXX?text=...`, sin el 0 inicial).
- Los links nunca se leen en voz alta; van como texto clickeable.
- PDF de propuestas: el link vence en 15 minutos; adjuntar el PDF en WhatsApp. En iPhone, compartir vía **"Guardar en Archivos"** y desde Archivos, para que no se cuele el link como texto.
- Documentos para clientes (respuestas, cotizaciones fuera del PM): PDF con logo Voltia arriba a la izquierda, isotipo al pie, azul `#1836B2`, firma "Equipo Voltia" salvo indicación.
- **Respuestas a un listado de preguntas:** punto por punto con la numeración del cliente; si hay un miedo central, contestarlo arriba de todo; si hay opciones, tabla resumen al principio; cerrar ofreciendo rehacer los números con sus facturas [Cameto, Dutra, Ruiz].

---

## 15. Banco de respuestas a preguntas frecuentes

Respuestas validadas en casos reales (José Rodríguez, Miguel Dutra, Federico García, Cameto, Ruiz). Ajustar números a cada cliente. Las preguntas de posventa (obra, UTE, encendido, "genera poco", tarifa, corte de luz, limpieza) están en el Anexo E del Manual de Posventa.

**¿Qué porcentaje es autoconsumo y qué porcentaje se inyecta?**
Depende de cuánto consumas en las horas de sol. En una casa típica el autoconsumo ronda un 35% y el resto se inyecta a UTE. Lo que consumís directo te ahorra el kWh completo; lo inyectado UTE te lo reconoce descontando IVA e IRPF.

**¿Pueden compartir la simulación?**
Usamos una herramienta interna. El ahorro sale de comparar la generación estimada con tu consumo y la tarifa vigente.

**¿Cómo se calcula el 90% de ahorro?**
La energía que generás se consume primero en tu casa; lo que sobra se inyecta y UTE te lo paga al mismo precio al que te vende, descontando IVA y 12% de IRPF. Hay un límite anual: podés inyectar como máximo la misma energía que consumís. Aunque llegues a ese equilibrio, siguen el cargo fijo y el cargo por potencia contratada; por eso el ahorro máximo típico ronda el 85–90%. Si consumís mucho de madrugada (auto en valle) y los paneles inyectan de día, puede acercarse al 100%. Trabajamos con una hipótesis de consumo promedio, no con un número garantizado.

**¿Me garantizan cuánto voy a pagar de UTE?**
La energía que generan los paneles se puede comprometer; el ahorro en pesos lo estimamos; lo que vas a pagar de UTE no lo puede garantizar nadie, porque es una resta: lo que consumís menos lo que generan los paneles, y el consumo lo manejás vos. Y se mide en el año: en verano se genera casi el doble que en invierno [Cameto].

**¿Orientación e inclinación?**
(Decir lo real.) Ej.: "Los paneles van en las caídas de isopanel orientadas al norte, en montaje coplanar (unos 5°). Para compensar la pérdida frente a una inclinación óptima agregamos un 10% de paneles a costo de Voltia, especificados en el contrato; la energía que te comprometemos es la de la propuesta." **Nunca decir "norte" si los paneles miran al sur.**

**¿Se perfora el techo?**
Isopanel: la fijación son pinzas que aprietan en el engrafe; no se perfora. Hormigón: no se perfora la losa ni la membrana; anclaje a pretiles y/o lastre. Chapa: tornillos en la cresta con arandela de estanqueidad, al tubular.

**¿Consideran sombras?**
En la visita relevamos chimeneas, tanques, equipos de aire y árboles; los paneles se ubican evitando esas zonas.

**¿Garantía de performance a 25 años?**
Al menos 80% de su potencia a los 25 años, garantía del fabricante.

**¿Qué degradación asumieron?**
El cálculo no aplica degradación de los paneles, pero tampoco suba de tarifas de UTE. A lo largo de los años el aumento compuesto de las tarifas suele superar la degradación, así que la estimación es conservadora.

**¿Vida útil del inversor y costo de reemplazo?**
Normalmente 10–15 años. El costo dependerá de los precios de ese momento; hoy un equipo equivalente ronda USD 2.000 (más mano de obra).

**¿Conviene sumar paneles por un auto eléctrico?**
8.000 km/año equivalen a unos 2 paneles más. Por eso proponemos un inversor con margen, para agregarlos más adelante sin cambiar la instalación.

**¿Hay garantía de generación mínima?**
[Corregido 27/10] **La IA no la ofrece: queda para quien vende.** No es estándar; es una herramienta de negociación que se dio a algunos clientes que la pidieron (ver §11).

**¿El monitoreo queda en la app?**
Sí, generación diaria, mensual y anual. Para ver consumo e inyección hace falta un medidor inteligente (opcional).

**¿Admite baterías / respaldo ante cortes?**
El inversor ofrecido es on-grid: no admite baterías y, si hay un corte de UTE, se apaga por seguridad. [Corregido 27/10] Para trifásico 230 V sin neutro, hoy la oferta de híbridos es muy acotada (frase propuesta en `04-equipos.md`; no decir "no se consigue"). Si hay trifásico 400 V con neutro, hay opción híbrida (Huawei) y se cotiza aparte. Si alguien ofrece un híbrido, verificar que sea compatible con el tipo de red.

**¿Qué pasa con el contrato de UTE después de los 10 años?**
Lo seguro: el contrato es por 10 años y UTE se compromete a comprar lo que se inyecte. Lo que pase después no se sabe: lo va a decidir el gobierno de ese momento. Opinión de Voltia, marcada como opinión: creemos que se va a renovar, porque el país va a necesitar más energía y generarla donde se consume es lo más barato para UTE [Cameto, ago-2026; se hizo una consulta formal a UTE, sin respuesta registrada].

**¿Qué costos quedan fuera de la propuesta?**
- Microgeneración: UTE no cobra la habilitación.
- Cambio a trifásico y aumento de potencia: el trámite lo hace Voltia, incluido. UTE cobra por única vez la tasa de conexión mono→trifásico ($12.493 + IVA, tarifario vigente). Aumento hasta 7 kW: conviene que lo pida el titular desde la aplicación de UTE, sin costo.
- Cargo fijo mensual: la potencia contratada adicional sube el cargo fijo (~$83,2/kW + IVA por mes).
- Instalación interior de la casa (adaptación a trifásico): no incluida; se cotiza aparte.
- Nicho para el inversor: la propuesta estándar lo excluye; incluirlo es decisión de quien vende.

**La factura está a nombre de otra persona.**
No afecta nada. Lo único es que los documentos de UTE los firma el titular del suministro [Wallbox].

**¿Cuánto me sale el sistema financiado?**
Las condiciones finales (tasa, comisiones, seguros) las define el banco. Te enviamos la proforma antes de confirmar para que lo evalúes con tiempo.

**¿Por qué cambió la propuesta?**
"En la visita vimos [X]; la propuesta anterior contemplaba [Y]. Con la ingeniería de detalle ajustamos a [Z]."

---

## 16. Plantillas de mensajes

### 16.1 Pre-visita (usar tal cual; no inventar otro)
> [Nombre], qué tal? Me presento, soy Nicolás Machín, ingeniero de Voltia. Hablaste con [asesor], nuestro asesor comercial.
> Tenemos una visita agendada para **hoy** a las [hora] hs. Simplemente para confirmar que me esperás. Aprovecho también para pedirte la ubicación para el GPS. Nos vemos en un rato

- Si se manda la noche anterior: "**mañana** [día]" y se adapta el cierre.
- **La frase del GPS va siempre**, aunque la dirección esté en el lead.
- Si el teléfono es de un familiar, se redirige el mensaje sin asumir la relación.

### 16.2 Reprogramar visita
> [Nombre], qué tal? Me presento, soy Nicolás Machín, ingeniero de Voltia. Hablaste con [asesor], nuestro asesor comercial. Tenemos la visita agendada para hoy a las [hora]; vengo un poco atrasado con la visita anterior. ¿Te complica si la pasamos a las [nueva hora]? Si te complica avisame y lo acomodamos.

### 16.3 Acompañar minuta o propuesta (post-visita)
Corto, sin re-presentarse:
> [Nombre], ahí te paso la minuta de la visita de hoy con lo que relevamos. Cualquier duda me escribís.

Propuesta actualizada: qué cambió respecto de la anterior (en viñetas), precio final, diferencia contra la anterior, cuota BBVA a 60 meses, ahorro "estimado".

### 16.4 "Comunicación de Presupuesto" de UTE — versión WhatsApp (90% de los casos)
> Hola [NOMBRE], te va a llegar (o ya te llegó) un correo de UTE con un documento que dice "Comunicación de Presupuesto".
> Te lo aclaro antes de que te preocupes: **no tenés que hacer nada ni pagar nada**. Fijate que abajo dice "Costos de Conexión: 0,00".
> Ese documento es la respuesta a la consulta técnica que presentamos nosotros como parte del trámite de microgeneración. Lo que nos confirma es que tu acometida soporta la potencia del sistema solar, así que **quedamos habilitados para avanzar con la obra**. Es una buena noticia 👍
> Cualquier cosa que te llegue de UTE por este tema, pasámela y la vemos nosotros.

**Repreguntas típicas:**
- *¿Tengo que pagar los 7,5 kW?* → No. Es la potencia que se consultó técnicamente, no un cargo; el documento dice que el costo de conexión es 0,00.
- *¿Yo pedí un aumento de potencia?* → No. Es la categoría con la que UTE registra la consulta técnica que presentamos nosotros.
- *¿Ya puedo poner los paneles?* → Es el paso que nos habilita a avanzar; quedan las etapas siguientes del trámite y la obra, que coordinamos nosotros.
- *¿Tengo que responder el mail?* → No hace falta.

**Versión formal (email):** asunto "Aclaración — Comunicación de UTE, trámite de microgeneración"; mismo contenido, explicando que no requiere subestación ni nicho de CGP, obra a cargo de UTE, costo $0,00, y que "Aumento de Potencia" es clasificación interna de UTE.

### 16.5 Variante cuando la potencia contratada SÍ sube
Reemplazar el cierre por:
> Una aclaración importante en tu caso: como parte de este trámite, tu potencia contratada con UTE pasa de [X] kW a [Y] kW. Eso no tiene costo de conexión (el documento lo confirma en cero), pero sí implica que el **cargo fijo mensual de tu factura sube**, y queda así de forma permanente. Es un costo bajo comparado con el ahorro del sistema, pero prefiero que lo sepas ahora y no cuando te llegue la factura.

### 16.6 Compensación por orientación (cara sur)
> En el techo tenés dos aguas: una mirando al norte y otra al sur. La cara norte es la buena, pero solo entran [N] paneles ahí. El resto va sobre la cara sur, que genera aproximadamente un 20% menos. Nosotros no queremos que eso te lo comas vos, así que lo compensamos: los paneles al sur representan una pérdida equivalente al [x]% de la energía del sistema; para cubrirla instalamos paneles adicionales que suman cerca de un [y]% de capacidad extra. La propuesta está cotizada por [N] paneles y vamos a instalar [M]; los adicionales van por cuenta de Voltia. Vos pagás por la energía de [N] paneles bien orientados, y esa es la energía que te vamos a entregar. La orientación del techo deja de ser un problema tuyo y pasa a ser nuestro.

### 16.7 Demora de UTE
> [Nombre], qué tal? Te cuento cómo viene el trámite: UTE está demorando más de lo habitual, van [N] días sin respuesta y ya hicimos [N] reclamos. Volvemos a reclamar [día] y te aviso esta semana con novedades.

---

## 17. Manejo de objeciones

- **"Me parece caro."** No ponerse a la defensiva: no solo se pagan materiales sino dimensionamiento, instalación, seguridad, responsabilidad técnica y que funcione. Ofrecer revisar alcance. Palancas internas: financiación a 60 cuotas (comisión libre), coplanar, sacar comisión si paga contado, trámites incluidos, inversor superior sin costo.
- **"Tengo otra cotización más barata."** No atacar a la competencia: comparar alcance punto por punto (equipos, protecciones, estructura, trámite, garantías, puesta en marcha, adecuaciones, potencia contratada, compatibilidad con la red).
- **"Pasámelo rápido."** Estimación rápida sí; precio cerrado necesita datos. "Prefiero ser claro ahora antes que pasarte un número que después haya que cambiar."
- **"Solo quiero un precio aproximado."** Rango con supuestos.
- **"Quiero pagar una parte al habilitar."** Ya está contemplado: 20% contra habilitación UTE (con o sin financiación).
- **"Un conocido tiene paneles y ahorra poco."** Preguntar de qué mes es el dato (si es de invierno, es el peor); no opinar sobre un sistema que Voltia no hizo; ofrecer mostrarle cómo se calculó el suyo con sus facturas [Cameto].
- **"¿Y si UTE no renueva el contrato?"** Ver §15.
- **Cliente con lupa (preguntas por escrito).** Responder punto por punto en PDF con marca Voltia, simple y sin comprometer lo no cerrado.

---

## 18. Cotizaciones no estándar

### Solo materiales / kit (cliente instala)
- El cotizador del PM **no sirve** (no expone costos por línea): se arma a mano, en PDF estilo cotización 2026-001.
- Precio: costo + 10–15% + IVA. Detallar el kit eléctrico (DC: tablero DC, cable solar 6 mm², MC4, caño PVC UV; tierra: 4 y 6 mm², jabalina con morseto, cámara; AC: tablero con térmica y diferencial 300 mA, tablero de interconexión, barras). Growatt trae SPD integrados (no se agregan). Incluir esquemas y guía de estructura.
- Excluir explícitamente: mano de obra, instalación, traslado, trámite UTE. [Julio Ciambelli, Lidio Braga]

### Reparación / readecuación de sistema existente
- Cotizar por ítems (materiales, mano de obra, gestión UTE, memoria de cálculo y firma técnica). [Masmio, 2026-001]
- Incluir **memoria de cálculo estructural con firma** cuando hubo un incidente: tranquiliza al cliente, cubre a Voltia y se cobra.
- En documentos al cliente, no poner kgf de viento calculados en gabinete sin firma: mostrar las mejoras concretas (peso, unión estructural) y anclar la precisión en la memoria firmada.

### Ampliaciones
- Un solo inversor más grande si hay un único suministro → trámite de **ampliación**, no nuevo. [Barenof]
- Reemplazar paneles viejos por de mayor potencia para aprovechar espacio; ver qué se hace con los retirados.
- Paneles de distinta potencia: agrupar en string/MPPT separado para evitar mismatch.

### Opciones escalonadas
Cuando el techo limita o se puede extender: ofrecer 2–3 opciones (techo actual / extensión / extensión mayor) como versiones distintas, con markup creciente, y dejar comentario indicando cuáles son vigentes. [Diego Schroeder]

### Paneles en pared
Montaje "sobre pared de hormigón (soportes tipo alero)", descontando metros con sombra. [Germán Bentancor]

### Comercial / B2B grande
- Usar el cotizador B2B desde la app (no está en el MCP).
- Hotel / comercio estacional: simulación mes a mes.
- Flota de autos eléctricos: la carga de la flota suele superar el consumo del local; la **gestión de carga dinámica** es el corazón del proyecto; considerar **carport**; framing: "el sistema solar te permite regalar la carga a los choferes sin comerte el margen". No vender "cargás con el sol" (de noche toma de la red).
- Complejo turístico por etapas: arquitectura por clusters, modular por cabaña, baterías justificadas como continuidad de servicio (no ahorro), piscinas climatizadas como driver de dimensionado. Cuidado con regalar ingeniería. [Sandlio]
- Segmentos B2B priorizados: colegios privados ("Nuestro Liceo Solar"), clubes deportivos, logística. Umbral CEE 2026: ~300 tep ≈ 100–150 kW FV.

### Licitaciones
Se evaluaron ESCO ASSE (~70 instalaciones) y MVOT (inspecciones). No se presentó a MVOT, pero conviene un **paquete de licitación reutilizable**.

---

## 19. Ingeniería FV: criterios generales

Fuente: skill `voltia-fv-ingenieria` v3.5. **Criterio rector: conservador pero sin sobredimensionar; dentro de lo técnicamente validado, siempre la opción más barata. Priorizar lo que se consigue en plaza.** No inventar normas, fichas, corrientes admisibles ni precios.

### Geometría
- Estructura: **30° al norte** estándar (en hormigón ventoso o al borde: 20°, hasta 15°). Módulos en **portrait**.
- Máximo **14 paneles por grupo**, repartidos parejo entre strings.
- **Sujetadores** a **456 mm de cada punta** (módulo de 2.278 mm; zona segura 400–790 mm). Adopción de Voltia validada contra un módulo de dimensiones idénticas; si el fabricante propio indica otra zona, manda la del fabricante. Nunca en la punta.

### DC
- Cable solar por cálculo (caída ≤ 3% con Vmp real), la opción más barata que cumpla. Guía: 4 mm².
- **Fusibles gPV solo desde 3 strings en paralelo.**
- Térmica DC solo si hay strings en paralelo, y certificada DC sobre la Isc corregida.
- **Seccionador DC accesible siempre**, aunque el inversor lo integre (seguridad de trabajo).
- SPD DC tipo 2 **solo si el inversor no lo integra** (Growatt MIN trae SPD DC clase II y AC clase III).
- Voc en frío con **Tmin = −5 °C**.
- **Verificar el sufijo exacto del módulo** (bifacial doble vidrio ≠ monofacial: cambian Voc, Isc, dimensiones y peso).
- Cómputo de cable solar: tirada real por polo, un recorrido (rojo + negro); el factor 2 es de la fórmula de caída, no de los metros.

### AC
- **Corriente máxima del inversor: de la ficha, no S/U** (ej. MIN 8000TL-X2: 34,8 A por cociente vs. 38,3 A de ficha).
- Sección: (1) corriente admisible corregida por temperatura (≈0,87 a 40 °C), (2) caída ≤ 3% total, (3) coordinación `I_max ≤ In_térmica ≤ Iz`. Si no coordina, subir sección.
- Tabla rápida (bipolar superplástico): hasta 8 módulos 2×4; desde 10, 2×6; con térmica de 40 A, 2×10. Con monofásicos ≥ 7 kW arrancar por la corriente del inversor.
- Térmica por la corriente **máxima** del inversor (el límite por software no baja este dimensionamiento).
- **Diferencial 300 mA**, tipo A (no se exige B; no 30 mA).
- Una sola térmica (interruptor general de microgeneración) si inversor a < 30 m; si > 30 m, otra local.
- Conexión en **bornera o barras**, nunca en bornes de llaves.
- Colores monofásico: fase blanco, neutro celeste.

### Tableros
- **DC:** seccionadores por string, SPD DC (si no integrado), bornera de tierra, fusibles si ≥ 3 strings.
- **Protecciones AC** (junto al inversor): diferencial 300 mA, bornera de tierra, SPD AC si no integrado. Sin térmica salvo > 30 m.
- **Interconexión** (junto al medidor, accesible a UTE): bornera, interruptor general de microgeneración (precintable, etiquetado), smart meter. El medidor bidireccional lo pone UTE.

### Puesta a tierra
- Electrodo propio, independiente del neutro de UTE. Objetivo **< 10 Ω** (ideal 5). Escalera: profundizar → paralelo a ≥ 5 m → hasta 3 jabalinas.
- **6 mm² solo bornera → jabalina** (exigencia UTE). **4 mm² todo lo demás.**
- Bornera DIN de 10 tornillos en estrella. Tierra de paneles por cable de borne a borne; nunca circular por el aluminio del marco.
- Se lleva siempre la independiente; si la de la casa mide ≤ 5 Ω se puede unir.

### Terminales y canalización
- Solar 4 mm² → terminal pino de 6 mm²; SPD DC → pino doble 6 mm²; tierra → ojal 4 mm². **+50%** de terminales.
- Caño de bajada: 1 string 1"; 2 strings 1¼"; 3 strings 1½". Corrugado metálico 2 m por string.

### Corrosión
Por distancia a la costa (~6 km → C3). Galvanizado estándar + retoques con pintura rica en zinc. Estructuras soldadas en obra: primer rico en zinc + esmalte (sin galvanizado en caliente), mantenimiento a cargo del cliente.

### Soporte de inversor (sustituto del nicho)
Atril metálico de una columna (100×100×3, 1,70 m, empotrada 0,60 m en dado 40×40×60), respaldo 40×40×2 (0,55 m MID-X; 0,70 m MID XL2), techo a 18° volado hacia adelante. Aloja inversor + tablero DC + protecciones AC; **nunca** el de interconexión. El dado empotrado **no requiere verificación de vuelco** (empuje pasivo, como las columnas de medidor de UTE).

### Medidores inteligentes (pinouts confirmados)
- **Growatt MIN TL-X2 (2,5–6 kW):** COM 8 pines; meter RS485 en **pines 7 (A) y 8 (B)**; datalogger en 3-4. Límite de exportación: `Advanced` (clave 123) → `Exportlimit ON` → `Meter`.
- **Eastron SDM120CT:** bornes 3 (N) y 4 (L) alimentación; 1-2 CT (flecha hacia la red; potencia negativa al generar = CT invertido); 10 (A+) → pin 7, 9 (B−) → pin 8, 8 (G) malla solo del lado del meter.
- Resto de modelos: pendiente de confirmar en obra; no se cargan pinouts de memoria.

---

## 20. Ingeniería FV: estructuras por tipo de montaje

| Montaje | Regla no negociable | Esquema |
|---|---|---|
| **Isopanel** | No se perfora el isopanel | Grampa de aluminio que muerde la junta alzada (2 bulones inox) → L bajo o soporte dentado → pieza de conexión en L (una por soporte) → riel P → sujetadores. Paso del engrafado 1,12 m. Portrait por defecto. |
| **Chapa** | Nunca anclar a la chapa sola; tornillos en la **cresta**, nunca en el valle, con EPDM | Estribos al **tubular estructural** bajo la chapa (ref. 80×40 cada 1,20 m), rieles de aluminio de fábrica. Sin tubular confirmado, el esquema no aplica. |
| **Hormigón (pretiles)** | Por defecto no se perfora la losa ni la membrana; pasajes por el pretil | **Híbrida recomendada:** anclaje a pretiles (C80 galvanizado + **varilla M12 inox con resina química**) + contrapesos en el borde libre. Confirmar pretil de hormigón armado sano. Mantener el arreglo algo adentro del pretil. Sin faldón perimetral por defecto. **[Corregido 27/10] Perforar la losa es una excepción**: se analiza caso a caso cuando no hay otra alternativa viable y solo si se define con el cliente que es lo mejor. Precedente: Ruiz (contrapesos de ~11.000 kg → anclaje químico a la losa, ~1.800 kg, garantía de estanqueidad a 5 años y USD 3.000 + IVA de descuento). |
| **Tejas** | La teja no toma carga | Ganchos inox A2 con 2 tirafondos al perfil de madera; rieles horizontales; coplanar. Confirmar estado de la madera. |
| **Suelo** | Adaptar la plantilla, no diseñar de cero | Patas C80×40×15×2 (Tipo 1 con diagonal, Tipo 2 sin), pilotes 50×50×60 / 40×40×60, longitudinales C80, cruz de San Andrés en extremos. Separación entre filas `s = 6·sen(ángulo)` (30° → 3,00 m; 20° → 2,05 m). |
| **Cochera / carport** | No pilotes aislados profundos | Tubular soldado (cabios 100×50×3, vigas 100×100×3, columnas 100×100×4), viga perimetral de HA 0,30×0,40 cerrada; estabilidad por peso propio. |
| **Pared** | — | Soportes tipo alero sobre pared de hormigón. |

**Lastre (lección Masmio):** losas de 15 kg ×4 por panel, sueltas y atadas al panel, no aguantaron a altura de piso 12. Solución: losas 45×45×10 cm (~50 kg) × 4 por panel (**~200 kg/panel**) **unidas entre sí con estructura de acero galvanizado** (ya no puede volar un panel solo) + memoria de cálculo firmada. Revisar bordes/esquinas (succión 2–3× el centro) y la carga sobre la losa (~75 kg/m²). **El lastre no crea un apoyo salvo vinculación mecánica.**

**Separación entre filas en comercial** (ref. Barenof, 590 W a 20°): ~1,44 m.

---

## 21. Ingeniería FV: viento

- Norma **UNIT 50:84**; **`general/viento.md` del skill es la única fuente** del cálculo.
- **Vk = 158 km/h** a menos de 25 km de Río de la Plata, Río Uruguay o costa atlántica; **135 km/h** en el resto.
- **Vk no es la velocidad de cálculo:** `v_c = K_t·K_z·K_d·K_k·v_k`; `q_c = v_c²/16,3`. Usar `q = 0,613·Vk²` sobredimensiona ~40% (error de la v3.3).
- **La acción de viento no se mayora** (tensiones admisibles, γ₃ = 1,00, K_k = 1,00). El FS 1,5 solo en estabilidad global (vuelco, arranque, deslizamiento).
- Datos obligatorios: distancia a costa/río, **altura del plano de módulos**, rugosidad del entorno, dimensiones de la construcción. Sin ellos no hay presión de cálculo.
- Coplanar (≤ 20 cm y ≤ 5° del plano) → Capítulo 8, con zonificación: borde h/10 doble, cumbrera triple, c = 2,0 junto a claraboyas/ventilaciones/chimeneas. Elevado → Capítulo 10 (cubierta aislada). `c_m` de conjunto: 30° → 1,30; 20° → 0,92; 15° → 0,73.
- **No se adoptan coeficientes "conservadores" en gabinete**: si un caso no está cubierto, se escala a Nicolás.
- Flecha L/200 se verifica siempre.

---

## 22. Ingeniería FV: cumplimiento UTE

- Mono → IMG mono. Trifásico ≤ 10 kW → mono/bi/tri con desequilibrio ≤ 5 kW. > 10 kW → trifásica.
- Potencia nominal de la IMG ante UTE = **salida efectiva** (la limitación por software cuenta y UTE la acepta).
- Interruptor general de la IMG: termomagnético, precintable en abierto, etiqueta "Interruptor de Corte de Microgeneración", junto al medidor.
- Diferencial general (300 mA tipo A).
- Inyección de continua ≤ 0,5% In; interruptor de interconexión automático (EN 50438); **anti-isla ≤ 500 ms; reconexión a los 3 min**.
- Inversores según **IEC 62109-2**; FP ≥ 0,95.
- PAT propia, adicional, independiente del neutro de UTE.
- Señalización de doble alimentación.
- Equipos con certificación US/IEEE: puede hacer falta un documento de **equivalencia de normas** con IEC [Fronius Symo Advanced 10.0-3].
- Verificar siempre la última versión publicada del Cap. XXVIII.

---

## 23. Ingeniería FV: entregables

Por obra: memoria descriptiva (DOCX+PDF), memoria de cálculo (DOCX+PDF), lista de materiales (XLSX, hojas Resumen + Detalle, columna Comprar/Stock), verificación de vuelco (XLSX con fórmulas vivas), prompts para Claude Design (plano estructural y soporte de inversor), manual de conexión del smart meter si lleva.

**Control de coherencia antes de emitir:** un dato distinto en dos documentos es un error aunque cada valor sea defendible. Verificar calibres de protecciones, secciones y longitudes, canalización, SPD integrado/externo, módulos/strings/MPPT, cantidades estructurales, anclaje, modelo de meter y **letra de revisión** (el juego se emite completo con la misma revisión).

Lo pendiente de sitio va en observaciones de la lista de materiales o celdas a confirmar, **no** como sección de supuestos en las memorias. Números en dígitos. Decir "lista de materiales", nunca "BOM". "Pata" = pórtico completo; "parantes" = sus columnas.

---

## 24. Visitas técnicas y relevamiento

### Ficha pre-visita (skill `visita-cliente`)
Orden fijo: paneles y potencia → precio → techo/montaje → UTE hoy y después → retorno → tarifa. Links: "Descargar PDF" (vence en 15 min) y WhatsApp del cliente. **Solo datos de lo cotizado y del cliente**: Nicolás tiene 4 años haciendo visitas, no necesita checklist ni instrucciones.

### Qué relevar siempre
- Tipo de suministro exacto (mono / tri 230 sin neutro / tri 400 con neutro), potencia contratada, tarifa, ubicación del medidor e ICP.
- Techo: tipo, pendiente real, orientación, estado (madera, tubular bajo chapa, pretiles), medidas, **obstáculos con posición y altura** (chimeneas, tanques, AA, antenas, árboles), retiro a bordes.
- Distancias y traza: campo → inversor, inversor → tablero/medidor, jabalina.
- Ubicación del inversor (nicho / soporte metálico / bajo techo).
- Cambios de consumo previstos (auto, bomba de calor, piscina, losa radiante).
- Viento: altura del plano de módulos, distancia a costa, entorno.
- Pretiles: **ancho y altura por separado** ("pretiles de 28 cm" no define nada).
- Quién hace obra civil (dados, nicho, zanjas).

### Durante la visita (skill `informe-visita-tecnica`)
Solo anotar, respuestas cortas, chequear coherencia geométrica de cada medida. Análisis en oficina. Informe para ingeniería: Docs editable + canvas A4 con marca + PDF.

### Después de la visita
- Revisar la minuta contra la propuesta (y errores de tipeo, ej. "acoplanar").
- Cargar en la ficha del lead todo lo que se pueda (dirección, techo, suministro, notas) sin que lo pidan.
- Pendientes técnicos de ingeniería (modelo de inversor, dirección de obra) **no se cargan como pendientes del CRM hasta que haya venta.**
- Lo que el instalador decida en obra (ej. paneles en pérgola) tiene que estar documentado en minuta o pre-ingeniería; si no, es una decisión no documentada [Gerardo Rodríguez].

---

## 25. Postventa y soporte técnico

### Growatt (skill `soporte-inversores-growatt`)
- **El inversor casi siempre dice qué le pasa.** Antes de ir a obra o cambiar hardware: **export `.xls` del día** (History Data del portal) y leer registros.
- Cuatro preguntas en orden: ¿fallas? (FaultCode, WarnCode, ISO, GFCI) → ¿derateo? (**`DerateMode`**: 3 = tensión de red, 4 = frecuencia, 5/6 = temperatura, 7 = control externo) → ¿campo DC completo? (Ipv por MPPT) → ¿cómo está la red? (VacRS/ST/TR; en 230 V sin neutro las VacR/S/T son línea/√3, no fase-neutro).
- Correlacionar (potencia vs. tensión, hora, consumo); una meseta clavada en una fracción del nominal es un umbral configurado.
- No confundir **protección** (umbrales de desconexión) con **derateo**. No usar el Modbus de una serie para otra.
- Soporte de Growatt: **solo a través del distribuidor**, no directo.

### Caso MID12KTL3-XL2 (ago-2026)
No arrancaba al amanecer (Standby congelado, sin código); arrancaba reiniciando la DC. La falla siguió al número de serie en dos obras distintas (problema del equipo, no de la red). En red delta sin referencia a tierra, el desbalance contra tierra (200/200/20 V) no es fuga. Error "AC V Outrange (006)" resuelto con **WideVolt Set 0 → 1**.

### Análisis de planta desde Voltia PM
`generacion_planta` (días y comparación con cartera) → `curva_horaria` (forma del día) → `estado_en_vivo` (inversor, strings, medidor). Exportar más de lo que se genera o exportar de noche = **medidor mal conectado** (CT invertido). Siempre separar dato de deducción.

### Huawei DTSU71 / FusionSolar
Brechas de consumo → revisar orientación de CT.

### Procesos a mejorar detectados
Materiales que quedan en casa del cliente semanas después de la obra [Almada] → revisar con operaciones.

---

## 26. Voltia PM y herramientas

**Voltia PM** es el ERP de Voltia: CRM, cotizador, propuestas, cobros por etapa, contabilidad, pagos a terceros e instaladores, comisiones, trámites UTE, monitoreo de plantas. Facturación electrónica: integración con **Biller** en curso. WhatsApp API de Meta en integración (verificación de empresa iniciada oct-2026). Respuestas automáticas hoy con **Manychat**.

### Uso del conector (MCP)
- Apunta a **producción**: todo lo que se crea es real.
- `buscar_lead`: por apellido o teléfono (sin 598); **probar variantes con y sin tilde** (voz transcribe mal: Varenov = Barenof, Ribeiro = Rivero, Fontanella = Fontenla); `incluir_cerrados: True` como fallback. Leads anteriores al PM no aparecen.
- Las funciones piden el **`lead_id` interno** (cmXXXX…), no el código LEAD-2026-XXX.
- `preparar_propuesta`: borrador iterable (solo se pasan los parámetros que cambian); markup por defecto 20% en la herramienta (llevarlo a 25 %, el de arranque); necesita `techo_m2`; acepta `inversores` (lista) para combinaciones distintas; `notas` vacías para limpiar.
- `publicar_propuesta` con `confirmar: True` → Cotizado; **siempre seguido de `comentar_lead`** con versión válida y cambios.
- `minuta_lead`, `documentos_lead` (con `incluir_texto=False` para chequear rápido), `leer_documentos`, `documentos_proyecto` (con `incluir_fotos`).
- `crear_pendiente` solo al usuario actual; reasignar desde la app. `completar_pendiente` usa `task_id`. Para mover fechas: `poner_en_espera` con fecha de reconsulta.
- `editar_lead` no reasigna asesor ni cambia tarifa (desde la app).
- `mover_etapa` a la misma etapa re-dispara automatizaciones (sirve si no se llenó "Visita realizada").
- `tramite_ute` (vía `buscar_proyecto` con `incluir_terminados`): tiempos internos vs. espera UTE.
- `indicadores` no expone ponderación por obra.
- Después de un deploy del MCP: desconectar y reconectar el conector, y abrir chat nuevo para ver el esquema nuevo.
- Links de PDF vencen a los 15 min; no se pueden bajar desde el entorno de Claude.

### Calendario
Visitas en **"VOLTIA externo"** (ID largo `c924bbcb…@group.calendar.google.com`); consultar también el calendario por defecto y nicolas@voltia.com.uy. El conector está autenticado con la cuenta personal de Google.

### Skills disponibles
`visita-cliente`, `informe-visita-tecnica`, `voltia-fv-ingenieria` (v3.5), `soporte-inversores-growatt`, `planificacion-semanal`, `rutina-diaria`. En sesiones solo de voz las skills de archivos pueden no estar disponibles.

---

## 27. Indicadores y metas

### Reglas de métricas
- Una obra sin ponderación cargada **vale 1**; las obras ponderadas de un mes suman al menos la cantidad de obras.
- La obra cuenta en el mes de "Validación de obra terminada".
- Para evaluar asesores: ventas, monto **y** pérdidas (volumen no es eficiencia).

### Foto setiembre 2026 (mejor mes del año)
11 ventas, USD 174.528 IVA inc. (+110% vs. agosto); conversión 36,7%; ticket ~USD 15.900. 11 obras, 76,55 kWp.
Metas: instalaciones Q3 22/25 (88%); anual 50/80; **kWp anual 464,9/400 (116%, cumplida)**. Q3 superó su meta de obras **ponderadas**.

---

## 28. Casos de referencia

| Caso | Qué enseñó |
|---|---|
| **Edificio Masmio Guayabos** (2026-001) | Readecuación tras desprendimiento de panel en azotea alta: lastre unido + memoria firmada; no pegar payback de sistema nuevo; dimensionado ideal 85%, honestidad sobre espacio; no desmotivar la habilitación UTE hablando de "sin excedentes". Paneles de reposición de mayor potencia en string aparte. |
| **Pablo Ruiz** (hostel, Punta del Este) | Compensación norte/sur con porcentajes; inversor por DC/AC 1,18 (25 kW, no 30); aumento de contratada sube cargo fijo; ICP/tablero físico ≠ trámite gratis; contrapesos vs. anclaje químico a la losa como excepción; contactos de UTE para saldo a favor. Detalle en `casos/2026-09-ruiz.md`. |
| **Mabrinor SA** (hotel) | Consumo estacional (80% en ene–abr); leer el gráfico de la factura; reconciliar un 99% previo con el nuevo número; señales de mora. |
| **Gerardo** (estructura propia del cliente) | Descuento por estructura existente (costo real ~30/panel); cortesías; recalcular ahorro con consumo proyectado (auto + bomba de piscina). |
| **Barenof SA** (40 kW en dos etapas) | Un inversor grande para ampliación; cobro 60/40 por etapas; paneles nuevos de mayor potencia; mensajes en plural; no mezclar cobro con otros temas. |
| **Diego Schroeder** | Tres opciones escalonadas; inversor mínimo 6 kW; cortesías en contrato; comentario de versiones vigentes para el asesor. |
| **Roque Rivero / Daniel Saravia** | Sacar comisión BBVA, subir equipo (inversor 8 kW, paneles 625 W) y aun así bajar precio: argumento de venta potente. |
| **José Rodríguez** (Carrasco) | Banco de 10 respuestas técnicas; garantía de generación negociada (no estándar); cuidado con decir "norte" cuando una parte mira al sur. Detalle en `casos/2026-10-rodriguez.md`. |
| **Miguel Dutra** | Desglose de costos fuera de propuesta (tasa mono→tri, cargo fijo por kW); adecuación interior fuera del ROI; forma de pago 80/20 con habilitación. Detalle en `casos/2026-10-dutra.md`. |
| **Ernesto Cameto** | Qué se firma (energía) y qué no (ahorro en pesos, factura); estaciones; cuota contra ahorro; casos de terceros; contrato UTE a 10 años. Detalle en `casos/2026-08-cameto.md`. |
| **Cliente con Wallbox** | Diferencia de precio entre versiones explicada por partidas; descuento por pago directo; cargador independiente del inversor; aumento hasta 7 kW por la aplicación de UTE; titular distinto. Detalle en `casos/2026-10-wallbox.md`. |
| **Ignacio Artola** | Proyecciones coherentes con el cotizador (ajustar factura, no paneles); cargador EV fuera del ROI; losa radiante y auto en valle. |
| **Julio Ciambelli / Lidio Braga** | Venta de solo materiales y precio amigo; factura real para evitar ahorro negativo. |
| **Federico García** | Híbrido trifásico 230 V sin neutro: hoy no se consigue en plaza (existe en el mercado). Respuestas por escrito guardadas como comentarios en el lead. |
| **Torre Trump** (73,75 kWp) | B2B desde la app; re-emisión de propuesta vencida ajustando markup para igualar precio. |
| **Flota de autos eléctricos** | Gestión de carga, carport, framing de beneficio a choferes. |

---

## 29. Errores que ya cometimos

**Comerciales**
- Inventar números o presentar estimaciones como datos de herramienta. Si no se tiene el dato, se dice.
- Dar markup sin ganancia en USD (o al revés).
- Cotizar Growatt de 5 kW.
- Prometer en mensajes cosas no cerradas (ajuste al techo real, generación mínima antes de definirla, llamadas de seguimiento).
- Decir "el contrato establece" una garantía que el contrato tipo no trae [Rodríguez].
- Decir "no hay en el mercado" del híbrido en 230 V: existe; y tampoco se dice "no lo conseguimos" [Dutra].
- Agregar paneles de cortesía o condiciones en mensajes sin confirmación.
- Inventar un formato de mensaje en lugar de usar la plantilla; sacar la frase del GPS; poner "hoy" cuando la visita es mañana; usar la hora del calendario en lugar de la real.
- Re-presentarse o re-explicar el sistema a quien se acaba de ver.
- Tratar temas técnicos (potencia contratada, cables) como bloqueantes de una cotización.
- Dar instrucciones de cómo hacer la visita cuando solo se pidió el contexto.
- Tomarse atribuciones: "ver los números" es para que Nicolás ajuste, no para mandar.
- Criticar repetidamente una decisión ya tomada: se marca una vez y se sigue.

**Técnicos**
- Calcular la corriente máxima del inversor como S/U.
- Viento con `q = 0,613·Vk²` y doble mayoración.
- Varilla "M13" (era la mecha; la varilla es M12).
- Cómputo de cable solar ida y vuelta por color.
- Ficha de módulo con sufijo equivocado.
- Unifilar y memorias con valores distintos; revisiones mezcladas.
- Confundir umbrales de protección con derateo en Growatt.
- Lastre suelto sin vinculación estructural.

---

## 30. Temas abiertos

- **Híbrido para trifásico 230 V sin neutro:** existe, pero hoy no se consigue en plaza; se va a traer. Falta registrar en la ficha de cada cliente que compró híbrido y recibió on-grid.
- **Pinouts** de Growatt MIN 7–10 kW, MID, Huawei SUN2000, Fronius Primo: confirmar en obra.
- **Cotizador:** costo de estructura editable por tipo de montaje; ítems adicionales y líneas negativas desde el MCP; efecto real de la tarifa en el ahorro; costo del inversor de 10 kW; B2B en el MCP; nombre del PDF (UUID) y fecha de la propuesta.
- **Bot de minutas:** que el paso a Visitado complete "Visita realizada"; que los pendientes de la minuta se creen como pendientes.
- **Precio de referencia de cargadores EV** (con y sin equipo): no hay número histórico en el PM.
- **Precio de la adecuación interior mono→trifásico:** sin referencia.
- **Tarifas UTE 2026:** re-verificar valores (cargo por kW, tasa de conexión) antes de usarlos en documentos.
- **Costo de UTE por aumento de potencia vía instalador:** sin dato.

---

## 31. Glosario

| Término | Significado |
|---|---|
| **IMG** | Instalación de microgeneración |
| **ICP** | Interruptor de control de potencia (de UTE) |
| **CGP** | Caja general de protección |
| **Consulta de suministro** | Primer paso UTE; verifica que la acometida soporte la potencia |
| **Comunicación de Presupuesto** | Respuesta de UTE a la consulta; costo 0, no requiere acción |
| **Potencia contratada** | kW contratados con UTE; define cargo fijo y techo de la IMG |
| **Red IT / delta / 230 V sin neutro** | Trifásica de 230 V entre fases sin neutro, típica de Uruguay |
| **Coplanar** | Paneles paralelos al techo, sin inclinación agregada |
| **Panel de cortesía** | Panel extra a costo de Voltia para compensar pérdidas; va en el contrato |
| **Markup / margen** | Ganancia sobre costo / sobre precio de venta |
| **DC/AC** | Relación potencia de paneles / potencia del inversor (objetivo ≈ 1,18) |
| **Clipping** | Recorte de generación cuando DC/AC es muy alta |
| **Minuta** | Resumen de visita generado por el bot de Telegram y subido al lead |
| **Versión vigente** | La propuesta válida, indicada en comentario del lead |
| **Proforma** | Factura previa para el banco en financiaciones |
| **Valle / llano / punta** | Franjas horarias de tarifa triple y Mediano Consumidor |
| **Pata / parantes** | Pórtico completo de la estructura / sus dos columnas |
| **Grampa de junta alzada** | Pieza que muerde el engrafe del isopanel (≠ sujetador del módulo) |
| **Sujetador (klema)** | Pieza que aprieta el marco del panel contra el riel |
| **DerateMode** | Columna del export Growatt que indica por qué limita potencia |
| **CEE** | Certificados de Eficiencia Energética (convocatoria 2026) |
| **Voltia externo** | Calendario de Google donde van las visitas a clientes |
| **Plan de Protección contra Granizo** | Plan anual de Voltia que repone paneles rotos por granizo; **no es un seguro** |

---

*Documento vivo. Cuando un criterio cambie, actualizar la sección correspondiente y la fecha de corte.*
