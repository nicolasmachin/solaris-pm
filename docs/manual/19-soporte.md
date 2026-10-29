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

Menú **Soporte** (`/soporte`, `pages/Soporte.tsx`):

- Arriba, en una sola línea: cuántas plantas tienen problema, cuántas están en
  línea (de noche dice "sin sol"), cuándo fue la última lectura, los reclamos
  abiertos (lleva a Mis tareas → Tickets) y el historial del monitoreo
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
   generar a las…").
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
   comunica, falla): si cambia el diagnóstico se actualiza el mismo caso. Con un
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
   hora típica, y **no se cierra solo** cuando la planta vuelve a generar (vuelve
   mañana): lo cierra una persona. Hace falta por las fallas que vienen y van:
   Martín González tuvo aislación baja (203) 16 días entre el 28-sep y el 28-oct,
   siempre a la mañana (en falla de ~6 a ~13 h y generando fuerte a la tarde),
   así que el total del día no bajaba del 60 % y "genera menos" no lo marcaba;
   sin esto, la revisión le habría abierto y cerrado un caso cada día.

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
- Alerta si en 2 de los últimos 3 días con sol (mediana ≥ 1 kWh/kWp) estuvo
  debajo del 60 % y el último también; se cierra sola cuando el último vuelve a
  80 %. Los días en cero no cuentan (son del vigía). Si ya hay un caso de
  planta caída, no se abre otro.
- Probado sobre producción el 28-oct-2026 con lo normal de 30 días y sin los
  días en cero: marcó 8 plantas en 30 días (Martín González, Irigaray,
  Crudelli, Ricca, Diego Trias…), las mismas que ya se veían raras.
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

### Avisar al cliente

`casos.service.ts` → `mensajeSugerido()` (según el tipo y si es la llave) y
`avisarCliente()`: notificación `soporte_aviso_cliente` a cada usuario de portal
del proyecto (campanita del portal y push). Mientras el caso siga abierto, el
Inicio del portal le muestra el aviso arriba (`GET /client/avisos-planta`, solo
el mensaje que se le mandó). Sin usuario de portal, la mesa dice que hay que
avisarle por WhatsApp.

## Permisos

- `SOPORTE:VIEW`: ver la mesa y recibir las alertas. `SOPORTE:EDIT`: avisar al
  cliente, cerrar casos y correr las revisiones a mano. Hoy solo ADMIN
  (`prisma/scripts/seed-soporte-permissions.ts`).
- `/client/avisos-planta`: `PORTAL_CLIENTE:VIEW` y proyectos del cliente.

## Reglas y decisiones

- **No consume recursos aparte**: no hay agentes ni procesos nuevos ni IA. Es
  un `cron` dentro del mismo proceso del server, que hace 2 consultas a
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
