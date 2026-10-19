# Sorotec sirve en Uruguay solo en monofásico

*Relevamiento del 18-oct-2026 sobre las fichas públicas de Sorotec (Shenzhen SORO Electronics), sorotecpower.com y soropower.com, y sobre la normativa de UTE. Casi todas las tablas de Sorotec están publicadas como imágenes y se leyeron una por una. No hay datasheets en PDF ni manuales oficiales descargables.*

**Ningún inversor trifásico de Sorotec funciona en la red uruguaya de 3x230 V entre fases sin neutro (IT).** Todos, incluidos los equipos híbridos, el comercial MPGS, el all-in-one trifásico y los UPS trifásicos, están especificados para 380/400/415 V con conexión 3W+N+PE. Además, el piso de su rango de red (305 V en la serie L3P G2, 360 V en el iHESS-3P) queda muy por encima de 230 V. Lo que sí entra en la red uruguaya es la línea **monofásica de 230 V**: 11 familias de híbridos montadas sobre dos plataformas. Una es tipo Voltronic/Axpert: inversor-cargador de 93 % de eficiencia, pensado para off-grid o backup. La otra es un híbrido "de red" sin transformador, con 97–97,5 % de eficiencia, anti-isla y RCMU. Que un monofásico se conecte **entre dos fases** es lo normal en zonas IT y UTE lo admite. Pero ningún documento de Sorotec lo autoriza, y queda abierto el riesgo con el enlace neutro-tierra en backup y con la vigilancia de aislación de los equipos sin transformador. UTE no tiene una lista de equipos homologados: habilita por **declaración jurada del instalador**, respaldada en certificados del modelo exacto (IEC 62109-1/-2, IEC 61000-3-x, limitación de inyección de corriente continua certificada por un laboratorio independiente, protecciones bloqueadas al usuario). Sorotec publica normas de red completas para **un solo** híbrido (el iHESS 1P de 3,6–6 kW) y para el trifásico de batería de alta tensión iHESS-3P, que no sirve en red IT. Para Voltia, entonces, Sorotec es un candidato serio solo para microgeneración monofásica de hasta 6 kW con el iHESS 1P, para sistemas aislados (la línea Voltronic y los controladores MPPT) y, en zonas TT de 400 V con neutro, para el iHESS-3P. Antes de comprar hay que conseguir certificados por modelo, manuales de instalación y una confirmación por escrito sobre la conexión entre fases.

## El catálogo son dos plataformas con nombres que se pisan

El listado de híbridos de Sorotec trae 11 familias monofásicas de 230 V repartidas en tres páginas ([listado p.1](https://www.sorotecpower.com/products-23651), [p.2](https://www.sorotecpower.com/products-23651-list-2), [p.3](https://www.sorotecpower.com/products-23651-list-3)). Agrupadas por electrónica, son dos productos distintos. La **plataforma tipo Voltronic** (VM IV, VM IV PRO-T, VM V, HM, HMT, HMT PRO/G2, HMT G2-IP54) comparte medidas (434×311×126,5 mm en los chicos), un 93 % de eficiencia, MPPT de 60–450 V y conmutación de 10/20 ms. Es un inversor-cargador off-grid con la inyección a red como opción. La **plataforma híbrida de red** (HES/HES-G2, iHESS 1P, iHESS L1P G2, HMT L1P G2 y HMT IP54 L1P G2) no tiene transformador, rinde 97,5 % y declara anti-isla, monitoreo de aislación y RCMU. La coincidencia de números con el "Axpert VM IV" que vende Voltronic ([Voltronic Power](https://voltronicpower.com/en-US/Company/News/121)) y un hilo de foro que trata al Sorotec REVO II y al Axpert como la misma plataforma ([DIY Solar Forum](https://diysolarforum.com/threads/sorotec-revo-ii-5-5kw-easun-axpert-powland-igrid-ve-ii-5-5kw.23525/page-13)) sugieren que la primera familia es OEM o clon de Voltronic. **Es una inferencia: no está confirmado por el fabricante.** Sorotec mismo se presenta como "professional OEM/ODM manufacture" ([REVO HES 8 kW](https://www.sorotecpower.com/products-detail-5056664)).

Fuera de los híbridos monofásicos, el catálogo tiene cinco trifásicos o comerciales (iHESS L3P G2 de 6–12 kW y su versión de 10/15 kW, REVO HMT IP54 L3P G2, iHESS-3P con batería de alta tensión y MPGS de 60–600 kVA), tres split-phase de 120/240 V para Norteamérica, unos 8 off-grid, una familia de controladores MPPT, 10 fichas de baterías LiFePO4, 4 all-in-one, 11 UPS y una línea de telecomunicaciones de 48 VDC. La categoría "Micro Inverter" **no tiene ningún producto**: solo un texto sobre un "KS micro inverter" y la leyenda "No more~~" ([Sorotec Micro Inverter](https://www.sorotecpower.com/products-77902)). REVO II y REVO III siguen con ficha propia, pero ya no aparecen en el listado de híbridos ([REVO II](https://www.sorotecpower.com/products-detail-134126), [REVO III](https://www.sorotecpower.com/products-detail-134125)). Lo razonable es tratarlos como discontinuados.

## Híbridos monofásicos: solo el iHESS 1P trae normas de red

Las dos plataformas se distinguen por algo que importa más que la potencia: **qué declaran sobre la conexión a la red**. Todas las familias actuales dicen ser "on-grid" y casi todas ofrecen **CT anti-inyección opcional**. **Ninguna declara medidor por Modbus.** Pero solo el **iHESS 1P** publica normas de conexión a red: VDE-AR-N 4105:2018, VDE 0124:2020, CEI 0-21:2022, TOR Erzeuger A/B:2022, OVE R25:2020 y G98/G99:2022, además de IEC 62109-1/-2, IEC 62477-1 y EN IEC 61000-6-1/-3 ([iHESS 1P](https://www.sorotecpower.com/products-detail-5082453)). El resto publica solo IEC 62109-1/-2, que es seguridad del equipo y no código de red. Para ninguno se encontró EN 50549 ni NRS 097.

### Plataforma híbrida de red (sin transformador)

| Dato | iHESS 1P | iHESS L1P G2 | HMT L1P G2 / HMT IP54 L1P G2 | HES (IP66) | HES-G2 |
|---|---|---|---|---|---|
| Potencias | 3,6 / 4,6 / 5 / 6 kW | 8 / 10 / 12 kW | 6 / 8 / 10 / 12 kW | 6 / 8 / 10 kW | 6 kW (la ficha anuncia 6/8/10) |
| Red AC nominal / rango | 230 V; **176–270 V**; 50/60 Hz | 230 V; 90–280 V | 90–280 V | 230 V; 90–280 / 170–280 V | ídem HES |
| Conexión de red | L+N+PE | L+N+PE | L+N+PE | L+N+PE | L+N+PE |
| Eficiencia | 97,5 % (europea 97 %) | 97,5 % (europea 97 %) | 97,5 % (europea 97 %) | no figura en la tabla (la versión IP65 anterior dice 93 % de pico) | no publicado |
| FV máx. | 5,4 / 6,9 / 7,5 / 9 kW | 12 / **11** / 13,2 kW | 9 / 11 / 11 / 13 kW | 7 / 11 / 13 kW | 9 kW |
| Voc / ventana MPPT | 500 V; 120–500 V | 500 V; 125–425 V | 500 V; 120–450 V | 500 V; 90–450 V | no publicado (el texto dice 90–450 V) |
| MPPT / corriente | 2; 15+15 A | 2; 22+22 A | 2; 22+22 A | 1 (6 kW) o 2; 30 A o 20+20 A | 2; 16+16 A |
| Batería | 48 V (40–58 V); 100/110 A | 48 V (40–60 V); 200 A | 48 V (40–60 V); 150 A (6 kW) / 200 A | 48 V (40–63 V); 120–150 / 140–220 A | 48 V; 120/140 A |
| Backup (UPS) | <10 ms; sobrecarga del 110 % | <10 ms; pico 2× durante 10 s | <10 ms; pico 2× durante 10 s | <10 ms; sobrecarga del 110 % | **9,6 kW** (no cierra para 6 kW) |
| Paralelo | **no figura** | 6 | 6 | 6 | 6 |
| Inyección / CT | sí (anti-isla); medición no publicada | anti-isla; DRM | anti-isla; DRM | CT opcional; puerto GEN | CT opcional |
| Protecciones | anti-isla, aislación, RCMU, AFCI opcional | ídem + sobrecorriente DC | ídem | anti-isla, aislación, RCMU | ídem |
| IP | IP65 | IP66 | IP21 / IP54 | IP66 | IP66 |
| Normas | **VDE 4105, VDE 0124, CEI 0-21, TOR, OVE R25, G98/G99**, IEC 62109-1/-2, 62477-1 | solo IEC 62109-1/-2 | solo IEC 62109-1/-2 | solo IEC 62109-1/-2 | CE, CUL, FCC, TÜV CB, sin decir de qué modelo |
| Garantía | no figura (el título de la familia G2 dice 5 años) | 5 años | no publicado | 5 años | 5 años (otro texto de la misma ficha dice 1 año) |
| Medidas / peso | 480×210×495 mm; 25 kg | 765×550×272 mm; 44 kg | 445×130×620 mm; 27 kg | 700×396×192 a 630×440×215 mm; 27–38 kg | 540×390×220 mm; 23,4 kg |

Fuentes: [iHESS 1P](https://www.sorotecpower.com/products-detail-5082453), [iHESS L1P G2](https://www.sorotecpower.com/products-detail-5081640), [HMT L1P G2](https://www.sorotecpower.com/products-detail-5079918), [HMT IP54 L1P G2](https://www.sorotecpower.com/products-detail-5080097), [HES IP66 / HES-G2](https://www.sorotecpower.com/products-detail-5080326), [HES-G2 folleto](https://www.sorotecpower.com/products-detail-5044903), [HES versión anterior](https://www.sorotecpower.com/products-detail-4776463). Hay además un **HES 8 kW IP65** con ficha propia, que trae batería de 40–58 V, protocolos de litio de terceros por CAN/RS485, 4G/WiFi/BT, garantía de 5 años y "paralelo monofásico y trifásico" ([HES 8 kW IP65](https://www.sorotecpower.com/products-detail-5056664)).

### Plataforma tipo Voltronic (inversor-cargador)

| Dato | VM V | HMT PRO / HMT G2 | HMT G2-IP54 | VM IV | VM IV PRO-T | HM |
|---|---|---|---|---|---|---|
| Potencias | 6 / 8 / 11 kW | PRO 4 / 6; G2 6 / 8 / 11 kW | 4 / 6 / 6 (2 MPPT) / 11 kW | 4 / 6 / 6 / 8 / 11 kW | 4 / 6 kW | 1,5 / 2,5 / 4 / 6 kW |
| Entrada AC | 230 V; 170–280 V (PC) / 90–280 V (electrodomésticos) | 220/230/240 V; ídem | 230 V; ídem | 230 V; ídem | 230 V; ídem | 230 V; ídem |
| Salida | 220/230/240 V; surge 2× | 220/230/240 V ±5 %; surge 2× | 230 V ±5 % | 220/230/240 V | 230 V ±5 % | 230 V ±5 % |
| Eficiencia / conmutación | 93 %; 10/20 ms | 93 %; 10/20 ms | 93 %; 10/20 ms | 93 %; 10/20 ms | 93 %; 10/20 ms | hasta 93,5 %; 10/20 ms |
| Batería | 48 V | 48 V | **24 V** (4 kW) / 48 V | **24 V** (4 kW) / 48 V | 24 V (4 kW) / 48 V | 12 / 24 / 24 / 48 V |
| Carga máx. (solar/AC) | 120/120 A; 150/150 A en 11 kW | 120/100 a 150/150 A | 120/100; 150/150 A en 11 kW | 120/100 a 150/150 A | 120/100 A | 80/60 a 120/100 A |
| Voc / MPPT | 500 V; 2 × 60–450 V | 500 V; 1 o 2 × 60–450 V | 500 V; 60–450 V | 500 V; 60–450 V | 500 V; 60–450 V; 1 | 500 V; 60–450 V; 1 |
| FV máx. | 8 / 11 / 13 kW | 5 / 7 / 8 / 11 / 13 kW | 5 / 7 / 8 / 13 kW | 5 / 7 / 8 / 10 / 11 kW | 5 / 7 kW | 2,5 / 3 / 5 / 6 kW |
| Inyección / CT | "on & off-grid"; CT no figura | On grid sí; **CT opcional** | on-grid opcional; el diagrama muestra un CT | no figura | no figura | **no en 1,5/2,5; sí en 4/6 kW** |
| Paralelo | 6 (6×11 = 66 kW; admite mezclar 6 y 11 kW) | 6 | sí, sin decir cuántos | 6 | no figura | no figura en la tabla (otra ficha dice 6) |
| IP | no publicado | no figura (made-in-china dice IP54) | IP54 | no publicado | no publicado | no publicado |
| Normas | no publicadas | IEC 62109-1/-2 | IEC 62109-1/-2 | no publicadas | IEC 62109-1/-2 | IEC 62109-1/-2 |
| Garantía | no publicada | made-in-china dice 1 año | no publicada | no publicada | no publicada | no publicada |

Fuentes: [VM V soropower](https://www.soropower.com/product/revo-vm-v-hybrid-on-off-grid-energy-storage-inverter) y [VM V sorotecpower](https://www.sorotecpower.com/products-detail-5068206), [HMT PRO/G2](https://www.sorotecpower.com/products-detail-5079914), [made-in-china HMT PRO/G2](https://soropower.en.made-in-china.com/product/hYXrNDeTCkcg/China-Sorotec-Revo-Hmt-PRO-G2-High-Power-Hybrid-Energy-Storage-Solar-Inverter-11kw-Energy-Storage-Battery-Compatible-Type.html), [HMT G2-IP54](https://www.sorotecpower.com/products-detail-5080110), [VM IV](https://www.sorotecpower.com/products-detail-4776382), [VM IV PRO-T](https://www.sorotecpower.com/products-detail-4776360), [HM](https://www.sorotecpower.com/products-detail-1076685). De los legacy: el REVO II (3–5,5 kW) declara una ventana grid-tie de **184–265 V**, CT y **paralelo de hasta 9 equipos** ([REVO II](https://www.sorotecpower.com/products-detail-134126)). El REVO III (8 kW) trae el único diagrama oficial de trifásico armado con monofásicos: 3 equipos (24 kW) o 6 (48 kW) ([REVO III](https://www.sorotecpower.com/products-detail-134125)).

La diferencia práctica entre las dos plataformas es clara. La Voltronic tolera mucho mejor la sobrecarga (surge de 2× la nominal) y acepta baterías de 12/24 V en los modelos chicos. Pero su rango de red de 90–280 V "para PC/electrodomésticos" es el de un UPS, no el de un equipo con protecciones de red certificadas, y no publica normas de red. La híbrida de red rinde 4 puntos más, tiene RCMU y anti-isla, y es la única que se puede presentar ante UTE sin forzar el papel. A cambio, en los modelos HES e iHESS 1P solo soporta el **110 % de sobrecarga** en backup.

## Ningún trifásico de Sorotec acepta 3x230 V sin neutro

El dato decisivo sale de las tablas de los propios trifásicos. La serie de 48 V **iHESS L3P G2** declara un rango de red de **305–485 V**, conexión **3W+N+PE** y salida de 380/400/415 V ([hoja iHESS L3P G2](https://img.yfisher.com/tos/video-website/1048/file_01766040331773.jpg)). La **REVO HMT IP54 L3P G2** tiene la misma tabla ([hoja HMT IP54 L3P G2](https://www.soropower.com/wp-content/uploads/2025/12/HMT-IP54-L3P-G2_page-002.jpg)). El **iHESS-3P** de batería de alta tensión dice 400 V con rango de **360–400 V**, también 3W+N+PE ([tabla iHESS-3P](https://img001.video2b.com/1048/file_31721273121997.jpg)). El comercial **MPGS** pide 380/400 V ±15 % en "three-phase four-wire" ([tabla MPGS](https://img001.video2b.com/1048/file_21721284410578.jpg)). Las corrientes de salida de la serie L3P G2 (9,6 / 12,7 / 15,9 / 19,1 A para 6 a 12 kW) cierran con P/(√3·~363 V): son equipos de 400 V. En una red IT de 3x230 V faltaría el neutro y además el equipo vería una tensión de 75 a 130 V por debajo de su mínimo, así que dispararía por subtensión. **Ninguno es apto conectado directo.** No se encontró ninguna variante de baja tensión del tipo "LP3 220 V" que fabrican otras marcas, ni una oferta publicada de fabricarla.

| Dato | iHESS L3P G2 | REVO HMT IP54 L3P G2 | iHESS L3P G2 "10/15 kW" | iHESS-3P (batería AT) | MPGS (C&I) |
|---|---|---|---|---|---|
| Potencias | 6 / 8 / 10 / 12 kW | 6 / 8 / 10 / 12 kW | 10 / 15 kW (pico 30 kW) | 5 / 6 / 8 / 10 / 12 kW | 60 / 120 / 180 / 240 / 300 / 480 / 600 kVA |
| Red | **305–485 V**; 3W+N+PE | **305–485 V**; 3W+N+PE | "380 VAC" | **400 V (360–400 V)**; 3W+N+PE | 380/400 V ±15 %; 4 hilos; transformador de aislación opcional |
| Eficiencia | 97,5 % (europea 97 %) | 97,5 % (europea 97 %) | no publicado | 98 % | 98 % |
| FV máx. / Voc / MPPT | 9–18 kW; 800 V; 200–650 V; 40+20 A | 9–18 kW; 800 V; 200–650 V; 22+22 A | no publicado | 7,5–18 kW; 1000 V; 120–900 V; 16+16 A | igual a la nominal; 1000 V (el texto dice 900 V); 200–850 V |
| Batería | 48 V (40–60 V); 150–260 A | 48 V (40–60 V); 150–260 A | litio/plomo/sodio | **125–600 V**; 40 A | 620–1000 V |
| Desbalance | 100 % entre fases; hasta 50 % por fase | ídem | control por fase | no publicado | no publicado |
| Paralelo | 6 | 6 | **15, hasta 225 kW** | hay puerto; cantidad no publicada | no publicado |
| Inyección / CT | no publicado | no publicado | no publicado | puerto Meter/CT | no publicado |
| IP | IP66 | IP54 | IP66 | IP65 | IP20 |
| Normas | solo IEC 62109-1/-2 | solo IEC 62109-1/-2 | no publicadas | **VDE 4105, VDE 0124, CEI 0-21, TOR, G98/G99**, IEC 62109, 62477-1 | no publicadas |
| Garantía | 5 años | "2 a 10 años según producto" | "10 años en componentes críticos" | 5 años | no publicada |
| Medidas / peso | 440×260×700 mm; 39 kg | 445×130×620 mm; 27 kg | no publicado | 570×210×475 mm; 28,5 kg | 800×800×2160 a 1600×800×2160 mm; 465–1800 kg |

Fuentes: [iHESS L3P G2](https://www.sorotecpower.com/products-detail-5081650), [HMT IP54 L3P G2 en soropower](https://www.soropower.com/product/three-phase-ip54-revo-hmt-ip54-l3p-g2-hybrid-energy-storage-inverter-6-12kw/), [iHESS L3P G2 10/15 kW](https://www.sorotecpower.com/products-detail-5079189), [iHESS-3P](https://www.sorotecpower.com/products-detail-4776869), [MPGS](https://www.sorotecpower.com/products-detail-4776905).

**Respuesta a la segunda pregunta: el monofásico entre fases.** En Uruguay es la conexión normal. La norma de enlace de UTE clasifica sus suministros en **IT trifásico con neutro aislado** (monofásico de 230 V y trifásico de 230 V) y **TT con neutro a tierra y distribuido** (monofásico de 230 V y trifásico de 400 V) ([UTE, Norma de Instalaciones de Enlace de BT](https://www.ute.com.uy/sites/default/files/files-cuerpo-paginas/Norma%20de%20Instalaciones%20de%20Enlace%20de%20BT_0.pdf)). La FING lo dice con todas las letras: "Monofásica 220V entre fases" ([FING-IIE, Tipos de suministro](https://iie.fing.edu.uy/ense/asign/iiee/Documentos/Teorico/Tipos_suministro.pdf)). Cualquier Sorotec monofásico de 230 V tiene la tensión dentro de rango, y su control se sincroniza a la diferencia L-"N" sin saber que el "N" es otra fase. **Sorotec no documenta en ningún lado que admita esa conexión, ni que la prohíba.** Los riesgos están en las funciones que miran el N contra tierra, y lo que sigue es **inferencia técnica, no dato del fabricante**. En la plataforma híbrida, el monitoreo de aislación y el RCMU están referidos a "L+N+PE": un borne N a unos 115–133 V de tierra puede disparar fallas de aislación. El caso análogo en Victron muestra que la verificación de neutro-tierra falla en 3x230 V sin neutro ([Victron Community](https://communityarchive.victronenergy.com/questions/130767/what-is-the-best-solution-for-ess-on-a-3-phase-230.html)). En la plataforma Voltronic, el manual genérico de la familia Axpert dice que el enlace N-PE no es interno: es un contacto seco (programa 38, deshabilitado por defecto) que comanda una caja de puesta a tierra externa solo en modo batería ([Manual Axpert 1.5/3.6/5.6 kVA](https://solartech.ro/wp-content/uploads/2022/02/1-22010G14219.pdf)). Hay un punto a favor: los diagramas de bloques oficiales de HM, HMT y HES muestran que el **relé de red corta L y N a la vez** ([HM](https://www.sorotecpower.com/products-detail-1076685), [HES-G2 folleto](https://www.sorotecpower.com/products-detail-5044903)). Si esa transferencia bipolar se confirma, en backup la salida queda separada de la red y poner a tierra el neutro de salida no transfiere el defecto a UTE. Si se confirma que es unipolar, **habilitar el enlace N-PE pondría a tierra una fase de UTE**, y eso choca con el Cap. XXVIII ("no transferencia de defectos a la Red de UTE").

**Tres monofásicos formando un trifásico de 230 V es otro problema.** El modo de paralelo trifásico de Sorotec y Voltronic está diseñado en estrella con neutro común ([Manual Axpert](https://solartech.ro/wp-content/uploads/2022/02/1-22010G14219.pdf), [REVO III](https://www.sorotecpower.com/products-detail-134125)): con unidades de 230 V da 230/400 V, no 3x230 V. Armarlo en triángulo y en isla cierra un lazo de tres fuentes de tensión con riesgo de corrientes circulantes, y no se encontró ningún fabricante que lo documente. Conectados a red, sin isla, tres monofásicos independientes, cada uno entre un par de fases, sí funcionan, y UTE los acepta si son idénticos y se conectan y desconectan a la vez ([UTE, RBT Cap. XXVIII](https://www.ute.com.uy/sites/default/files/generico/Cap%C3%ADtulo%20XXVIII%202020.pdf)). La otra vía para usar un trifásico de 400 V en red IT es un **transformador de aislación Dyn** (triángulo de 230 V del lado de UTE, estrella de 400/230 V con neutro a tierra del lado del inversor). Es justo el grupo que el Cap. XXVIII admite. Un autotransformador o un zig-zag **no sirven**: no dan separación galvánica y pondrían a tierra la red de UTE ([UTE, RBT Cap. XXVIII](https://www.ute.com.uy/sites/default/files/generico/Cap%C3%ADtulo%20XXVIII%202020.pdf)). Las pérdidas en vacío, la corriente de inserción y el costo de esa solución no se relevaron.

## UTE habilita por declaración jurada, y a Sorotec le faltan papeles

UTE no publica una lista de inversores aprobados. El Cap. XXVIII del Reglamento de Baja Tensión dice que el instalador presenta una **declaración jurada** de cumplimiento, basada "en ensayos o evaluaciones documentadas por el fabricante, importador o terceros" ([UTE, RBT Cap. XXVIII](https://www.ute.com.uy/sites/default/files/generico/Cap%C3%ADtulo%20XXVIII%202020.pdf)). La falsedad en esa declaración cae bajo el art. 239 del Código Penal ([UTE, DJ de Cumplimiento](https://ute.com.uy/sites/default/files/files-cuerpo-paginas/DJ%20de%20Cumplimiento%20con%20los%20Requisitos%20T%C3%A9cnicos.pdf)). La pregunta útil, entonces, no es si Sorotec "está aprobado", sino **si Voltia puede firmar la declaración con respaldo documental**. Hoy, con lo que Sorotec publica, no puede para ningún modelo sin pedir más papeles.

| Exigencia de UTE (Cap. XXVIII y DJ vigente) | Lo que publica Sorotec |
|---|---|
| Conversor con IEC 62109-1/-2 o IEC 62477-1 | Declarado en tablas de casi todos los modelos; certificados por modelo no publicados. Los CE (LVD/EMC) que se muestran son de REVO III 8 kW y REVO VM II 8 kW, incluso en fichas de otros equipos ([certificado LVD](https://img.yfisher.com/tos/video-website/1048/file_01767510526362.jpg)) |
| Armónicos y flicker IEC 61000-3-2/3-3 (≤16 A), 3-11/3-12 (16–75 A), 3-4/3-5 | Solo EN IEC 61000-6-x (inmunidad y emisión) en iHESS 1P e iHESS-3P; el CE EMC de 2022 menciona 61000-3-11/3-12 para REVO III y VM II ([VM II PRO US](https://www.sorotecpower.com/products-detail-5104959)) |
| Limitación de inyección de corriente continua (≤0,5 % de In) por transformador BF o "sistema equivalente" con **certificado de laboratorio independiente / organismo acreditado** | No publicado en ningún modelo; todos los híbridos de red son sin transformador |
| Protecciones según EN 50438 (85/110/115 %, 47/51 Hz), **no modificables por el usuario** | No publicado. En la plataforma Voltronic los ajustes son programas accesibles desde el panel (inferido del manual Axpert) |
| Anti-isla ≤500 ms; reconexión ≥3 min; FP ≥0,95 | Anti-isla declarado en la plataforma de red; los tiempos no se publican |
| Falla de aislación según IEC 62109-2 (sin transformador: avisar y no conectar) | Monitoreo de aislación declarado en la plataforma de red |
| Baterías IEC 62619 / IEC 62485; conversor, batería y BMS compatibles "según lo declarado por los fabricantes" | Solo la batería SL-RH de alta tensión declara IEC 62619; ninguna ficha nombra baterías ni protocolos compatibles |
| Respaldo con baterías: unifilar alternativo aprobado por UTE y **llave de doble vía** (Cap. XXV) | Responsabilidad del instalador |
| Monofásico en suministro monofásico; en trifásico ≤10 kW, desbalance ≤5 kW; >10 kW trifásico o monofásicos idénticos con desconexión simultánea | — |
| Vía IAC (instalación para autoconsumo con inyección cero) | CT anti-inyección opcional en la mayoría; no hay certificado de inyección cero |

Fuentes: [UTE, RBT Cap. XXVIII](https://www.ute.com.uy/sites/default/files/generico/Cap%C3%ADtulo%20XXVIII%202020.pdf), [UTE, DJ de Cumplimiento con los Requisitos Técnicos](https://ute.com.uy/sites/default/files/files-cuerpo-paginas/DJ%20de%20Cumplimiento%20con%20los%20Requisitos%20T%C3%A9cnicos.pdf).

Hay tres matices. La versión del Cap. XXVIII que se leyó dice "Octubre '18" (el archivo se llama 2020), y no se confirmó si hay una posterior. Tampoco se verificó si URSEA exige un registro aparte del producto para importarlo. Y el certificado CB de TÜV que Sorotec menciona como empresa **podría** cubrir IEC 62109, pero es una suposición mientras no aparezca el informe con el número del modelo. A modo de referencia, un competidor como Deye declara en sus híbridos IEC 61727, IEC 62116, EN 50549 y NRS 097 ([GreenSun, Deye SG04LP3-EU-AM2-LV](https://www.greensunbattery.com/deye-new-three-phase-127v220v-voltage-hybrid-inverter-5-12kw)). Ese es el nivel de documentación que hay que pedirle a Sorotec.

## Off-grid, split-phase, controladores MPPT y micro: útiles fuera de la red o descartables

Los off-grid son todos monofásicos de 230 V y 50/60 Hz, con transferencia de 10/20 ms y entrada de 170–280 V o 90–280 V. Por tensión y frecuencia sirven en Uruguay. Ninguna ficha publica el grado IP ni la garantía por modelo. El único dato de garantía es un texto genérico de "2-5 years warranty (depending on product)" ([MPPT SCC IP20](https://www.sorotecpower.com/products-detail-5081041)).

| Modelo | Potencia / pico | Batería | Carga solar / AC | Voc · MPPT · FV máx. | Red / paralelo | Eficiencia | Peso | Normas |
|---|---|---|---|---|---|---|---|---|
| REVO MPI 6 / 10 kW | 6 / 10 kW; pico 12 / 20 kVA | **sin sección de batería en la tabla** | no publicado | 500 V · 60–450 V · 2 o 3 × 4,5 kW | "On Grid: Yes (optional)"; CT; paralelo no publicado | 97 % | 4,9 / 5,7 kg | IEC 62109-1/-2 |
| REVO VM II PRO 1,6–6 kW | 1,6 / 3,2 / 4 / 6 kW; pico 2× | 12 / 24 / 24 / 48 V | 80/60 a 120/80 A | 500 V · 60–450 V · 2–5,5 kW | no publicado | 93 % | 5–9 kg | IEC 62109-1/-2 |
| REVO HM 4 / 6 kW | 4 / 6 kW; pico 2× | 24 / 48 V | 120/100 A | 500 V · 60–450 V · 5 / 7 kW | **On Grid sí; paralelo hasta 6** | 93 % | 8,5 / 9 kg | IEC 62109-1/-2 |
| REVO VM III-T 4 / 6 kW | 4 / 6 kW | 24 / 48 V | 120/100 A | 500 V · 60–450 V · 5 / 7 kW | las dos fichas se contradicen | 93 % | 8,5 / 9 kg | IEC 62109-1/-2 |
| REVO VM IV Pro 3,6 / 5,6 kW | 3,6 / 5,6 kW | 24 / 48 V | 120/100 A | 500 V · **120–450 V** · 4,5 / 6 kW | no publicado | 93,5 % | 8,5 / 9 kg | no publicadas |
| REVO VM IV PRO-T 4 / 6 kW | 4 / 6 kW | 24 / 48 V | 120/100 A | 500 V · 60–450 V · 5 / 6 kW | las fichas se contradicen | 93,5 % | 8,5 / 9 kg | IEC 62109-1/-2 |
| REVO VM II Pro_1 1,5 / 2,5 kW | 1,5 / 2,5 kW | 12 / 24 V | 80/60 A | **450 V** · 120–450 V · 2 / 3 kW | no publicado | 94 % | 4 / 5 kg | no publicadas |
| REVO VP (PWM) 1–5 kW | 1 / 2 / 3 / 5 kW | 12 / 24 / 24 / 48 V | 50 A solar | 55–105 V · PWM · 0,6–2,4 kW | no | 93 % | 4,4–8,5 kg | CE, ISO 9001 |
| REVO VM (MPPT de baja) 1,2–5 kW | 1,2 / 2,2 / 3,2 / 5 kW | 12 / 24 / 24 / 48 V | 50–65 A solar | 102–145 V · hasta 115 V · 0,7–3 kW | no | 93 % | 4,4–9,7 kg | no publicadas |

Fuentes: [REVO MPI](https://www.sorotecpower.com/products-detail-5053614), [VM II PRO](https://www.sorotecpower.com/products-detail-4775798), [HM off-grid](https://www.sorotecpower.com/products-detail-4776311), [VM III-T](https://www.sorotecpower.com/products-detail-4775844), [VM IV Pro](https://www.sorotecpower.com/products-detail-326562), [VM IV PRO-T](https://www.sorotecpower.com/products-detail-2088874), [VM II Pro_1](https://www.sorotecpower.com/products-detail-774213), [VP/VM](https://www.sorotecpower.com/products-detail-4775760).

Los **split-phase** (iHESS L2P G2, REVO HMT IP54 L2P G2 y REVO HMT L2P G2 IP21, de 8/10/12 kW) comparten la misma tabla eléctrica: 120/240 V con L1/L2/N/PE, entrada de **90–140 V por rama**, batería de 48 V y 2 MPPT de 60–450 V a 22 A ([iHESS L2P G2](https://www.sorotecpower.com/products-detail-5081851), [HMT IP54 L2P G2](https://www.sorotecpower.com/products-detail-5080100), [HMT L2P G2 IP21](https://www.sorotecpower.com/products-detail-5079922)). Difieren en IP (66, 54 o 21) y en garantía (5 años, no publicada o 3 años). **Para Uruguay se descartan**: 230 V aplicados a una rama quedan fuera del rango de 140 V, y la salida da 120 V fase-neutro. Su único uso posible sería un sistema aislado con cargas conectadas entre L1 y L2 a 240 V, y eso el fabricante no lo documenta. El VM II PRO US es monofásico de 120 V y tampoco sirve ([VM II PRO US](https://www.sorotecpower.com/products-detail-5104959)). Los **microinversores** no existen en el catálogo publicado.

Los **controladores MPPT** son una sola familia de cuatro modelos y son lo más limpio del catálogo para sitios aislados chicos. Una advertencia de diseño: son de **tierra positiva**, así que no se puede poner a tierra el negativo del sistema sin verificarlo antes.

| Modelo | Sistema | Carga / salida a consumo | Voc FV | Ventana MPPT | Eficiencia / seguimiento | IP | Garantía |
|---|---|---|---|---|---|---|---|
| SCC40A | 12/24 V automático | 40 A / 20 A | <100 V | 15–80 / 30–80 V | 97 % / 99 % | IP20, sin ventilador | 2 años (ficha B) / 3 años (ficha A) |
| SCC60A | 12/24/48 V automático | 60 A / 20 A | <150 V | 15–130 / 30–130 / 60–130 V | 97 % / 99 % | IP20 | 2 / 3 años |
| SCC80A | 12/24/48 V | 80 A / 40 A | <200 V | 15–170 / 30–170 / 60–170 V | 97 % / 99 % | IP20 | 2 / 3 años |
| SCC100A | 12/24/48 V | 100 A / 40 A | <200 V | 15–170 / 30–170 / 60–170 V | 97 % / 99 % | IP20 | 2 / 3 años |

Fuentes: [MPPT SCC ficha B](https://www.sorotecpower.com/products-detail-5081041), [MPPT SCC ficha A](https://www.sorotecpower.com/products-detail-4776864). Aceptan baterías de gel, inundadas, litio y perfil de usuario, y se comunican por RS232, con WiFi o Bluetooth opcionales. La potencia FV máxima por modelo y las certificaciones no están publicadas.

## Baterías, all-in-one y UPS: una sola batería certificada

Las baterías son todas LiFePO4 y todas hablan CAN y RS485, pero **ninguna ficha nombra marcas de inversor compatibles**. Dicen "mainstream inverters" o "SOROTEC and many other hybrid inverters". Solo la **SL-RH** en rack de alta tensión publica certificaciones de producto (CE, IEC 62619, UL 1973, UL 9540A, UN 38.3) y 10 años de garantía ([SL-RH](https://www.sorotecpower.com/ip20-rack-mounted-energy-storage-battery-sl-rh-series-10-year-warranty.html)). Esto pesa en el ítem 6 de la declaración jurada de UTE, que exige IEC 62619 o IEC 62485: **ninguna batería de 48 V de pared lo acredita en su ficha**.

| Modelo | Tensión | Capacidad | Ciclos / DoD | Corriente | Formato / IP | Certificaciones | Garantía |
|---|---|---|---|---|---|---|---|
| SL-W-02 | 25,6 / 51,2 V | 300 Ah (≈15,4 kWh a 51,2 V) | >6000; DoD no publicado | 200 A descarga / 150 A carga | pared, modular; IP20 | CE, CUL, FCC, TÜV CB | 5 años |
| SL-W/SL-R (y versión Upgraded táctil) | 24 / 48 V | 100–480 Ah (el texto dice 100–300) | 6000 al 100 % | "hasta 100 A/300 A" | pared | solo de empresa | 5 años |
| IP20 SL-W/SL-R 300 Ah | 25,6 / 48 / 51,2 V | hasta 15,36 kWh | 6000 al 100 % | 100 A carga / 200 A descarga | pared; IP20 | no publicadas | 5 años |
| SL-W 100–200 Ah | 24 / 48 V | 100–200 Ah | 6000 | 100/200 A; pulso de 200 A por 5 s | pared | no publicadas | 5 años |
| Wall Mounted 51,2 V y Home Solar 48 V | 48 / 51,2 V | 50–200 Ah | vida ">6 años" | pulso de 120 A | pared | solo RoHS | no publicada |
| SL-RH/S-EU | 48 V (43,2–58,4 V) | 25,6 / 51,2 kWh | **4000 al 90 % o 6000** | hasta 150 A | modular; **IP21 o IP20** | no publicadas | **1 o 10 años** |
| SL-RH (rack 19") | **153,6 / 409,6 / 614,4 V** | 5,12 kWh/módulo; hasta 55,29 kWh útiles | 6000 (70 % de retención); 90 % DoD | no publicado | rack hot-swap; IP20 | **CE, IEC 62619, UL 1973, UL 9540A, UN 38.3** | **10 años** |
| SL-S-EU | alta tensión (valor no publicado) | no publicado | 6000 | no publicado | apilable | "normas europeas" | 5 años |

Fuentes: [SL-W-02](https://www.sorotecpower.com/products-detail-5086238), [SL-W/SL-R](https://www.sorotecpower.com/products-detail-4776925), [Upgraded](https://www.sorotecpower.com/products-detail-5069747), [IP20 300 Ah](https://www.sorotecpower.com/ip20-sl-w-sl-r-series-lifepo-battery-300ah-models-6000-cycles-wall-mounted-household-battery-storage.html), [SL-W](https://www.sorotecpower.com/products-detail-982112), [51,2 V](https://www.sorotecpower.com/products-detail-274307), [48 V](https://www.sorotecpower.com/products-detail-273720), [SL-RH/S-EU](https://www.sorotecpower.com/products-detail-4776951), [SL-S-EU](https://www.sorotecpower.com/products-detail-5087039).

Entre los **all-in-one**, el **iHESS-M 1P** (6 kW monofásico, IP65, 97,5 %, MPPT de 90–500 V, módulo SL-M48100 de 5,12 kWh a 48 V, con CE, VDE 0124 y G99) es el segundo equipo monofásico con alguna norma de red publicada ([iHESS-M 1P](https://www.sorotecpower.com/best-single-phase-ip65-ihess-m-1p-integrated-energy-storage-system-6kw-5-12kwh-company-sorotec.html)). El **iHESS-M-H 3P** (5–12 kW, de 1 a 6 módulos, de 4,75 a 28,5 kWh útiles, FV hasta 1000 V, con VDE-AR-N 4105, G99 y EN 50549) dice ser "compatible con redes trifásicas de 400 V", así que sirve solo en TT ([iHESS-M-H 3P](https://www.sorotecpower.com/best-three-phase-ip65-energy-storage-inverter-ihess-m-h-3p-efficient-and-stable-company-sorotec.html)). El **REVO HESS** de 6/8 kW no publica fase, tensión ni IP, y su capacidad aparece como "5000Wh*2" en una ficha y 6/8 kWh en la otra ([REVO HESS](https://www.sorotecpower.com/products-detail-4776873), [REVO HESS customized](https://www.sorotecpower.com/customized-revo-hess-hybrid-all-in-one-energy-storage-system-6-8kwh-manufacturers-from-china-sorotec.html)).

Los **UPS** van de 1 a 800 kVA. Los monofásicos HP9116C y HP9116CR PLUS (1–10 kVA, alta frecuencia, hasta 3 en paralelo) y el GP9111C (de baja frecuencia, 220 V monofásico) sirven en 230 V. **Ningún UPS trifásico publica entrada de 3x230 V entre fases**: los GP9315C, GP9335C, IPS9335C e IPS9315C piden 380/400/415 V en cuatro hilos, y el HP9335C Plus está especificado fase-neutro (110–300 V F-N) ([listado UPS](https://www.sorotecpower.com/products-23646), [HP9335C Plus](https://www.sorotecpower.com/products-detail-134112), [GP9335C](https://www.sorotecpower.com/products-detail-134115)). El único con un rango que podría abarcar 230 V entre fases es el modular MPS9335C II (138–485 V, sin aclarar si F-N o F-F), y eso habría que confirmarlo ([MPS9335C II](https://www.sorotecpower.com/products-detail-167417)). Solo los GP e IPS declaran IEC/EN 62040. Ningún UPS publica garantía. La línea de telecomunicaciones (SHW de 48 VDC y el gabinete SES de 100–215 kWh a 380/400 V) queda fuera del negocio de Voltia ([Telecom](https://www.sorotecpower.com/products-23647)).

## Las inconsistencias obligan a pedir hojas firmadas por modelo

Las fichas de Sorotec tienen errores que impiden dimensionar sin confirmación previa. Las que más afectan un diseño son estas:

| Producto | Inconsistencia | Fuente |
|---|---|---|
| iHESS L1P G2 10 kW | FV máx. de 11 kW, menor que los 12 kW del modelo de 8 kW | [ficha](https://www.sorotecpower.com/products-detail-5081640) |
| HMT L1P G2 8 kW | corriente de red de 40 A (8000/230 da 34,8 A) | [ficha](https://www.sorotecpower.com/products-detail-5079918) |
| HES-G2 | salida UPS de 9,6 kW en un equipo de 6 kW; la ficha anuncia 6/8/10 kW pero la tabla solo trae 6 kW; Voc en blanco; garantía de 5 años en el título y "un año" en el texto | [HES IP66](https://www.sorotecpower.com/products-detail-5080326), [HES-G2](https://www.sorotecpower.com/products-detail-5044903) |
| HES IP66 | rangos "PC/electrodomésticos" invertidos respecto de los demás modelos | [ficha](https://www.sorotecpower.com/products-detail-5080326) |
| VM V | LCD de 4,3" en la tabla y táctil de 5" en la ficha; IP66 solo según un revendedor | [VM V](https://www.sorotecpower.com/products-detail-5068206) |
| REVO II / REVO III | FV de 4500 o 5000 W; 2 MPPT de 4000 o 5000 W | [REVO II](https://www.sorotecpower.com/products-detail-134126), [REVO III 2×4000](https://www.sorotecpower.com/products-detail-276580) |
| iHESS L3P G2 10/15 kW | adjunta la hoja de 6–12 kW; paralelo de 15 unidades contra 6 en la serie; garantía de 10 años contra 5 | [ficha](https://www.sorotecpower.com/products-detail-5079189) |
| iHESS-3P | rango de red de 360–400 V, sin margen hacia arriba; 6,8 A en 6 kW contra 8 A en 5 kW | [tabla](https://img001.video2b.com/1048/file_31721273121997.jpg) |
| MPGS | Voc de 1000 V en la tabla y 900 V en el texto; "50–600 kW" contra una tabla que arranca en 60 kVA | [ficha](https://www.sorotecpower.com/products-detail-4776905) |
| Certificados CE | la ficha del trifásico muestra los CE del REVO III y del VM II (monofásicos de 2022) | [CE EMC](https://img.yfisher.com/tos/video-website/1048/file_01767510413453.jpg) |
| VM III-T, VM IV PRO-T | la misma ficha dice "off-grid" y "on-grid and off-grid" | [VM IV PRO-T](https://www.sorotecpower.com/products-detail-2088874) |
| MPPT SCC | garantía de 2 o 3 años y pesos distintos entre las dos fichas | [A](https://www.sorotecpower.com/products-detail-4776864), [B](https://www.sorotecpower.com/products-detail-5081041) |
| SL-RH/S-EU | 4000 o 6000 ciclos; 1 o 10 años; IP20 o IP21; "153,6 V" en el título contra un rango de 43,2–58,4 V | [ficha](https://www.sorotecpower.com/products-detail-4776951) |
| iHESS-M-H 3P | la categoría de soropower.com está vacía, pero sorotecpower.com tiene la ficha | [soropower](https://www.soropower.com/product-category/solar-inverter/all-in-one-ess/ihess-m-h-3p/), [sorotecpower](https://www.sorotecpower.com/best-three-phase-ip65-energy-storage-inverter-ihess-m-h-3p-efficient-and-stable-company-sorotec.html) |

## Qué conviene a Voltia y qué pedirle a Sorotec antes de comprar

El orden de la lista sigue un criterio: primero lo que se puede presentar ante UTE, después lo que sirve para sistemas aislados y al final lo que sirve solo en zonas TT de 400 V. **Las prioridades son una recomendación propia a partir de los datos, no algo que diga Sorotec.**

| Prioridad | Producto | Para qué le sirve a Voltia | Condición antes de comprar |
|---|---|---|---|
| 1 | **iHESS 1P 3,6–6 kW** | Microgeneración monofásica con backup; el único híbrido con normas de red publicadas; 97,5 %, IP65, RCMU, AFCI opcional | Certificado de inyección de corriente continua de laboratorio acreditado; ajuste y bloqueo de umbrales según UTE; confirmación por escrito de la conexión entre fases en red IT; tope de 6 kW (no publica paralelo) |
| 2 | **iHESS-M 1P** (all-in-one de 6 kW) | La misma propuesta en una sola caja, con VDE 0124 y G99 publicados | Lo mismo, más la tensión AC y la cantidad de módulos, que no están publicadas, y la IEC 62619 del módulo |
| 3 | **iHESS L1P G2 / HMT L1P G2** (8–12 kW) | Monofásico grande o trifásico armado con 3 monofásicos idénticos a red; 200 A de carga; paralelo de 6 | Normas de red (hoy solo publica IEC 62109); corrección de las erratas de FV y corriente |
| 4 | **VM V / HMT PRO-G2** (plataforma Voltronic) | Sistemas aislados rurales y backup sin inyección; surge de 2×; paralelo de 6, también trifásico (2+2+2) | No usarlos como IMG sin certificados de red; confirmar transferencia bipolar y cómo se gestiona el enlace N-PE |
| 5 | **MPPT SCC 60–100 A** | Sitios aislados chicos de 12/24/48 V | Tierra positiva; garantía de 2 o 3 años |
| 6 | **SL-RH** (batería AT) / baterías de 48 V de pared | Baterías del sistema | Para las de pared: IEC 62619, UN 38.3 y lista de inversores y protocolos compatibles (Pylontech, Deye, Growatt, Victron) |
| 7 | **iHESS-3P / iHESS-M-H 3P** | Solo en suministros TT de 400 V con neutro (interior) | Confirmar que el rango de 360–400 V tolera la red uruguaya (+10 %); batería AT compatible |
| No | Trifásicos L3P G2, MPGS y UPS trifásicos | Inservibles en red IT sin un transformador Dyn | Solo si Sorotec cotiza una versión de 3x230 V o el transformador de aislación |
| No | Split-phase, VP/VM PWM, microinversores | No sirven en la red uruguaya, son tecnología vieja o no existen | — |

La consulta a Sorotec (ella@soroups.com, +86-755-81495850) conviene hacerla en un solo correo, pidiendo documentos firmados por modelo:

| # | Pregunta o documento |
|---|---|
| 1 | Hoja de datos firmada y **manual de instalación completo** (en PDF) del iHESS 1P, iHESS-M 1P, iHESS L1P G2, HMT L1P G2, VM V y HMT PRO/G2, y el catálogo completo cuyas páginas numeradas ("21/22", "27/28", "31/32") aparecen en las imágenes |
| 2 | **Informes de ensayo y certificados por modelo** (no de empresa ni de otros equipos): IEC 62109-1/-2 o IEC 62477-1 con número de informe CB; IEC 61000-3-2/3-3 o 3-11/3-12; IEC 62116 / IEC 61727 o EN 50549; certificados VDE 4105 / G99 / CEI 0-21 que respalden lo que dice la tabla del iHESS 1P |
| 3 | **Certificado de limitación de inyección de corriente continua** (≤0,5 % de In) emitido por un laboratorio independiente u organismo acreditado, para cada híbrido sin transformador |
| 4 | Si los umbrales de tensión y frecuencia (85 % y 110 % a 1,5 s; 115 % a 0,2 s; 47 y 51 Hz a 0,5 s), el anti-isla (≤500 ms) y la reconexión (≥3 min) se pueden programar y **bloquear con contraseña** para el usuario final; si hay preset o perfil personalizado |
| 5 | **Confirmación por escrito**: ¿el modelo puede conectarse entre dos fases de una red IT de 3x230 V sin neutro, con el borne N a unos 133 V de tierra? ¿Disparan el monitoreo de aislación, el RCMU o la detección de N-PE? |
| 6 | ¿El relé de transferencia es **bipolar** (abre L y N)? ¿Hay relé N-PE interno en modo backup, cómo se configura y puede deshabilitarse? ¿Neutro de entrada y de salida son comunes en bypass? |
| 7 | ¿Se puede armar un trifásico con 3 monofásicos a red, cada uno entre un par de fases (triángulo), con desconexión simultánea? ¿El modo de paralelo trifásico admite triángulo o solo estrella con neutro? |
| 8 | ¿Fabrican o cotizan una **versión trifásica para 3x220/230 V entre fases sin neutro** (como las "LP3 220 V" de otras marcas)? Si no, ¿el MPGS se puede pedir con transformador de aislación Dyn de primario a 230 V? |
| 9 | Inyección cero: ¿solo con CT o también con medidor Modbus? ¿Monofásico o trifásico? ¿Qué precisión y tiempo de respuesta tiene? |
| 10 | Lista oficial de **baterías y protocolos BMS compatibles** (Pylontech, etc.), e IEC 62619 / UN 38.3 de las baterías de 48 V de pared y del módulo SL-M48100 |
| 11 | Garantía por modelo, por escrito (las fichas dicen 1, 2–5, 5 o 10 años según la página), con condiciones, plazos de reposición y soporte en Sudamérica |
| 12 | Corrección de erratas: FV del iHESS L1P G2 de 10 kW, corriente del HMT L1P G2 de 8 kW, tabla del HES-G2 de 8/10 kW, rango de red del iHESS-3P, IP del VM V y del HMT PRO/G2 |
| 13 | ¿La plataforma VM/HMT es OEM de Voltronic? ¿Con qué firmware y qué aplicación o portal de monitoreo? ¿Hay acceso a Modbus o API para integrarlo con Voltia PM? |

## Conclusión

Sorotec no es una marca de microgeneración con documentación lista para UTE: es un fabricante OEM/ODM con un catálogo amplio y fichas de calidad despareja, donde la misma electrónica aparece bajo nombres distintos y los certificados publicados son de la empresa o de otros modelos. En Uruguay, la red IT de 3x230 V deja afuera a toda su línea trifásica. Para Voltia, el valor real está en un nicho angosto: el iHESS 1P (y su versión all-in-one) como híbrido monofásico con respaldo hasta 6 kW, y la plataforma Voltronic para sistemas aislados, donde UTE no interviene.

Lo que cambia la decisión no es el precio ni la potencia, sino tres papeles que hoy no existen en línea: el certificado de limitación de inyección de corriente continua, la prueba de que las protecciones se pueden bloquear y la confirmación escrita sobre la conexión entre fases. Sin esos documentos, firmar la declaración jurada con un Sorotec deja la responsabilidad penal y técnica en Voltia. Si Sorotec los entrega, el iHESS 1P compite en serio. Si no, conviene acotar a Sorotec al mercado off-grid y seguir con marcas que ya documentan su compatibilidad con la red.
