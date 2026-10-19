# Sorotec (Shenzhen Soro Electronics): inversores híbridos monofásicos, tabla de especificaciones

Relevado el 18-oct-2026. Fuente principal: las **tablas de especificaciones oficiales de Sorotec**, que en sorotecpower.com están como **imágenes** dentro de cada ficha de producto (no como texto) y se leyeron una por una. El texto de las fichas trae muy pocos números. En soropower.com las pestañas "Specifications" y "Downloads" están vacías, salvo una captura con la tabla del VM V. No se encontró ningún PDF de datasheet ni de manual oficial descargable. Los valores que no aparecen en ninguna fuente figuran como "no publicado".

Abreviaturas de fuentes (se citan en cada dato):
- [VMV] tabla en imagen de soropower.com: https://www.soropower.com/product/revo-vm-v-hybrid-on-off-grid-energy-storage-inverter (imagen `wp-content/uploads/2025/10/ScreenShot_2025-10-25_171531_027.png`). Ficha de sorotecpower: https://www.sorotecpower.com/products-detail-5068206
- [HMTPRO-G2] https://www.sorotecpower.com/products-detail-5079914 (tabla en imagen, página "Energy Storage Inverter 21/22")
- [HMT-L1P-G2] https://www.sorotecpower.com/products-detail-5079918 (tabla en imagen)
- [HMT-IP54-L1P-G2] https://www.sorotecpower.com/products-detail-5080097 (tabla en imagen, "Single-phase hybrid energy storage inverter 27/28")
- [HMT-G2-IP54] https://www.sorotecpower.com/products-detail-5080110 (folleto en imagen con tabla)
- [HES-IP66] https://www.sorotecpower.com/products-detail-5080326 (tabla en imagen con REVO HES 6/8/10 + REVO HES-G2 6 kW, "Energy Storage Inverter IP66 23/24")
- [HES-G2] https://www.sorotecpower.com/products-detail-5044903 (folleto en imagen + texto)
- [HES-8-IP65] https://www.sorotecpower.com/products-detail-5056664 (solo texto)
- [HES-old] https://www.sorotecpower.com/products-detail-4776463 (tabla en imagen, REVO HES 6/8 kW, versión IP65)
- [iHESS-L1P-G2] https://www.sorotecpower.com/products-detail-5081640 (tabla en imagen)
- [iHESS-1P] https://www.sorotecpower.com/products-detail-5082453 (tabla en imagen, "Energy Storage Inverter IP65 27/28"); listado anterior: https://www.sorotecpower.com/products-detail-4776475
- [VMIV] https://www.sorotecpower.com/products-detail-4776382 (tabla en imagen)
- [VMIV-PRO-T] https://www.sorotecpower.com/products-detail-4776360 (tabla en imagen)
- [HMT-old] https://www.sorotecpower.com/products-detail-4776415 (tabla en imagen, "REVO HMT series", ficha titulada IP54)
- [HM] https://www.sorotecpower.com/products-detail-1076685 (tabla en imagen)
- [REVO-II] https://www.sorotecpower.com/products-detail-134126 (texto)
- [REVO-III] https://www.sorotecpower.com/products-detail-134125 (texto + diagrama de paralelo en imagen)
- Listado del catálogo: https://www.sorotecpower.com/products-23651, https://www.sorotecpower.com/products-23651-list-2, https://www.sorotecpower.com/products-23651-list-3

---

## 1. Qué modelos monofásicos híbridos hay hoy en el catálogo

### Takeaway
El catálogo actual (páginas 1 a 3 de "Hybrid Solar Inverter") tiene **11 familias monofásicas** de 230 V. Se pueden agrupar en dos "plataformas":
1. **Tipo Voltronic/Axpert**: inversor-cargador off-grid con inyección opcional, 93 % de eficiencia, conmutación de 10 a 20 ms, 48 V. Son el VM IV, el VM IV PRO-T, el VM V, el HM, el HMT, el HMT PRO/G2 y el HMT G2-IP54.
2. **Tipo híbrido "de red"**: sin transformador, 97,5 % de eficiencia, con anti-isla, monitoreo de aislación y RCMU, menos de 10 ms. Son el HES / HES-G2, el iHESS 1P, el iHESS L1P G2, el HMT L1P G2 y el HMT IP54 L1P G2.

Apareció una familia que no estaba en la lista del encargo: **REVO HMT L1P G2 (6/8/10/12 kW, IP21)**, y también el **HMT IP54 L1P G2**, que es la misma tabla con IP54.

### Cited Findings
- Página 1 del listado de híbridos: iHESS 1P 3.6–6 kW; iHESS L1P G2 8–12 kW (IP66); REVO HMT PRO/G2 4–11 kW; REVO HES 8 kW IP65; REVO HES-G2 6/8/10 kW; REVO VM V 6/8/11 kW; REVO VM IV 4/6/11 kW; REVO VM IV PRO-T; REVO HMT 4/6/8 kW IP54. También aparecen los trifásicos iHESS L3P G2 y HMT IP54 L3P G2 — [listado p.1](https://www.sorotecpower.com/products-23651)
- Página 2: REVO HES 6/8 kW (monofásico); REVO HES IP66 6/8/10 kW (monofásico); **REVO HMT IP54 L1P G2 6–12 kW**; **REVO HMT L1P G2 6–12 kW**; REVO HMT G2-IP54 4–11 kW; iHESS 1P IP65 3.6–6 kW; REVO HM 2.5/4/6 kW; REVO HES 6 kW IP65; REVO VM IV 3.6/5.6 kW (120 A MPPT). Trifásicos: iHESS-3P, HMT L3P G2 — [listado p.2](https://www.sorotecpower.com/products-23651-list-2)
- Página 3: REVO VM IV 8 kW (2 MPPT), iHESS 1P 3.6–6 kW IP65 (ficha vieja), REVO HMT 4/6 kW (ficha vieja) — [listado p.3](https://www.sorotecpower.com/products-23651-list-3)
- REVO II (3–5.5 kW) y REVO III (8 kW) siguen con ficha publicada, pero no figuran en las 3 páginas del listado de híbridos — [REVO-II](https://www.sorotecpower.com/products-detail-134126), [REVO-III](https://www.sorotecpower.com/products-detail-134125)
- Hay variantes **split-phase 120/240 V** (iHESS L2P G2, HMT L2P G2, HMT IP54 L2P G2), que quedan fuera del alcance porque no sirven en Uruguay — [iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851), [HMT L2P G2](https://www.sorotecpower.com/products-detail-5079922)

### Inferences
- VM IV, VM IV PRO-T, HM y HMT tienen las mismas medidas típicas de la plataforma Voltronic Axpert (434×311×126.5 mm), la misma eficiencia del 93 % y los mismos 500 Voc / 60–450 V. Un revendedor pakistaní vende el "Triex Axpert VM IV" con los mismos números. Probablemente sean OEM de Voltronic Power o clones de esa plataforma. Esto no está confirmado — [búsqueda: Triex Axpert VM IV](https://w11stop.com/triex-axpert-vm-iv-pv6000-hybrid-solar-inverter-price-in-pakistan)
- REVO II y REVO III parecen discontinuados o legacy, porque ya no están en el listado de híbridos.

### Gaps
- Sorotec no publica un catálogo PDF completo. Las imágenes de las tablas tienen numeración de página ("21/22", "23/24", "27/28"), así que existe un catálogo, pero no se encontró en línea.

---

## 2. Tablas de especificaciones por modelo

### Takeaway
Hay tablas oficiales completas para casi todos los modelos actuales. Las diferencias clave para elegir son estas:
- Batería: **48 V** en todos. HM, VM IV 4 kW, PRO-T 4 kW y HMT G2-IP54 4 kW tienen variantes de 12/24 V.
- Ventana MPPT: **60–450 V** en la plataforma Voltronic; **90/120/125–450/500 V** en la plataforma híbrida. Voc máximo de **500 V en todos**.
- Paralelo: **6 equipos** en casi todos (en el REVO II, 9).
- Certificación de red: **solo el iHESS 1P** declara normas de conexión a red (VDE 4105, CEI 0-21, TOR, G98/G99). El resto declara solamente seguridad IEC 62109-1/-2.

### A) Plataforma tipo Voltronic (eficiencia 93 %, conmutación 10/20 ms)

**REVO VM V (6 / 8 / 11 kW)** — fuente [VMV], salvo indicación
| Dato | 6 kW | 8 kW | 11 kW |
|---|---|---|---|
| Potencia nominal | 6000 VA/6000 W | 8000 VA/8000 W | 11000 VA/11000 W |
| Surge | 12000 | 16000 | 22000 (unidad no indicada, VA/W) |
| Entrada AC nominal / rango | 230 VAC; 170–280 VAC (rango angosto) / 90–280 VAC (rango ancho); 50/60 Hz | ídem | ídem |
| Salida AC | 220/230/240 VAC seleccionable, senoidal pura, 50/60 Hz | ídem | ídem |
| Eficiencia | 93 % máx. | | |
| Conmutación | 10 ms típico (angosto) / 20 ms (ancho) | | |
| Batería | 48 V nominal; flotación 54 V; protección por sobrecarga 63 V; litio y plomo-ácido | | |
| Voc FV máx. | 500 VDC | | |
| FV máx. | 8000 W (4000×2) | 11000 W (5500×2) | 13000 W (6500×2) |
| MPPT | 2; 60–450 VDC | | |
| Corriente por MPPT | 15 A ×2 | 27 A ×2 (máx. 40 A total) | 27 A ×2 (máx. 40 A total) |
| Carga solar / AC / total máx. | 120 / 120 / 120 A | 120 / 120 / 120 A | 150 / 150 / 150 A |
| Paralelo | hasta 6 equipos. La ficha de sorotecpower agrega "6×11 kW = 66 kW", la mezcla de 6 y 11 kW y el maestro/esclavo automático ([ficha](https://www.sorotecpower.com/products-detail-5068206)) | | |
| Comunicación | Estándar RS232, CAN y RS485; opcional WiFi y Bluetooth. BMS por RS485/CAN | | |
| Display | LCD color de 4.3" según la tabla; la ficha de sorotecpower dice pantalla táctil de 5" (**conflicto**) | | |
| Temperatura | -10 a 50 °C; humedad 5–90 % | | |
| Peso | 18 kg | 19.6 kg | 19.9 kg |
| Dimensiones (P×A×H) | 458×400×130 mm | 603×440×160 | 603×440×160 |
| IP | no publicado en la tabla (un revendedor dice IP66, sin respaldo oficial) | | |
| Certificación | no publicada en la tabla | | |
| Garantía | no publicada | | |
| Inyección / CT | no figura en la tabla. La ficha dice "on & off-grid" | | |

**REVO HMT PRO (4/6 kW) y REVO HMT G2 (6/8/11 kW)** — [HMTPRO-G2]
| Dato | PRO 4 kW | PRO 6 kW | G2 6 kW | G2 8 kW | G2 11 kW |
|---|---|---|---|---|---|
| Entrada AC | 220/230/240 VAC; 170–280 (PC) / 90–280 VAC (electrodomésticos); 50/60 Hz autodetección | | | | |
| Surge | 8000 VA | 12000 VA | 12000 VA | 16000 VA | 22000 VA |
| Salida (modo batería) | 220/230/240 VAC ±5 %; 50/60 Hz | | | | |
| Eficiencia pico / conmutación | 93 %; 10 ms (PC) / 20 ms (electrodomésticos) | | | | |
| Batería | 48 VDC; flotación 54 V; protección por sobrecarga 63 V; litio/plomo | | | | |
| Voc máx. | 500 VDC | | | | |
| FV máx. | 5000 W | 7000 W | 8000 W (4000×2) | 11000 W (5500×2) | 13000 W (6500×2) |
| MPPT | 1; 60–450 V; 27 A | 1; 60–450 V; 27 A | 2; 60–450 V; 27 A×2 (máx. 40 A) | ídem | ídem |
| Carga solar / AC / total | 120 / 100 / 120 A | 120 / 100 / 120 A | 120 / 100 / 120 A | 120 / 120 / 120 A | 150 / 150 / 150 A |
| Puerto de generador | NO | NO | NO | Sí | Sí |
| On-grid | Sí | | | | |
| Paralelo | Sí, 6 equipos | | | | |
| CT anti-inyección | Sí (opcional) | | | | |
| Doble salida | gestión inteligente de cargas, sí | | | | |
| Temperatura | -10 a 50 °C | | | | |
| Dimensiones (P×A×H) | 470×320×125 | 470×320×125 | 520×420×128 | 603×440×141 | 603×440×141 |
| Peso | 8.8 kg | 10 | 12.6 | 19 | 19.3 |
| Comunicación | Estándar RS232, CAN y RS485; opcional WiFi y Bluetooth; pantalla táctil | | | | |
| Seguridad | EN/IEC 62109-1, EN/IEC 62109-2 | | | | |
| IP | no figura en la tabla. made-in-china (Sorotec) dice IP54 ([MIC](https://soropower.en.made-in-china.com/product/hYXrNDeTCkcg/China-Sorotec-Revo-Hmt-PRO-G2-High-Power-Hybrid-Energy-Storage-Solar-Inverter-11kw-Energy-Storage-Battery-Compatible-Type.html)). La ficha menciona un kit antipolvo | | | | |
| Garantía | made-in-china dice "1 Year" ([MIC](https://soropower.en.made-in-china.com/product/hYXrNDeTCkcg/China-Sorotec-Revo-Hmt-PRO-G2-High-Power-Hybrid-Energy-Storage-Solar-Inverter-11kw-Energy-Storage-Battery-Compatible-Type.html)); no hay garantía oficial en la tabla | | | | |

Nota: el texto de la ficha dice "dual MPPT 60–450 V, hasta 13 kW FV, rango de entrada AC 90–280 V, CT opcional, puerto de generador" ([HMTPRO-G2](https://www.sorotecpower.com/products-detail-5079914)). Una ficha de made-in-china dice "Support 6PCS parallel to single phase and 3 phase" (según el resultado de búsqueda; no se verificó directamente).

**REVO HMT G2-IP54 (4/6/6/11 kW)** — [HMT-G2-IP54]
| Dato | 4 kW | 6 kW | 6 kW (2 MPPT) | 11 kW |
|---|---|---|---|---|
| Entrada AC | 230 VAC; 170–280 / 90–280 VAC; 50/60 Hz | | | |
| Surge | 8000 VA | 12000 VA | 12000 VA | 22000 VA |
| Salida | 230 VAC ±5 % (sin selección 220/240 en esta tabla); 50/60 Hz; 93 %; 10/20 ms | | | |
| Batería | **24 VDC** | 48 VDC | 48 VDC | 48 VDC (flotación 54, protección por sobrecarga 63; la tabla no ajusta estos valores al de 24 V) |
| Voc | 500 VDC | | | |
| FV máx. | 5000 W | 7000 W | 2×4000 W | 13000 W (6500×2) |
| MPPT | 1; 60–450 V; 27 A | 1; 27 A | 2; 2×16 A | 2; 27 A×2 (máx. 40 A) |
| Carga solar / AC / total | 120 / 100 / 120 A (4 a 6 kW) | | | 150 / 150 / 150 A |
| Paralelo | "Yes (optional)" (no dice cuántos) | | | |
| Temperatura | -10 a 50 °C | | | |
| Comunicación | Estándar RS232, USB, CAN y RS485; opcional WiFi | | | |
| Seguridad | EN/IEC 62109-1/-2 | | | |
| IP | IP54 (portada del folleto) | | | |
| Dimensiones / peso | no publicados en el folleto | | | |
| On-grid | "off-grid y on-grid (opcional)"; el diagrama de aplicación muestra un CT en la acometida | | | |

**REVO HMT (versión anterior, ficha "IP54" 4/6/6/8/11 kW)** — [HMT-old]
- Entrada 220/230/240 VAC, 170–280 / 90–280 V. Surge de 8000 / 12000 / 12000 / 16000 / 22000 VA. Salida 220/230/240 ±5 %. Eficiencia 93 %; conmutación 10/20 ms. Batería de 48 V (flotación 54, protección por sobrecarga 63). Voc de 500 V. FV de 5000 W (4 y 6 kW) / 8000 W (4000×2) / 11000 W (5500×2). MPPT de 90–450 V (1 tracker, 27 A) en 4 y 6 kW; 60–450 V con 27 A×2 (máx. 40 A) en los de 2 MPPT. Carga solar de 80 / 120 / 120 / 150 A; carga AC de 60 / 100 / 120 / 150 A. On grid: sí. Paralelo: sí, 6 equipos. Temperatura de -10 a 50 °C. Dimensiones 315×134×516 / 134×390×516 / 147.4×432.5×553.6 mm. Peso 9 / 10.5 / 16.5 / 18 / 18.4 kg. Comunicación RS232, CAN y RS485; opcional WiFi, BT y CT. Seguridad EN/IEC 62109-1/-2 — [HMT-old](https://www.sorotecpower.com/products-detail-4776415)

**REVO VM IV (4/6/6/8/11 kW)** — [VMIV]
| Dato | 4 kW | 6 kW | 6 kW (2 MPPT) | 8 kW | 11 kW |
|---|---|---|---|---|---|
| Entrada AC | 230 VAC; 170–280 / 90–280 VAC; 50/60 Hz | | | | |
| Surge | 8000 | 12000 | 12000 | 16000 | 22000 |
| Salida | 220/230/240 VAC; senoidal; 93 % máx.; 10/20 ms | | | | |
| Batería | **24 V** (flotación 27, protección por sobrecarga 31) | 48 V (54 / 63) | 48 V | 48 V | 48 V |
| Voc | 500 VDC | | | | |
| FV máx. | 5000 W | 7000 W | 8000 W (4000×2) | 10000 W (5000×2) | 11000 W (5500×2) |
| MPPT | 60–450 V; 27 A (1 MPPT) | 27 A | 15 A×2 | 27 A×2 (máx. 40 A) | 27 A×2 (máx. 40 A) |
| Carga solar | 120 A | 120 | 120 | 120 | 150 |
| Carga AC | 100 A | 100 | 100 | 120 | 150 |
| Paralelo | hasta 6 equipos | | | | |
| Comunicación | Estándar RS232, CAN y RS485; opcional WiFi y Bluetooth; LCD color de 5" | | | | |
| Temperatura | -10 a 50 °C | | | | |
| Peso | 9 kg | 10 | 18 | 18.8 | 20 |
| Dimensiones (P×A×H) | 434×311×126.5 | 434×311×126.5 | 500×440×136 | 420×561.6×152.4 | 420×561.6×152.4 |
| IP / certificación / garantía | no publicados en la tabla | | | | |

**REVO VM IV PRO-T (4 / 6 kW)** — [VMIV-PRO-T]
- Entrada 230 VAC, 170–280 / 90–280 V, 50/60 Hz con autodetección. Surge de 8000 / 12000 VA. Salida 230 VAC ±5 %. Eficiencia 93 %; conmutación 10/20 ms.
- Batería: 24 V (4 kW: flotación 27, protección por sobrecarga 33) / 48 V (6 kW: 54 / 63); litio/plomo.
- FV: Voc de 500 V; FV máx. de 5000 / 7000 W; MPPT de 60–450 V; 27 A; 1 tracker. Carga solar de 120 A, AC de 100 A, total de 120 A.
- Otros: protecciones y gestión inteligente de cargas. **La tabla no menciona paralelo ni on-grid.** Temperatura de 0 a 50 °C. Dimensiones 434×311×126.5 mm; peso 8.5 / 9 kg. Teclas táctiles; RS232, CAN y RS485; opcional WiFi y BT. EN/IEC 62109-1/-2 — [VMIV-PRO-T](https://www.sorotecpower.com/products-detail-4776360)

**REVO HM (1.5/2.5/4/6 kW; el catálogo vende 2.5/4/6)** — [HM]
- Entrada 230 VAC, 170–280 / 90–280 V, 50/60 Hz. Surge de 3000 / 5000 / 8000 / 12000 VA. Salida 230 VAC ±5 %. Eficiencia de hasta 93.5 %; conmutación 10/20 ms.
- Batería de 12 / 24 / 24 / 48 V; litio/plomo.
- FV: Voc de 500 V; FV de 2500 / 3000 / 5000 / 6000 W; MPPT de 60–450 V; 1 tracker; 6 / 9 / 27 / 27 A. Carga solar de 80 / 80 / 120 / 120 A; AC de 60 / 60 / 100 / 100 A.
- **On Grid: No en 1.5 y 2.5 kW; Sí en 4 y 6 kW.** Segunda salida programable (solo 4/6 kW).
- Paralelo: no figura. Temperatura de 0 a 50 °C. Dimensiones 356×255×104.5 / 434×311×126.5 mm. Peso 5.3 / 5.5 / 8.5 / 9 kg. RS485 y CAN; opcional WiFi y BT. EN/IEC 62109-1/-2 — [HM](https://www.sorotecpower.com/products-detail-1076685)

**REVO II (3 / 3.2 / 5.5 kW) — legacy** — [REVO-II] (texto de la ficha)
- 3000 W (24 V) / 3200 W (48 V) / 5500 W (48 V); surge de 6000 / 6400 / 11000 W. Salida de 220/230/240 VAC.
- Red de 120–280 VAC. **Grid-tie con rango de 184–265 VAC.** CT para limitar la inyección.
- FV: 120–450 V MPPT, Voc de 500 V, 1 MPPT. Potencia FV de 4500 W según la tabla y de 5000 W según las características (**conflicto**). Carga solar de 90 A, AC de 60 A.
- **Paralelo de hasta 9 equipos.** Eficiencia de 93.5 %. Medidas 345×476×133.2 mm. USB y RS232; WiFi opcional — [REVO-II](https://www.sorotecpower.com/products-detail-134126)

**REVO III (8 kW) — legacy** — [REVO-III]
- 8 kW; salida de 220/230/240 V; PF 1.0; 2 MPPT de 4000 W; entrada FV de 120–450 VDC (otro título de ficha dice "2 MPPT de 5000 W", **conflicto**).
- Paralelo de hasta 6. El diagrama oficial muestra **monofásico de hasta 48 kW con 6 equipos y trifásico con 3 (24 kW) o 6 equipos (48 kW)**. Puertos RS232, RS485 y CAN — [REVO-III](https://www.sorotecpower.com/products-detail-134125), [REVO III 8kW 2×4000 W](https://www.sorotecpower.com/products-detail-276580)

### B) Plataforma híbrida "de red" (sin transformador, 97–97.5 %)

**REVO HES (6/8/10 kW, IP66) y REVO HES-G2 (6 kW)** — [HES-IP66]
| Dato | HES 6 kW | HES 8 kW | HES 10 kW | HES-G2 6 kW |
|---|---|---|---|---|
| FV máx. | 7 kW | 11 kW | 13 kW | 9 kW |
| Voc máx. / MPPT | 500 V; 90–450 V | ídem | ídem | **no publicado (celda vacía)**. La ficha del G2 dice "dual MPPT 90–450 V" ([HES-G2](https://www.sorotecpower.com/products-detail-5044903)) |
| Corriente FV | 30 A (1 MPPT/2 strings) | 20+20 A (2/2) | 20+20 A (2/2) | 16+16 A (2/2) |
| Red | 230 V; 90–280 (PC) / 170–280 (electrodomésticos) [sic, invertido respecto de otros modelos]; 50/60 Hz; PF 0.8 inductivo a 0.8 capacitivo; THDi <3 %; L+N+PE | | | |
| Batería | 40–63 V; carga máx. de 63 V; litio/plomo | | | |
| Carga/descarga máx. | 120/140 A | 150/190 A | 150/220 A | 120/140 A |
| Salida UPS | 6 kW | 8 kW | 10 kW | **9.6 kW** (probable error de tabla, ver nota) |
| Tensión UPS | 220/230/240 V; 50/60 Hz; <10 ms; THDu <10 % | | | |
| Corriente UPS (220/230/240) | 27.2/27/25 A | 36.3/34.7/33.3 | 45.4/43.5/41.7 | 27.2/27/25 |
| Sobrecarga | 5 s ≥110 %; 10 s entre 101 y 110 % (**sin surge 2× como en los Voltronic**) | | | |
| Protecciones | anti-isla, monitoreo de aislación, RCMU, sobrecorriente/sobretensión AC, temperatura | | | |
| Paralelo | Sí, 6 equipos | | | |
| IP / temperatura | IP66; -25 a 50 °C, derating >45 °C | | | |
| Dimensiones (A×P×H) | 700×396×192 | 630×440×215 | 630×440×215 | 540×390×220 |
| Peso | 27 kg | 38 | 38.2 | 23.4 |
| Comunicación | Estándar RS232, CAN y RS485; opcional WiFi y CT; táctil | | | |
| Seguridad | EN/IEC 62109-1/-2 | | | |
| Garantía | 5 años (folleto HES/HES-G2: "5 years warranty", y en el título de la ficha) | | | |

- Puertos del HES según el folleto: PARALLEL, CT, WIFI, BMS, RS232/Dry, BAT, **GEN**, AC OUTPUT, AC INPUT, PV1, PV2, seccionador de batería — [HES-G2 folleto](https://www.sorotecpower.com/products-detail-5044903)
- Texto de la ficha HES-G2: 6/8/10 kW, dual MPPT 90–450 V, 23.4 kg, puede funcionar **sin batería**, carga desde generador diésel, IP66, paralelo de 6. Certificaciones listadas: CE (LVD/EMC), CUL, FCC, OHSAS18001 y TUV CB, sin decir a qué modelo corresponde cada una — [HES-G2](https://www.sorotecpower.com/products-detail-5044903)
- **HES 8 kW IP65** (ficha separada): 8 kW, pico de 12 kW, "admite paralelo monofásico y trifásico", batería de 40–58 VDC, litio/plomo con protocolos de terceros por CAN/RS485, IP65, -25 a 60 °C, 4G/WiFi/BT, garantía de 5 años — [HES-8-IP65](https://www.sorotecpower.com/products-detail-5056664)
- **HES versión anterior (6/8 kW, IP65)**: la tabla es igual a la del HES-IP66, salvo carga/descarga de 8 kW = 120/190 A (no 150/190), IP65, eficiencia pico del 93 %, dimensiones 360×192×630 / 460×234×630 mm y peso de 22.5 / 32 kg — [HES-old](https://www.sorotecpower.com/products-detail-4776463)

**iHESS 1P (3.6 / 4.6 / 5 / 6 kW, IP65)** — [iHESS-1P]
| Dato | 3.6 | 4.6 | 5 | 6 |
|---|---|---|---|---|
| Eficiencia | DC máx. 97.5 %; europea 97 % | | | |
| FV máx. | 5.4 kW | 6.9 | 7.5 | 9 |
| Voc / MPPT | 500 V; **120–500 V**; 2 MPPT de 1 string cada uno; 15/15 A | | | |
| Red | **230 V; 176–270 V**; 50/60 Hz; PF ±0.8; THDi <3 %; L+N+PE | | | |
| Batería | 40–58 V; carga máx. de 58 V; **carga/descarga de 100/110 A**; litio/plomo | | | |
| Salida UPS | 220/230/240 V; 16.3/16/15 A | 20.9/20/19.1 | 22.7/21.7/20.8 | 27.2/26/25 |
| UPS | <10 ms; THDu <2 %; sobrecarga 5 s ≥110 %, 10 s 101–110 % | | | |
| Protecciones | anti-isla, aislación, RCMU, AFCI opcional | | | |
| IP / temperatura | IP65; -25 a 60 °C; enfriamiento natural | | | |
| Dimensiones / peso | 480×210×495 mm; 25 kg | | | |
| Comunicación | Estándar RS485, CAN y DRM; opcional WiFi y BT; LCD | | | |
| **Normas** | CE-EMC EN IEC 61000-6-3:2021 y EN IEC 61000-6-1:2019; CE IEC 62109-1:2010, IEC 62109-2:2011 e IEC 62477-1:2022; **VDE 4105:2018, VDE 0124:2020; CEI 0-21:2022; TOR Typ A/B:2022; OVE R25:2020; G98:2022, G99:2022** | | | |
| Paralelo | **no figura en la tabla** | | | |
| Garantía | no figura en la tabla. El título de la ficha nueva de iHESS dice "5-Year Warranty" en la familia G2 | | | |

- Modos (soropower, familia iHESS 1P-3P-EU): Self Use, Time of Use, Backup, Grid Priority; backup en <10 ms; AFCI; "aislación física y eléctrica doble"; web, app y portal — [soropower iHESS](https://www.soropower.com/product/ihess-series-1p-3p-eu-3-6-12kw/)

**iHESS L1P G2 (8 / 10 / 12 kW, IP66)** — [iHESS-L1P-G2]
| Dato | 8 | 10 | 12 |
|---|---|---|---|
| Eficiencia | DC 97.5 %; europea 97 % | | |
| FV máx. | 12 kW | **11 kW** (menor que el de 8 kW: probable error de tabla) | 13.2 kW |
| Voc / MPPT | 500 V; **125–425 V**; 22+22 A; 2 MPPT (1+1 strings) | | |
| Red | 8 / 10 / 12 kW; corriente máx. 36.5 / 45.5 / 54.5 A; **90–280 V**; 50/60 Hz; PF ±0.8; L+N+PE | | |
| Batería | 40–60 V; **carga de 200 A**; litio/plomo | | |
| Salida UPS | 220/230/240 V; 34.8 / 43.5 / 52.2 A; <10 ms; THDu <3 %; **pico off-grid 2× la nominal durante 10 s** | | |
| Protecciones | anti-isla, sobrecorriente DC, aislación, RCMU, AFCI opcional | | |
| Paralelo | 6 equipos | | |
| IP / temperatura | IP66; -25 a 60 °C, derating >45 °C; humedad 0–95 % | | |
| Dimensiones (A×P×H) / peso | **765×550×272 mm; 44 kg** | | |
| Autoconsumo | <5 W | | |
| Comunicación | RS485, CAN y DRM; WiFi | | |
| Seguridad | EN/IEC 62109-1/-2 (sin normas de red listadas) | | |
| Garantía | 5 años (texto de la ficha) | | |
| Puerto GEN | Sí, dedicado (texto de la ficha) | | |

**REVO HMT L1P G2 (6/8/10/12 kW, IP21)** — [HMT-L1P-G2] y **REVO HMT IP54 L1P G2** (la misma tabla con IP54) — [HMT-IP54-L1P-G2]
| Dato | 6 | 8 | 10 | 12 |
|---|---|---|---|---|
| Eficiencia | DC 97.5 %; europea 97 % | | | |
| FV máx. | 9 kW | 11 | 11 | 13 |
| Voc / MPPT | 500 V; 120–450 V; 22+22 A; 2 MPPT | | | |
| Red | corriente máx. 27.2 / 40 / 45.5 / 54.4 A; 90–280 V; 50/60 Hz; L+N+PE | | | |
| Batería | 40–60 V; carga/descarga de **150 A** (6 kW) / **200 A** (8–12 kW); litio/plomo | | | |
| UPS | 220/230/240 V; <10 ms; pico 2× la nominal durante 10 s | | | |
| Protecciones | anti-isla, aislación, RCMU, AFCI opcional | | | |
| Paralelo | 6 equipos | | | |
| IP | **IP21** (L1P G2) / **IP54** (IP54 L1P G2) | | | |
| Temperatura | -25 a 60 °C, derating >45 °C | | | |
| Dimensiones / peso | 445×130×620 mm; 27 kg | | | |
| Comunicación / seguridad | RS485, CAN, DRM y WiFi; EN/IEC 62109-1/-2 | | | |

### Inferences
- La corriente de 40 A del HMT L1P G2 de 8 kW (8000/230 da 34.8 A) y el FV de 11 kW del iHESS L1P G2 de 10 kW parecen errores de tipeo de Sorotec. Hay que confirmarlos antes de dimensionar.
- La fila "HES-G2 6 kW = 9.6 kW UPS" no tiene sentido para un equipo de 6 kW. Además, el título de la ficha HES-G2 habla de 6/8/10 kW, pero la tabla solo trae la columna de 6 kW. Las variantes de 8 y 10 kW del G2 no tienen especificaciones publicadas.
- Para la plataforma Voltronic, "Surge 2× nominal" (12 kVA en 6 kW) es un pico breve. La plataforma híbrida HES/iHESS 1P declara solo 110 % de sobrecarga, salvo el iHESS L1P G2 y el HMT L1P G2, que declaran 2× durante 10 s.

### Gaps
- No hay garantía oficial en las tablas de VM V, VM IV, HMT, HMT PRO/G2, HM ni iHESS 1P.
- No hay IP oficial para VM V, VM IV, HMT PRO/G2 ni HM.
- Faltan dimensiones y peso del HMT G2-IP54.

---

## 3. Inyección a red, inyección cero y certificaciones de red

### Takeaway
Todas las familias actuales declaran "on-grid" y la mayoría ofrece **CT anti-inyección opcional** (inyección cero). **Ninguna declara medidor Modbus.** Solo el **iHESS 1P** publica certificaciones de conexión a red (VDE-AR-N 4105, VDE 0124, CEI 0-21, TOR Erzeuger A/B, OVE R25, G98/G99). El resto publica solamente IEC 62109-1/-2, que es seguridad del equipo y **no** un código de red. No se encontró ni EN 50549 ni NRS 097 para ningún modelo.

### Cited Findings
- HMT PRO/G2: "On Grid: Yes"; "CT Anti-backflow function: Yes (Optional)" — [HMTPRO-G2](https://www.sorotecpower.com/products-detail-5079914)
- HMT (anterior): On Grid sí; CT como opción de interfaz — [HMT-old](https://www.sorotecpower.com/products-detail-4776415)
- HMT G2-IP54: "off-grid and on grid (optional)"; el diagrama de aplicación muestra CT y "watt-hour meter" en la acometida — [HMT-G2-IP54](https://www.sorotecpower.com/products-detail-5080110)
- HES / HES-G2: CT opcional en la interfaz; tienen puerto CT; anti-isla — [HES-IP66](https://www.sorotecpower.com/products-detail-5080326), [HES-G2](https://www.sorotecpower.com/products-detail-5044903)
- HES 8 kW IP65: "PV self-use with excess sent to the grid" — [HES-8-IP65](https://www.sorotecpower.com/products-detail-5056664)
- HM: inyección solo en 4/6 kW ("On Grid: No/Yes") — [HM](https://www.sorotecpower.com/products-detail-1076685)
- REVO II: rango grid-tie de 184–265 VAC; CT para evitar la inyección excedente — [REVO-II](https://www.sorotecpower.com/products-detail-134126)
- iHESS 1P: lista completa de normas (VDE 4105:2018, VDE 0124:2020, CEI 0-21:2022, TOR Typ A/B:2022, OVE R25:2020, G98/G99:2022, IEC 62109-1/-2, IEC 62477-1, EN IEC 61000-6-1/-3) — [iHESS-1P](https://www.sorotecpower.com/products-detail-5082453)
- iHESS L1P G2, HMT L1P G2 y HMT IP54 L1P G2: anti-isla sí; interfaz DRM (gestión de demanda, esquema AS/NZS 4777); seguridad solo EN/IEC 62109-1/-2 — [iHESS-L1P-G2](https://www.sorotecpower.com/products-detail-5081640), [HMT-L1P-G2](https://www.sorotecpower.com/products-detail-5079918)
- Las certificaciones a nivel empresa (CE, TUV CB, CUL, FCC, ISO 9001/14001/45001) aparecen como imágenes sin vincular a un modelo — [iHESS-L1P-G2](https://www.sorotecpower.com/products-detail-5081640), [HES-8-IP65](https://www.sorotecpower.com/products-detail-5056664)

### Inferences
- Para habilitar con UTE, que pide un certificado de conformidad con norma de conexión, el único candidato con certificaciones de red publicadas es el **iHESS 1P (3.6–6 kW)**. Para los demás habría que pedirle a Sorotec los certificados por modelo. Un rango de red de 90–280 V con protecciones de 10/20 ms "para PC/electrodomésticos" es típico de un equipo UPS/off-grid, no de un equipo con anti-isla certificado.
- "Rango para PC / para electrodomésticos" es la configuración de la entrada en modo UPS (Voltronic), no un rango de inyección.

### Gaps
- No se publica el método de medición para la inyección cero (si es solo CT o también medidor por RS485), salvo los diagramas, que muestran un CT.
- No hay certificados descargables.

---

## 4. Paralelo (monofásico y formación trifásica)

### Takeaway
Casi todos admiten **hasta 6 equipos en paralelo**: VM V, VM IV, HMT, HMT PRO/G2, HES/HES-G2, iHESS L1P G2, HMT L1P G2 y REVO III. El REVO II admite 9. Para formar un trifásico con equipos monofásicos, **solo hay evidencia oficial explícita en el REVO III** (diagrama con 3 o 6 equipos) y **en el texto del HES 8 kW IP65**. Para los demás, la ficha dice "6 units" sin aclarar si incluye trifásico.

### Cited Findings
- VM V: hasta 6 equipos; 6×11 kW = 66 kW; se pueden mezclar 6 y 11 kW; maestro/esclavo automático — [VMV ficha](https://www.sorotecpower.com/products-detail-5068206)
- HES 8 kW IP65: "supports single-phase and three-phase parallel operation" — [HES-8-IP65](https://www.sorotecpower.com/products-detail-5056664)
- REVO III: "Single phase output up to 48 KW using 6 units" y "Three phase output using either 3 units (24 KW) or max 6 units (48 KW)" (imagen oficial) — [REVO-III](https://www.sorotecpower.com/products-detail-134125)
- HMT PRO/G2: paralelo de 6 equipos; según made-in-china, "single and three phase" — [MIC](https://soropower.en.made-in-china.com/product/hYXrNDeTCkcg/China-Sorotec-Revo-Hmt-PRO-G2-High-Power-Hybrid-Energy-Storage-Solar-Inverter-11kw-Energy-Storage-Battery-Compatible-Type.html)
- iHESS 1P: la tabla no lista paralelo — [iHESS-1P](https://www.sorotecpower.com/products-detail-5082453)
- VM IV PRO-T: la tabla no lista paralelo — [VMIV-PRO-T](https://www.sorotecpower.com/products-detail-4776360)
- HMT G2-IP54: "Parallel Function: Yes (optional)", sin cantidad — [HMT-G2-IP54](https://www.sorotecpower.com/products-detail-5080110)

### Inferences
- En la plataforma Voltronic (VM IV/HMT/VM V), el kit de paralelo suele permitir monofásico y trifásico (por ejemplo, 2+2+2), como en el REVO III. Es muy probable que aplique igual, pero no está publicado por modelo.

### Gaps
- No hay manuales con el procedimiento de paralelo ni con los límites (por ejemplo, si exige batería común o firmware igual).

---

## 5. Neutro a tierra (relé N-PE) en modo off-grid y neutro común entre la entrada y la salida

### Takeaway
**No publicado para ningún modelo.** No se encontró ningún manual oficial de Sorotec que trate el relé N-PE. Los **diagramas de bloques oficiales** (HM, HMT y HES) muestran que el **relé de entrada de red corta los dos polos, L y N**. Por lo tanto, en modo batería el neutro de la salida queda separado del neutro de la red: **la entrada y la salida no comparten un neutro rígido**. Ningún diagrama dibuja un relé N-PE interno.

### Cited Findings
- REVO HM, diagrama: la entrada "N L" pasa por **dos contactos** hacia el inversor; Output load1 (L, N) y Output load2 (L conmutada, N común con load1) — [HM](https://www.sorotecpower.com/products-detail-1076685)
- REVO HMT, diagrama: igual, con dos contactos en la entrada N y L; Output load1 y Output load2 con la L de load2 conmutada — [HMT-old](https://www.sorotecpower.com/products-detail-4776415)
- REVO HMT G2-IP54, diagrama: la entrada N, L va con un SPD de AC; salida L, N — [HMT-G2-IP54](https://www.sorotecpower.com/products-detail-5080110)
- REVO HES, diagrama: "Grid relay" de dos polos hacia el puerto Grid L/N; "UPS relay" de dos polos hacia el puerto GEN y otro "UPS relay" hacia Backup L/N — [HES-G2 folleto](https://www.sorotecpower.com/products-detail-5044903)
- HES / iHESS / HMT L1P G2: topología de salida "L+N+PE"; "Isolation transformer: No" (sin transformador); con monitoreo de aislación y RCMU — [HES-IP66](https://www.sorotecpower.com/products-detail-5080326), [iHESS-1P](https://www.sorotecpower.com/products-detail-5082453)
- Un manual de la línea REVO (subido por terceros a Scribd) distingue una "I Version" (con conmutador interno; el N de la fuente alternativa no se debe puentear) de una "E Version". No se pudo leer el documento completo — [búsqueda: REVO manual Scribd](https://www.scribd.com/document/716479006/REVO-VMII-Users-Manual)

### Inferences
- Como el relé de red corta también el N, en modo isla la salida queda **flotante respecto del neutro de red**. Si el equipo no tiene un relé N-PE interno (no hay evidencia de que lo tenga), la puesta a tierra del neutro de salida en off-grid quedaría a cargo del instalador (por ejemplo, con un contactor externo). Esto es una deducción a partir de los diagramas, no un dato.
- **Conexión entre dos fases** (red de 230 V F-F sin neutro): en la plataforma Voltronic (VM IV/V, HMT, HM) el "N" de entrada se conmuta y pasa al inversor. Lo esperable es que tolere tener un vivo en el borne N, pero no está confirmado. En la plataforma híbrida (HES, iHESS, HMT L1P G2), con monitoreo de aislación, RCMU y anti-isla referidos a "L+N+PE", tener un borne N a unos 115–133 V respecto de tierra puede disparar fallas de aislación o de corriente residual, o quedar fuera de norma. Antes de usar cualquiera entre fases hay que pedirle a Sorotec una confirmación por escrito.

### Gaps
- No se sabe si existe un relé N-PE interno ni cómo se configura en ningún modelo.
- No se sabe si el neutro de entrada y el de salida son comunes en modo bypass (el diagrama sugiere que sí cuando el relé está cerrado, y que no en modo batería).
- Hay que pedirle a Sorotec (ella@soroups.com, +86-755-81495850) el manual de instalación de cada modelo.

---

## 6. Monitoreo, comunicación BMS, garantía

### Takeaway
Todos tienen puerto BMS por **CAN y RS485**. Los Voltronic suman RS232. Los iHESS y los HMT L1P G2 suman DRM. WiFi y Bluetooth son opcionales u optativos según el modelo, con app y portal web. No se publica una lista de baterías ni de protocolos compatibles. La garantía de 5 años solo figura en HES/HES-G2, HES 8 kW IP65 e iHESS L1P G2.

### Cited Findings
- HES 8 kW IP65: "Third-party lithium protocols over CAN/RS485"; detección automática de batería en 40–58 V; 4G, WiFi y BT — [HES-8-IP65](https://www.sorotecpower.com/products-detail-5056664)
- VM V: BMS por RS485/CAN doble; WiFi, BT, app con alertas de falla — [VMV ficha](https://www.sorotecpower.com/products-detail-5068206)
- HM: plataforma en la nube con app móvil — [HM](https://www.sorotecpower.com/products-detail-1076685)
- HMT PRO/G2 en made-in-china: garantía de "1 Year" — [MIC](https://soropower.en.made-in-china.com/product/hYXrNDeTCkcg/China-Sorotec-Revo-Hmt-PRO-G2-High-Power-Hybrid-Energy-Storage-Solar-Inverter-11kw-Energy-Storage-Battery-Compatible-Type.html); la ficha HES-G2 dice 5 años en el título, pero en "Company Advantages" dice "un año + servicio de por vida" (**conflicto**) — [HES-G2](https://www.sorotecpower.com/products-detail-5044903)

### Gaps
- No se publica la lista de marcas de batería ni de protocolos BMS compatibles (Pylontech, etc.).
- No se publica el nombre de la app ni de la plataforma de monitoreo.
