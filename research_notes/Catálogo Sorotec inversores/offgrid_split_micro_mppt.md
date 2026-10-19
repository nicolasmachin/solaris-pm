# Sorotec (Shenzhen SORO Electronics) — Off-grid, Split-phase, Micro inversores y controladores MPPT

Método: se descargaron las fichas de producto de sorotecpower.com (18-oct-2026). Las tablas de especificaciones de casi todos los modelos están publicadas **como imágenes** (no como texto) dentro de la ficha; se leyeron las imágenes una por una. Cada dato abajo cita la ficha de donde sale la imagen. "no publicado" = no aparece en la ficha ni en su tabla.

Fichas usadas (todas en https://www.sorotecpower.com/):
- [Listado Off-grid p.1](https://www.sorotecpower.com/products-23652) · [p.2](https://www.sorotecpower.com/products-23652-list-2)
- [REVO MPI 6/10 kW](https://www.sorotecpower.com/products-detail-5053614)
- [REVO VM II PRO 1.6–6 kW](https://www.sorotecpower.com/products-detail-4775798)
- [REVO HM 4/6 kW](https://www.sorotecpower.com/products-detail-4776311)
- [REVO VM IV Pro 3.6/5.6 kW](https://www.sorotecpower.com/products-detail-326562)
- [REVO VM III-T 4/6 kW (ficha A)](https://www.sorotecpower.com/products-detail-4775844) · [ficha B duplicada](https://www.sorotecpower.com/products-detail-2088431)
- [REVO VM IV PRO-T 4/6 kW](https://www.sorotecpower.com/products-detail-2088874)
- [Pure sine wave 1.5–5 kW (= REVO VP/VM)](https://www.sorotecpower.com/products-detail-4775760)
- [REVO VP 1–5 kW](https://www.sorotecpower.com/products-detail-134133) · [REVO VM series](https://www.sorotecpower.com/products-detail-134141) · [REVO VP/VM Built-in MPPT/PWM](https://www.sorotecpower.com/products-detail-133798)
- [REVO VM II Pro_1 1.5/2.5 kW](https://www.sorotecpower.com/products-detail-774213)
- Split phase: [listado](https://www.sorotecpower.com/products-86939) · [iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851) · [REVO HMT IP54 L2P G2](https://www.sorotecpower.com/products-detail-5080100) · [REVO HMT L2P G2 IP21](https://www.sorotecpower.com/products-detail-5079922) · [REVO VM II PRO US](https://www.sorotecpower.com/products-detail-5104959)
- Micro: [listado](https://www.sorotecpower.com/products-77902)
- MPPT: [listado](https://www.sorotecpower.com/products-23653) · [MPPT SCC 40–100A (ficha A)](https://www.sorotecpower.com/products-detail-4776864) · [MPPT SCC IP20 (ficha B)](https://www.sorotecpower.com/products-detail-5081041)

## 1. Inversores Off-grid: especificaciones por modelo

### Takeaway
El catálogo off-grid vigente tiene 12 fichas, pero son ~8 familias (hay duplicados: VM III-T aparece dos veces; "Pure sine wave", "REVO VP", "REVO VM series" y "VP/VM Built-in MPPT/PWM" son la misma tabla VP/VM). Todos son monofásicos 230 VAC, 50/60 Hz, transferencia 10/20 ms, rango de entrada 170–280 VAC (modo PC) o 90–280 VAC (modo electrodomésticos). Solo REVO HM declara "On Grid: Yes" + paralelo; REVO MPI declara "On Grid: Yes (optional)" y **no tiene sección de batería en su tabla**.

### Cited Findings

**Tabla resumen (valores leídos de las imágenes de especificación de cada ficha)**

| Modelo | Potencia nominal / pico | Salida AC | Entrada AC | Batería | Carga máx. (solar / AC / total) | PV: Voc máx · MPPT · Pmax · I · nº MPPT | Inyección a red | Paralelo | Ef. pico | Peso | Normas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **REVO MPI 6 kW** | 6000 W / 12000 VA | 180/200/220/230/240 VAC ±5% | 230 VAC, 170–280 VAC, 50/60 Hz | no publicado (tabla sin sección batería) | no publicado | 500 V · 60–450 V · 4500 W×2 · 15A+15A · 2 | "On Grid: Yes (optional)" | no publicado | 97% | 4,92 kg | EN/IEC 62109-1/-2 |
| **REVO MPI 10 kW** | 10000 W / 20000 VA | ídem | ídem | no publicado | no publicado | 500 V · 60–450 V · 4500 W×3 · 15A×3 · 3 | Yes (optional) | no publicado | 97% | 5,69 kg | EN/IEC 62109-1/-2 |
| **REVO VM II PRO 1.6** | 1600 W / 3200 VA | 230 VAC ±5% | 230 VAC (220/240), 170–280 / 90–280 | 12 V (float 13,5; OVP 16) | 80 / 60 / 80 A | 500 V · 60–450 V · 2000 W · — · — | no publicado | no publicado | 93% | 5 kg | EN/IEC 62109-1/-2 |
| **REVO VM II PRO 3.2** | 3200 W / 6400 VA | ídem | ídem | 24 V (27 / 33) | 80 / 60 / 80 A | 500 V · 60–450 V · 3500 W | no publicado | no publicado | 93% | 5,5 kg | ídem |
| **REVO VM II PRO 4** | 4000 W / 8000 VA | ídem | ídem | 24 V (27 / 33) | 120 / 80 / 120 A | 500 V · 60–450 V · 4500 W | no publicado | no publicado | 93% | 8,5 kg | ídem |
| **REVO VM II PRO 6** | 6000 W / 12000 VA | ídem | ídem | 48 V (54 / 63) | 120 / 80 / 120 A | 500 V · 60–450 V · 5500 W | no publicado | no publicado | 93% | 9 kg | ídem |
| **REVO HM 4 kW** | 4000 W / 8000 VA | 230 VAC ±5%, 50/60 Hz | 230 VAC, 170–280 / 90–280 | 24 V (27/33), Litio/plomo | 120 / 100 / 120 A | 500 V · 60–450 V · 5000 W · 27 A · 1 | **On Grid: Yes** | **Yes (optional)**; ficha: "hasta 6 unidades" | 93% | 8,5 kg | EN/IEC 62109-1/-2 |
| **REVO HM 6 kW** | 6000 W / 12000 VA | ídem | ídem | 48 V (54/63), Litio/plomo | 120 / 100 / 120 A | 500 V · 60–450 V · 7000 W · 27 A · 1 | Yes | Yes (opt.) hasta 6 | 93% | 9 kg | ídem |
| **REVO VM III-T 4 kW** | 4000 W / 8000 VA | 230 VAC ±5% | 230 VAC, 170–280 / 90–280 | 24 V, Litio/plomo | 120 / 100 / 120 A | 500 V · 60–450 V · 5000 W · 27 A · 1 | no publicado (ficha A: "off-grid"; ficha B: "on-grid and off-grid application") | no publicado | 93% | 8,5 kg | EN/IEC 62109-1/-2 |
| **REVO VM III-T 6 kW** | 6000 W / 12000 VA | ídem | ídem | 48 V, Litio/plomo | 120 / 100 / 120 A | 500 V · 60–450 V · 7000 W · 27 A · 1 | ídem | no publicado | 93% | 9 kg | ídem |
| **REVO VM IV Pro 3600-24** | 3600 W / 7200 VA | 230 VAC ±5% | 230 VAC, 170–280 / 90–280 | 24 V (27/33); soporta litio | 120 / 100 / 120 A | 500 V · **120–450 V** · 4500 W | no publicado | no publicado | hasta 93,5% | 8,5 kg | no publicado en tabla |
| **REVO VM IV Pro 5600-48** | 5600 W / 11200 VA | ídem | ídem | 48 V (54/63) | 120 / 100 / 120 A | 500 V · 120–450 V · 6000 W | no publicado | no publicado | hasta 93,5% | 9 kg | no publicado |
| **REVO VM IV PRO-T 4 kW** | 4000 W / 8000 VA | 230 VAC ±5% | 230 VAC, 170–280 / 90–280 | 24 V, litio/plomo | 120 / 100 / 120 A | 500 V · 60–450 V · 5000 W · 27 A · 1 | no publicado (ficha dice "off-grid" y también "on-grid and off-grid application") | no publicado | hasta 93,5% | 8,5 kg | EN/IEC 62109-1/-2 |
| **REVO VM IV PRO-T 6 kW** | 6000 W / 12000 VA | ídem | ídem | 48 V | 120 / 100 / 120 A | 500 V · 60–450 V · 6000 W · 27 A · 1 | ídem | no publicado | hasta 93,5% | 9 kg | ídem |
| **REVO VM II Pro_1 (tabla rotulada "VM II PRO 1500/3000")** | 1500 W / 3000 VA; 3000 VA/2500 W / 4800 VA | 230 VAC ±5% | 230 VAC, 170–280 / 90–280 | 12 V / 24 V; soporta LiFePO4 | 80 / 60 / 80 A | **450 V** · 120–450 V · 2000 W / 3000 W | no publicado | no publicado | 94% bat→inv; 97% PV→inv | 4 / 5 kg | no publicado |
| **REVO VP 1000-12 (PWM)** | 1000 W / 2000 VA | 230 VAC ±5% | 230 VAC, 170–280 / 90–280 | 12 V | 50 / 20 / 50 A | 55 V · PWM · 600 W | no | no publicado | 93% (tabla texto: 90–93%) | 4,4 kg | no publicado |
| **REVO VM 1200-12 (MPPT)** | 1200 W / 2000 VA | ídem | ídem | 12 V | 50 / 20 / 60 A | 102 V · 15–80 V (texto: 17–80) · 700 W | no | no publicado | 93% | 4,4 kg | — |
| **REVO VP 2000-24** | 2000 W / 4000 VA | ídem | ídem | 24 V | 50 / 20 / 50 A | 80 V · PWM · 1200 W | — | — | 93% | 5 kg | — |
| **REVO VM 2200-24** | 2200 W / 4000 VA | ídem | ídem | 24 V | 50 / 20 / 60 A | 102 V · 30–80 V · 1400 W | — | — | 93% | 5 kg | — |
| **REVO VP 3000-24** | 3000 W / 6000 VA | ídem | ídem | 24 V | 50 / 25 / 70 A | 80 V · PWM · 1200 W | — | — | 93% | 6,3 kg | — |
| **REVO VM 3200-24** | 3200 W / 6000 VA | ídem | ídem | 24 V | 65 / 25 / 80 A (texto: 60 A) | 102 V · 30–80 V · 1800 W | — | — | 93% | 6,5 kg | — |
| **REVO VP 5000-48** | 5000 W / 10000 VA | ídem | ídem | 48 V | 50 / 60 / 110 A | 105 V · PWM · 2400 W | — | — | 93% | 8,5 kg | — |
| **REVO VM 5000-48** | 5000 W / 10000 VA | ídem | ídem | 48 V | 60 (texto: 65) / 60 / 120 A | 145 V · 60–115 V · 3000 W | — | — | 93% | 9,7 kg | — |

Fuentes por fila:
- REVO MPI: tabla "REVO MPI series" (imagen) y texto de la ficha: "6kW model: Dual-MPPT; 10kW model: Triple-MPPT", "10kW model weighs only 5.69kg", "60-450VDC PV Input | 170-280VAC Grid Range", "Optional grid-tied power sales functionality", "EN/IEC 62109 Certified", "Supports pure photovoltaic-driven loads", "AC input supports unlimited load expansion (real-time metering via CT meters)" — [Sorotec REVO MPI](https://www.sorotecpower.com/products-detail-5053614)
- REVO VM II PRO: tabla "REVO VM II PRO series" (dos imágenes); 24 VDC corresponde a 3,2 y 4 kW (la celda abarca ambas columnas); comunicación "Standard: USB/RS232; Optional: CAN&RS485"; dimensiones 348×270×95 (1,6/3,2) y 400×300×115 mm (4/6); texto: "PV Range 60-450VDC, Work without Battery, Built-in Wi-Fi, Built-in anti-dust kit", "Built-in 80/100A MPPT solar charger" (el texto dice 80/100 A; la tabla dice 80/120 A) — [Sorotec REVO VM II PRO](https://www.sorotecpower.com/products-detail-4775798)
- REVO HM: tabla "REVO HM series" (dos imágenes): On Grid Yes, Parallel Function Yes (optional), 466×313×136,5 mm, interfaz "RS232, USB; CAN&RS485; Optional WiFi, Bluetooth", −10~50 °C; texto: "Parallel operation up to 6 units", "Dual outputs for smart load management", "Work without Battery", "suitable for on-grid and off-grid applications" — [Sorotec REVO HM](https://www.sorotecpower.com/products-detail-4776311)
- REVO VM III-T: tabla "REVO VM III-T series" (dos imágenes): 434×311×126,5 mm, 0~50 °C, interfaz "Standard RS232; Optional WiFi, Bluetooth", "Smart load management Yes" — [Sorotec VM III-T ficha A](https://www.sorotecpower.com/products-detail-4775844); la ficha B dice "Revo VM III-T series is suitable for on-grid and off-grid application" y "Detachable LCD control module" — [Sorotec VM III-T ficha B](https://www.sorotecpower.com/products-detail-2088431)
- REVO VM IV Pro: tabla "REVO VM IV Pro Series" (imagen): 400×300×115 mm, USB/RS232, −10~50 °C; texto: "Built-in 120A MPPT solar charger", "Touchable button with large 5" colored LCD", "Reserved communication port (RS485, CAN-BUS or RS232) for BMS (Optional)", "Battery Optional" — [Sorotec VM IV Pro](https://www.sorotecpower.com/products-detail-326562)
- REVO VM IV PRO-T: tabla "REVO VM IV PRO-T series" (imagen): 434×311×126,5 mm, 0~50 °C, interfaz "Standard RS485, CAN; Opt WiFi, Bluetooth", "Smart load management Yes (for 4/6k)"; la imagen de marketing dice "suitable for off-grid applications" mientras el texto dice "suitable for on-grid and off-grid application" — [Sorotec VM IV PRO-T](https://www.sorotecpower.com/products-detail-2088874)
- REVO VM II Pro_1: tabla "REVO VM II PRO Series / VM II PRO 1500 / 3000" (imagen), 348×270×95 mm, "RS232 (Standard) GPRS/WIFI (Optional)", 0~55 °C, "Maximum Efficiency 98%" (del cargador); texto: "Built-in 80A MPPT solar charger & 60A AC charger", "Can work without battery", "Support lithium iron battery" — [Sorotec VM II Pro_1](https://www.sorotecpower.com/products-detail-774213)
- REVO VP/VM: tabla en imagen de [Pure sine wave 1.5–5 kW](https://www.sorotecpower.com/products-detail-4775760) y tabla HTML en [REVO VP](https://www.sorotecpower.com/products-detail-134133), [REVO VM series](https://www.sorotecpower.com/products-detail-134141) y [VP/VM Built-in MPPT/PWM](https://www.sorotecpower.com/products-detail-133798). Comunicación USB/RS232 (texto) o RS232 (imagen); −10~50 °C. Ficha 133798 declara "Certification: CE, ISO9001".

**Datos comunes / garantía / certificaciones**
- Transferencia: "10 ms (For Personal Computers); 20 ms (For Home Appliances)" en todas las tablas off-grid — fichas citadas arriba.
- Frecuencia: 50/60 Hz auto-sensing en todos — fichas citadas arriba.
- Garantía: ninguna ficha off-grid publica la garantía del modelo; el texto genérico de la empresa dice "Warranty service: 2-5 years warranty (depending on product)" — [Sorotec MPPT SCC IP20](https://www.sorotecpower.com/products-detail-5081041); [Sorotec iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851)
- Certificados mostrados en la ficha del VM II PRO US: CE EMC (EN IEC 61000-6-4/6-2/3-11/3-12, reg. SZNTC2202633EV00, 24-jun-2022) y CE LVD (EN 62109-1:2010 / 62109-2:2011, reg. SZNTC2202634SV01, 19-sep-2022) emitidos por Shenzhen Nore Testing Center, pero para los modelos **"REVO III 8KW, REVO VM II 8KW"**, no para los de las fichas — [Sorotec REVO VM II PRO US](https://www.sorotecpower.com/products-detail-5104959)
- Texto corporativo repetido en varias fichas: "our products have passed the Thai certificate, energy saving certificate, CE certificate, TUV CB certificate" — [Sorotec REVO HM](https://www.sorotecpower.com/products-detail-4776311). La ficha iHESS dice "Certificate: CE (LVD/EMC), CUL, FCC, OHSAS18001, TUV CB" — [Sorotec iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851)
- IP: ninguna tabla off-grid publica grado IP; varias mencionan "built-in anti-dust kit" — fichas VM II PRO, HM, VM IV Pro.

**Contradicciones detectadas dentro de las propias fichas**
- VP/VM: la tabla HTML dice VM 1200-12 MPPT 17–80 V, VM 3200-24 carga total 60 A, VM 5000-48 solar 65 A; la tabla imagen dice 15–80 V, 80 A y 60 A — [134133](https://www.sorotecpower.com/products-detail-134133) vs [4775760](https://www.sorotecpower.com/products-detail-4775760). La ficha 4775760 dice además "Built-in 50/65A MPPT".
- VM II PRO: texto "80/100A MPPT" vs tabla 80/120 A — [4775798](https://www.sorotecpower.com/products-detail-4775798).
- VM II Pro_1: el título dice 1.5–2.5 kW pero la tabla es "VM II PRO 1500 / 3000" con 3000 VA / 2500 W — [774213](https://www.sorotecpower.com/products-detail-774213).

### Inferences
- Ningún off-grid tiene paralelo trifásico publicado; el único con paralelo declarado es REVO HM (hasta 6 unidades), y no se dice si arma trifásico.
- REVO MPI parece un inversor sin batería (PV + red, con CT para medir carga) más que un off-grid clásico: su tabla no tiene sección batería y el título dice "Pure PV Load Power and CT". No se pudo confirmar si admite batería.
- La familia VP/VM (PWM / MPPT de bajo voltaje, Voc ≤ 145 V) es tecnología vieja; las fichas de esa familia son de 2021 (por los nombres de archivo de imagen) — inferencia débil.
- Para Uruguay (230 V/50 Hz) todos los off-grid son compatibles en tensión y frecuencia.

### Gaps
- Garantía por modelo off-grid: no publicada.
- Grado IP de los off-grid: no publicado.
- Rango de tensión de batería (min/max de operación), corte por bajo voltaje: no publicado en tablas (solo float y sobrecarga).
- Corriente PV máxima de VM II PRO, VM IV Pro, VP/VM: no publicada.
- Si VM III-T / VM IV PRO-T / VM II PRO inyectan a red: no publicado (las fichas se contradicen entre "off-grid" y "on-grid and off-grid application", sin fila "On Grid" en la tabla).
- Batería, cargador y paralelo de REVO MPI: no publicados.
- La página 2 del listado off-grid solo repite la ficha 133798 (REVO VP/VM).

## 2. Split phase: especificaciones, rangos L-N / L-L y uso con 230 V L-L

### Takeaway
iHESS L2P G2, REVO HMT IP54 L2P G2 y REVO HMT L2P G2 IP21 comparten la misma tabla eléctrica: 8/10/12 kW, salida 120/240 Vac (L1/L2/N/PE), entrada 90–140 VAC, 50/60 Hz, batería 48 V, 2 MPPT 60–450 V (22 A + 22 A), carga solar 180/200 A, paralelo opcional, eficiencia pico 93%. Difieren en IP y peso. El VM II PRO US es monofásico 120 V (no split) y no publica tabla.

### Cited Findings

| Modelo | Potencia / pico | AC entrada | AC salida | Batería | Carga solar / AC / total | PV | Paralelo | Ef. | IP | Medidas / peso | Garantía | Normas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **iHESS L2P G2 8/10/12 kW** | 8000/10000/12000 W; pico 16000/20000/24000 VA | 120/240 Vac (L1/L2/N/PE split phase), rango 90–140 VAC, 50/60 Hz | 120/240 Vac ±5%; transferencia 10/20 ms | 48 V (float 54, OVP 63), Litio/plomo | 8 kW: 180/100/180 A; 10–12 kW: 200/150/200 A | Voc 500 V; 60–450 V; 5500 W×2 (8 kW) / 6500 W×2 (10–12 kW); 22A+22A; 2 MPPT | Yes (optional) | 93% | **IP66** | 440×260×270 mm; **42 kg** | **5 años** | EN/IEC 62109-1/-2 |
| **REVO HMT IP54 L2P G2 8/10/12 kW** | ídem | ídem | ídem | ídem | ídem | ídem | Yes (optional) | 93% | **IP54** (texto; la tabla no tiene fila IP) | 455×620×130 mm; 21 kg (8) / 22 kg (10–12) | no publicado | EN/IEC 62109-1/-2 |
| **REVO HMT L2P G2 IP21 8/10/12 kW** | ídem | ídem | ídem | ídem | ídem | ídem | Yes (optional) | 93% | IP21 (título) | 455×620×130 mm; 21 / 22 kg | **3 años** (texto) | EN/IEC 62109-1/-2; texto "UL-Compliant Design" |
| **REVO VM II PRO US** | no publicado (texto: "PV arrays up to 3000W") | 110/120 VAC monofásico | 120 VAC monofásico | no publicado | MPPT 80 A | no publicado | no publicado | no publicado | IP21 | no publicado | no publicado | no publicado |

- iHESS L2P G2: tabla "iHESS L2P G2 series" (imagen, página 43/44 de un catálogo "Hybrid on & off grid energy storage inverter (split phase)"); texto: "IP66 protection rating… operating temperature range of -10°C to 50°C", "120V/240V split-phase output (L1/L2/N/PE) with output voltage ranges precisely matched to North American grids (L-N: 100-120Vac, L-L: 200-240Vac)", "dual high-efficiency MPPT (60-450VDC wide voltage range, 22A per channel)", "grid-to-battery switching as fast as 10ms", "Supports optional parallel operation", "RS485/CAN/USB", "5-year warranty", "anti-islanding, and insulation detection", "Certificate: CE (LVD/EMC), CUL, FCC, OHSAS18001, TUV CB" — [Sorotec iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851)
- REVO HMT IP54 L2P G2: tabla "REVO HMT IP54 L2P G2 series" (imagen, página 29/30 de catálogo "Industrial and commercial energy storage inverter"); texto: "L-N: 100-120VAC, L-L: 200-240VAC", "Each controller handles up to 22A input current… 60-450VDC", "IP54-rated design… semi-outdoor", "optional WiFi" — [Sorotec HMT IP54 L2P G2](https://www.sorotecpower.com/products-detail-5080100)
- REVO HMT L2P G2 IP21: tabla "REVO HMT L2P G2 series" (imagen); texto: "standard 120V/240V split-phase voltage output, specifically suited for the North American market", "200A ultra-fast charging", "Dual Independent MPPT | 60-450VDC", "3-Year Warranty | UL-Compliant Design", TOU — [Sorotec HMT L2P G2 IP21](https://www.sorotecpower.com/products-detail-5079922)
- VM II PRO US: "single phase hybrid inverter 120VAC", "battery-free solar inverter", "80A MPPT solar controller… PV input arrays up to 3000W", "dual output", "RS485/CAN communication ports", "IP21 indoor housing"; la ficha muestra una imagen "Hybrid Solar Energy Storage Inverter 110/120VAC" y no tiene tabla — [Sorotec VM II PRO US](https://www.sorotecpower.com/products-detail-5104959)

**Rangos L-N / L-L**
- Entrada AC: "120/240Vac (L1/L2/N/PE split phase)", "Voltage Range 90-140 VAC" (rango por fase L-N; L-L no publicado como rango de entrada) — las tres tablas G2.
- Salida: L-N 100–120 Vac, L-L 200–240 Vac (texto) y "120/240Vac ±5%" (tabla) — [iHESS](https://www.sorotecpower.com/products-detail-5081851), [HMT IP54](https://www.sorotecpower.com/products-detail-5080100).

### Inferences
- **¿Funcionaría con una sola alimentación 230 V L-L (sin neutro, como dos fases de 115 V)?** No publicado. Por la especificación, la entrada AC espera L1/L2/N/PE con 90–140 VAC por rama; una red monofásica uruguaya de 230 V F-N aplicada a L1-N quedaría fuera de rango (>140 V). Una alimentación 230 V L-L sin neutro no corresponde al esquema declarado (exige N). La salida tampoco sirve para cargas de 230 V F-N: daría 120 V F-N y 240 V L-L. Conclusión inferida: estos equipos son para sistemas norteamericanos 120/240 V y no son aptos para la red uruguaya monofásica 230 V/50 Hz salvo como sistema aislado alimentando cargas entre L1 y L2 (240 V ±5%), algo que el fabricante no documenta. Requiere confirmación con Sorotec.
- Los tres modelos G2 split phase comparten la misma electrónica; IP21 e IP54 incluso publican las mismas medidas y peso, lo que sugiere misma caja (o tabla copiada). El iHESS (IP66) es distinto: 42 kg y otras medidas.
- 50/60 Hz auto-sensing está declarado, así que la frecuencia de Uruguay no es el problema; el problema es la tensión.

### Gaps
- Inyección a red / venta de excedentes en split phase: la tabla no tiene fila "On Grid"; solo el iHESS menciona "anti-islanding". No publicado explícitamente.
- Número máximo de unidades en paralelo y si arman trifásico: no publicado para los L2P G2 (solo "Yes (optional)").
- Certificaciones UL concretas (UL1741 etc.): no publicadas; solo "UL-Compliant Design" y "CUL, FCC" en texto genérico.
- Garantía de HMT IP54: no publicada.
- Tabla completa del VM II PRO US: no publicada.

## 3. Micro inversores

### Takeaway
La categoría "Micro Inverter" de sorotecpower.com **no lista ningún producto** ("No more~~"); solo tiene un texto descriptivo de un "KS micro inverter" sin modelos ni datos.

### Cited Findings
- Texto único de la categoría: "The KS micro inverter has high reliability, high efficiency, simple installation, and multiple protection functions, which can be directly connected to the home power grid. It has MPPT function, intelligent WiFi module… intelligent online monitoring." La grilla de productos muestra "No more~~" — [Sorotec Micro Inverter](https://www.sorotecpower.com/products-77902)
- La página 2 de la categoría tampoco devuelve fichas (verificado por descarga directa) — [Sorotec Micro Inverter](https://www.sorotecpower.com/products-77902)
- Búsquedas web de "Sorotec micro inverter KS" no devolvieron ninguna ficha Sorotec; el único "KS-Series" encontrado es un documento en francés de inversores de 1,5–5 kW sin marca Sorotec visible — [HelloPro PDF](https://www.hellopro.fr//documentation/pdf_prod/0/3/6/822839_e48e6627e0028ffb17f93eab78ad8cb6_8031630.pdf)

### Inferences
- Sorotec no tiene hoy un micro inversor publicado en su catálogo web; si lo ofrece, sería OEM/a pedido.

### Gaps
- Tensión de red, certificaciones, potencia de panel compatible, número de entradas: no publicado.

## 4. Controladores de carga MPPT

### Takeaway
Una sola familia: MPPT SCC 40A/60A/80A/100A (dos fichas, con algunas diferencias entre sí). 12/24/48 V auto (el de 40 A solo 12/24 V), Voc < 100/150/200 V, IP20, sin ventilador, RS232, eficiencia 97% y tracking 99%.

### Cited Findings

| Modelo | Sistema | Rango batería | Corriente carga / salida carga | Voc PV máx | Rango MPPT | Ef. máx / MPPT | IP | Peso | Garantía |
|---|---|---|---|---|---|---|---|---|---|
| **SCC40A 100V** | 12/24 V auto | 9–15 / 18–30 VDC | 40 A / 20 A | < 100 V | 15–80 / 30–80 VDC | 97% / 99% | IP20 | 1,7 kg (ficha B) / 2,0 kg (ficha A) | 2 años (B) / 3 años (A) |
| **SCC60A 150V** | 12/24/48 V auto | 9–15 / 18–30 / 36–60 VDC | 60 A / 20 A | < 150 V | 15–130 / 30–130 / 60–130 VDC | 97% / 99% | IP20 | 4,1 kg (B) / 4,0 kg (A) | 2 / 3 años |
| **SCC80A 200V** | 12/24/48 V auto | ídem | 80 A / 40 A | < 200 V | 15–170 / 30–170 / 60–170 VDC | 97% / 99% | IP20 | 5,5 kg (B) / 4,0 kg (A) | 2 / 3 años |
| **SCC100A 200V** | 12/24/48 V auto | ídem | 100 A / 40 A | < 200 V | 15–170 / 30–170 / 60–170 VDC | 97% / 99% | IP20 | 5,5 kg (B) / 4,0 kg (A) | 2 / 3 años |

- Tabla en imagen (página 25/26 de un catálogo "Solar controller"): batería "GEL (default), FLD, LIO and USE"; boost 14,4/28,8/57,6 V; float 13,9/27,8/55,6 V; ecualización 15/30/60 V; reconexión 12,5/25/50 V; desconexión 11,5/23/46 V; compensación −3 mV/°C/2V (40–60 A) y −4 mV/°C/2V (80–100 A); autoconsumo ≤300 mA(12 V)/≤150 mA(24 V)/≤100 mA(48 V); tierra positiva; −20~55 °C; RS232; opcional Wi-Fi/Bluetooth; garantía 2 años — [Sorotec MPPT SCC IP20 (ficha B)](https://www.sorotecpower.com/products-detail-5081041)
- La ficha A muestra la misma tabla pero con "Warranty 3 Years" y pesos 2,0 kg / 4,0 kg — [Sorotec MPPT SCC 40–100A (ficha A)](https://www.sorotecpower.com/products-detail-4776864)
- Texto: "tracking accuracy 99.00%", "maximum 97.00%", "12/24/48VDC system voltage automatic recognition", "natural cooling (fanless) design with IP20", "standard RS232… optional Wi-Fi/Bluetooth modules", tipos "GEL (default), FLOODED, and LI-ION" — [Sorotec MPPT SCC IP20](https://www.sorotecpower.com/products-detail-5081041)
- El listado MPPT incluye además un "IP55 Outdoor Communication Base Station Stacked Light Controller SHWB48300" (telecom), fuera del alcance de controladores FV residenciales — [Sorotec MPPT Solar Controller](https://www.sorotecpower.com/products-23653)

### Inferences
- "Tierra positiva" (positive grounding) es relevante para el diseño de puesta a tierra: no se puede aterrar el negativo del sistema sin verificar.
- La potencia PV máxima por modelo no está publicada; se calcularía como corriente × tensión de batería, pero eso no es dato del fabricante.

### Gaps
- Potencia PV máxima por modelo, certificaciones (CE etc.) del controlador: no publicadas.
- Garantía real: contradicción 2 vs 3 años entre fichas.
- Dimensiones de SCC60A en ficha A no coinciden con ficha B (A agrupa 60–100 A en 251×83×228).
