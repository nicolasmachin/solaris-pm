# Enciclopedia Voltia — cómo funciona la empresa y qué criterios tomamos

**Versión 1.1 — 27/10/2026**
Recopilación de los criterios comerciales, operativos, regulatorios y de ingeniería de Voltia SAS, armada a partir de las conversaciones de trabajo con Nicolás, la skill `voltia-fv-ingenieria` (v3.5), las skills de soporte Growatt, visita a cliente e informe de visita técnica, y datos de Voltia PM al 27/10/2026.

> **Cómo leer este documento**
> - **[DECIDIDO]** criterio cerrado por Nicolás. No se reabre sin motivo nuevo.
> - **[CRITERIO]** forma habitual de resolver, con margen de juicio por obra.
> - **[PENDIENTE]** tema abierto o a confirmar.
> - **[DATO PM]** número sacado de Voltia PM a la fecha de esta versión. Cambia con el tiempo.
> - **[LECCIÓN]** error real que ya pasó y no se repite.
> - **[Corregido 27/10]** decisión de Nicolás al revisar la base de conocimiento.
> - **[A DECIDIR]** choca con otro documento y falta definir.
>
> Si algo de este documento choca con una ficha técnica vigente o con la última versión del reglamento de UTE, manda la fuente vigente. Este documento no reemplaza la ficha ni la norma.
>
> Es una fuente de la base de conocimiento (`README.md`): si choca con los archivos de tema (`01` a `08`) o con `cifras-vigentes.md`, mandan esos.

---

## Índice

1. La empresa
2. Ventas
3. Proceso de obra (pipeline de Voltia PM)
4. UTE y marco regulatorio
5. Ingeniería eléctrica DC
6. Ingeniería eléctrica AC
7. Tableros y protecciones
8. Puesta a tierra
9. Redes uruguayas, inversores y configuración
10. Smart meters y comunicación
11. Estructura y viento
12. Tipologías de montaje
13. Entregables y documentación
14. Postventa, soporte y diagnóstico
15. Componentes estándar
16. Lecciones aprendidas (errores que no se repiten)
17. Obras de referencia
18. Pendientes y discrepancias abiertas
19. Glosario

---

## 1. La empresa

### 1.1 Identidad

| Dato | Valor |
|---|---|
| Razón social | Voltia SAS |
| Dirección | Rondeau 2110, Montevideo |
| Inicio de actividad | 16/06/2022 |
| Actividad | Diseño, venta, instalación y tramitación de sistemas solares fotovoltaicos on-grid (microgeneración), residenciales, comerciales e industriales |
| Responsable técnico | Ing. Nicolás Machín — fundador y Director Técnico, técnico instalador Categoría A ante UTE. Firma todos los entregables de ingeniería |
| Correo técnico | nicolas@voltia.com.uy (nmachin@voltia.com.uy sigue figurando en trámites UTE viejos) |
| Colores de marca | Azul `#1836B2`, amarillo `#F5C400`, tinta `#15171C`, gris `#F2F4F8`, bordes `#D5DAE1`. Tipografías Archivo (títulos) e IBM Plex Sans (texto) |
| Logo | Logo blanco sobre azul (adjunto del proyecto `Artboard 1 copy 62xotro azul.png`) |

### 1.2 Equipo y roles

| Persona | Rol |
|---|---|
| Nicolás Machín | Dirección, ingeniería (firma), ventas de proyectos grandes, decisiones técnicas finales |
| Gabriel Vera | Encargado de Operaciones (desde abril 2026). Coordina cuadrillas, obra y compras |
| Luna Toja | Proyectista. Ciclo completo de ingeniería (preingeniería → ingeniería final) y tramitación UTE, bajo revisión de Nicolás |
| Alejandra Yañez | Experiencia Solar (postventa) |
| Martín García, July Correa | Asesores comerciales (según registros de ventas de Voltia PM) |
| Capataz / instaladores (ej. Fernando) | Ejecución de obra; informe del capataz antes de la ingeniería final |
| Agustín | Ingeniero civil consultado en temas estructurales (no firma; los criterios de viento son internos de Voltia firmados por Nicolás) |

**Regla de flujo [DECIDIDO]:** Operaciones carga la instalación completa en Voltia PM antes de que Luna tramite. La ingeniería tiene que salir en tiempo para que Operaciones pueda exigir plazos al resto.

### 1.3 Herramientas

- **Voltia PM** (app.voltia.com.uy): ERP de la empresa. Leads, propuestas, cobros por etapa, pipeline de obra, trámite UTE, compras, pagos a instaladores, comisiones, monitoreo de plantas, tickets. Tiene conector MCP propio para usarlo desde Claude.
- **Facturación electrónica:** Biller (integración por API con Voltia PM en curso). La unipersonal de Nicolás factura aparte.
- **Correo:** Zoho, con carpetas por proveedor y filtros automáticos.
- **Skills de Claude:** `voltia-fv-ingenieria` (ingeniería de obra), `soporte-inversores-growatt` (diagnóstico), `visita-cliente` (ficha antes de visita comercial), `informe-visita-tecnica` (relevamiento).
- **Monitoreo:** ShineServer / server.growatt.com (Growatt), FusionSolar (Huawei).

### 1.4 Proveedores y contactos frecuentes

| Proveedor | Para qué |
|---|---|
| Tiempo al Tiempo | Importador de paneles (incl. Restar). Contacto Daniel |
| Efergia | Distribuidor Huawei |
| Fivisa (Fierro Vignoli) | Materiales eléctricos |
| MGI S.A. | Materiales eléctricos (diferenciales, etc.) |
| Bultech | Fijaciones industriales |
| NIC Hormigones | Triángulos de hormigón prefabricados para módulos sobre losa |
| Distribuidor Growatt | Canal obligatorio de soporte: Growatt no atiende directo. Código de instalador OSS: EBLNYD |
| Prospectos Intersolar 2026 | EPEVER, Aite Fuse, Art Sign, CCM Estruturas (todavía no proveedores fijos) |

---

## 2. Ventas

### 2.1 Números del embudo 2026 [DATO PM al 27/10/2026]

| Indicador | Valor |
|---|---|
| Leads nuevos | 575 |
| Propuestas enviadas | 545 |
| Visitas realizadas | 62 |
| Ventas cerradas | 34 |
| Monto vendido (IVA incl.) | USD 438.235 |
| Ticket promedio | USD 12.889 |
| Ventas perdidas | 70 |
| Conversión (ganadas / cerradas) | 32,7% |
| Lead → propuesta | 1,3 días |
| Propuesta → visita | 24 días |
| Visita → cierre | 33,4 días |
| Obras realizadas | 55 |
| kWp instalados | 497 |

Lectura: casi todo lead recibe propuesta en el día; el cuello está entre propuesta y visita. La venta típica residencial está entre USD 10.000 y 15.000; los proyectos comerciales grandes (USD 30.000–50.000) los cierra Nicolás o pasan por él.

**[PENDIENTE]** El origen del lead ("¿Cómo nos conoció?") está sin dato en el 98% de los registros. Hasta que se cargue sistemáticamente no se puede medir qué canal vende. (Desde el 22/10/2026 el campo es obligatorio en pantalla.)

### 2.2 Flujo comercial

1. **Lead** entra (WhatsApp, Instagram, recomendación) → se carga en Voltia PM.
2. **Propuesta** automática (Propuestas v2 en Voltia PM) con paneles, precio, ahorro, retorno y financiación.
3. **Agendar visita** → en el lead, "visita agendada" es el día en que se puso en el calendario; "visita realizada" es el día en que se hizo. No tienen por qué coincidir.
4. **Visita comercial**: antes de ir se arma la ficha con la skill `visita-cliente` (paneles, precio, techo, factura actual y futura, retorno, tarifa, PDF y WhatsApp del cliente). Las visitas van en el calendario de Google "VOLTIA externo".
5. **Minuta de visita** → se sube al lead (a futuro, automática por bot de Telegram).
6. **Cierre**: confirmación por escrito, seña de USD 500, contrato, datos administrativos, modalidad de pago.

### 2.3 Criterios comerciales que impactan la ingeniería

- **La ingeniería trabaja con lo vendido [DECIDIDO].** El ratio DC/AC y si la generación cubre el consumo son decisiones comerciales, no de ingeniería. La ingeniería no discute la potencia vendida.
- **Práctica N+1 [DECIDIDO]:** se cotizan N paneles y se garantiza la energía de N, pero en montajes coplanares o de baja inclinación se instalan N+1 (o los que hagan falta) para compensar la pérdida respecto de 25–30°. Evita el costo y el riesgo estructural de elevar. La ingeniería se diseña con la cantidad real instalada aunque la propuesta diga N.
- **Paneles extra sin costo:** cuando la orientación es mala (ej. caras sur), se suman paneles por cuenta de Voltia para llegar a la energía cotizada. Se le dice al cliente explícitamente como cambio respecto de lo prometido, no como si siempre hubiera sido así.
- **No perforamos techos ni losas [DECIDIDO, criterio comercial; confirmado 27/10]:** los clientes rechazan la perforación y anticiparlo gana la venta. Se resuelve con lastre, anclaje a pretiles o grampas. No es un juicio técnico contra la perforación bien hecha: es una excepción que se analiza caso a caso, cuando no hay otra alternativa viable y solo si se define con el cliente que es lo mejor (ver caso Pablo Ruiz, §17), con sellado y garantía extendida.
- **Potencia contratada:** UTE exige potencia contratada ≥ potencia de la IMG. Si hace falta subirla, Voltia hace el trámite sin costo de gestión; el cambio de interruptor lo hace UTE; al cliente le cambia el cargo por potencia. **[Corregido 27/10] Hasta 7 kW** conviene que lo pida el titular desde la aplicación de UTE: así UTE no le cobra nada; si entra por un instalador, UTE le cobra el trámite al cliente. Alternativa: limitar el inversor por software (UTE lo acepta) a costa de recortar los mediodías. Se le presentan los números al cliente.
- **Cambio de tarifa:** subir mucho la potencia contratada puede sacar al cliente de su tarifa (ej. General Simple) y mover el ahorro prometido. Verificar el tarifario vigente antes de cerrar.
- **Titularidad:** el contrato de microgeneración va a nombre del titular del suministro de UTE. Confirmar persona física vs jurídica antes de tramitar. Si la factura está a nombre de otra persona, los documentos de UTE los firma el titular.

### 2.4 Garantías y servicios

| Tema | Criterio |
|---|---|
| **Garantía de generación** [Corregido 27/10] | **No es estándar: es una herramienta de negociación** que se agregó para algunos clientes que la pidieron. El contrato tipo no la trae. La ofrece quien vende. Cuando se da: si en los primeros 12 meses el sistema genera menos del **90%** de la energía de la propuesta, medido con el monitoreo del inversor sobre el año completo, Voltia agrega sin costo los paneles necesarios. No usar 95%: el clima solo ya varía ±4–5% entre años. 92% es el máximo razonable si se quiere ser más generoso. Dejar espacio reservado en el techo para cumplirla. |
| Sombras | Árboles del cliente: poda a cargo del cliente, por escrito. Edificios existentes: si afectan, aplica la garantía. |
| Garantía de mano de obra extendida | Cuando se perfora (anclaje químico), 5 años sobre la **estanqueidad de los puntos de fijación** — nunca "toda la membrana". Fotos del techo antes de empezar como registro. |
| Mantenimientos incluidos | Los primeros 2 años (revisión anual). |
| **Mantenimiento posterior** [DECIDIDO] | USD 100 estándar; USD 150–200 en instalaciones grandes. |
| **Plan de Protección contra Granizo** [Corregido 27/10] | **No es un seguro y nunca se le dice "seguro"** (ni póliza, prima, siniestro, asegurado): es un *plan*. Voltia lo brinda directo (no intermedia aseguradora), repone solo paneles rotos por granizo, USD 12 por panel por año IVA incluido. **Vandalismo opcional** al mismo precio. No busca ganancia: cubre reposición y mano de obra. Cobro integrado a Voltia PM. Condiciones completas en el Manual de Posventa, Anexo E, tema 19. |
| Constancias para seguros | Carta de cumplimiento normativo por instalación, citando certificados del módulo (IEC 61215, IEC 61730) e inversor (IEC 62109-1/-2, IEC 62116, EN 50438). Verificar que la revisión del certificado cubra la potencia real del panel. (Es para el seguro que el cliente contrata por su cuenta, no el plan de Voltia.) |

### 2.5 Cómo le escribimos al cliente [DECIDIDO]

- Los mensajes que van en nombre de Nicolás **no tienen que parecer escritos por IA**: redacción natural, paréntesis en lugar de guiones largos, sin estructura de informe.
- Firma "Nicolás — Voltia", primera persona, estilo plano (sin colores corporativos en documentos al cliente). [A DECIDIR: la otra fuente (`enciclopedia.md` §14) dice que los documentos para clientes van en PDF con logo y azul de Voltia, firmados "Equipo Voltia". Posible criterio: lo que firma Nicolás, plano; lo que manda el equipo, con marca.]
- **No exponer a Voltia como empresa chica** (ej. no decir "no se consigue en plaza"). [Confirmado 27/10: sigue valiendo. Para el híbrido en 230 V hay frase propuesta en `04-equipos.md`, a confirmar.]
- **Growatt:** decir que lo conocemos muchísimo y resolvemos cualquier problema. No atribuirle "respaldo local" ni garantías que no estén documentadas.
- Presentar la información real (pesos, cambios, opciones) sin narrar errores internos ni cómo se llegó a la conclusión.
- Lenguaje de garantía siempre acotado: qué cubre, cuánto tiempo, cómo se mide. Nada abierto.
- **No inflar precios para desmotivar una opción.** Si una opción no conviene, se explica por qué (con los números reales). Un precio falso que el cliente después compara quema la confianza en todo lo demás.
- Tono con el cliente: confirmar "usted" o "vos" según el cliente antes de mandar.

### 2.6 Análisis de margen al cambiar el alcance [CRITERIO]

Cuando la ingeniería cambia lo vendido (más lastre, otra fijación, más paneles), se recalcula el margen con el **presupuesto real cotizado** (referencia de estructura: del orden de USD 90 por panel en la cotización) antes de responder al cliente. Si una opción deja pérdida y otra ganancia, conviene descontar para orientar al cliente hacia la buena, siempre que el descuento no se coma el colchón que paga los paneles de cortesía. La comisión de financiación (BBVA, cuotas) se considera aparte.

### 2.7 Respaldo / baterías [CRITERIO]

- Los inversores on-grid (ej. Huawei SUN2000-50KTL-M3) no admiten batería de respaldo como accesorio: hace falta un híbrido aparte y caja de respaldo.
- **[Corregido 27/10] Híbrido en trifásico 230 V sin neutro:** existe en el mercado, pero hoy Voltia no lo consigue; se va a traer. A quien compró híbrido se le instala un on-grid y, cuando quiera conectar baterías, se le cambia por el híbrido sin costo. Es un compromiso con cada uno de esos clientes y tiene que quedar anotado en su ficha.
- Para respaldar todo el sitio con potencia alta, el generador suele ser más barato y capaz. La batería conviene para cargas esenciales, silencio y cero mantenimiento.
- Datos a pedir antes de cotizar: respaldo total o esenciales, cargas trifásicas críticas, tipo de cortes (cortos y frecuentes vs largos).
- Línea estratégica de Nicolás: inversores híbridos Deye con baterías de marca blanca y segunda vida de baterías de auto eléctrico.

### 2.8 Línea B2B

Foco en colegios privados (programa "Nuestro Liceo Solar"), clubes deportivos y empresas logísticas, por contacto directo.

---

## 3. Proceso de obra (pipeline de Voltia PM)

### 3.1 Etapas y subetapas

| Etapa | Subetapas | Plazo configurado |
|---|---|---|
| **Onboarding** | Confirmación formal por escrito · Cobro de seña (USD 500) · Contrato · Datos administrativos · Modalidad de pago · Carpeta digital · Registro en planilla de operaciones · Consulta inicial UTE · Fecha tentativa de obra · Comunicación al cliente · Subir minuta de visita al PM | 3 días hábiles |
| **Pre-Ingeniería** | Pre-ingeniería · Unifilar · Memoria descriptiva · Memoria de cálculo · Planos aéreos · Planos estructurales · Lista de materiales preliminar | 10 días hábiles |
| **Validación de Operaciones** | Informe del capataz · Fecha de obra confirmada · Presupuesto al instalador tercerizado | 4 días hábiles |
| **Ingeniería Final** | Revisar informe del capataz · Validar/ajustar paquete · Cerrar lista definitiva · Generar documentos UTE | 3 días hábiles |
| **Compras** | Materiales listos (stock + comprados) · Logística de envío · Materiales recibidos en depósito | 5 días hábiles |
| **Ejecución de Obra** | Planificación y logística · Validación de obra terminada | 10 días hábiles |
| **Tramitación UTE** | Consulta enviada → caso abierto → consulta aprobada → solicitud enviada → proyecto aprobado → documentos 1 enviados/aprobados → ensayos enviados/aprobados → documentos finales enviados → trámite finalizado | 30 días hábiles |
| **Post-Habilitación** | Capacitación al cliente · Alta en monitoreo · Garantías y documentación final | — |
| **Experiencia Solar** (Preobra, Habilitación) | Control por cadencia de contacto, no por plazo | — |

### 3.2 Tiempos reales [DATO PM, histórico]

| Etapa | Promedio real | % en plazo |
|---|---|---|
| Onboarding | 5,7 días | 82% |
| Pre-Ingeniería | 3,7 días | 94% |
| Validación de Operaciones | 3,6 días | 83% |
| Ingeniería Final | 2,9 días | 75% |
| Compras | 7,4 días | 79% |
| Ejecución de Obra | 14,9 días | 67% |
| **Tramitación UTE** | **56,4 días** | **28%** |

**Trámite UTE en curso [DATO PM]:** 32 trámites abiertos; 12 esperando a Voltia y 15 a UTE. Tiempo promedio nuestro 10,5 días, de UTE 32,3 días. Respuesta promedio de UTE por paso: Consulta 45,2 días · Solicitud 7,4 · Documentación 1 8,4 · Ensayos 1,1 · Finalización 3,5.

Lectura: el cuello es la Consulta en UTE (no la controlamos) y lo que queda "le toca a Voltia" (sí la controlamos). La consulta se manda en Onboarding para que corra en paralelo con ingeniería y obra.

### 3.3 Plazos internos de ingeniería y trámite [CRITERIO]

- Una ingeniería estándar lleva 2–3 horas de trabajo.
- Los plazos corren desde que **la información está completa**. Si falta un dato de sitio o una definición, el reloj no arranca.
- Los tiempos de UTE no se comprometen; sí el tiempo de reacción de Voltia cuando UTE responde.
- Proyecto **estándar**: residencial monofásico sobre tipología ya resuelta. **Complejo**: trifásico, comercial/industrial o tipología estructural nueva.

---

## 4. UTE y marco regulatorio

### 4.1 Régimen [DECIDIDO]

- Las obras de Voltia son **microgeneración**, Decreto 173/010, **Capítulo XXVIII** del Reglamento de Baja Tensión de UTE. **No** el Capítulo XXIX (autoconsumo sin inyección).
- Verificar siempre la última versión publicada por UTE antes de presentar.

### 4.2 Configuración por suministro (Cap. XXVIII)

- Suministro monofásico → IMG monofásica.
- Trifásico con IMG ≤ 10 kW → mono, bi o trifásica, con desequilibrio entre fases ≤ 5 kW.
- Trifásico con IMG > 10 kW → trifásica.
- Máximos a inyectar: 100 kW en 230 V, 150 kW en 400 V.
- Potencia de la IMG ≤ potencia contratada.
- IMG > 40 kW en 230 V o > 70 kW en 400 V → dos registros de calidad de onda (sin y con generación).
- Corriente generada > 16 A (o > 25 A en MRT) → estudio de red de UTE.

### 4.3 Potencia de la IMG [DECIDIDO]

- La potencia nominal de la IMG ante UTE es la **salida efectiva**: la del inversor, o la limitada por software (UTE lo acepta). Ej.: MIN 8000TL-X2 limitado a 7 kW para igualar la contratada.
- **No declarar la potencia pico de los paneles (kWp) en las presentaciones a UTE.** Solo la IMG en kW. Más información = más exposición.

### 4.4 Requisitos de protección (Cap. XXVIII, punto 6.1)

- Interruptor general de la IMG (corte de microgeneración): termomagnético, poder de corte ≥ el que indique UTE, curva coordinada con el ICP, lo más cerca posible del medidor, accesible a UTE, **precintable en abierto**, etiqueta "Interruptor de Corte de Microgeneración".
- Diferencial contra contactos indirectos (no se exige tipo B).
- Inyección de continua ≤ 0,5% de la corriente nominal (certificado del inversor).
- Interruptor de interconexión automático con protecciones de tensión y frecuencia (EN 50438), integrado en el inversor.
- Anti-isla: cese ≤ 500 ms; reconexión a los 3 minutos.
- Factor de potencia del inversor ≥ 0,95 inductivo y capacitivo.
- Inversores según IEC 62109-2.
- Punto de conexión con **bornera o barras, nunca los bornes de las llaves**.
- Señalización de doble alimentación en tableros.

### 4.5 Trámite (subetapas reales)

Consulta → Solicitud (proyecto) → Documentación 1 → Ensayos (no funcionamiento en isla y temporización de reconexión) → Documentos finales → Finalizado. La solicitud lleva firma instaladora y técnico Categoría A o B, unifilar, plano de ubicación, información técnica de generadores y conversores, y DAR.

### 4.6 Contactos de UTE

| Contacto | Tema |
|---|---|
| Seguimiento de Generadores Externos (microgeneración) | Tel. 2155. Orden sugerido a clientes: Marco Mora (int. 22152, el de más experiencia), Daniel Yáñez (int. 22151), Ezequiel Perdomo (int. 22154). El interno 22150 no se pasa a clientes |
| Ing. Yañez | Microgeneración técnica, puesta a tierra de módulos |
| Ezequiel Perdomo | Resistencia de puesta a tierra (caso Ciudad de la Costa) |
| Sofía Martínez | Ampliaciones y justificación de consumo |

### 4.7 Ampliaciones con justificación de consumo [CRITERIO]

Cuando UTE limita la ampliación por consumo histórico (ej. Rodrigo Alvarez, Coviteja):
- Argumentar con **consumo medido** (monitoreo del inversor, facturas) antes que proyectado. Comparar mes a mes contra el año anterior para mostrar que el salto es nuevo (ej. compra de autos eléctricos).
- Usar el rendimiento medido de la propia planta (kWh/kW/año) para calcular la potencia necesaria.
- Pedir la potencia del **inversor** (IMG), no la de los paneles.
- Incluir solo lo necesario para el argumento. Sin anexos de más.

### 4.8 Argumentos ya construidos ante UTE

- **Resistencia de tierra alta en suelo arenoso:** el criterio real de seguridad es la **tensión de contacto (50 V)**, no un valor absoluto de resistencia (Cap. XXIII, numerales 9 y 13). Un diferencial de alta sensibilidad justifica resistencias mayores. Ver §8.4.
- **Marcos de composite (Restar):** un marco no conductor no es masa (IEC 60050-195, término 195-06-10) y queda fuera del requisito de puesta a tierra (IEC 62548-1, IEC 60364), igual que un módulo sin marco. Perforar el pultruido corta fibras y debilita la sección. Se respondió con informe técnico propio firmado, con ensayo de no conductividad. Citar solo IEC (no AS/NZS ni NEC).
- **Nicho del inversor con dado empotrado:** resiste por empuje pasivo como las columnas de medidor de UTE. Discusión cerrada.

---

## 5. Ingeniería eléctrica DC

### 5.1 Verificaciones obligatorias

| Verificación | Criterio |
|---|---|
| Tensión en frío | `Voc(Tmin) = Voc(STC)·[1+β·(Tmin−25)]` con **Tmin = −5 °C** y el panel real. `N_serie·Voc(−5 °C)` < tensión máx. del inversor **y** < tensión de las protecciones DC |
| Vmp del string | Dentro del rango MPPT |
| Corriente | Imp del conjunto < corriente máx. por MPPT; Isc < Isc máx. por MPPT. Si queda justo, avisar posible recorte |
| Valores del módulo | **Usar los de la etiqueta del módulo cuando difieren de la ficha** (son más conservadores) |
| Sufijo del módulo | Verificar que la ficha corresponda al módulo físico (ver §16) |

### 5.2 Cable solar [CRITERIO]

- Sección por cálculo con Vmp real, **la opción más barata que cumpla**. Guía: 4 mm² si la caída verifica; 6 mm² en tiradas largas.
- Caída DC: `ΔV = 2·L·I·ρ/S`. Límite: ver §18 (discrepancia 3% vs 5%).
- **Paralelizar strings** antes de un tramo largo para llevar menos cable, siempre que la corriente no supere el MPPT y con fusibles gPV si quedan ≥3 en paralelo.
- **Cómputo de metros [DECIDIDO]:** tirada real por polo, un solo recorrido (rojo +, negro −). Un string a 25 m → 25 m rojo + 25 m negro. El factor 2 es de la fórmula de caída, no del cómputo.

### 5.3 Protecciones DC [DECIDIDO]

- **Seccionador DC accesible siempre**, aunque el inversor lo integre (seguridad de trabajo: permite cortar y medir en el tablero). Certificado DC a 600/1000 Vdc según Voc en frío.
- **Fusibles gPV solo desde 3 strings en paralelo por MPPT.** Con 2 o menos, la corriente de retorno no supera el fusible máximo del módulo. Confirmar contra el máximo fusible de serie de la ficha.
- **Térmica DC solo si hay strings en paralelo** que la justifiquen. Si va: **certificada DC** y por encima de la **Isc corregida** (si queda por debajo, dispara en falso; ver caso Trías §14.3).
- **SPD DC tipo 2** con tensión acorde. **No va externo si el inversor lo integra** (familia Growatt MIN: SPD DC clase II integrado). La tensión del SPD DC es decisión de proyecto por obra y no se reabre.
- **Nunca protecciones AC en DC** salvo certificación DC a la tensión correspondiente. Portafusibles "500 V~" son AC: no sirven en strings.
- Fusibles cerámicos comunes y portafusibles cerámicos no son DC: se sacan de la lista.

### 5.4 Ratio DC/AC

Objetivo de referencia ≈ 1,18, pero es decisión comercial (§2.3).

---

## 6. Ingeniería eléctrica AC

### 6.1 Corriente [DECIDIDO]

- **La corriente máxima de salida se lee de la ficha del inversor, no se calcula como S/U.** Ej.: Growatt MIN 8000TL-X2 → 34,8 A por cociente a 230 V, pero la ficha declara **38,3 A**. Si la ficha no la trae, calcular con la **tensión mínima del rango** del equipo.
- Fórmulas de referencia: trifásica `I = P/(√3·U)`; monofásica `I = P/U`. Factor de potencia ≥ 0,95.
- **La térmica se dimensiona por la corriente máxima del equipo, no por el límite de exportación configurado.** Ej.: 10 kW a 230 V trifásico → ~25 A nominal, ~27,6 A máxima → térmica 32 A (la de 25 cortaba).

### 6.2 Sección — tres pasos, siempre

1. **Corriente admisible** según método de instalación real (dos conductores cargados en canalización, no al aire), **corregida por temperatura**: bajo chapa, al sol o en local caliente, factor del orden de 0,87 a 40 °C.
2. **Caída de tensión** sobre la tirada real. Trifásica `ΔV = √3·ρ·L·I·cosφ/S`; monofásica `ΔV = 2·ρ·L·I·cosφ/S`. ρ Cu ≈ 0,018–0,0225; Al ≈ 0,028–0,029 Ω·mm²/m. Límite: ver §18.
3. **Coordinación:** `I_max_inversor ≤ In_térmica ≤ Iz_corregida`. Si no cierra por la derecha, se sube sección; nunca se baja la térmica por debajo de la corriente del inversor.

**Tabla de partida por módulos (no es verificación):** bipolar superplástico hasta 8 módulos → 2×4; desde 10 → 2×6. Deja de aplicar con inversores monofásicos ≥ 7 kW: 2×6 no coordina con térmica de 40 A, ahí corresponde 2×10. La caída sobre la tirada real manda sobre la tabla. Colores monofásico: fase blanco, neutro celeste. Margen de compra 10–15%.

### 6.3 Cobre vs aluminio [DECIDIDO]

- Dentro de lo técnicamente validado, **la más barata**. Si 70 mm² Cu cumple pero 95 mm² Al sale más barato y también cumple, va aluminio.
- En tiradas largas el cable suele elegirse por caída, no por corriente (ej. Álvaro García: 4×Al 95 mm² en 180 m, 57,7 A, caída ~1,3–1,8%; admisible enterrado 262 A).
- **El aluminio nunca entra directo a una protección ni al inversor.** Transición Al→Cu en cada extremo con **terminal bimetálico** crimpado (matriz hexagonal) o **bornera de paso certificada Al/Cu**, cepillado, grasa inhibidora, torque del fabricante y **reapriete en el primer mantenimiento**.
- Riesgo de hacerlo mal: aluminio apretado contra cobre sin bimetálico → afloja, oxida, recalienta, borne quemado en meses.
- **Dentro del tablero** se dimensiona solo por corriente admisible: puentes internos en Cu de menor sección (ej. Cu 25 o 35 mm² desde Al 95), derivaciones a SPD en Cu corto (ej. 10 mm²), con borneras o repartidores.
- Cable XLPE 0,6/1 kV apto subterráneo puede ir **directo enterrado**: cama de arena 10–15 cm, profundidad ~70 cm (80–100 cm con tránsito), placa o ladrillo de protección, cinta de advertencia a 20–30 cm, conductores en haz. Caño solo en subidas.
- **[PENDIENTE]** Citar el artículo del Reglamento de BT de UTE que admite aluminio en instalaciones del cliente antes de firmar.
- En FV, además de la caída, importa la **subida de tensión** en bornes del inversor: con red alta, un cable justo provoca disparos por sobretensión.

### 6.4 Cableado y terminales [DECIDIDO]

- Cable AC largo: bipolar superplástico por largo real; unipolares de colores solo para remates de tablero (~3 m por color).
- Solar 4 mm² → terminal pino de 6 mm². SPD DC → pino doble de 6 mm². AC → pino del calibre; SPD AC → pino doble del calibre.
- Tierra → terminal ojal 4 mm² con tornillo y tuerca.
- **50% extra en todos los terminales.**
- Caño de bajada de string: 1 string → 1"; 2 → 1¼"; 3 → 1½". Corrugado metálico 2 m por string, mismo calibre; mínimo 4 conectores. En volúmenes grandes de cable DC, bandeja perforada (ej. 50×50) en lugar de caños.
- Caño PVC eléctrico tipo Fusger 205 sirve en interior; al sol, pedir resistencia UV o negro.

---

## 7. Tableros y protecciones

### 7.1 Arquitectura [DECIDIDO]

| Tablero | Ubicación | Contenido |
|---|---|---|
| **Tablero DC** | Junto al inversor (puede ir en el nicho) | Seccionador DC por string, SPD DC (si el inversor no lo integra), bornera de tierra. Fusibles gPV si ≥3 strings |
| **Tablero de protecciones AC** | Junto al inversor | **Diferencial 300 mA** (tipo A o el que indique el fabricante), bornera de tierra, SPD AC (si no está integrado). **Sin térmica**, salvo distancia al tablero de interconexión > 30 m |
| **Tablero de interconexión** | Junto al medidor de UTE, accesible a UTE. Nunca en el nicho | Bornera, **interruptor general de microgeneración** (única térmica: corte + sobrecorriente/cortocircuito, precintable, etiquetado), smart meter. El medidor bidireccional lo pone UTE |

- **Regla de los 30 m:** si el tablero de interconexión está a menos de 30 m del inversor, hay una sola térmica (en interconexión). Si está a más, se agrega otra en el tablero de protecciones AC.
- No se duplica térmica: el inversor es fuente limitada; la falla grande la aporta la red y la corta la térmica del lado del medidor.
- Distinguir **ICP de UTE / control de potencia de la IMG** de la térmica: pueden ser el mismo aparato o distintos, a veces lo provee UTE. Confirmar.
- Diferencial: **bipolar en monofásica, tetrapolar en trifásica**. No se exige tipo B. **No se usa 30 mA por defecto** (dispara por la fuga normal del inversor), salvo como medida justificada en casos de tierra difícil (§8.4).
- **SPD AC solo si el inversor no lo integra** (aunque sea clase III integrado, no se agrega externo). Verificar la ficha antes de computarlo.
- Con cable de gran sección: borneras/repartidores y reducción de sección hacia SPD y protecciones; nunca el Al 95 directo al descargador.

### 7.2 Ítems fijos que siempre van en la lista (se olvidan)

Smart meter (con su CT), datalogger WiFi (Shine WiFi-X en Growatt), UTP exterior para RS485, bornera de conexión AC (además de la de tierra), documentos de UTE, precinto con bloqueo del interruptor general, codos de PVC de subidas de cámara a tablero.

---

## 8. Puesta a tierra

### 8.1 Esquema [DECIDIDO]

- **Electrodo propio de la generación**, independiente del neutro de UTE. Todas las masas conectadas.
- Esquema TT por defecto.
- **Punto común: bornera de riel DIN de 10 tornillos** (no barra), en **estrella**: jabalina, gabinete del inversor, tierra de alterna del inversor, descargadores, marcos, caños, estructura. Cerco metálico del cliente vinculado a la PAT.
- El conductor de protección **no se extiende hasta el tablero de interconexión**.
- Reutilizar la tierra de la casa solo si se mide ≤ 5 Ω. Como no se sabe antes, **siempre se computa la independiente**; si sobra, se trae.

### 8.2 Secciones [DECIDIDO]

- **6 mm² exclusivamente en el bajante bornera → jabalina** (exigencia UTE).
- **4 mm² para todo el resto**: saltos panel a panel, tableros, gabinete y tierra AC del inversor, SPD DC y AC, marcos, caños, estructura.
- Si la fase AC sube a 10 mm² o más, revisar y dejar constancia de la decisión del PE.
- **[PENDIENTE]** En `general/estandares.md §5` de la skill falta la aclaración "4 mm² por defecto; 6 mm² solo en el bajante bornera-jabalina por exigencia UTE" (pendiente de la próxima edición del ZIP canónico).

### 8.3 Paneles

- Tierra en salto, **cable de borne a borne** (aceptado por UTE). Continuidad siempre por cable; nunca entrar por un borne y salir por la otra punta del marco (no circular por el aluminio).
- Módulos con marco **no conductor** (composite): no son masa, no se perforan (§4.8).

### 8.4 Resistencia [DECIDIDO]

- Objetivo **< 10 Ω** (ideal 5 Ω). No es el criterio de cierre en suelos difíciles.
- **Escalera de máximo esfuerzo:** 1) profundizar la primera jabalina (otra enroscada en serie); 2) jabalina en paralelo a ≥ 5 m en cámara nueva; hasta **3 jabalinas**. Si no baja, se documenta (típico en costa arenosa).
- En sitios ya construidos (hormigón, sin zanjas posibles): profundizar en el mismo punto con **lanza de agua**, midiendo cada metro y parando si dos metros seguidos no mejoran. Alternativa: ir directo al argumento de tensión de contacto con cambio de diferencial a 30 mA.
- Argumento ante UTE: tensión de contacto ≤ 50 V (Cap. XXIII, num. 9 y 13), no resistencia absoluta.

---

## 9. Redes uruguayas, inversores y configuración

### 9.1 Tipos de red

| Red | Notas |
|---|---|
| Monofásica 230 V | Fase + neutro |
| Trifásica 400 V + N | 3W+N+PE. El neutro es referencia de tensión para el smart meter; no reduce la corriente de fase |
| **Trifásica 230 V entre fases sin neutro (triángulo, IT)** | Muy común. Contra tierra se pueden medir valores raros (ej. 200/200/20 V): **no es necesariamente una fuga**, es una red sin referencia a tierra. Las tensiones "por fase" de inversores y medidores no son fase-neutro reales |

- La red uruguaya **trabaja alta**: 242–250 V sobre 230 V nominal es frecuente, sobre todo con exportación. Tiene consecuencias en derateos y disparos (§14).

### 9.2 Inversores en red de 230 V sin neutro [DECIDIDO]

- Voltia tiene un método propio para configurar inversores trifásicos de 400 V en redes de 230 V entre fases. Hay varios Growatt MID 20KTL3-XL2 y MAC funcionando así.
- **Growatt:** si aparece "AC V Outrange (006)", el parámetro **WideVolt Set = 1** lo resolvió en el MID12KTL3-XL2.
- **Huawei:** el catálogo pide transformador de aislación en la red IT de 230 V entre fases. **Fronius Symo Advanced 208-240** soporta triángulo sin neutro de forma nativa (no siempre se consigue en la potencia necesaria).
- **No usar autotransformador 400→230 para "crear" un neutro solo del lado del inversor.** El autotransformador comparte bobinado: el punto estrella es común a la red de UTE. Aterrado, se convierte en transformador de puesta a tierra de la red del barrio (absorbe desbalances y armónicos ajenos); sin aterrar, el neutro flota. El régimen de neutro lo define UTE. Hace falta transformador de doble bobinado, y es otra discusión con UTE.

### 9.3 Parámetros UTE cargados en inversores Growatt

Ver tabla completa en la skill `soporte-inversores-growatt` (`references/parametros-ute.md`). Resumen: tiempo de inicio 190 s, reinicio 180 s, tensión mín. 1 195,5 V, máx. 253 V, frecuencia 47–51 Hz, tiempos de actuación en ciclos de 0,02 s.

**Ojo:** esos son umbrales de desconexión. La curva **Volt-Watt** es otra cosa (registros 148 y 149 en serie MAC) y viene de fábrica en 233,1/241,9 V: con red alta deja al inversor clavado en el 20%. **Verificarla en toda puesta en marcha MAC** y relevarla en la flota (caso Lamas, §14.3).

### 9.4 Growatt — límite de exportación (MIN TL-X2)

Pantalla: `Advanced` (clave 123) → `Exportlimit ON` → `Meter` → `Export Limit Rate`.

---

## 10. Smart meters y comunicación

### 10.1 Principio

El smart meter mide el **intercambio con la red en el punto de interconexión** (no la salida del inversor) y reporta al inversor por RS485 (Modbus) para el límite de exportación. **Los CT van entre el medidor de UTE y el punto donde se juntan inversor y cargas**, con la flecha hacia la red. Si los CT quedan aguas abajo de donde inyecta el inversor, solo ven la casa: la app muestra exportación cero y "consumo" igual a generación + algo (caso Huawei Estilo).

### 10.2 Modelos [DECIDIDO salvo indicación]

| Meter | Uso | Conexión clave |
|---|---|---|
| **Eastron SDM120CT** | Monofásico con CT 100/5 | Bornes 3 (N) y 4 (L) alimentación; 1-2 (S1, S2) CT; 8 (G), 9 (B−), 10 (A+) RS485. A Growatt MIN: 10→pin 7, 9→pin 8, malla solo del lado del meter |
| **Eastron SDM630MCT** | Trifásico 3 o 4 hilos | Ver §10.3 |
| Huawei DTSU666-H / DTSU71 | Huawei | Cableado propio de Huawei. Verificar el modelo real instalado: en Álvaro García era un **DHSU1079-CT (Wisdom)** y había que elegirlo así en la app |
| Fronius Smart Meter | Fronius | Pendiente de ficha de obra |

### 10.3 Medición trifásica en tres hilos (230 V sin neutro) [DECIDIDO]

- **Solo dos CT** (teorema de Blondel, conexión Aron): en L1 y L3. **L2 sin CT.** El tercero es redundante.
- **SDM630MCT en 3 hilos:** el borne **N recibe la Fase 1 con fusible** (referencia común); L2→borne L1; L3→borne L2; **borne L3 vacío**. La fase no va al borne de su mismo nombre.
- Fusibles de sensado 1 A rápido **300 V** (230 V entre fases; serían 500 V en 400 V).
- Menú: **SET SYS = 3P3W**; **PT1 = PT2** (trampa: PT2 viene en 400 V por defecto y escala todo por 0,575); SET CT según el CT real (confirmar si es de 40 mA/mV o de 1/5 A); SET SYS CONT con todas las fases en FRD.
- En 3 hilos, **potencias y FP por fase no tienen significado físico**; solo valen los totales.
- Una fase leyendo ~135 V = entrada flotando (tornillo flojo o mal insertado). Medir sobre el tornillo.
- **Magnitud idéntica con signo invertido = los dos CT invertidos** (uno solo invertido da otra magnitud).
- CT con secundario en amperes: **nunca se abren con carga**.
- Verificación: pinza en la fase sin CT ≈ lo que muestra el display.
- **[LECCIÓN]** Nunca validar una instalación comparándola con otra igual; solo contra cálculo (las dos pueden estar mal).

### 10.4 RS485 [DECIDIDO]

- **Siempre un par trenzado del mismo par** del UTP (ej. verde/verde claro). Mezclar hilos de pares distintos degrada la señal en tiradas largas (180 m en Álvaro García → no comunicaba).
- UTP exterior; malla a tierra solo del lado del meter; aislar los hilos libres.
- Growatt MIN TL-X2: meter en **pines 7-8**; los **pines 3-4 son del datalogger**. Torque del conector ~0,4 Nm; bornes del meter ~0,2 Nm.
- Monitoreo en campo sin WiFi: el Shine 4G importado puede no tener bandas compatibles con Antel/Claro/Movistar. Alternativa: router 4G doméstico local en gabinete IP65 aparte, con timer de reinicio diario, montado a la sombra y cerca de un borde lateral de la estructura (no detrás de chapa).

---

## 11. Estructura y viento

### 11.1 Principios [DECIDIDO]

- **Dentro de lo técnicamente validado, la opción más barata.** Optimizar sin comprometer seguridad. Diferenciar "parece aguantar" de "tiene criterio técnico".
- Viento por **UNIT 50:84** en todo el país. **Nunca usar 90–100 km/h genérico.** El método completo está en `general/viento.md` de la skill y es la única fuente.

### 11.2 Cadena de viento (resumen)

| Paso | Valor |
|---|---|
| `v_k` (§6.2.2) | **158 km/h (43,9 m/s)** a ≤ 25 km del Río de la Plata, Río Uruguay o costa atlántica; **135 km/h** resto |
| `K_t` topografía | 1,00 en terreno llano (verificar crestas y barrancas) |
| `K_z` altura y rugosidad | Con `z` = altura del **plano de módulos**. z ≤ 5 m: I 0,993 · II 0,822 · III 0,667 · IV 0,515. Defecto Voltia rural/suburbano: **rugosidad II**. Ante duda entre II y III, va II. Faja costera de 1 km: I |
| `K_d` | 1,00 (del lado seguro) |
| `K_k` y `γ₃` | **1,00** (tensiones admisibles, Tabla 6.3 fila L). **La acción de viento no se mayora** |
| Velocidad y presión | `v_c = K_t·K_z·K_d·K_k·v_k`; `q_c = v_c²/16,3` (daN/m²) |

**Tipología (decide el capítulo):**
- **Coplanar → Cap. 8:** cara inferior del módulo ≤ 20 cm de la cubierta y ≤ 5° respecto de su plano. `γ₀ = 0,90` por defecto en vivienda de una planta → `c_e = 0,45` interior. Borde (franja h/10, sin exceder b/10) ×2; cumbrera ×3; alrededor de chimeneas, claraboyas, ventilaciones `c = 2,0`; tope 2,0.
- **Elevado/inclinado, suelo, cochera → Cap. 10:** `c_m` de conjunto para la estructura (0° 0,35 · 10° 0,53 · 15° 0,73 · 20° 0,92 · 25° 1,11 · 30° 1,30) y `c` del borde de ataque para módulo, sujetadores y riel de barlovento (30° → 1,80).
- **Filas largas en suelo:** verificar `λ = h_a/l`. Con λ < 0,20, `γ_α` sube hasta 1,2–1,44. Ignorarlo subestima la carga.
- **No se aplica reducción por apantallamiento entre filas** (no tiene respaldo en la norma).
- La altura de la pila de capas se calcula y anota siempre: una pila losa + nervio + corredera + riel pasa los 20 cm y deja de ser coplanar.

### 11.3 Márgenes (no se acumulan)

| Verificación | Criterio |
|---|---|
| Resistencia de perfiles, uniones, soldaduras | Tensión ≤ `f_y/1,5`, carga sin mayorar |
| Flecha bajo succión | `L/200` (o `L/300` con elemento sensible). Suele gobernar antes que la tensión |
| Estabilidad global (vuelco, arranque, deslizamiento) | Resistencia/acción ≥ **1,5** |
| Peso propio a favor | Minorado a 0,90, con el peso **real** del módulo (nunca uno mayor "por conservador") |

- Extremos de perfiles: **articulados por defecto**. Semirrígido (γ 0,7–0,8) solo con detalle dibujado y verificado.
- **El lastre no crea un apoyo** salvo vinculación mecánica al perfil. Antes de agregar contrapeso, revisar sección, luz y esquema de apoyos.
- **[LECCIÓN]** Hasta la v3.3 de la skill se usaba `q = 0,613·v_k²`, `Cf = 1,8` para toda la estructura y doble 1,5: sobredimensionaba 3 a 4 veces. Las obras calculadas así quedaron del lado seguro; conviene revisar las no compradas (bajan material).

### 11.4 Geometría y orientación [DECIDIDO]

- Inclinación **30° al norte**, módulos **portrait**. Bajar a 20° (hasta 15°) en techos al borde y zona de 158 km/h: de 30° a 20° la carga de conjunto baja 29% y la generación ~5%.
- Grupos de **máximo 14 paneles**, repartidos parejo por strings.
- **Separación entre filas en suelo:** `s = 6·sen(α)` en metros, libre del fondo de una fila al frente de la siguiente (30° → 3,00 m; 25° → 2,54; 20° → 2,05; 15° → 1,55; 10° → 1,04). Para estudio fino de sombras, el criterio IDAE `d = h/tan(61° − latitud)` da del orden de 2× la diferencia de altura; diseñar solo para el mediodía solar subestima.
- **Retiro de bordes:** no menos de ~1 m a cada borde libre, dibujado y acotado. Centrar el arreglo si el techo lo permite.
- **Faldón perimetral: no por defecto.** Con viento dominante del sur, cerrar el borde bajo norte aumenta la succión.

### 11.5 Sujeción de módulos [DECIDIDO]

- Zona segura (módulo de 2.278 mm): entre 400 y 790 mm de cada punta. **Posición adoptada: 456 mm** de cada punta (1/5 del largo), 1.368 mm entre sujetadores. En memorias se redacta como **adopción de Voltia**, no como dato de la ficha. Si aparece el manual propio del fabricante con otra zona, prevalece ese.
- Nunca sujetadores en la punta.
- **Los módulos nunca se fijan directo a acero**: siempre sobre riel o perfil de aluminio (rieles de fábrica para paneles, no fabricados en taller).
- **Separación aislante (EPDM/neopreno, arandelas de nylon) en cada contacto aluminio–acero galvanizado**, más pasta antioxidante y bulonería A2.
- Marcos de composite: grampa de 50 mm mínimo, 4 por módulo sobre el lado largo, torque ~16 Nm, sin perforar.
- Riel P de 4,8 m: empalmes siempre sobre un apoyo.

### 11.6 Corrosión [DECIDIDO]

- Categoría por distancia a la costa, sin sobrestimar: ~6 km → C3. C4/C5 solo pegado al mar.
- C3: galvanizado estándar, pintura rica en zinc en cortes y perforaciones, pasta antioxidante, bulonería A2 o galvanizada. Costa: A4.
- Estructuras **soldadas en obra**: sin galvanizado en caliente; primer rico en zinc + esmalte exterior, mantenimiento a cargo del cliente.

### 11.7 Hormigón

- Dosificación estándar de obra: **1:3:2** usando la bolsa de 25 kg como unidad de medida. (La skill de cálculo usa 1:2:3 con ~350 kg/m³ de portland como orientativo; ver §18.)
- Desglosar siempre en componentes (portland, arena, pedregullo, agua) y bolsas/m³.
- Fundar por debajo de la capa de tierra negra.

### 11.8 Anclaje químico [CRITERIO]

- **Varilla M12 inoxidable** (A2; **A4 en costa**). No existe M13 (era la mecha). Perforación del diámetro que indique la ficha de la resina (para M12 suele ser 14 mm).
- Producto usado: Sika AnchorFix-2. Limpieza: soplado y cepillado, 2 veces cada uno, desde el fondo. Curado 40–100 min según temperatura antes de cargar.
- Mecha con tope de profundidad; dejar siempre hormigón por debajo (≥ 5 cm). Tejuela: perforar sin percutor y llenar también ese tramo.
- Sellado: poliuretano en la perforación, arandela EPDM, 2–3 manos de membrana líquida con malla cubriendo la base y 10 cm alrededor.
- Tracción/corte admisible: de la ficha del anclaje **para elemento estrecho** cuando es pretil.

---

## 12. Tipologías de montaje

Cada tipología tiene criterios propios en `estructura/<montaje>/` de la skill. Se adapta la plantilla maestra; no se diseña de cero.

### 12.1 Suelo (altura de hombre)

- **Pata Tipo 1 (rígida):** parantes y cabio C80×40×15×2, diagonal C60×40×15×2, pilote 50×50×60 cm (≈0,150 m³). En bordes/refuerzo.
- **Pata Tipo 2 (simple):** sin diagonal, pilote 40×40×60 cm (≈0,096 m³).
- Longitudinales C80 (×2), rieles de aluminio de fábrica, cruz de San Andrés C60 en vanos extremos.
- Geometría a 30°: parante bajo ≈0,30 m, alto ≈1,53 m, proyección ≈2,13 m, cabio ≈2,46 m.
- **Sector de 11 paneles:** 7 patas a ≈2,10 m, largo ≈12,60 m. Distribución Opción B: Tipo 1 en posiciones 1·3·5·7 (o 1·4·7 según obra).
- **Obra frecuente: 66 paneles en 2 filas de 33**, cada fila en 3 sectores de 11 con 1 m entre sectores y 3 m entre filas → 42 patas, 84 fundaciones, ≈9,36 m³ de hormigón.
- Anclaje con perfil embebido. Verificar arranque del pilote de barlovento (Momento/separación de parantes) contra peso + fricción lateral con FS 1,5; la fricción es incierta sin ensayo de suelo.
- **[PENDIENTE de cada obra]** Pilotes de 60 cm pueden ser marginales para vuelco en sitios expuestos; cerrar con cálculo y dato geotécnico antes de hormigonar.
- Con animales: cerca perimetral opcional. Si el cliente quiere que los animales pasen por debajo (sombra), es otra estructura: marquesina monopendiente 10–12°, altura libre ≥ 2,6 m, columnas de tubo cerrado (no C80), fundaciones empotradas profundas.

### 12.2 Techo de hormigón con pretiles

- **Regla:** no se perfora la losa ni la membrana; todo anclaje va a pretiles y todo lastre apoya sin fijación pasante (salvo que se acuerde la opción perforada con el cliente, como excepción).
- Modalidades: anclaje a pretiles, contrapesos, **híbrida (recomendada)**. Borde con pretil siempre se ancla; el contrapeso es para el borde libre.
- **Confirmar en obra que el pretil sea hormigón armado sano** vinculado a la losa. Pretil: **ancho y altura como dos datos separados**.
- **Anclaje vertical desde el coronamiento** (a tracción, mayor capacidad) o **horizontal a la cara interior con pieza en L** (a corte; bajar el punto de anclaje para ganar distancia al coronamiento: de 8 a 20 cm multiplica la capacidad ~4 veces). La pieza en L se verifica a flexión. Reservar 3–4 cm al fondo del pretil.
- Contrapesos: losa 45×45×10 (~50 kg), placa de reparto debajo siempre, vinculada mecánicamente al perfil si se computa.
- **Variantes:** A (escuadras L de aluminio sobre C80, bloques chicos); B (durmientes C80 E-O sobre travesaños C160 N-S, triángulos de aluminio de taller, ej. base 2.140 / altura 732 para 20°); C (4 capas: C durmiente → triángulo isósceles → perfil H → módulo; triángulos con separación ≤ 1,60 m; para 2.278 mm a 20°: lado de atrás 791 mm, altura 779 mm); D (coplanar lastrada y anclada a pretiles laterales: losas → nervios → correderas → aluminio → módulos).
- Alternativa comercial: triángulo de hormigón prefabricado NIC Hormigones (calculado por el fabricante; se cita, no se recalcula).
- Luces de referencia C80 entre apoyos: 1,7–2,4 m, por cálculo.
- Toda variante se documenta con **tabla de jerarquía de montaje** (nivel, elemento, apoya sobre).

### 12.3 Chapa

- **Nunca se ancla a la chapa sola.** Todo anclaje llega al tubular estructural de abajo (ref. 80×40, líneas a 1,20 m). Tornillos en la **cresta** con arandela EPDM. Sin tubular confirmado, el esquema no aplica.
- Coplanar Cap. 8 con zonificación. Tornillería inox.

### 12.4 Isopanel

- **No se perfora el isopanel.** Anclaje a la **junta alzada (engrafado)** con grampa de aluminio de dos bulones laterales; encima L bajo (coplanar) o soporte dentado; **pieza de conexión en L, una por soporte** (contarla siempre); riel P y sujetadores.
- Paso del engrafado 1,12 m por defecto. Portrait por defecto; landscape si el módulo apoya a caballo de dos juntas y los sujetadores caen en zona segura (579 mm de cada punta).
- Verificar la capacidad de la grampa con su ficha y que el isopanel esté bien fijado a la estructura de abajo.
- Distinguir en la lista la **grampa de junta alzada** (anclaje a cubierta) del **sujetador** del módulo.

### 12.5 Tejas cerámicas (coplanar)

- Rieles horizontales sobre los **perfiles de madera**; la teja no toma carga. Ganchos de teja inox A2 con dos tirafondos cada uno (ref.: perfiles 10×3 cada 1,50 m, ganchos cada 0,55 m). Confirmar estado de la madera.

### 12.6 Cochera / carport

- Tubular de acero soldado en obra (ref.: columnas 100×100×4, vigas 100×100×3, cabios 100×50×3), arriostramiento en el plano del techo.
- **Fundación: viga perimetral de hormigón armado cerrada** (ref. 0,30×0,40), estabilidad por peso propio sin depender de fricción del suelo. Pilotes aislados profundos descartados.
- Cap. 10 sin analogía; altura libre de referencia 2,0–2,2 m.

### 12.7 Nicho / soporte del inversor [DECIDIDO]

- Soporte metálico de una columna (sustituto del nicho de mampostería): tubo 100×100×3 a 1,70 m, **empotrado 0,60 m en dado 40×40×60 cm** (no requiere verificación de vuelco), bastidor 40×40×2 de **0,55 m (MID-X) o 0,70 m (MID XL2)** × ~1,22 m, cartelas 6 mm, chapa de respaldo, techo a 18° volado hacia adelante con alero 0,20 m.
- Aloja inversor + tablero DC + tablero de protecciones AC. **Nunca el de interconexión.**
- Ventilación ~30 cm arriba y abajo del inversor; dongle sobre el inversor; caño rígido metálico a la vista vinculado a tierra.

---

## 13. Entregables y documentación

### 13.1 Juego de ingeniería por obra [DECIDIDO]

1. Memoria descriptiva (DOCX + PDF).
2. Memoria de cálculo (DOCX + PDF).
3. Lista de materiales (XLSX, hojas Resumen y Detalle; columna **Comprar**: Sí / Stock / Fabricante / Verificar / UTE; los ítems de stock se marcan, no se borran).
4. Verificación estructural bajo viento (XLSX con fórmulas vivas y celdas de entrada resaltadas).
5. Prompts de Claude Design (lámina estructural + soporte de inversor).
6. Manual de conexión del smart meter (si lleva medidor).

### 13.2 Reglas de redacción [DECIDIDO]

- Números en dígitos en documentos. Revisiones A, B, C.
- **Sin secciones de supuestos ni pendientes en las memorias**: lo pendiente va en observaciones de la lista de materiales y en celdas a confirmar de la planilla.
- No mezclar estimado con confirmado.
- Componentes por características técnicas, no por marca (salvo pedido para uso interno de obra). Sin precios en la ingeniería.
- "Lista de materiales", nunca "BOM". "Pata" y "parantes", no "pórtico".
- Portada con wordmark compacto "V voltia" (22 pt + 16 pt), identifica cliente y obra. Títulos azules subrayados, tablas alternadas, callouts con borde azul. Firma **Ing. Nicolás Machín — Responsable técnico**.
- Documentos al cliente: estilo plano, primera persona, "Nicolás — Voltia".

### 13.3 Coherencia entre entregables [DECIDIDO]

Antes de emitir, verificar que coincidan en todos los documentos: calibre y polos de protecciones, sección y largo de cada tramo, canalización, SPD integrados o externos, módulos/strings/MPPT, cantidades de perfiles y anclajes, descripción del anclaje, modelo de meter, **letra de revisión**. Se emite el juego completo con la misma revisión.

### 13.4 Datos de entrada que no se inventan

Módulo con sufijo exacto y ficha; inversor modelo exacto (corriente máx. de ficha, rango de tensión, MPPT); tipo de red; largos DC, AC y a la jabalina; traza; ubicación de inversor, tableros y medidor; tipo de montaje; **los cuatro datos de viento** (distancia a costa, altura del plano de módulos, rugosidad, dimensiones de la construcción); retiro a bordes; obstáculos de cubierta con posición y altura; pretil ancho y alto.

### 13.5 Informe de visita técnica [DECIDIDO]

Formato del relevamiento de Barenof: documento editable + canvas A4 con marca Voltia + PDF. Durante la visita solo se anota (con chequeo de coherencia de medidas); el análisis se hace en la oficina. Secciones: objetivo, resumen de datos con origen, instalación existente, eléctrico, zona nueva, cambios, sugerencias, riesgos, pendientes, fotos.

### 13.6 Informes técnicos de falla

Para casos de soporte se hacen dos versiones: **una al cliente** en lenguaje simple, sin recomendaciones internas ni problemas ajenos al cliente, y **una interna** con hipótesis descartadas y recomendaciones para la flota.

---

## 14. Postventa, soporte y diagnóstico

### 14.1 Principio [DECIDIDO]

**El inversor casi siempre dice qué le pasa.** Antes de ir a obra se lee el export de datos (History Data del portal, `.xls`) y, si hace falta, los registros. Antes de cambiar hardware se leen los registros de configuración. En Voltia PM: `generacion_planta` → `curva_horaria` → `estado_en_vivo`.

### 14.2 Las cuatro preguntas (Growatt)

1. **¿Hay fallas?** FaultCode, WarnCode, StrBreak, aislación (PV ISO), GFCI.
2. **¿Está derateando?** `DerateMode` (3 = tensión de red, 4 = frecuencia, 6 = temperatura, 7 = comando externo).
3. **¿El campo DC está completo?** Comparar corrientes por MPPT y string. Ojo: cuando Growatt limita, saca un MPPT de punto (corriente cero) y no es un string caído.
4. **¿Cómo está la red?** VacRS/ST/TR, Fac.

Correlacionar: potencia vs tensión (codo = umbral), meseta plana = lazo de control, meseta en una fracción exacta del nominal (20%) = piso de curva. Corrientes de dos circuitos sumando un valor constante = límite de corriente de entrada. Columna `IsAgain` = datos re-subidos por el datalogger tras perder conexión (no es corte real).

Identidades del medidor: Generación = autoconsumo + exportado; Consumo = autoconsumo + importado. Exportar más de lo que se genera o exportar de noche = medidor mal conectado.

Con dos inversores en el sitio: **modificar uno y dejar el otro de control**. Anotar siempre el valor original antes de escribir un registro.

### 14.3 Casos resueltos (para reconocerlos de nuevo)

| Caso | Síntoma | Causa | Solución |
|---|---|---|---|
| **Lamas** (2× MAC 30KTL3-XL) | Meseta en 6 kW (20%), DerateMode 3 | Curva Volt-Watt de fábrica (149 = 233,1 V, 148 = 241,9 V) con red en 242–245 V | 149 → 247,0 V, 148 → 256,0 V. Lamas 1 subió de ~45 a ~60–68 kWh/día |
| Lamas 2 | Desconexión por falsa sobretensión (FaultCode 300) | Offset de medición del inversor ~5 V vs smart meter | Umbral temporal 258 V documentado + reclamo de garantía |
| **Diego Trías** | Caídas de llaves DC | Térmicas DC CHINT C10A con strings de Isc ~14,3 A (picos de 16 A con borde de nube) | Cambiar a C25/C32 DC o seccionador 32 A. **Auditar la flota con el mismo kit** |
| **Victoria Soler** | Planta al 68% de la mediana | 40 paneles en un solo MPPT (tope ~32,8 A) | Recablear a dos MPPT; además sombras por árboles (a cargo del cliente) |
| **Nelson Filippa** | "No generó a la mañana" | Datalogger sin conexión, datos re-subidos (`IsAgain`) | Nada en obra; revisar WiFi del cliente |
| **MID12KTL3-XL2** (SN JRR6F8600A) | No arranca al amanecer sin código | Falla que sigue al número de serie (pasó en dos obras distintas) | Sustitución por garantía vía distribuidor. "AC V Outrange (006)" se resolvió con WideVolt Set = 1 |
| **Huawei Estilo** | Exportación cero, consumo pegado a la generación | CT aguas abajo de la inyección del inversor | Reubicar CT entre medidor UTE y el nodo inversor/cargas |
| SDM630MCT 3 hilos | Lecturas de ~135 V y potencia al 60% / potencia con signo invertido | Cableado de 4 hilos en red de 3 hilos / los dos CT invertidos | Recableado según §10.3 |
| Huawei Álvaro García | Meter no detectado | Modelo de meter distinto al asumido + RS485 con hilos de pares distintos en 180 m | Elegir DHSU1079-CT en la app y recablear con un par trenzado |

### 14.4 Reportes FV automáticos

**[PENDIENTE]** Los reportes mensuales de Voltia PM sobrestimaron el pago proyectado de un cliente con tarifa triple (falta bonificación de reactiva, período de exportación desfasado, cálculo con tarifa simple). Corregir el generador de reportes para tarifas horarias. La retención de IRPF del 12% sobre el crédito de exportación es un anticipo de impuesto, no una pérdida.

---

## 15. Componentes estándar

### 15.1 Módulo estándar [DECIDIDO]

**Resun RS8I590M** (590 W, N-Type TOPCon, monofacial simple vidrio), 2.278 × 1.134 × 30 mm, 27,2 kg. Por defecto en toda obra nueva salvo indicación.

Valores de **etiqueta** (se usan sobre los de ficha): Voc 52,20 V ±3% · Vmp 43,50 V · Isc 14,38 A ±3% · Imp 13,57 A.

**No confundir con RS8I-M-DG** (bifacial doble vidrio): cambian Voc, Isc, dimensiones y peso (31,75 kg).

Otros módulos vistos en obras: JA Solar JAM66D45-630/LB, JA 625 W, Restar RT8H620M-DG (marco composite), AESOLAR.

### 15.2 Inversores habituales

| Marca / familia | Notas |
|---|---|
| Growatt MIN TL-X2 (2500–6000) | Monofásico. Seccionador DC, SPD DC clase II y SPD AC clase III integrados. Meter en pines 7-8 |
| Growatt MIN 7000/8000/10000 TL-X2 | MIN 8000: I_max de ficha 38,3 A. Pinout COM pendiente de confirmar |
| Growatt MID 10–25 KTL3-XL2 | Trifásico; funciona en 230 V sin neutro con el método de Voltia. Respaldo de nicho 0,70 m |
| Growatt MAC 30KTL3-XL | Trifásico comercial. Verificar Volt-Watt (148/149) en puesta en marcha |
| Huawei SUN2000 (20KTL-M3, 30KTL-M3, 40K-MC0, 50KTL-M3) | Red 400 V+N. En 230 V IT el catálogo pide trafo de aislación. 50KTL-M3: 4 MPPT, 1.100 V, 30 A por MPPT |
| Fronius Symo Advanced 10.0-3 / 208-240, Primo | Symo 208-240 trabaja en triángulo nativo. Poca disponibilidad trifásica en 230 V |
| Victron MultiPlus-II GX | Usado para respaldo de cargas críticas con batería LiFePO4 48 V |

### 15.3 Meters

Eastron SDM120CT (mono, CT 100/5), Eastron SDM630MCT (tri, 3 o 4 hilos), Huawei DTSU666-H / DTSU71 / DHSU1079-CT, Fronius Smart Meter.

---

## 16. Lecciones aprendidas (errores que no se repiten)

1. **Sufijo del módulo:** se usó la ficha del bifacial RS8I-M-DG con el monofacial RS8I590M instalado. Cambia todo, incluido el peso a favor en arranque.
2. **Varilla M13:** no existe; era la mecha. Se especifica M12.
3. **Corriente AC por cociente S/U:** subdimensiona. Leer la ficha.
4. **Térmica dimensionada por el límite de exportación:** dispara. Va por la corriente máxima del equipo.
5. **Térmicas DC por debajo de la Isc corregida:** disparos en días de nubes con borde brillante.
6. **Protecciones AC en DC** (portafusibles 500 V~, fusibles cerámicos): no.
7. **Viento con `q = 0,613·v_k²`, Cf 1,8 y doble 1,5:** estructuras 3–4 veces sobredimensionadas.
8. **Viento genérico de 90–100 km/h** en sitio costero: no; manda UNIT 50:84.
9. **Coplanar declarado con pila de más de 20 cm:** es Cap. 10.
10. **Lastre apoyado sin vínculo computado en la planilla:** no resiste nada.
11. **Perfil anclado solo en los extremos sobre luz larga:** falla por flexión/flecha aunque el anclaje esté perfecto.
12. **Datos distintos entre unifilar y memorias** (térmica 32 vs 40 A, largo AC 1 vs 10 m, SPD integrados vs externos): error aunque cada valor sea defendible.
13. **Cable solar computado ida y vuelta por color:** duplica metros.
14. **Meter en pines 3-4 del Growatt MIN** (son del datalogger): no lee.
15. **RS485 con hilos de distintos pares:** no comunica en tiradas largas.
16. **Medidor de 4 hilos en red de 3 hilos:** referencia flotando.
17. **Validar una instalación copiando otra:** las dos pueden estar mal.
18. **Inventar datos** (largos, secciones, specs): nunca. Se pregunta.
19. **Opinar sobre lo comercial en la ingeniería** o alertar problemas sin preguntar si existen: primero preguntar.
20. **Informes a UTE con información de más** (kWp, anexos): solo lo necesario.
21. **Dos MPPT previstos y todo cableado en uno:** recorte permanente. Verificar en la validación de obra terminada.

---

## 17. Obras de referencia

| Obra | Tipo | Qué dejó como criterio |
|---|---|---|
| Álvaro García (Maldonado, ~6 km de costa) | Suelo, 66 × 625 W, Huawei 50KTL-M3, 400 V+N, 180 m Al 95 enterrado | Plantilla de suelo, Al por caída, reducción de sección en tablero, cable enterrado directo, RS485 por par |
| Rafael Ricca (Valdense) | Suelo, Growatt 10 kW en 230 V sin neutro | Medición 3 hilos SDM630MCT, rechazo del autotransformador, marquesina para ganado |
| Javier de León | Suelo | Nicho con dado empotrado sin verificación de vuelco |
| Camilo Pérez (Las Toscas) | Hormigón con pretiles, MIN 8000 limitado a 7 kW | Variante B, IMG limitada por software, 6/4 mm² de tierra |
| Gerardo Fernández (Lagomar) | Hormigón, dos techos | Escuadras sobre C80, anclaje vertical a pretil, error de sufijo del módulo |
| Hernán Almada | Hormigón, Variante C | Triángulo isósceles, perfiles H, ítems fijos de lista, cable por polo |
| Hamilton Romero | Hormigón coplanar con pendiente | Variante D, jerarquía de montaje, apoyos y luces, coherencia entre entregables |
| Antonella Brondo (Cuatro Piedras) | Coplanar, 11 × 590 W | Revisión completa del viento (v3.4), anclajes sin perforar, aérea Al/Cu |
| Pablo Ruiz (Punta del Este, hostel) | Losa a dos aguas 13°, 52 × 590 W, Growatt 25 kW | Opción A lastre (~11.000 kg) vs B anclaje químico (~68 puntos, ~1.800 kg); garantía 90% negociada; N+1 por cara sur; margen por opción |
| José Correa / De la Abuela SAS (San Jacinto) | Chapa trapezoidal, 74 × 590 W, Huawei 40–50 kW | Riesgo de anclar a isopanel, succión de borde, 4×Al 50 + PE Cu 16 |
| Nelson Filippa (Juan Lacaze) | Primera obra de chapa | Anclaje a tubular, tornillos en cresta |
| Néstor Rojas (Minas) | Losa a dos aguas coplanar | Mordaza al canto de viga, C80 con alma vertical |
| Gustavo Vallegra (Pando) | Cochera 7,0 × 4,6 m | Viga perimetral, tubular soldado, segunda térmica a 45 m |
| Solymar | Tejas planas sobre madera | Ganchos A2 con dos tirafondos |
| Barenof | Ampliación: 50 × 425 W → 590 W, Huawei 20 → 40 kW, techo nuevo | Formato de informe de visita técnica |
| Estilo / Fransuar (Maldonado) | Huawei 30 kW | Constancias para seguro, CT mal ubicados |
| Lamas | 2× MAC 30 | Curva Volt-Watt |
| Rodrigo Alvarez / Coviteja | Ampliaciones | Informes de justificación de consumo |
| Lagomar / Ciudad de la Costa | PAT > 100 Ω en arena | Argumento de tensión de contacto, lanza de agua |
| Obra Restar (caso UTE 7616370386) | Marcos composite | Informe de no conductividad |

---

## 18. Pendientes y discrepancias abiertas

| Tema | Situación | Acción |
|---|---|---|
| **Límite de caída de tensión** | La skill v3.5 dice **3%** (DC y AC total). El criterio que Nicolás le pidió a Luna (octubre 2026) es **≤ 5%, lo que pide UTE**. En versiones viejas se hablaba de 1% DC | Definir cuál rige y actualizar la skill. Hasta entonces, el 5% es la última instrucción |
| Dosificación de hormigón | Estándar de obra 1:3:2 con bolsa de 25 kg vs 1:2:3 (~350 kg/m³) en `calculo.md` | Unificar en la skill |
| Tierra en `estandares.md §5` | Falta la aclaración de 6 mm² solo en el bajante | Corregir en la próxima edición del ZIP |
| Pinout Growatt MIN 7000–10000, MID, Huawei 50KTL-M3, Fronius Primo | Sin confirmar | Asentar cuando una obra lo confirme |
| Plantillas de chapa, isopanel, tejas, cochera | Sin plano maestro aprobado | Generar con la primera lámina aprobada |
| Artículo UTE para aluminio | No citado | Buscar y citar |
| Volt-Watt en la flota MAC | Solo corregido en Lamas 1 | Relevar 148/149 en toda la flota |
| Kit con térmicas DC C10A | Detectado en Trías | Auditar obras con el mismo kit (empezar por Daniel Trías) |
| Reportes FV con tarifa triple | Sobrestiman | Corregir el generador |
| Origen de leads | 98% sin dato | Cargar sistemáticamente |
| Restar Solar | Sin respuesta del fabricante | Se respondió a UTE con informe propio |
| **Cómo se le dice al cliente lo del híbrido 230 V** | Sigue valiendo no exponer a Voltia como empresa chica | Confirmar la frase propuesta en `04-equipos.md` |
| **Formato de documentos al cliente** | Plano y firmado "Nicolás — Voltia" vs PDF con marca firmado "Equipo Voltia" | Definir cuándo va cada uno |

---

## 19. Glosario

| Término | Significado |
|---|---|
| IMG | Instalación de microgeneración (potencia = salida del inversor o la limitada) |
| ICP | Interruptor de control de potencia de UTE |
| Interruptor de corte de microgeneración | Térmica general de la IMG en el tablero de interconexión, precintable |
| Tablero de interconexión | Junto al medidor de UTE: bornera, térmica general, smart meter |
| PAT | Puesta a tierra |
| SPD / DPS / descargador | Protección contra sobretensiones |
| gPV | Fusible para strings fotovoltaicos |
| MPPT | Seguidor del punto de máxima potencia (entrada del inversor) |
| Pata / parantes | Pórtico transversal de la estructura de suelo / sus dos columnas |
| Sujetador (grampa, klema) | Pieza que aprieta el marco del módulo al riel |
| Grampa de junta alzada | Anclaje al engrafado del isopanel |
| Pila de capas | Altura total de la estructura sobre la cubierta; define Cap. 8 o 10 |
| Coplanar | Módulo a ≤ 20 cm y ≤ 5° de la cubierta |
| 3P3W / tres hilos | Trifásica sin neutro |
| Conexión Aron | Medición trifásica de tres hilos con dos CT (Blondel) |
| CT / TC / TI | Transformador de corriente (pinza del smart meter) |
| Volt-Watt | Curva de reducción de potencia por tensión alta |
| DerateMode | Columna del export de Growatt que dice por qué limita |
| N+1 | Paneles extra para compensar orientación o inclinación |
| Experiencia Solar | Área de postventa |
| Voltia PM | Sistema de gestión interno (ERP) |
| Plan de Protección contra Granizo | Plan anual de Voltia que repone paneles rotos por granizo; **no es un seguro** |

---

*Documento interno de Voltia SAS. Responsable: Ing. Nicolás Machín. Actualizar al cerrar cada decisión nueva y al subir de versión la skill de ingeniería.*
