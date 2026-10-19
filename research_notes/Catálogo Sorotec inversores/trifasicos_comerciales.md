# Sorotec (Shenzhen SORO Electronics): inversores trifásicos y comerciales — lado AC y compatibilidad con red 3x230 V sin neutro (Uruguay)

Relevado el 18-oct-2026. Fuentes: sorotecpower.com (tablas de parámetros publicadas como **imágenes**, leídas una por una), soropower.com (sitio WordPress de la misma empresa) y búsquedas generales. Ningún sitio ofrece PDF descargable; las hojas de datos son imágenes JPG/PNG embebidas en la página. Fabricante según los certificados CE publicados: "Shenzhen SORO Electronics Co., Ltd", Bao'an, Shenzhen ([certificado LVD en la página del iHESS L3P G2](https://img.yfisher.com/tos/video-website/1048/file_01767510526362.jpg)).

Catálogo trifásico/comercial que existe hoy en sorotecpower.com (se listaron los títulos de las 23 fichas de producto del sitio; los únicos trifásicos o comerciales son estos 5):

| Ficha | Producto |
|---|---|
| products-detail-5081650 | iHESS L3P G2 6–12 kW, IP66 |
| products-detail-5079189 | iHESS L3P G2 "10/15 kW", IP66 |
| products-detail-5080104 | REVO HMT IP54 L3P G2 6–12 kW |
| products-detail-4776869 | iHESS-3P 5–12 kW (batería de alta tensión), IP65 |
| products-detail-4776905 | MPGS 50–600 kW (comercial/industrial) |

El resto del catálogo de sorotecpower.com es monofásico (REVO VP/VM/HM/HES, VM II PRO US 120 V, MPI) o split-phase (REVO HMT L2P G2 IP21 e IP54, iHESS L2P G2) — [listado de títulos obtenido de las fichas products-detail-* de sorotecpower.com](https://www.sorotecpower.com/products). **No existe en el catálogo una "REVO HMT L3P G2 IP21"**: la versión IP21 solo aparece en split-phase (L2P), [ficha 5079922](https://www.sorotecpower.com/products-detail-5079922).

---

## 1. Tensión de red AC, rango y conexionado de cada modelo (la pregunta central)

### Takeaway
**Ningún trifásico de Sorotec funciona en una red 3x230 V entre líneas sin neutro.** Todos están especificados para 380/400/415 V entre líneas con conexión **3W+N+PE** (neutro obligatorio), y el piso del rango de red publicado (305 V en la serie L3P G2; 360 V en el iHESS-3P; ≈323 V en el MPGS) está muy por encima de 230 V. No se encontró ninguna variante de baja tensión trifásica (tipo "LP3 220 V" de Deye/Sunsynk) ni oferta publicada de fabricarla.

### Cited Findings
- **iHESS L3P G2 (6/8/10/12 kW)**: rango de tensión de red 305~485 V; frecuencia 50/60 Hz; "AC output topology: 3W+N+PE"; salida UPS 380/400/415 V; corriente máx. de salida 9,6 / 12,7 / 15,9 / 19,1 A — [hoja de datos (imagen) en la ficha 5081650](https://img.yfisher.com/tos/video-website/1048/file_01766040331773.jpg); la misma tabla está en [soropower.com (iHESS-L3P-G2_page-0002)](https://www.soropower.com/wp-content/uploads/2025/12/iHESS-L3P-G2_page-0002.jpg) (URL de imagen encontrada en el HTML de [soropower.com/product/5223](https://www.soropower.com/product/5223/); no se abrió esa copia, se leyó la de sorotecpower.com).
- **REVO HMT IP54 L3P G2 (6/8/10/12 kW)**: rango de red 305~485 V; 50/60 Hz; 3W+N+PE; salida UPS 380/400/415 V; mismas corrientes 9,6 / 12,7 / 15,9 / 19,1 A. La hoja es la página 31/32 de un catálogo titulado "Three-phase hybrid energy storage inverter" — [soropower.com, HMT-IP54-L3P-G2_page-002.jpg](https://www.soropower.com/wp-content/uploads/2025/12/HMT-IP54-L3P-G2_page-002.jpg) (enlazada desde [la ficha del producto en soropower.com](https://www.soropower.com/product/three-phase-ip54-revo-hmt-ip54-l3p-g2-hybrid-energy-storage-inverter-6-12kw/)). La ficha de sorotecpower.com (5080104) no muestra tensión de red: solo foto del equipo y texto de marketing — [ficha 5080104](https://www.sorotecpower.com/products-detail-5080104).
- **iHESS L3P G2 "10/15 kW"**: el texto habla de "stable 380VAC industrial-grade output", trifásico — [ficha 5079189](https://www.sorotecpower.com/products-detail-5079189). La única hoja de datos publicada en esa ficha es **la de 6–12 kW** (idéntica a la de 5081650: 305~485 V, 3W+N+PE) — [imagen en ficha 5079189](https://img.yfisher.com/tos/video-website/1048/file_11764907907093.jpg).
- **iHESS-3P (5/6/8/10/12 kW)**: "Grid voltage/range(V): 400/360~400"; 50/60 Hz; "AC output topology: 3W+N+PE"; salida UPS 380/400/415 V con corrientes 13,1/12,5/12 – 15,8/15/14,4 – 21/20/19,2 – 26,3/25/24 – 31,5/30/28,9 A (por tensión, para 5…12 kW) — [tabla parte 1](https://img001.video2b.com/1048/file_31721273121997.jpg), [tabla parte 2](https://img001.video2b.com/1048/file_41721273121997.jpg) de la [ficha 4776869](https://www.sorotecpower.com/products-detail-4776869). El diagrama de bloques del mismo producto dibuja la salida de red y de carga como "L / N" (simplificado) — [diagrama](https://img001.video2b.com/1048/file_21721273121997.jpg).
- **MPGS (60/120/180/240/300/480/600 kVA)**: "Allowable Grid Voltage: 380/400(±15%)VAC"; "Allowable Grid Frequency: 50/60(±2.5)Hz"; "Wiring method: three-phase four-wire"; "Isolation transformer: Optional" — [tabla MPGS](https://img001.video2b.com/1048/file_21721284410578.jpg) de la [ficha 4776905](https://www.sorotecpower.com/products-detail-4776905). El diagrama de aplicación muestra PCS-AC → transformador de aislamiento → carga L1/L2/L3/N y red U/V/W (red de 3 hilos, la carga con N) — [diagrama MPGS](https://img001.video2b.com/1048/file_11721284410578.jpg).
- **Gabinete SES 100–215 kWh (C&I, soropower.com)**: "380/400VAC Grid", batería 670–1000 VDC, MPPT 200–850 VDC, IP55 — [ficha SES en soropower.com](https://www.soropower.com/product/ses-integrated-energy-storage-system-ip55-outdoor-cabinet-100-215kwh-capacity-40c-to-55c-wide-temperature-sorotec/). Potencia del PCS y conexionado: no publicados.
- **iHESS-M-H 3P (todo-en-uno trifásico)**: figura como categoría en el menú de soropower.com, pero la categoría está vacía ("No posts found") — [categoría iHESS-M-H 3P](https://www.soropower.com/product-category/solar-inverter/all-in-one-ess/ihess-m-h-3p/). No aparece en sorotecpower.com ni en búsquedas web. **No publicado.**
- Búsquedas de una versión trifásica de 220 V / baja tensión ("Sorotec trifásico 220V", "iHESS three phase 220V", "REVO HMT L3P") no devolvieron ninguna ficha ni distribuidor (los resultados eran de otras marcas o de monofásicos Sorotec de 230 V, p. ej. [Gennex](https://gennextechnologies.com/sorotec-solar-inverters/)); tampoco hay mención a variantes de tensión a pedido en ninguna de las 5 fichas de Sorotec leídas.

### Inferences
- En una red uruguaya 3x230 V entre líneas: (a) no hay neutro para el 3W+N+PE que exigen todos los modelos; (b) 230 V entre líneas queda 75 V por debajo del mínimo de 305 V de la serie L3P G2 y 130 V por debajo del de iHESS-3P, por lo que el equipo dispararía por subtensión de red. Ninguno es apto conectado directo.
- La única vía técnicamente plausible es **intercalar un transformador** 3x230 V Δ → 400/230 V Yn (que además crea el neutro). Para el MPGS, Sorotec ya lista un transformador de aislamiento opcional, así que un pedido con primario a 230 V parece negociable, pero **no está publicado**: habría que pedirlo por escrito al fabricante (contacto de las fichas: ella@soroups.com, +86-755-81495850).
- Para esa red, la alternativa con equipos Sorotec sería usar inversores **monofásicos de 230 V conectados entre dos líneas** (lo habitual en Uruguay); eso queda fuera de este capítulo (ver notas de monofásicos). Un distribuidor nigeriano dice que el REVO HM monofásico se puede armar en trifásico con 3 o 6 unidades ([Gennex](https://gennextechnologies.com/sorotec-revo-hm-6-kva-hybrid-inverter/)), pero eso supone estrella con neutro, no triángulo de 230 V: no verificado para red sin neutro.

### Gaps
- Si Sorotec fabrica a pedido una versión 3x220/230 V L-L (no publicada; requiere consulta directa).
- Ficha y hoja de datos del iHESS-M-H 3P: no existen en línea.
- Comportamiento de los equipos en sistema IT (sin referencia a tierra): no publicado; todos son "transformerless" (sin transformador) en la serie L3P G2 e iHESS-3P ("Isolation transformer: No").

---

## 2. Tabla de especificaciones completa por modelo

### Takeaway
Hay dos familias de 48 V (iHESS L3P G2 IP66 y REVO HMT IP54 L3P G2, mismo electrónico con distinta caja), una de alta tensión de batería (iHESS-3P, 125–600 V) y una comercial (MPGS, batería 620–1000 V). Las cuatro primeras son 380/400 V 3W+N+PE.

### Cited Findings

**Serie de 48 V: iHESS L3P G2 (IP66) y REVO HMT IP54 L3P G2** — fuentes: [hoja iHESS L3P G2](https://img.yfisher.com/tos/video-website/1048/file_01766040331773.jpg), [hoja REVO HMT IP54 L3P G2](https://www.soropower.com/wp-content/uploads/2025/12/HMT-IP54-L3P-G2_page-002.jpg)

| Parámetro | iHESS L3P G2 | REVO HMT IP54 L3P G2 |
|---|---|---|
| Potencia nominal | 6 / 8 / 10 / 12 kW | 6 / 8 / 10 / 12 kW |
| Pico off-grid | 2× nominal, 10 s | 2× nominal, 10 s |
| Eficiencia máx. / europea | 97,5 % / 97 % | 97,5 % / 97 % |
| FV potencia máx. | 9 / 12 / 15 / 18 kW | 9 / 12 / 15 / 18 kW |
| FV Vdc máx. | 800 V | 800 V |
| Rango MPPT | 200–650 V | 200–650 V |
| Corriente por MPPT | 40 + 20 A | 22 + 22 A |
| MPPT / strings | 2 / 2+1 | 2 / 1+1 |
| Red: rango de tensión | 305–485 V | 305–485 V |
| Red: frecuencia | 50/60 Hz | 50/60 Hz |
| FP | 0,8 ind.–0,8 cap. | 0,8 ind.–0,8 cap. |
| THDi | <3 % | <3 % |
| Conexionado AC | 3W+N+PE | 3W+N+PE |
| Corriente máx. salida (red) | 9,6 / 12,7 / 15,9 / 19,1 A | 9,6 / 12,7 / 15,9 / 19,1 A |
| Batería: rango | 40–60 V | 40–60 V |
| Carga/descarga máx. | 150 / 180 / 220 / 260 A | 150 / 180 / 220 / 260 A |
| Tipo de batería | Litio / plomo-ácido | Litio / plomo-ácido |
| Salida UPS (respaldo) | 380/400/415 V, mismas corrientes, <10 ms, THDu <3 % | idem |
| Protecciones | anti-isla, sobrecorriente DC, monitoreo de aislación, corriente residual, AFCI opcional, sobrecorriente/sobretensión AC, sobretemperatura | idem |
| Paralelo | 6 unidades | 6 unidades |
| IP | IP66 | IP54 |
| Temperatura | −25~60 °C, derateo >45 °C | −25~60 °C, derateo >45 °C |
| Altitud | derateo >2000 m | derateo >2000 m |
| Medidas (mm) | 440×260×700 | 445×130×620 |
| Peso | 39 kg | 27 kg |
| Topología | sin transformador | sin transformador |
| Autoconsumo | <5 W | <5 W |
| Comunicación | RS485, CAN, DRM; WiFi | RS485, CAN, DRM; WiFi |
| Norma de seguridad | EN/IEC 62109-1, EN/IEC 62109-2 | EN/IEC 62109-1, EN/IEC 62109-2 |
| Garantía | 5 años (título de la ficha) — [ficha 5081650](https://www.sorotecpower.com/products-detail-5081650) | "2 a 10 años según producto" (texto genérico) — [ficha 5080104](https://www.sorotecpower.com/products-detail-5080104) |

- Desbalance: "100% phase-to-phase imbalance", cada fase hasta el 50 % de la potencia nominal — [ficha 5081650](https://www.sorotecpower.com/products-detail-5081650); igual en REVO HMT IP54 L3P G2 ("single-phase loads can reach 50% of rated power") — [ficha 5080104](https://www.sorotecpower.com/products-detail-5080104).
- Entrada para cargar desde grupo electrógeno (diésel) — [ficha 5081650](https://www.sorotecpower.com/products-detail-5081650).

**iHESS L3P G2 "10/15 kW"** — [ficha 5079189](https://www.sorotecpower.com/products-detail-5079189)
- 10 y 15 kW, pico hasta 30 kW; salida "380VAC"; desbalance con control independiente por fase; **paralelo hasta 15 unidades, mezclando potencias, 225 kW**; IP66; −25~60 °C; baterías litio/plomo/sodio con detección CAN/RS485; "garantía de 10 años en componentes críticos".
- FV, batería, eficiencia, peso, certificaciones: **no publicados** (la hoja adjunta es la de 6–12 kW).

**iHESS-3P (batería de alta tensión)** — [tabla parte 1](https://img001.video2b.com/1048/file_31721273121997.jpg), [parte 2](https://img001.video2b.com/1048/file_41721273121997.jpg), [parte 3](https://img001.video2b.com/1048/file_51721273121997.jpg), [portada](https://img001.video2b.com/1048/file_01721273121997.jpg)

| Parámetro | Valor |
|---|---|
| Potencia nominal | 5 / 6 / 8 / 10 / 12 kW |
| Eficiencia máx. / europea | 98,00 % / 98 % |
| FV potencia máx. | 7,5 / 9 / 12 / 15 / 18 kW |
| FV Vdc máx. | 1000 V |
| Rango MPPT | 120–900 V |
| Corriente por MPPT | 16 / 16 A |
| MPPT / strings | 2 / 1 |
| Red | 400 V, rango 360~400 V, 50/60 Hz, FP 0,8–0,8, THDi <3 % |
| Conexionado | 3W+N+PE |
| Corriente máx. salida | 8 / 6,8 / 12,7 / 15,9 / 19,1 A |
| Batería | 125–600 V; nominal 300 V; carga máx. 600 V; 40 A carga/descarga; litio/plomo |
| Salida UPS | 380/400/415 V; <10 ms; THDu <2 %; sobrecarga 110 % 30 s / 120 % 10 s / 150 % 0,02 s |
| Protecciones | anti-isla, sobrecorriente DC, aislación, corriente residual, AFCI (sí), sobrecorriente/sobretensión AC, sobretemperatura |
| IP / temp. | IP65 / −25~60 °C, refrigeración natural |
| Medidas / peso | 570×210×475 mm / 28,5 kg |
| Transformador de aislación | No |
| Comunicación | LCD; RS485, CAN, DRM; opcional WiFi, Bluetooth |
| Normas | CE-EMC EN IEC 61000-6-3:2021, EN IEC 61000-6-1:2019; CE VOC IEC 62109-1:2010, IEC 62109-2:2011, IEC 62477-1:2022; CoC VDE 4105:2018; VDE 0124:2020; CoC CEI 0-21:2022; CoC TOR Typ A/B:2022; OVE R25:2020; G98:2022; G99:2022 |
| Garantía | 5 años (portada) |
| Paralelo | puerto de paralelo presente (A6/A7) — [características](https://img001.video2b.com/1048/file_11721273121997.jpg); cantidad no publicada |
| CT/medidor | puerto "Meter/CT" (A3) — [características](https://img001.video2b.com/1048/file_11721273121997.jpg) |

**MPGS (comercial/industrial, "50–600 kW")** — [tabla AC/DC](https://img001.video2b.com/1048/file_21721284410578.jpg), [tabla sistema](https://img001.video2b.com/1048/file_31721284410578.jpg)

| Parámetro | Valor |
|---|---|
| Potencia AC | 60 / 120 / 180 / 240 / 300 / 480 / 600 kVA |
| Red | 380/400 V ±15 %, 50/60 Hz ±2,5 Hz, THDi ≤3 %, FP 0,99 / −1~1 |
| Conexionado | trifásico cuatro hilos; transformador de aislación opcional |
| Batería | 620–1000 VDC; carga máx. 176 / 352 / 528 / 704 / 880 / 1408 / 1760 A |
| FV | Vdc máx. 1000 V (el texto de la ficha dice "hasta 900 V"); potencia FV = potencia nominal (60…600 kW); MPPT 200–850 V |
| Protecciones | seccionador DC, anti-isla, sobrecorriente de salida, DPS tipo II DC y AC, test de aislación, corriente de fuga |
| Eficiencia máx. | 98 % |
| Medidas / peso | 800×800×2160 mm (60–180 kVA) y 1600×800×2160 mm (240–600 kVA) / 465 a 1800 kg |
| IP / temp. | IP20 (interior) / "−20 °C" (sin máximo publicado), ≤3000 m, ruido <75 dB |
| Comunicación | pantalla táctil, RS485/LAN, BMS/EMS |
| Conmutación off-grid | <10 ms (texto de la ficha) |
| Certificaciones del producto / garantía | no publicadas |

### Inferences
- Las corrientes de 9,6–19,1 A de la serie L3P G2 equivalen a P/(√3·~363 V), consistente con operación a 380–400 V entre líneas, no a 230 V.
- REVO HMT IP54 L3P G2 e iHESS L3P G2 tienen el mismo electrónico (tablas idénticas salvo MPPT, IP, medidas y peso); conviene tratarlas como una sola plataforma.

### Gaps
- Inyección cero / limitación de exportación y tipo de medidor/CT (monofásico o trifásico) para la serie L3P G2: no publicado en las hojas leídas (solo la iHESS-3P muestra puerto Meter/CT).
- Certificaciones de red (VDE 4105, EN 50549, G99, etc.) para la serie L3P G2: no publicadas; la hoja solo lista IEC 62109-1/-2.

---

## 3. Inconsistencias entre los sitios y fichas de Sorotec

### Takeaway
La información es irregular: fichas sin tabla, una ficha que adjunta la hoja de otro modelo, certificados de equipos monofásicos mostrados en la ficha trifásica y cifras internas que no cierran.

### Cited Findings
- La ficha del iHESS L3P G2 "10/15 kW" adjunta la hoja de datos de 6–12 kW — [ficha 5079189](https://www.sorotecpower.com/products-detail-5079189) vs [imagen adjunta](https://img.yfisher.com/tos/video-website/1048/file_11764907907093.jpg).
- Paralelo: la hoja de la serie L3P G2 dice "6 Units" y soropower.com cita "72 kW con 6 unidades" ([soropower.com/product/5223](https://www.soropower.com/product/5223/)); la ficha 10/15 kW dice "hasta 15 unidades, 225 kW" ([ficha 5079189](https://www.sorotecpower.com/products-detail-5079189)).
- Garantía de la serie L3P G2: "5 años" en el título de la ficha 6–12 kW ([5081650](https://www.sorotecpower.com/products-detail-5081650)) vs "10 años en componentes críticos" en la de 10/15 kW ([5079189](https://www.sorotecpower.com/products-detail-5079189)).
- Los certificados CE (EMC y LVD) que se muestran en la ficha del iHESS L3P G2 trifásico son de modelos **monofásicos** REVO III 8 kW y REVO VM II 8 kW (2022) — [CE EMC](https://img.yfisher.com/tos/video-website/1048/file_01767510413453.jpg), [CE LVD](https://img.yfisher.com/tos/video-website/1048/file_01767510526362.jpg). No hay certificado publicado del propio equipo trifásico.
- iHESS-3P: rango de red "400/360~400" (el máximo coincide con la nominal, sin margen hacia arriba) y corriente máxima de 6,8 A para 6 kW, menor que los 8 A del de 5 kW — [tabla parte 1](https://img001.video2b.com/1048/file_31721273121997.jpg). Probables errores de tipeo.
- MPGS: el texto dice "PV hasta 900 V" ([ficha 4776905](https://www.sorotecpower.com/products-detail-4776905)) y la tabla dice 1000 VDC ([tabla](https://img001.video2b.com/1048/file_21721284410578.jpg)); el título dice "50–600 kW" y la tabla empieza en 60 kVA.
- REVO HMT IP54 L3P G2: la ficha describe la eficiencia de 97,5 % como "lado DC" en un párrafo y como pico en otro — [ficha 5080104](https://www.sorotecpower.com/products-detail-5080104).
- soropower.com muestra en su menú la categoría iHESS-M-H 3P, pero está vacía — [categoría](https://www.soropower.com/product-category/solar-inverter/all-in-one-ess/ihess-m-h-3p/).
- En un foro alemán, un usuario dice que un Sorotec más viejo (Revo II) solo mide una fase con su pinza — [akkudoktor.net](https://akkudoktor.net/t/netzparallel-wr/841?page=2) (opinión de usuario, modelo monofásico; no verificado para los trifásicos).

### Inferences
- Para un pedido real, exigir al fabricante la hoja de datos firmada del modelo exacto, los certificados de ese modelo (no de la empresa ni de otros equipos) y la confirmación por escrito de tensión de red y conexionado.

### Gaps
- No se encontraron distribuidores de los trifásicos de Sorotec en Latinoamérica ni listados en made-in-china/Alibaba con hojas de datos distintas (las búsquedas no devolvieron resultados de Sorotec trifásico).
