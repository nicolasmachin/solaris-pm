# 19 · Soporte (mesa de monitoreo de plantas)

## Para qué existe

Enterarse de que una planta anda mal **el mismo día, y antes que el cliente**.
El monitoreo diario (capítulo 09) mira el día anterior y lo cuenta en un mail;
con eso Alberto Norman pasó del 8 al 28 de octubre de 2026 con la llave de
microgeneración saltada: estaba detectado ("falla código 302") pero nadie
entendía qué quería decir. Y lo que no deja código —una planta que genera a
medias, como Martín González con la aislación— no lo veía nadie.

Es la primera parte del módulo de Soporte, que va a centralizar los reclamos y
el monitoreo. Decidido el 28-oct-2026: **por ahora no lo atiende nadie en
particular** (las alertas le llegan a quien tenga `SOPORTE:VIEW`, hoy ADMIN);
después habrá un rol de Soporte. **Al cliente nunca le escribe el sistema
solo**: lo decide una persona con un toque. Fuera de horario no se avisa a
nadie: lo detectado queda en la cola.

## Cómo se usa

Menú **Soporte** (`/soporte`, layout `pages/SoporteLayout.tsx`) con tres
pestañas por URL:

- **Mesa** (`/soporte`, `pages/Soporte.tsx`): lo que se describe en esta
  sección.
- **Tickets** (`/soporte/tickets`, `modules/tickets/TicketsSection.tsx`): la
  lista de tickets con sus filtros, el alta y el detalle. Vivía en Mis tareas
  hasta el 17-nov-2026; `/mis-tareas/tickets` redirige acá. Ver capítulo 04.
- **Evolución** (`/soporte/evolucion`, `pages/SoporteEvolucion.tsx`): las dos
  gráficas de cómo vienen los tickets y los problemas (ver "La evolución").

En la Mesa:

- Arriba, en una sola línea: cuántas plantas tienen problema, cuántas están en
  línea (de noche dice "sin sol"), cuándo fue la última lectura, los reclamos
  abiertos (lleva a Soporte → Tickets) y el historial del monitoreo
  (Experiencia Solar → Monitoreo), más **Revisar ahora** y **Revisar
  rendimiento**.
- **Problemas**: **todo lo que está abierto, de las dos fuentes juntas** —los
  casos de la revisión automática y las incidencias abiertas del monitoreo
  diario—, **una columna por tipo**: falla del inversor, no genera, no comunica,
  genera menos de lo normal, medidor mal conectado, no exporta, sin datos de la
  plataforma. Cada columna lleva la cantidad en grande (pasando el mouse, qué
  suele ser).
- Cada alerta es **una tarjeta de dos líneas**: la planta, cuántos días lleva,
  una frase de qué pasa, los últimos 3 días en mini barras, y marcas de "cliente
  avisado" y "en obra/silenciada". Está pensado para que **hasta unas 20
  alertas entren en la pantalla sin bajar** (pedido de Nicolás); con muchas más,
  cada columna crece hacia abajo.
- **Al tocar una alerta se abre el detalle**: los kWp, desde cuándo, de dónde
  salió (revisión automática, monitoreo diario o los dos), las barras con los
  kWh de cada día, qué se vio y las acciones:
  - casos de la revisión automática: **Avisar al cliente**, **Resuelto**,
    **Descartar**;
  - incidencias del monitoreo diario: **Ya la vi**, **Descartar** (con el
    motivo) y **Ver en Monitoreo**.
- En el detalle de los casos de la revisión automática, el recuadro violeta
  **Análisis con IA**: qué pasa, causa probable, qué hacer y energía perdida.
  Las fallas y los "no genera" lo traen solo; **Analizar** / **Analizar de
  nuevo** lo pide a mano para cualquier caso (ver "El análisis con IA").
- **Se arreglaron solas**: la última columna, en verde. Las plantas cuyo caso
  se cerró solo porque volvieron a andar, con cuánto duró, cuándo volvió y
  cuántas veces; **Visto** las saca. Ver el paso 7 de "La revisión automática".
- **Ver casos cerrados** muestra los últimos 50 casos de Soporte cerrados.
- **Plantas ahora**: todas las plantas vinculadas con su lectura (ver abajo).
  De noche el estado dice "Sin sol" en vez de "Desconectada": Growatt da a casi
  todas por desconectadas a la noche y no quiere decir nada.
- **Revisar ahora** corre la revisión en el momento; **Revisar rendimiento**,
  el chequeo diario de "genera menos".

## Cómo funciona

### La revisión automática, "el vigía" (cada media hora, de 7:00 a 20:30)

En el código se llama vigía; en la pantalla y en los manuales del equipo es
"la revisión automática". Cada media hora y no cada 15 minutos (decidido el
28-oct-2026): alcanza para enterarse en el día, con la mitad de consultas.

`services/soporte/vigia.service.ts` → `correrVigia()`, programado en
`soporte.job.ts`.

1. **`plant/list` de Growatt**: en 2 llamadas trae, para las 185 plantas
   visibles, la potencia de ahora (`current_power`), la energía total y el
   estado (1 en línea, 4 desconectada). Es lo barato: toda la cartera por el
   costo de dos consultas. Verificado el 28-oct-2026 que se actualiza (en 5
   minutos cambiaron 18 de 46 plantas: cada datalogger sube cada 5 a 10).
2. **Hay sol si la mediana de la cartera** (W generados por W instalados, de
   las plantas en línea, con el kWp del proyecto) pasa de 10 %
   (`medianaCartera()`, `SOL_MIN` en `vigia.ts`). Así el clima se cancela: si
   está nublado, baja todo el mundo.
3. Por planta, `evaluarLectura()` (puro, `vigia.test.ts`) cuenta lecturas
   seguidas **en línea sin generar con sol** (`ceroConSol`) o **desconectada con
   sol** (`desconectadaConSol`). A las 2 (una hora) hay alerta, y solo si esa
   lectura tiene sol (el contador se conserva de noche). Si genera, se
   ponen en cero y **se cierran solos** los casos de planta caída ("Volvió a
   generar a las…"), **también los recurrentes** (`cerrarAutomatico()`): quedan
   en la columna "Se arreglaron solas" hasta que alguien los marca como vistos
   (ver el paso 7).
4. **Antes de abrir el caso se confirma con el inversor**: `ultimoDatoInversor()`
   (`growatt/client.ts`, `tlx_last_data` para MIN y `max_last_data` para MAX, una
   llamada por equipo, solo de las plantas sospechosas). Hace falta porque
   `plant/list` es grueso: Irigaray figuraba "en línea con 0 W" y en realidad su
   inversor había dejado de mandar datos a las 16:23 generando 3,5 kW.
   `diagnosticarInversor()` (`diagnostico.ts`, puro, `diagnostico.test.ts`):

   | Último dato del inversor | Caso |
   |---|---|
   | de hace más de 35 minutos | No comunica (con la hora y lo que generaba) |
   | trae código de falla | Falla del inversor, explicada (`codigos.ts`) |
   | genera | ninguno: la lista venía atrasada |
   | red en 0 y paneles con tensión | No genera — **el inversor no ve la red: la llave** |
   | paneles sin tensión, con sol | No genera — lado de continua |
   | red y paneles con tensión, sin generar | No genera — en espera, apagado o limitado |

   Con varios inversores manda el peor (`elegirPeor()`).
5. **Un caso de "planta caída" por proyecto** (`TIPOS_CAIDA`: no genera, no
   comunica, falla): si cambia el diagnóstico se actualiza el mismo caso
   (`abrirOActualizar()`). **Eso vale también para el recurrente**: conserva la
   marca, pero cambia el tipo, el código y el texto ("Se repite: Dejó de mandar
   datos", y el detalle dice qué figuraba antes). Hasta el 17-nov-2026 el
   recurrente solo actualizaba la hora y se quedaba con el tipo viejo: Antonella
   Brondo, que no comunicaba desde el 14-nov, seguía en "falla del inversor" por
   una falla repetida de días antes, y lo mismo otras cuatro plantas. Con un
   caso abierto revisado hace menos de una hora no se vuelve a consultar al
   inversor.
6. Al **abrir** un caso (no al actualizarlo) se avisa a los usuarios con
   `SOPORTE:VIEW`: notificación `soporte_alerta` con link a `/soporte`, que sale
   también por push (capítulo 12, *Avisos push*).

7. **¿Se repite?** Al abrir un caso de falla o de "no genera",
   `marcarSiSeRepite()` (`casos.service.ts`) mira, una sola vez: los casos de
   caída de la misma planta de los últimos 7 días y, si hay código de falla,
   **las alarmas del inversor del último mes** (`alarmasPlanta()` de la web de
   Growatt, una consulta). Si la falla apareció 3 días o más, el caso queda
   `recurrente`: el título dice "Se repite: …", el detalle lista las fechas y la
   hora típica. Hace falta por las fallas que vienen y van:
   Martín González tuvo aislación baja (203) 16 días entre el 28-sep y el 28-oct,
   siempre a la mañana (en falla de ~6 a ~13 h y generando fuerte a la tarde),
   así que el total del día no bajaba del 60 % y "genera menos" no lo marcaba;
   sin esto, la revisión le habría abierto y cerrado un caso cada día.

   **Cuando la planta vuelve a generar, el recurrente se cierra solo igual**
   (desde el 17-nov-2026; antes lo tenía que cerrar una persona y quedaban en
   la mesa plantas que andaban bien). Como "vuelve mañana", no desaparece:
   todo caso cerrado por el sistema (`estado RESUELTO`, `resueltoPorId` vacío)
   y sin `vistoEn` aparece en la columna **Se arreglaron solas**
   (`armarArregladas()` en `soporte.routes.ts`): una tarjeta por planta con el
   último caso, cuánto duró, cuándo volvió y cuántas veces se cerró sola sin
   verse. Si la planta tiene un caso abierto, no aparece ahí (ya está en su
   columna). **Visto** (`POST /api/soporte/casos/:id/visto` → `marcarVisto()`)
   marca todos los cerrados solos de esa planta y la tarjeta se va. Cerrar o
   descartar a mano (`cerrarManual()`) deja el caso visto. La migración
   `soporte_casos_visto` dio por vistos todos los casos que ya estaban
   cerrados, para que la columna arranque vacía.

Además guarda por planta (`SoporteEstadoPlanta`) la última lectura, la energía
total del primer sondeo del día (para "Hoy") y un `factorNormal` (cuánto rinde
respecto de la mediana, promedio móvil, que no aprende con un caso abierto). El
factor instantáneo **no se muestra**: depende de la hora y la orientación (un
techo al este a las 17 h siempre rinde poco) y confundía.

### Plantas en obra o silenciadas: no avisan

`pausas.ts` → `pausasDePlantas()`. Una planta **no abre caso** (aunque no
genere ni comunique) si:

- **Tiene obra agendada hoy en el calendario** (`InstallationSegment`), la
  propia o la de **una ampliación suya** (`Project.parentProjectId`), con un día
  de margen después del fin por si la reconexión se demora. Caso real: Barenof,
  desconectada por la obra de ampliación del 26 al 30-oct-2026; sin esto le
  habría saltado un caso "no comunica".
- **Está silenciada** desde Experiencia Solar → Monitoreo
  (`monitoreoSilenciadoHasta` de la planta Growatt o Huawei): el mismo silencio
  del monitoreo diario.

Vale para la revisión de cada media hora y para el chequeo diario de "genera
menos" (un día de obra a medias daría bajo). La mesa las muestra "En obra
hasta el …" o "Silenciada hasta el …". La lectura
se sigue guardando; solo no se abre caso. Un caso ya abierto no se cierra por
entrar en obra: se cierra cuando vuelve a generar, o a mano.

### La potencia instalada (kWp)

`kwp.ts` → `kwpEfectivo()`: primero la de la configuración de reportes FV
(`potenciaInstaladaKwp`, la cargó una persona mirando la planta), después la
del proyecto y la de Growatt, si son ≥ 0,5 kWp. Hace falta porque en los
proyectos hay valores mal cargados: medido el 28-oct-2026, Hotel Lamas 2 en
0,01 kWp (y Lamas 1 con 45,6, el total del hotel), Barenof en 0, COVITEJA
Trifásico en 0,01, y otros que no coinciden con Growatt.

La potencia se usa para la mediana de la cartera (W/Wp, kWh/kWp). Para "vs. lo
normal" **no hace falta**: se cancela (es el cociente de la planta dividido su
propia mediana). Una planta sin potencia confiable queda fuera de la mediana
pero igual tiene sus últimos días.

### Plantas Huawei (en la misma revisión)

`vueltaHuawei()` en `vigia.service.ts`, lógica pura en `vigia-huawei.ts`
(`vigia-huawei.test.ts`). FusionSolar **no da la potencia del momento**: una
sola llamada (`kpiTiempoReal()` → `getStationRealKpi`, hasta 50 plantas) trae el
estado de salud (`real_health_state`: 1 sin comunicación, 2 con falla, 3 sana) y
la energía del día (`day_power`). Con dos lecturas seguidas se sabe si está
sumando; la "potencia" que muestra la mesa es el promedio de la última media
hora.

- Sin comunicación o con falla dos lecturas seguidas con sol → caso. Sin
  comunicación **no quiere decir rota** (Rodolfo Sosa anda bien sin wifi).
- Sana pero sin sumar energía (menos de 0,05 kWh en media hora) dos lecturas
  con sol → "no genera".
- Hay sol según la mediana de las plantas Growatt (es el mismo cielo). Si
  Growatt no contesta, no hay mediana y Huawei no alerta esa vuelta.
- Una marca que falla no frena a la otra (`correrVigia()`). Sin credenciales de
  Huawei (`huaweiConfigurado()`), se saltea.
- El estado queda en `SoporteEstadoHuawei` (tabla aparte, para no tocar la de
  Growatt ya en producción); el caso guarda `huaweiPlantCode`.
- Probado el 28-oct-2026 con las 6 plantas reales (Cidel - Barenof figuraba sin
  comunicación). No pregunta por las alarmas del inversor: el caso manda a
  verlas en FusionSolar.

### Genera menos de lo normal (una vez por día, 9:30)

`rendimiento.service.ts` → `revisarRendimiento()`. Sin APIs: usa
`ReporteFvGeneracionDiaria` (la carga el monitoreo de las 8).

- rendimiento del día = kWh / kWp; cociente = rendimiento / mediana de la
  cartera ese día. Con eso **la estación se cancela**: en julio genera menos
  todo el mundo.
- **Lo normal de la planta** = mediana de sus cocientes **del mismo mes del año
  anterior** (si tiene ≥ 8 días con sol), o si no de los **últimos 30 días**
  (`fuente` en `RendimientoPlanta`). Hace falta porque el cociente de cada planta
  también cambia con la estación (sol de invierno más bajo, sombras): medido el
  28-oct-2026 en 44 plantas con 4 meses o más, la mitad varía 23 % entre su
  mejor y su peor mes, y una de cada diez más de 50 % (Vanoli: 1,50 en junio,
  0,84 en octubre). Los datos arrancan el 1-jun-2026, así que hasta junio de
  2027 se usan los 30 días. vs. lo normal = cociente / lo normal. **Hoy no
  entra** (día incompleto).
- **Con un solo día rojo alcanza** (criterio de Nicolás, 28-oct-2026: "con
  una sola vez que pasa ya lo vas a detectar"). Cada mañana se mira **el último
  día con sol**: si generó algo pero menos del 60 % de lo normal, se abre el
  caso y **se va a mirar el inversor ese día** (`investigar.ts` →
  `investigarDia()`): el historial cada 5 minutos de ese día y, si hubo un
  código de falla, las alarmas de las dos semanas anteriores. Dos consultas a
  la web de Growatt, solo para esa planta.
  - Si el inversor estuvo en falla, el caso pasa a "falla del inversor" con el
    código explicado; si el código vino más de un día, "Se repite: …" y no se
    cierra con los 3 días buenos (lo cierra una persona). Si después la planta
    se cae del todo y vuelve, ese caso de falla se cierra solo como cualquier
    caída y pasa a "Se arreglaron solas". Martín González (23-oct): "Se repite: Aislamiento bajo de los
    paneles", en falla de 05:51 a 15:47, aislamiento hasta 43 kΩ, 10 días en dos
    semanas.
  - Si no hay falla pero sí otra cosa (cortes de comunicación, recorte,
    entrada sin tensión, aislamiento bajo), se anota.
  - Si no se ve nada: "en observación" (sombra nueva, suciedad, un grupo de
    paneles). Si ya hubo otro día rojo en las dos semanas anteriores, o vuelve a
    pasar con el caso abierto, pasa a "Se repite".
  - `ultimoDiaRevisado` evita mirar dos veces el mismo día (si se corre a mano).
  - Se cierra solo con 3 días con sol seguidos al 80 % o más, salvo que se
    repita (ahí lo cierra una persona).
- Los días en cero no cuentan (son del vigía); si ya hay un caso de planta
  caída, no se abre otro; las plantas en obra o silenciadas no avisan.
- **El día de lluvia ya está descontado**: cada planta se compara contra la
  mediana de la cartera ese mismo día, y los días con la mediana debajo de 1
  kWh/kWp ni entran. Lo único que podría engañar es un chaparrón localizado
  sobre una planta lejos del resto; por eso se mira el inversor antes de
  concluir.
- `rendimientoReciente()` alimenta también la columna de la mesa (caché de 10
  minutos en la ruta).

### Una sola lista de problemas

`armarProblemas()` en `routes/soporte.routes.ts` junta los `SoporteCaso`
abiertos y las `FvIncidencia` abiertas del monitoreo diario, y los agrupa
(`GRUPO_CASO`, `GRUPO_INCIDENCIA`). **Una planta con un caso y una incidencia
por lo mismo aparece una vez**: el caso, con la marca de que el monitoreo
también lo vio. "No genera", "no comunica" y "falla" cuentan como lo mismo para
esto (la planta está caída, vista distinto). Las incidencias que traen "código
N" se explican con la misma tabla (`describirCodigo()`), así Norman dice "el
inversor no ve la red de UTE" y no "código 302".

"Genera menos" avisa si esos mismos días la planta tuvo cortes de comunicación
(incidencias `SIN_COMUNICACION` o `SIN_DATOS_API`): los kWh pueden estar
incompletos. Caso Irigaray (22 al 27-oct-2026): parecía rendir 8 % de lo normal
y en realidad era el relé en falla (código 405) más el datalogger cortado.

### La evolución (pestaña Evolución)

`GET /api/soporte/evolucion?dias=` (`soporte.routes.ts` → `evolucion()`),
entre 7 y 730 días, por defecto 90; la pantalla ofrece 30, 90, 180 y 365.
Devuelve, para cada día local de Montevideo:

- **Tickets abiertos al final del día**: creados hasta ese día y sin resolver ni
  cerrar hasta ese día (el cierre es el primero entre `resueltoEn` y
  `cerradoEn`). Los borrados (`deletedAt`) no cuentan. **Un ticket que hoy está
  ABIERTO, DERIVADO o EN_PROGRESO cuenta como abierto desde que se creó**,
  aunque tenga `resueltoEn`: pasar de RESUELTO a "en progreso" no borra esa
  fecha (`marcarEnProgreso()` no la toca), y sin esta regla un ticket reabierto
  desaparecía de la gráfica. El costo es que el hueco en que estuvo resuelto se
  ve como abierto.
- **Plantas con problema, por tipo**: los casos de Soporte (`detectadoEn` →
  `resueltoEn`) y las incidencias del monitoreo diario (`primeraDeteccionEn` →
  `resueltaEn`) mapeados a los mismos siete tipos de la mesa (`GRUPO_CASO`,
  `GRUPO_INCIDENCIA`). Se cuenta **planta × tipo** (por `projectId`, o el id de
  la planta si la incidencia no tiene proyecto): la misma planta con el mismo
  tipo visto por las dos fuentes cuenta una vez. **A diferencia de la mesa no se
  juntan "falla", "no genera" y "no comunica"**: una planta que tuvo falla y
  además dejó de comunicar el mismo día suma en las dos franjas. Los descartados
  (caso DESCARTADO, incidencia DESCARTADA) no cuentan en ningún día.

**No hay foto diaria guardada**: todo se reconstruye con las fechas de apertura
y cierre. Por eso, antes del primer registro (tickets desde jul-2026, monitoreo
desde ago-2026, casos de Soporte desde el 29-oct-2026) el cero es falta de
dato, y la pantalla lo avisa con `desdeTickets` / `desdeProblemas`. También
pasa que un problema que se abrió y cerró dentro del mismo día no se ve (al
final del día ya no estaba abierto).

La gráfica de problemas es de áreas apiladas en escalón, con un color fijo por
tipo (paleta categórica validada para daltonismo, un tono para modo claro y otro
para oscuro) y la leyenda con el valor de hoy de cada tipo. Muestra solo los
tipos que aparecieron en el rango elegido.

### El análisis con IA

`services/soporte/analisisIa.ts`. La revisión automática dice **qué pasa ahora**
(el último dato del inversor); el análisis hace lo que haría un técnico
después: mira los días anteriores, las alarmas de meses, el historial cada 5
minutos si hace falta y si ya pasó en otra obra, y deja escrito el diagnóstico
en el caso (`analisisIa`, Markdown).

- **Cuándo se pide solo**: `analizarSiCorresponde()`, llamado por el vigía
  (Growatt y Huawei) después de abrir o actualizar un caso, y por "genera menos"
  cuando el día rojo resulta una falla. Solo si el caso está abierto, es
  `FALLA_INVERSOR` o `SIN_GENERACION` y **todavía no se analizó con ese tipo**
  (`analisisIaTipo`). Si el caso cambia de tipo (de "no genera" a falla), se
  analiza de nuevo. "No comunica" no se analiza solo: sin datos no hay qué
  mirar.
- **A mano**: `POST /api/soporte/casos/:id/analizar`, cualquier tipo.
- **Cómo**: Claude (`SOPORTE_IA_MODEL`, por defecto `claude-sonnet-5-5`) con
  las **mismas herramientas de lectura del conector** (`abrirHerramientas()` del
  asistente), limitadas a las de plantas: `buscar_casos_tecnicos`,
  `generacion_planta`, `alarmas_planta`, `historial_inversor` (sin Excel, hasta
  14 días), `curva_horaria`, `estado_en_vivo`, `ficha_generador`. Él decide si
  vale la pena bajar el historial. Las herramientas actúan en nombre del usuario
  de `SOPORTE_IA_USUARIO` (email) o, si no está, el primer ADMIN; solo leen.
- **Recursos**: una cola en memoria, **de a un caso por vez**, tope de 10
  vueltas y de 5 minutos (la última vuelta va sin herramientas para que cierre
  con lo que tiene). No frena al vigía: el caso queda `ANALIZANDO` y la pantalla
  se refresca cada 10 segundos hasta que aparece.
- **Costo**: cada llamada queda en `ai_usage` con la feature
  `soporte_analisis`, el proyecto y el caso. En la prueba del 17-nov-2026 un
  análisis costó unos 3 centavos de dólar.
- **Estados** (`analisisIaEstado`): `ANALIZANDO`, `LISTO`, `ERROR`. El tipo se
  anota **al pedirlo**, no al terminar: un análisis que falla no se vuelve a
  pedir solo cada media hora (se pide a mano).
- **Apagado**: sin `ANTHROPIC_API_KEY` o con `SOPORTE_IA=0` no se pide nada y
  el botón responde `SOPORTE_IA_OFF`.

### Avisar al cliente

`casos.service.ts` → `mensajeSugerido()` (según el tipo y si es la llave) y
`avisarCliente()`: notificación `soporte_aviso_cliente` a cada usuario de portal
del proyecto (campanita del portal y push). Mientras el caso siga abierto, el
Inicio del portal le muestra el aviso arriba (`GET /client/avisos-planta`, solo
el mensaje que se le mandó). Sin usuario de portal, la mesa dice que hay que
avisarle por WhatsApp.

## Permisos

- **El menú Soporte lo ve quien tiene `SOPORTE:VIEW` o `TICKETS:VIEW`**
  (`SoporteLayout`). Las pestañas Mesa y Evolución piden `SOPORTE:VIEW`;
  Tickets, `TICKETS:VIEW`. Quien solo tiene TICKETS entra directo a Tickets
  (`SoporteIndex` redirige). Es así porque los tickets los ven casi todos los
  roles y la mesa solo unos pocos.
- `GET /api/soporte/evolucion`: `SOPORTE:VIEW`.
- `POST /api/soporte/casos/:id/analizar` (pedir el análisis con IA):
  `SOPORTE:EDIT`. El análisis se ve con `SOPORTE:VIEW`.
- `SOPORTE:VIEW`: ver la mesa y recibir las alertas. `SOPORTE:EDIT`: avisar al
  cliente, cerrar casos, marcar como visto lo que se arregló solo y correr las
  revisiones a mano. El script
  `prisma/scripts/seed-soporte-permissions.ts` se lo da a ADMIN; en producción
  (verificado el 17-nov-2026) también tienen VIEW y EDIT EXPERIENCIA_SOLAR y
  COMPRAS, y VIEW ASESOR_IA.
- `/client/avisos-planta`: `PORTAL_CLIENTE:VIEW` y proyectos del cliente.

## Reglas y decisiones

- **No consume recursos aparte**: no hay agentes ni procesos nuevos. La
  revisión en sí no usa IA (el análisis con IA es aparte, de a uno y con
  topes; ver "El análisis con IA"). Es un `cron` dentro del mismo proceso del server, que hace 2 consultas a
  Growatt por vuelta más una por inversor sospechoso, y termina. Nunca corren
  dos vueltas a la vez (`corriendo`), cada consulta tiene 30 s de límite y 5
  reintentos, y la vuelta entera tiene un tope de 10 minutos
  (`TOPE_VUELTA_MS`): lo que no llegó a revisar queda para la próxima. Pedido
  explícito de Nicolás el 28-oct-2026, después de que el asistente Secretario
  llenara la RAM de la VPS de desarrollo con agentes que quedaban abiertos.

- **El vigía solo corre en producción** (`vigiaHabilitado()`): dev usa el mismo
  token de Growatt y compartirían el cupo. En dev: **Revisar ahora**, o
  `SOPORTE_VIGIA=1`. `SOPORTE_VIGIA=0` lo apaga en prod.
- Una hora (2 lecturas) antes de alertar: menos da falsas alarmas por nubes que
  tapan una planta y no la mediana.
- Los códigos de `codigos.ts` salen de los manuales MIN/MAX; **el 302 = sin red
  (la llave) está confirmado con Norman**, los demás a confirmar caso a caso.

## Casos borde

- **Si el server se reinicia con análisis en la cola**, esos casos quedan en
  `ANALIZANDO` para siempre (la cola es en memoria y el tipo ya quedó anotado,
  así que no se vuelven a pedir solos). La pantalla muestra "Mirando la
  planta…" sin botón; hoy se destraba poniendo `analisisIaEstado` en `ERROR`
  o `NULL` en la base. Pasa con cada deploy que caiga en medio de un análisis.
- Una falla intermitente que dura **menos de una hora** con sol no abre caso
  (hacen falta dos lecturas seguidas). Para esas, la fuente es el registro de
  alarmas del inversor, que hoy solo se mira al abrir un caso. Si hiciera falta,
  se podría revisar el registro de alarmas de toda la cartera una vez por día
  (una consulta a la web de Growatt por planta).

- "Hoy" se calcula desde la primera lectura del día: el día que se prende (o si
  el server estuvo caído a la mañana) da de menos.
- Una planta muerta desde antes que el vigía empiece se detecta en su primera
  hora con sol.
- Si Growatt no contesta, la vuelta falla entera y se loguea; la siguiente
  vuelve a intentar.
- `plant/list` muestra 55 de 185 plantas desconectadas, pero muchas no son de
  clientes (de otra empresa, de prueba): el vigía solo mira las vinculadas a un
  proyecto y no ignoradas.
