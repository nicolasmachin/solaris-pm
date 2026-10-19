# Sorotec: baterías de litio, all-in-one híbridos, UPS y telecom (catálogo sorotecpower.com, relevado el 18-oct-2026)

> Nota general de método: en casi todas las fichas de sorotecpower.com la tabla "Parameter" es una **imagen** y no texto, así que muchos datos (dimensiones, peso, corriente de carga, rango PV, etc.) no se pudieron leer y quedan como **"no publicado"**. Lo que sigue sale del texto de cada ficha. Las listas de categoría no tienen paginación (terminan en "No more"), así que se relevaron todos los modelos listados. No se encontró ningún datasheet PDF descargable ni lista oficial de compatibilidad con inversores.

## 1. Baterías de litio (Lithium Iron Battery, products-23649): especificaciones por modelo

### Takeaway
El catálogo actual tiene 10 fichas de batería LiFePO4: 6 de baja tensión (24/25,6 V y 48/51,2 V, de pared), 1 de 48 V modular en rack (SL-RH/S-EU, 25,6 a 51,2 kWh) y 2 de alta tensión (SL-RH en rack 19", 153,6/409,6/614,4 V, y SL-S-EU apilable). Todas usan CAN y RS485, pero **ninguna nombra marcas de inversor compatibles**: solo dicen "mainstream inverters" o "SOROTEC y muchos otros híbridos". La única ficha con certificaciones de producto concretas es la SL-RH (CE, IEC 62619, UL 1973, UL 9540A, UN 38.3, garantía de 10 años). Las demás tienen 5 años de garantía o no la publican.

### Cited Findings

**Tabla resumen (todo LiFePO4, salvo donde se aclara)**

| Modelo | Tensión nominal | Capacidad | Ciclos / DoD | Corriente | Formato / IP | Comunicación | Certificaciones (producto) | Garantía |
|---|---|---|---|---|---|---|---|---|
| SL-W-02 | 25,6 V y 51,2 V | 300 Ah por unidad (kWh no publicado; 51,2 V × 300 Ah ≈ 15,36 kWh) | >6000 ciclos; DoD no publicado en la ficha | Descarga 200 A continua, carga 150 A | Pared, modular, vertical o colgada; IP20; paralelo para ampliar | CAN, RS485, RS232; LCD | CE (LVD/EMC), CUL, FCC, TÜV CB (y OHSAS18001, que es de empresa) | 5 años; vida de diseño >10 años |
| SL-W/SL-R 24V/48V-T/W (100–480 Ah) | 24 V / 48 V | 100–480 Ah según título (el texto de la serie dice 100–300 Ah) | Hasta 6000 ciclos, 100 % DoD | "Hasta 100 A/300 A" | Pared | CAN, RS485, RS232; LCD / touch | Solo certificaciones de empresa (ISO 9001/14001/45001, CE) | 5 años |
| SL-W/SL-R Upgraded (touch screen) | 24/48 V (serie: 25,6/51,2 V) | 100–480 Ah (título) | 6000 ciclos, 100 % DoD | "Hasta 100 A/300 A" | Pared | CAN, RS485, RS232; pantalla táctil | No publicado a nivel producto | 5 años; >10 años de diseño |
| IP20 SL-W/SL-R (modelos 300 Ah) | 25,6 V, 48 V, 51,2 V | 100–300 Ah; ej. SL-51.2300 = 15,36 kWh | 6000 ciclos al 100 % DoD (>6000 a 25 °C) | Hasta 100 A carga y 200 A descarga, según modelo | Pared, IP20 | CAN, RS485, RS232; LCD | No publicado | 5 años |
| SL-W Series 24V/48V (100–200 Ah) | 24 V / 48 V | 100–200 Ah | 6000 ciclos; DoD no publicado | Hasta 100 A/200 A; pulso 200 A 5 s | Pared | CAN/RS485/RS232; BMS inteligente opcional | No publicado | 5 años |
| Wall Mounted 51,2 V | 51,2 V | 50, 80, 100, 120, 150, 200 Ah | Vida ">6 años a 25 °C"; ciclos no publicados | Pulso máx. 120 A | Pared | No publicado | Solo RoHS | No publicado |
| Rechargeable Home Solar (48 V) | 48 V | 50–200 Ah | Vida ">6 años a 25 °C" | Pulso máx. 120 A | Pared/gabinete, sin refrigeración activa | No publicado | Solo RoHS | No publicado |
| SL-RH/S-EU (modular) | Rango de trabajo 43,2–58,4 V (o sea, BT de 48 V); el título dice "153.6V/50Ah–61.4V/100Ah" | 25,6 kWh (5 módulos) y 51,2 kWh (10 módulos) | La ficha se contradice: "hasta 4000 ciclos a 90 % DoD" y también 6000 ciclos | Pico (3 s) 120 A / 200 A; "hasta 150 A" de descarga | Modular, IP21 (otra ficha dice IP20); autocalentamiento a baja temperatura | CAN/RS485; "soporta inversores de terceros" | No publicado | La ficha se contradice: 1 año (sección de empresa) y 10 años (ficha SL-RH) |
| SL-RH (rack, IP20) | **Alta tensión**: 153,6 / 409,6 / 614,4 V (3, 8 o 12 módulos en serie) | 5,12 kWh por módulo; hasta 55,29 kWh útiles | Hasta 6000 ciclos (70 % de retención); DoD recomendado 90 % | No publicado | Rack 19", módulos hot-swap; IP20; -20 a 55 °C | CAN 2.0 y RS485 | **CE, IEC 62619, UL 1973, UL 9540A, UN 38.3** | **10 años** |
| SL-S-EU (HV modular) | Alta tensión (valor no publicado) | No publicado | Hasta 6000 ciclos | No publicado | Modular apilable, paralelo multimódulo | RS485/CAN | "Cumple normas europeas"; no nombra certificados | 5 años; >10 años de diseño |

**Fuentes por modelo**
- SL-W-02: 25,6/51,2 V, 300 Ah, >6000 ciclos, 200 A de descarga y 150 A de carga, CAN/RS485/RS232, IP20, CE/CUL/FCC/TÜV CB, 5 años de garantía, carga de 0 a 45 °C — [Sorotec SL-W-02](https://www.sorotecpower.com/products-detail-5086238)
- SL-W/SL-R 24V/48V, 100–480 Ah, 6000 ciclos, 100 % DoD, "hasta 100A/300A", sin marcas de inversor ("different brands of hybrid energy storage inverters"), 5 años — [Sorotec SL-W/SL-R](https://www.sorotecpower.com/products-detail-4776925)
- Versión Upgraded con pantalla táctil: los mismos datos — [Sorotec SL-W/SL-R Upgraded](https://www.sorotecpower.com/products-detail-5069747)
- IP20 SL-W/SL-R 300 Ah: SL-51.2300 = 15,36 kWh, 100 % DoD, compatible con "SOROTEC and many other hybrid inverters", sin certificaciones listadas — [Sorotec IP20 SL-W/SL-R](https://www.sorotecpower.com/ip20-sl-w-sl-r-series-lifepo-battery-300ah-models-6000-cycles-wall-mounted-household-battery-storage.html)
- SL-W 24/48 V 100–200 Ah, pulso de 200 A 5 s, 6000 ciclos, 5 años — [Sorotec SL-W](https://www.sorotecpower.com/products-detail-982112)
- 51,2 V 50–200 Ah, pulso de 120 A, eficiencia de carga 100 % a 0,2C, solo RoHS — [Sorotec 51.2V](https://www.sorotecpower.com/products-detail-274307)
- 48 V 50–200 Ah, pulso de 120 A, RoHS — [Sorotec 48V](https://www.sorotecpower.com/products-detail-273720)
- SL-RH/S-EU: 25,6/51,2 kWh, 43,2–58,4 V, CAN/RS485, IP21, -30 a 55 °C, datos contradictorios de ciclos y garantía — [Sorotec SL-RH/S-EU](https://www.sorotecpower.com/products-detail-4776951)
- SL-RH en rack: 5,12 kWh por módulo, 153,6/409,6/614,4 V, 6000 ciclos, 90 % DoD, CAN2.0/RS485, CE/IEC 62619/UL 1973/UL 9540A/UN 38.3, 10 años — [Sorotec SL-RH](https://www.sorotecpower.com/ip20-rack-mounted-energy-storage-battery-sl-rh-series-10-year-warranty.html)
- SL-S-EU: HV modular apilable, 6000 ciclos, RS485/CAN, 5 años; no nombra química ni tensión — [Sorotec SL-S-EU](https://www.sorotecpower.com/products-detail-5087039)

**Compatibilidad con inversores**
- Ninguna ficha de Sorotec nombra marcas: solo "mainstream energy storage inverters", "SOROTEC and many other hybrid inverters" o "third-party inverter" — ver las fichas citadas arriba.
- No apareció ninguna lista de compatibilidad de baterías Sorotec en las búsquedas. La única mención de terceros es al revés (un inversor Sorotec REVO II 5.5 kW en la lista de baterías compatibles de Sunsynk, por CAN) — [Sunsynk battery compatibility (bimblesolar)](https://www.bimblesolar.com/docs/Sunsynk%20Battery%20compatibility%20(1).pdf)
- Contexto: Victron exige CAN-bus vía GX y entrega su protocolo a los fabricantes de baterías a pedido — [Victron battery compatibility](https://www.victronenergy.com/live/_export/raw/battery_compatibility:start)

### Inferences
- Las tensiones de sistema del SL-RH (153,6/409,6/614,4 V) dan exactamente 3, 8 y 12 módulos de 51,2 V (16S LFP). La ficha no publica la tensión del módulo, así que esto es inferencia.
- La SL-RH/S-EU, por su rango de 43,2–58,4 V, es en la práctica un banco de BT de 48 V que se arma con módulos de 5,12 kWh. El "153.6V" del título parece venir mezclado con la SL-RH de alta tensión.
- Que tengan CAN y RS485 no garantiza compatibilidad con Deye, Growatt o Victron: hay que pedirle a Sorotec los protocolos de BMS soportados (Pylontech-compatible u otro).

### Gaps
- Marcas de inversor compatibles: **no publicado** en ninguna fuente.
- UN38.3 e IEC 62619 de las baterías de BT de pared: **no publicado** (solo la SL-RH las declara).
- Dimensiones, peso y corriente continua de carga y descarga de la mayoría de los modelos: **no publicado** (tablas en imagen).
- SL-S-EU: tensión, capacidad, DoD y química: **no publicado**.
- Datos contradictorios en la SL-RH/S-EU (4000 o 6000 ciclos, 1 o 10 años, IP20 o IP21): confirmar con el fabricante.

## 2. All-in-one híbridos (Hybrid ALL-IN-ONE, products-82939): inversor + batería, ampliación

### Takeaway
Hay 4 fichas: REVO HESS 6/8 kW (monofásico supuesto, en dos fichas), iHESS-M 1P (6 kW monofásico, IP65, módulo de 5,12 kWh de 48 V) e iHESS-M-H 3P (5–12 kW trifásico **para red de 400 V**, de 1 a 6 módulos, hasta 28,5 kWh, PV hasta 1000 V). Ningún equipo trifásico declara 3×220 V entre fases. Garantía: solo un genérico "2–5 años según producto".

### Cited Findings

| Modelo | Inversor | AC | PV | Batería | Ampliación | Otros |
|---|---|---|---|---|---|---|
| REVO HESS 6/8 kW | 6 kW / 8 kW, on/off-grid | Fase y tensión no publicadas en la ficha de Sorotec | No publicado en la ficha (ver ENF abajo) | LiFePO4; "5000Wh*2" (título), mientras la otra ficha dice 6/8 kWh | No publicado | 95 % de eficiencia pico, conmutación de 10 ms, BMS, app y monitoreo web; certificaciones CE (LVD/EMC), CUL, FCC, TÜV CB |
| iHESS-M 1P | 6 kW, híbrido, monofásico | Tensión no publicada | MPPT 90–500 VDC | LiFePO4, módulo **SL-M48100 de 5,12 kWh** (48 V × 100 Ah, o sea BT), carga y descarga de hasta 100 A | Cantidad de módulos no publicada | 97,5 % máx. y 97 % europea, <10 ms, IP65, Wi-Fi y Bluetooth, CE, VDE0124, G99, AFCI opcional |
| iHESS-M-H 3P | 5–12 kW, trifásico | "Compatible con redes trifásicas de 400 V", 50/60 Hz | 2 MPPT, hasta 1000 V, PV recomendado hasta 19,2 kW | LiFePO4, de 1 a 6 módulos, 4,75–28,5 kWh útiles, DoD ajustable 0–90 % | Modular hasta 6 módulos; paralelo no publicado | 98 %, <10 ms, IP65, <25 dB, BT/WiFi/4G/Ethernet, VDE-AR-N 4105, G99, EN 50549 |

- REVO HESS: 6/8 kW, "5000Wh*2", BMS, on/off-grid — [Sorotec REVO HESS](https://www.sorotecpower.com/products-detail-4776873); 6/8 kWh, 95 %, 10 ms, CE/CUL/FCC/TÜV CB — [Sorotec REVO HESS customized](https://www.sorotecpower.com/customized-revo-hess-hybrid-all-in-one-energy-storage-system-6-8kwh-manufacturers-from-china-sorotec.html)
- Una ficha de terceros (no se pudo abrir, devolvió 403; dato tomado del resumen del buscador) lista el "REVO HESS All-in-One 5.6/8 kW" de Shenzhen SORO Electronics con batería de 51,2 V y 100–200 Ah, 50 A de carga máxima y MPPT de 90–450 V, más un "max DC voltage 230 V" ambiguo — [ENF Solar REVO HESS](https://www.enfsolar.com/pv/storage-system-datasheet/12479)
- iHESS-M 1P — [Sorotec iHESS-M 1P](https://www.sorotecpower.com/best-single-phase-ip65-ihess-m-1p-integrated-energy-storage-system-6kw-5-12kwh-company-sorotec.html)
- iHESS-M-H 3P — [Sorotec iHESS-M-H 3P](https://www.sorotecpower.com/best-three-phase-ip65-energy-storage-inverter-ihess-m-h-3p-efficient-and-stable-company-sorotec.html)
- Garantía genérica de la empresa: "2-5 years warranty (depending on product)" — ídem fichas iHESS

### Inferences
- iHESS-M-H 3P: para "400 V trifásico" y PV de 1000 V, la batería probablemente sea de alta tensión, pero la tensión no está publicada. 4,75 kWh por módulo surge de dividir 28,5 kWh entre 6.
- El iHESS-M 1P usa batería de baja tensión de 48 V (por el nombre SL-M48100 y la corriente de 100 A).

### Gaps
- REVO HESS: tensión AC, fase, PV máximo, Voc, dimensiones, peso, IP y garantía: **no publicado** por Sorotec.
- iHESS-M 1P: tensión AC, PV máximo y cuántos módulos admite: **no publicado**.
- iHESS-M-H 3P: tensión de batería, paralelo y garantía específica: **no publicado**. No dice si funciona en 3×220 V entre fases (solo nombra 400 V).

## 3. UPS (products-23646): potencia, fases y tensiones de entrada

### Takeaway
Son 11 modelos, de 1 kVA a 800 kVA, en alta frecuencia (HP, MPS modulares) y baja frecuencia con transformador (GP, IPS). **Ningún UPS trifásico publica entrada de 3×220/230 V entre fases**: todos los que dan tensión nominal dicen 380/400/415 V trifásico 4 hilos. El HP9335C Plus está especificado fase-neutro (110–300 V F-N, salida de 208–240 V F-N), lo que corresponde a una red de 380/400 V con neutro. El MPS9335C II publica un rango de entrada de 138–485 V sin aclarar si es F-N o F-F.

### Cited Findings

| Modelo | Tecnología | Potencia | Fases (entrada/salida) | Tensión de entrada | Salida | Batería DC | Datos clave |
|---|---|---|---|---|---|---|---|
| HP9116C | HF online | 1–10 kVA | No publicado (monofásico supuesto) | No publicado | No publicado | No publicado | Paralelo N+X para 6–20K (hasta 3 unidades) |
| HP9116CR PLUS | HF online (rack/torre) | 1–10 kVA | 1/1 (el listado menciona opción de entrada trifásica) | "Super wide", sin valores | Regulación 1 % | Según autonomía | Hasta 94 %, ECO 98 %, FP de salida 0,9, hasta 3 en paralelo |
| HP9335C Plus | HF online, doble conversión real | 10/15/20/30 kVA (+XL) | 3/3 con neutro | 110 V F-N (50 % de carga) / 176 V F-N (100 %) hasta 300 V F-N | 208/220/230/240 V F-N | 18–20 baterías de 12 V; carga a 273 VDC | FP 0,9, N+X, transformador de aislamiento (listado) |
| MPS9335C | HF modular | 10–300 kVA, módulos de hasta 40 kW (1–10) | No publicado | No publicado | No publicado | Celdas configurables | >96 %, FP de entrada >0,99, THDi <3 %, 4 en paralelo |
| MPS9335C II | HF modular | 50–720 kVA | No publicado | 138–485 V, 40–70 Hz | No publicado | 32–44 baterías ajustables | >97 %, FP de salida 0,9 o 1 |
| GP9111C / GP9311C | LF online, "pure-online double conversion" | 6–15 kVA / 10–40 kVA | 1/1 o 3/1 | 220 V ±25 % (1F) o 380 V ±25 % trifásico 4 hilos (304–456 V); el texto dice 380/400/415 | 220 V | 192 V nominal | FP de salida 0,8 |
| GP9315C | LF online | 10–120 kVA | 3/1 | 380/400/415 VAC trifásico 4 hilos ±25 %, 45–65 Hz | 220/230/240 V monofásico | 360/384/432/480 VDC | 94 %, FP 0,9, 6 en paralelo; IEC 62040-1-1/-2/-3, UL1778 |
| GP9335C | LF online (AC-DC-AC) | 10–800 kVA (la tabla arranca en 120) | 3/3 | 380/400/415 V trifásico 4 hilos ±25 % | 380/400/415 V | 360/384/432/480 VDC | Rectificador de 6 o 12 pulsos, 6 en paralelo, IEC 62040, UL1778 |
| IPS9335(C) | Industrial | 10–160 kVA | 3/3, aislamiento total | 380/400/415 V ±20 % | 380/400/415 V | 384 VDC | Hasta 98 % (smart mode), EN 62040-1-1 |
| IPS9315C | Industrial (LF) | 10–120 kVA | 3/1 | 380/400/415 V ±20 % | 220/230/240 V | 220/384 VDC | Hasta 94 %, EN 62040-1-1 |
| "HF Online UPS with blue LCD" | HF online | No publicado | No publicado | No publicado | No publicado | No publicado | N+X 6–20K |

- Listado de UPS — [Sorotec UPS](https://www.sorotecpower.com/products-23646)
- HP9116CR PLUS — [ficha](https://www.sorotecpower.com/products-detail-133804); HP9116C — [ficha](https://www.sorotecpower.com/products-detail-133802)
- HP9335C Plus (110–300 VAC F-N, salida de 208–240 VAC F-N, doble conversión real) — [ficha](https://www.sorotecpower.com/products-detail-134112)
- MPS9335C — [ficha](https://www.sorotecpower.com/products-detail-134111); MPS9335C II (138–485 V) — [ficha](https://www.sorotecpower.com/products-detail-167417)
- GP9111C — [ficha](https://www.sorotecpower.com/products-detail-133795); GP9315C — [ficha](https://www.sorotecpower.com/products-detail-133796); GP9335C — [ficha](https://www.sorotecpower.com/products-detail-134115)
- IPS9335C — [ficha](https://www.sorotecpower.com/products-detail-134114); IPS9315C — [ficha](https://www.sorotecpower.com/products-detail-134116)

### Inferences
- Para una red trifásica de 3×220 V entre fases sin neutro, como en parte de Uruguay, **ningún UPS trifásico de Sorotec está publicado como apto**. Todos piden 380/400/415 V con neutro. Usar uno exigiría un transformador elevador, o confirmar con fábrica si el MPS9335C II (con rango de 138–485 V) admite esa configuración.
- Para cargas monofásicas, los HP9116C y HP9116CR PLUS (1/1, 1–10 kVA) y el GP9111C (220 V 1F) sirven en 230 V F-N.

### Gaps
- Garantía de los UPS: **no publicado** en ninguna ficha.
- Certificaciones de los UPS HF (HP, MPS): **no publicado**. Los GP e IPS listan normas IEC/EN 62040.
- Tensión de batería de los HP9116: "se elige según capacidad" (no publicado).

## 4. Telecom Power Solutions (products-23647): resumen

### Takeaway
Hay 5 fichas de sistemas solares outdoor de 48 VDC para estaciones base (SHW48200/48250/48500, con rectificador y MPPT incorporados) y un gabinete de almacenamiento SES de 100–215 kWh (IP55, PCS de 100/120/180 kW). Casi sin especificaciones publicadas.

### Cited Findings
- Listado: SHW48500 (dos fichas), SHW48250 (dos fichas), SHW48200 (48 VDC, MPPT híbrido de 10–200 A) y SES (100–215 kWh, IP55, PCS de 100/120/180 kW, ampliable en paralelo) — [Sorotec Telecom](https://www.sorotecpower.com/products-23647)
- SHW48500: 48 VDC, rectificador incorporado, eficiencia MPPT >97 %, gabinete IP55 galvanizado, monitoreo remoto. Corriente MPPT, PV y certificaciones no publicadas — [ficha](https://www.sorotecpower.com/products-detail-167409)

### Inferences
- Línea orientada a telecom e industria. Para residencial y comercial en Uruguay no aplica salvo sitios aislados de 48 VDC.

### Gaps
- Especificaciones del SES (química, tensión, certificaciones) y de los SHW: **no publicado**. Contacto del fabricante: ella@soroups.com, +86-755-81495850 (según las fichas).
