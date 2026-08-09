# 09 · Experiencia del cliente

> **Capítulo parcial.** Las secciones "Monitoreo diario de plantas" e "Ingesta
> de generadores Huawei" están escritas y al día. El resto del módulo funciona en producción pero todavía no está
> documentado; se completa cuando se trabaje sobre cada parte.

Post-habilitación: interacciones, encuestas, mantenimientos y reportes fotovoltaicos.

---

## Qué falta cubrir en este capítulo

- El timeline unificado del cliente y de dónde sale cada evento
- Interacciones: canal, dirección y motivo
- Encuestas: disparo por hito y por aniversario, nota baja y T11
- Mantenimientos: por qué no se auto-agendan
- Reportes fotovoltaicos mensuales: lecturas, día de corte y emisión
- Generadores livianos importados por CSV

---

# Monitoreo diario de plantas

## Para qué existe

Antes de esto, que la planta de un cliente dejara de generar se descubría de dos
maneras: el cliente llamaba, o al armar el reporte del mes siguiente aparecía un
mes en cero. Podía pasar un mes entero con la planta apagada y el cliente
perdiendo plata sin que nadie se enterara.

Cuando se prendió por primera vez sobre la flota real encontró, entre otras, dos
plantas que no reportaban desde el 13 de mayo y desde el 18 de julio.

## Cómo se usa

Pestaña **Monitoreo** en Experiencia Solar (`/clientes/monitoreo`), con tres vistas:

- **Estado de las plantas** — una fila por planta con su diagnóstico de ayer,
  cuántos días lleva sin generar y desde cuándo está abierta la incidencia.
  Filtros por texto, por diagnóstico (chips), por silenciadas y por "sin
  revisar". El botón **Revisar ahora** lanza una corrida manual.
- **Historial de incidencias** — todo lo que pasó, abierto y cerrado.
- **Revisiones** — las últimas corridas. Sirve sobre todo para confirmar que el
  cron está vivo.

Al hacer clic en una fila se abre el detalle: gráfico de los últimos 30 días,
historial de la planta y las acciones de gestión (marcar revisada, descartar,
silenciar).

Además, todos los días sale un **mail** con lo nuevo, a la casilla de
`FV_MONITOR_EMAIL` (hoy `nmachin@voltia.com.uy`, sólo Nicolás).

## Cómo funciona

Un cron diario a las **08:00 hora de Uruguay** (`monitor.job.ts`) evalúa **el día
anterior completo** de todas las plantas Growatt vinculadas a un proyecto y no
marcadas como ignoradas.

Por planta, `monitor.service.ts` pide:

1. `plant/energy` de los últimos 7 días — 1 request. Se piden 7 y no 1 porque
   cuesta lo mismo, da la racha sin generar gratis y rellena un día que haya
   fallado antes. La serie se persiste en `ReporteFvGeneracionDiaria`.
2. `device/list` — **sólo si la planta no generó**. Trae `lost`, `status` y
   `last_update_time` por equipo, que se guardan en `GrowattDevice`.
3. `device/tlx/tlx_last_data` — sólo si además el equipo está comunicando. Es el
   **único** endpoint de la Open API v1 con códigos de falla, y es POST estricto
   (por GET devuelve 405).

Con eso, `diagnostico.ts` (función pura, con tests) clasifica. Primer match gana:

| Orden | Condición | Diagnóstico | ¿Alerta? |
|---|---|---|---|
| 1 | silenciada a mano | `SILENCIADA` | no |
| 2 | sin fecha operativa conocida | `ESPERANDO_HABILITACION` | no |
| 3 | operativa hace menos de 3 días | `ESPERANDO_HABILITACION` | no |
| 4 | Growatt no contestó | `SIN_DATOS_API` | sólo si son ≥3 días seguidos |
| 5 | generó por encima del umbral | `OK` | no |
| 6 | el inversor reporta un código de falla | `ERROR_DISPOSITIVO` | sí |
| 7 | el equipo no reporta hace ≥36 h | `SIN_COMUNICACION` | sí |
| 8 | resto | `SIN_GENERACION` | sí |

Cuando hay alerta, `incidencias.service.ts` abre (o extiende) una `FvIncidencia`.
Cuando la planta vuelve a generar, la cierra. El mail sólo informa lo que
**empieza**: lo que sigue abierto no se repite todos los días.

## Permisos

Todo el monitoreo usa `EXPERIENCIA_CLIENTES`: `VIEW` para las tres vistas y la
serie diaria, `CREATE` para "Revisar ahora", `EDIT` para revisar / descartar /
silenciar. Adentro quedan ADMIN, ASESOR_COMERCIAL, POSTVENTA y EXPERIENCIA_SOLAR;
afuera INGENIERIA, OPERACIONES, FINANZAS y CLIENT.

**No se usan las acciones `COMPLETE` ni `DELETE` a propósito**: no hay nada
irreversible ni nada que salga hacia el cliente. Como consecuencia, la
funcionalidad no necesitó un seed de permisos nuevo ni agrega pasos al deploy.

## Reglas y decisiones

- **Se evalúa siempre el día anterior, nunca el de hoy.** El datalogger se
  alimenta del inversor y sólo transmite con luz solar (~08:00–18:30), así que el
  día en curso está incompleto por definición hasta la tarde.
- **La falta de comunicación se mide en 36 h, no en 24.** Con el cron a las
  08:00, un equipo sano transmitió ayer 18:30 (13,5 h) y uno muerto anteayer
  lleva 37,5 h. Con 24 h, cualquier día nublado de arranque tardío daría falso
  positivo. Ese margen es lo que permite correr el cron temprano sin que las
  plantas sanas —que a esa hora todavía no transmitieron— aparezcan como caídas;
  lo que no conviene es correrlo de madrugada, donde la ventana se acorta de más.
- **El umbral de generación es 0,5 kWh y es intencionalmente bajísimo.** En
  Uruguay una planta sana da más que eso incluso el peor día nublado de junio;
  sólo da cero si algo está roto. Por eso el criterio funciona igual en invierno
  que en verano, sin comparar contra ningún histórico.
- **Alerta al primer día sin generar** (`FV_MONITOR_DIAS`, default 1). Es la
  configuración más sensible y fue una decisión explícita: se acepta algún falso
  positivo con tal de no perder días de generación.
- **"Ver la planta" y "estaba mal la alerta" son cosas distintas.** *Marcar
  revisada* no cierra la incidencia: sigue abierta hasta que la planta genere.
  *Descartar* sí la cierra y **exige un motivo**, porque sin él es indistinguible
  de esconder el problema.
- **Silenciar es siempre hasta una fecha, nunca para siempre.** Un silencio
  permanente se olvida y deja la planta sin vigilar sin que nadie se entere. Para
  "no mirarla nunca más" ya existe `ignorada` en la planta Growatt.
- **La API de Growatt no tiene endpoint de alarmas.** No existen
  `inverter/alarm` ni `device/fault` en la Open API v1. El detalle de la falla
  sale de `tlx_last_data`, y por eso se pide sólo para plantas sospechosas.

## Casos borde

- **Plantas sin fecha de habilitación.** 32 de las 44 plantas vinculadas (73%) no
  tienen ninguna de las cuatro señales canónicas de habilitación UTE: son clientes
  viejos, muchos cargados como generadores livianos por CSV, que nunca pasaron por
  el pipeline de etapas. Con sólo esa cascada, el monitoreo las daba a todas por
  "esperando habilitación" y no alertaba nunca. Por eso `resolverOperativaDesde()`
  agrega un último escalón: `ReporteFvConfig.mesInicio`, el mes desde el que se le
  manda el reporte. Si le reportamos desde tal mes, la planta genera desde tal mes.
- **Sin ninguna de las dos señales, la planta queda silenciada.** Es lo correcto
  para una instalación que todavía no arrancó, y es preferible a alertar mal.
- **Temporal o corte general.** Si el 40% o más de la flota aparece sin generar el
  mismo día (`FV_MONITOR_ALERTA_MASIVA_PCT`), se asume un evento general: **no se
  abren incidencias individuales** y el mail cambia de tono. Evita el peor modo de
  falla del sistema, que es mandar 60 alertas de pánico un día de tormenta.
- **Growatt caído o token vencido.** Si más del 30% de las plantas no se pudo
  consultar (`FV_MONITOR_ERROR_MASIVO_PCT`), la corrida queda en `ERROR`, **no se
  abre ni se cierra ninguna incidencia** y sale un único mail avisando. Las pocas
  plantas que sí respondieron no son muestra de nada.
- **Una incidencia sólo se cierra si esa planta se evaluó con éxito**, nunca por
  omisión. Si no, una caída de la API "arreglaría" todas las plantas rotas.
- **El rate limit de Growatt es mucho más duro de lo que dice su documentación.**
  Medido contra la API real: una corrida a ~1,4 req/s hizo que 40 de 44 plantas
  fallaran con `error_code 10012`. De ahí que la concurrencia por defecto sea 1 y
  que el backoff ante 10012 sea de segundos (4 s × intento, hasta 20 s) en vez de
  los milisegundos que se usan para el resto de los errores. Una corrida completa
  sobre 44 plantas tarda unos 2,5 minutos.
- **Si cambia el diagnóstico** (volvió el wifi pero el inversor sigue muerto) se
  cierra la incidencia anterior y se abre una nueva. Es información, no ruido.

### Plantas Huawei en el monitoreo

Desde el 8 de agosto de 2026 el monitoreo diario cubre también las plantas
Huawei. Corren en la misma corrida y alimentan **las mismas incidencias**, así
que el mail y el listado de incidencias muestran las dos marcas juntas.

- El diagnóstico vive aparte, en `monitor/diagnostico-huawei.ts`, porque las
  señales de entrada son distintas: en Growatt hay que **inferir** la falla
  ("comunica pero no genera"), mientras que FusionSolar la **declara** con
  `real_health_state`. Forzar las dos en una función obligaría a inventar campos
  vacíos de los dos lados.
- Traducción: `2` → `ERROR_DISPOSITIVO`, `1` → `SIN_COMUNICACION`, `3` + sin
  generar → `SIN_GENERACION`. **El `1` no es planta rota**: es el inversor sin
  llegar a internet, y el detalle del mail lo aclara.
- Cuesta **2 requests para toda la flota Huawei** (serie diaria del mes + estado
  actual), contra ~2 por planta en Growatt. Por eso no tiene corrida propia ni
  concurrencia.
- Corre **al final y aislado**: si FusionSolar está caído no arruina la corrida
  de las ~150 plantas Growatt. Y **no corre si la de Growatt se rompió**: en ese
  escenario no se toca ninguna incidencia de ninguna marca.
- De paso guarda la generación diaria en `ReporteFvGeneracionDiaria` con fuente
  `HUAWEI`, que es lo que alimenta el gráfico día a día del portal. Sale gratis:
  la serie ya vino en la misma llamada.
- `FvIncidencia` tiene ahora **dos FK nullables** (`growattPlantId`,
  `huaweiPlantId`) con un CHECK que exige exactamente una, más un índice único
  parcial propio para Huawei — el gemelo del de Growatt, contra corridas
  concurrentes duplicadas.

**Vinculación:** el panel tiene el modal "Plantas Growatt" pero **no hay
equivalente para Huawei**: el catálogo se sincroniza y se vincula con
`scripts/reportes-fv/sync-huawei.ts`. En la práctica molesta poco, porque el
alcance es por empresa y las plantas nuevas entran solas — pero si aparece una
que el matcheo por nombre no resuelve (pasó en producción con Barenof, que tiene
el proyecto original y una ampliación `-A1`), hay que vincularla por script.

**Limitación conocida:** la tabla de plantas del panel de Monitoreo sigue
listando sólo las Growatt; las incidencias Huawei aparecen en la lista de
incidencias y en el mail, pero la planta no tiene fila propia. Silenciar una
planta Huawei tampoco tiene botón todavía (los campos existen en el modelo).


## Archivos

- Backend: `server/src/services/reportesFv/monitor/` — `diagnostico.ts` (puro),
  `habilitacion.ts` (puro), `monitor.service.ts`, `incidencias.service.ts`,
  `panel.service.ts`, `digest.email.ts`, `monitor.job.ts`, `config.ts`, `dias.ts`.
- Cliente Growatt: `growatt/client.ts` — `listarDispositivos()`, `estadoInversor()`.
- Endpoints: `server/src/routes/reportes-fv.routes.ts`, sección "Monitoreo diario".
- Frontend: `client/src/modules/clientes/pages/MonitoreoFvPanel.tsx`,
  `components/MonitorPlantaDrawer.tsx`, `client/src/api/monitorFv.api.ts`.
- Scripts: `scripts/reportes-fv/correr-monitor.ts` (corrida manual),
  `backfill-generacion-diaria.ts`, `spike-growatt-estado.ts` (one-off, descartable).
- Tests: `npm run test:fv-monitor`.

## Variables de entorno

| Variable | Default | Qué hace |
|---|---|---|
| `FV_MONITOR_ENABLED` | `true` | `false` no agenda el cron |
| `CRON_FV_MONITOR` | `0 8 * * *` | Expresión cron (timezone America/Montevideo) |
| `FV_MONITOR_EMAIL` | `nmachin@voltia.com.uy` | Destinatarios del digest, separados por coma. Tienen que ser usuarios internos vivos: el digest se manda como `internal` |
| `FV_MONITOR_EMAIL_ENABLED` | `true` | `false` corre pero no manda mail |
| `FV_MONITOR_CONCURRENCIA` | `1` | Plantas en paralelo |
| `FV_MONITOR_DIAS` | `1` | Días sin generar para alertar |
| `FV_MONITOR_KWH_MIN` | `0.5` | kWh por debajo de los cuales el día no cuenta |
| `FV_MONITOR_HORAS_SIN_COMS` | `36` | Horas sin dato para dar el equipo por caído |
| `FV_MONITOR_DIAS_GRACIA` | `3` | Gracia tras la habilitación |
| `FV_MONITOR_ALERTA_MASIVA_PCT` | `0.4` | Umbral de "esto es el clima" |
| `FV_MONITOR_ERROR_MASIVO_PCT` | `0.3` | Umbral de "la corrida no vale" |

---

---

# Ingesta de generadores Huawei (FusionSolar)

## Para qué existe

Seis clientes tienen inversor Huawei en vez de Growatt. Hasta agosto de 2026 sus
lecturas se cargaban a mano todos los meses, y en la práctica se atrasaban o se
copiaban de un mes al otro. Esta ingesta trae generación, consumo y exportación
de la Northbound API de FusionSolar y las escribe en la misma
`ReporteFvLectura` que usa Growatt, así que el cálculo, el PDF y el portal no se
enteran de la marca del inversor.

## Cómo se usa

Nada nuevo en la UI: el generador se marca con **Origen de datos = Huawei /
FusionSolar** y el resto del circuito (recalcular, emitir, enviar) es el de
siempre. El listado de Reportes FV filtra por ese origen.

La ingesta corre sola con el cron mensual de los días 2, 4 y 6, después de la de
Growatt. El botón "Traer todo de nuevo" del panel también la dispara.

Para el catálogo y la vinculación hay un script:

```bash
docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts            # lista y sugiere
docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts --vincular # aplica
docker compose exec server npx tsx scripts/reportes-fv/sync-huawei.ts --ingerir 2026-07
```

Sin `--vincular` sólo muestra qué haría: vincular la planta al proyecto
equivocado le manda a un cliente el consumo de otro, así que se confirma a mano.

## Cómo funciona

Autenticación por **sesión**, no por token fijo: `POST /thirdData/login` con el
usuario Northbound devuelve una cookie `XSRF-TOKEN` que dura unos 30 minutos y
viaja como header. `client.ts` la cachea 20 minutos y la renueva sola; los
errores llegan con **HTTP 200 y `failCode` en el body**, no con status HTTP.

El corazón es `getKpiStationDay`, que devuelve **el mes entero de hasta 100
plantas en una sola llamada**, y por cada día trae generación, consumo,
exportación e importación juntos. Es la diferencia grande con Growatt, donde
consumo y exportación salen del smart meter día por día y fallan seguido. La
ingesta suma los días y guarda los totales.

Se verificó que el `use_power` de Huawei cuadra exacto con la definición de
consumo del sistema (generación − exportación + importación): 7,46 − 0,85 +
30,09 = 36,7.

## Permisos

Ninguno nuevo. La ingesta se dispara desde `POST /reportes-fv/ingesta`
(`EXPERIENCIA_CLIENTES:CREATE`, igual que Growatt) o desde el cron. El catálogo y
la vinculación hoy sólo se tocan por script, no hay endpoint.

## Reglas y decisiones

- **La ingesta no pisa lo que cargó una persona.** A diferencia de Growatt, que
  sólo protege `MANUAL`, acá también se respeta `IMPORT_LEGACY`: son
  estimaciones hechas a mano para meses en que el medidor estaba mal conectado, y
  para esos meses la API tiene *menos* días que la estimación. Sólo `force` las
  reemplaza.
- **Cobertura mínima del 90%** (`HUAWEI_MIN_COVERAGE`). Por debajo se guarda la
  generación pero se descartan consumo y exportación: con días faltantes los
  totales salen incoherentes — mayo de Marianela Indart daba 141 kWh generados
  contra 874 exportados, que es imposible.
- **Sin medidor no es consumo cero.** FusionSolar devuelve `use_power` en 0 todo
  el mes cuando la planta no tiene smart meter (Alejandro Fiermarin). Guardar ese
  0 diría que el cliente no consumió nada y daría un ahorro equivocado; se guarda
  `null` con el motivo anotado.
- **Un mes sin ningún día con datos no genera lectura**, ni siquiera en cero: es
  "no sabemos", no "generó 0". De eso avisa el monitoreo diario.
- **Tabla propia (`huawei_plants`), no un campo `proveedor` en `growatt_plants`.**
  El identificador de Huawei es un string (`"NE=36611488"`) contra el BigInt de
  Growatt, y dispositivos, incidencias y monitoreo ya cuelgan de ese BigInt.
  Unificarlas sería un refactor grande de algo que funciona: los dos catálogos se
  cruzan por `projectId`, que es lo que importa.
- **Si FusionSolar falla, la ingesta de Growatt sigue.** Corre en su propio
  `try/catch` después, porque las ~150 plantas Growatt son el grueso.
- **Capacidad 0 se guarda como null.** FusionSolar deja la capacidad en 0 cuando
  no la cargaron (Estilo, Rodolfo Sosa); 0 no es un dato, es un campo vacío.

## Casos borde

- **`real_health_state = 1` NO significa planta rota**, significa sin
  comunicación. Verificado en campo: Rodolfo Sosa da 1 y la planta está sana — lo
  que falla es el wifi del inversor. Importa para cuando se enganche el
  monitoreo diario.
- **`getAlarmList` está sin verificar.** Era el motivo original de mirar Huawei
  (Growatt no tiene endpoint de alarmas), pero en la única prueba devolvió lista
  vacía, y no se puede distinguir "no hay alarmas" de "el endpoint necesita otros
  parámetros". Hay que reprobarlo con una planta en falla antes de apoyar
  cualquier diagnóstico ahí.
- **El rate limit real no es el documentado.** La doc habla de 1 llamada cada 5
  minutos por interfaz; medido, dos llamadas separadas 177 ms dan `failCode 407` y
  separadas ~2 s pasan siempre. `HUAWEI_PAUSA_MS` está en 2500 y hay backoff.
- **El dominio es regional** y la cuenta existe en uno solo: el nuestro es
  `la5.fusionsolar.huawei.com`. Con el dominio equivocado el login falla sin
  explicar por qué.
- **Plantas parciales por ser nuevas.** La API ya recorta los días a partir de la
  conexión a red (Fiermarin dio 20/20 en mayo, conectado el 12), así que un
  generador que arrancó a mitad de mes no figura como si le faltaran datos.
- **El monitoreo diario todavía no cubre estas plantas**: es sólo ingesta
  mensual. Una planta Huawei caída no dispara incidencia.

## Archivos

- Cliente: `reportesFv/huawei/client.ts` — `listarPlantas()`,
  `serieDiariaDelMes()`, `estadoActual()`.
- Catálogo: `reportesFv/huawei/plantas.service.ts` — `sincronizarPlantasHuawei()`,
  `vincularPlantaHuawei()`, `marcarOrigenHuawei()`.
- Ingesta: `reportesFv/huawei/ingesta.service.ts` — `ingerirPeriodoHuawei()`.
- Script: `scripts/reportes-fv/sync-huawei.ts`.
- Spike descartable con el que se decidió todo esto:
  `scripts/reportes-fv/spike-huawei-fusionsolar.ts`.

## Variables de entorno

| Variable | Default | Para qué |
|---|---|---|
| `HUAWEI_API_USER` | — | usuario Northbound (`voltia_api`) |
| `HUAWEI_API_PASSWORD` | — | su contraseña; sin esto la ingesta no corre |
| `HUAWEI_API_BASE` | `https://la5.fusionsolar.huawei.com` | dominio regional |
| `HUAWEI_PAUSA_MS` | 2500 | pausa entre llamadas |
| `HUAWEI_MIN_COVERAGE` | 0.9 | cobertura mínima del mes |

---

## Plantilla

Al escribirlo, seguir la estructura común (ver `README.md`):

```
## Para qué existe
## Cómo se usa
## Cómo funciona
## Permisos
## Reglas y decisiones
## Casos borde
```

## Mientras tanto

Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad
sobre cómo funciona hoy**:

- El código, que es lo único que no miente.
- `CHANGELOG.md` para saber qué cambió y cuándo.
- `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede
  contradecir a la implementación.
- `docs/pendientes/` para saber qué falta.
