# 09 · Experiencia del cliente

> **Capítulo parcial.** La sección "Monitoreo diario de plantas" está escrita y
> al día. El resto del módulo funciona en producción pero todavía no está
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

Además, todos los días sale un **mail** con lo nuevo. Hoy va sólo a la casilla
de `FV_MONITOR_EMAIL`.

## Cómo funciona

Un cron diario a las **09:30 hora de Uruguay** (`monitor.job.ts`) evalúa **el día
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
- **La hora del cron es 09:30 y no 06:00.** A las 06:00 *todas* las plantas
  parecerían incomunicadas, porque los dataloggers todavía no arrancaron.
- **La falta de comunicación se mide en 36 h, no en 24.** A las 09:30, un equipo
  sano transmitió ayer 18:30 (14,5 h) y uno muerto anteayer lleva 38,5 h. Con 24 h
  cualquier día nublado de arranque tardío daría falso positivo.
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
| `CRON_FV_MONITOR` | `30 9 * * *` | Expresión cron (timezone America/Montevideo) |
| `FV_MONITOR_EMAIL` | `nfmj@hotmail.com` | Destinatarios del digest, separados por coma |
| `FV_MONITOR_EMAIL_ENABLED` | `true` | `false` corre pero no manda mail |
| `FV_MONITOR_CONCURRENCIA` | `1` | Plantas en paralelo |
| `FV_MONITOR_DIAS` | `1` | Días sin generar para alertar |
| `FV_MONITOR_KWH_MIN` | `0.5` | kWh por debajo de los cuales el día no cuenta |
| `FV_MONITOR_HORAS_SIN_COMS` | `36` | Horas sin dato para dar el equipo por caído |
| `FV_MONITOR_DIAS_GRACIA` | `3` | Gracia tras la habilitación |
| `FV_MONITOR_ALERTA_MASIVA_PCT` | `0.4` | Umbral de "esto es el clima" |
| `FV_MONITOR_ERROR_MASIVO_PCT` | `0.3` | Umbral de "la corrida no vale" |

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
