# 11 · Métricas

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

Dashboard, metas del trimestre, indicadores y el reporte semanal por correo.

---

## Qué tiene que cubrir este capítulo

- El dashboard y sus tarjetas
- Metas: cómo se cargan (el cálculo del avance ya está abajo)
- Las tarjetas de portafolio del dashboard (presupuesto, ejecutado, CO₂, avance)

---

## Panel de operaciones (Dashboard · Tiempos & SLA)

### Para qué existe

Triage operativo en vivo dentro del **Dashboard**: responde "¿quién está en
riesgo ahora?" para atajar el problema antes del reclamo. No es análisis
histórico (eso es Métricas): es una lista accionable del día. Es el primer panel
de un Dashboard pensado para ser **modular por rol** — cada área verá el suyo.

### Cómo se usa

Aparece arriba de las tarjetas del Dashboard, solo para quien tiene
`OPERACIONES:VIEW`. Cuatro bloques:

- **En riesgo ahora**: cuántos proyectos activos están vencidos / por vencer / en
  plazo contra el SLA de su etapa actual.
- **Sin fecha de instalación**: vendidos sin agenda de obra, ordenados por días
  desde la venta (más demorado arriba). Cada fila linkea a la ficha.
- **Sin comunicación hace X días**: clientes cuya última interacción registrada
  superó la cadencia objetivo de su recorrido (E1/E2/E3). "Sin contacto" si nunca
  se registró una.
- **¿Dónde se rompe el proceso?**: promedio real + % cumplimiento SLA por etapa, y
  el cliente más trabado en cada una.
- **Trámites UTE** (banda): sin habilitar por demora desde la venta + reparto de
  espera nosotros vs. UTE (con promedios) + respuesta de UTE por sub-etapa
  (par enviada→aprobada). Endpoint `GET /ops/ute-panel`, reutiliza
  `uteProcess.calculateTimes` + `waitingParty` (tail "quién tiene el turno").

### Cómo funciona

- **Un solo motor**: reutiliza `stage-sla.service.ts` (`getSlaMap`,
  `currentStageStart`, `countdownForStage` → semáforo ok/warning/overdue en días
  hábiles). No recalcula nada por su cuenta.
- Endpoints backend `GET /ops/risk-summary`, `/ops/sin-fecha-instalacion`,
  `/ops/sin-comunicacion`, `/ops/proceso-por-etapa` (`api.routes.ts`), con la
  cadencia y el recorrido en `server/src/services/ops-panel.service.ts`.
- Frontend: `client/src/components/dashboard/OperationsPanel.tsx`, montado en
  `Dashboard.tsx` con `usePermission("OPERACIONES","VIEW")`.
- **Unidades**: el SLA por etapa va en días **hábiles** (motor existente); "días
  desde la venta" y "sin comunicación hace X días" van en días **calendario** (así
  se lee "hace X días").
- La última comunicación sale de `ClientInteraction` (las interacciones que se
  registran en Experiencia Solar), no de WhatsApp/mail reales: es "última
  interacción **registrada**".

### Permisos

- Los cuatro endpoints y el panel se gatean con `OPERACIONES:VIEW`. Lo tienen
  ADMIN, GERENTE_OPERACIONES y los roles operativos/comerciales; **no**
  EXPERIENCIA_SOLAR, FINANZAS ni CLIENT.
- La cadencia de contacto se edita en **Administración → Cadencia de contacto**
  (`CONFIGURACION:EDIT`), modelo `RecorridoCadencia` (una fila por E1/E2/E3, en
  días calendario), con seed `seed-recorrido-cadencias.ts` (defaults 3/5/10).

### Reglas y decisiones

- "En riesgo" = estado del countdown de la **etapa actual** (no un score
  compuesto). Proyectos en etapas sin SLA activo (POST_HABILITACION, paralelas)
  quedan fuera del semáforo.
- "¿Dónde se rompe?" ordena por el pipeline canónico (`PIPELINE_DEFINITIONS`) y
  solo muestra etapas con dato histórico o alguien trabado.
- Los generadores livianos (CSV / Experiencia Solar) quedan fuera del panel.

### Casos borde

- Cliente nunca contactado → "Sin contacto" (siempre aparece, sin importar el
  objetivo).
- Cadencia inactiva para un recorrido → ese recorrido no dispara "Sin comunicación".
- El motor de días hábiles no contempla feriados (solo fines de semana).

---

## Definiciones compartidas: qué cuenta como lead, venta y obra

### Para qué existe

El dashboard, el mail de los lunes y el conector MCP (cap. 13) muestran los
mismos indicadores. Para que no puedan dar números distintos, las definiciones
y las cuentas viven en un solo lugar: `services/metricas/indicadores.service.ts`
(y `services/metricas/tiempos-etapa.service.ts` para los tiempos por etapa).

### Cómo funciona

| Indicador | Qué cuenta | Función |
|---|---|---|
| Lead nuevo | `createdAt` en el período (no `leadCreatedAt`, la fecha editable) | `contarPeriodo()`, `indicadoresDelPeriodo()` |
| Propuesta enviada | `proposalSentAt` en el período | ídem |
| Visita realizada | `visitCompletedAt` en el período | `visitasRealizadas()` |
| Venta | etapa CERRADO_GANADO y `closedAt` en el período; monto según `montoDeVenta()` | `ventasGanadas()` |
| Venta perdida | etapa CERRADO_PERDIDO y `closedAt` en el período | `indicadoresDelPeriodo()` |
| Obra realizada | ver abajo | `obrasRealizadasDe()`, `listarObrasRealizadas()` |
| Tiempos del embudo | días promedio entre dos hitos, sobre los leads cuyo hito final cae en el período | `promedioDias()` |
| Tiempos por etapa | duración real de cada etapa COMPLETED, filtrada por su fecha de fin; cumplimiento contra el plazo en días hábiles | `tiemposPorEtapa()` |

**Obra realizada**: el proyecto tiene la etapa "Ejecución de obra" finalizada
con fecha de fin, o está finalizado aunque esa etapa no figure cerrada. La fecha
es la del fin de la obra, o si no hay, la de finalización del proyecto. Los
generadores cargados por planilla cuentan en su fecha de entrega. Quedan fuera
los proyectos borrados y los marcados "fuera de métricas".

Quién usa qué:

- `GET /metrics/overview` → `obrasRealizadasDe()` sobre los proyectos que ya
  carga para el resto de las tarjetas.
- `GET /metrics/sales` → `promedioDias()`; los conteos los sigue haciendo en la
  ruta, con la misma definición.
- `GET /metrics/stages` → `tiemposPorEtapa()`.
- El mail semanal → `ventasGanadas()`, `visitasRealizadas()`,
  `listarObrasRealizadas()`, `contarPeriodo()` y los helpers de metas.
- El conector → `indicadoresDelPeriodo()`, `avanceMetas()`, `tiemposPorEtapa()`.

Al extraer todo esto se comparó la salida antes y después: 16 respuestas del
dashboard (overview, sales y stages en 5 períodos, más el histórico de etapas)
y el mail de 13 semanas distintas, 8 de ellas con ventas o visitas. Todas
idénticas.

### Reglas y decisiones

- **Avance de metas**: una meta va "en ritmo" si la fracción lograda es al menos
  la fracción de tiempo transcurrida del período (`fraccionTranscurrida()`).
  Cada meta se mide sobre su propio período: la trimestral sobre el trimestre,
  la anual sobre el año.

### Casos borde

- ⚠️ **Hora de corte distinta.** El servidor corre en UTC y el dashboard arma
  sus períodos con `new Date(año, mes, 1)`, o sea medianoche UTC: en Uruguay,
  las 21:00 del día anterior. El mail y el conector cortan a medianoche de
  Uruguay. Un lead creado el 30 de junio a las 22:00 cuenta en julio para el
  dashboard y en junio para el mail y el chat. Solo afecta lo que pasa en esas
  tres horas del borde; alinear el dashboard queda pendiente.
- **La semana del dashboard empieza el domingo** ("esta semana" en
  `/metrics/sales`); la del mail y el chat, el lunes.
- Hasta esta extracción, el mail semanal **no** excluía los proyectos marcados
  "fuera de métricas" y el dashboard sí. Ahora los dos los excluyen. En
  producción no había ninguno marcado, así que ningún número cambió.
- `tiemposPorEtapa()` corta a medianoche UTC, igual que la pantalla: las etapas
  guardan su fecha de fin como día.

---

## Reporte semanal de indicadores por correo

### Para qué existe

Replica por mail el tablero semanal de indicadores con los datos que la app ya
calcula, para tenerlo el lunes sin entrar a la app. Las definiciones son las
compartidas (ver la sección anterior); lo mismo, para cualquier período, se
puede pedir en el chat con la herramienta `indicadores` del conector.

### Cómo se usa

- Sale solo los **lunes 00:01 hora de Uruguay** y reporta la semana que acaba de
  cerrar (lunes 00:00 a domingo 23:59). Asunto: `Indicadores · Semana N (…)`.
- En **Métricas → pestaña "Reporte semanal"** se ve el mismo informe en pantalla
  (`WeeklyReportTab`), con el destinatario a la vista.
- El botón **"Enviar el mail ahora"** lo dispara a mano, siempre a la casilla
  configurada (no al usuario que aprieta el botón).

### Cómo funciona

- Job `server/src/services/reporteSemanal/reporte-semanal.job.ts`, registrado en
  `index.ts` con `startReporteSemanalJob()`.
- Destinatario: `destinatario()`, que lee `REPORTE_SEMANAL_EMAIL` y, si no está
  seteada, usa `nicolas@voltia.com.uy`. **Es el único lugar con ese default**: las
  rutas lo importan de ahí. En producción la variable no está seteada, así que
  rige el default.
- El mail se manda con `type: "client_facing"` para que el guardrail de
  "solo usuarios internos" de `sendEmail` no lo frene si algún día el
  destinatario es una casilla externa.
- Funciones puras testeables: `calcularSemana`, `calcularTrimestre`,
  `numeroSemanaIso`; después `recolectarDatos` (DB) y `renderHtml` / `renderTexto`.
  `recolectarDatos` solo arma la semana y el trimestre: las cuentas las hace
  `services/metricas/indicadores.service.ts`. `montoDeVenta` vive ahí y el job
  lo reexporta.
- Endpoints en `api.routes.ts`: `GET /metrics/weekly-report` y
  `POST /metrics/weekly-report/send`.

### Permisos

- Ver la pestaña y el endpoint `GET`: `METRICAS:VIEW`.
- Disparar el envío (`POST`): `METRICAS:VIEW` **más** un guard hardcodeado
  `role === "ADMIN"` que devuelve 403 al resto. Es un guard por rol, no matriz.

### Reglas y decisiones

- Se **listan** solo las ventas ganadas (cliente, asesor, monto c/IVA) y las
  visitas comerciales (cliente, asesor). El resto va como número.
- El monto de cada venta sale de la **propuesta**, en este orden: la propuesta
  congelada en la comisión → la última propuesta publicada del lead →
  `estimatedBudgetUsd`. Si no hay ninguna, muestra "s/dato" y no suma a la
  facturación (`montoDeVenta`).
- El avance de metas usa solo las metas **trimestrales** del trimestre en curso.
  Verde = en ritmo (fracción lograda ≥ fracción de tiempo transcurrido).
- Flags: `REPORTE_SEMANAL_ENABLED=false` lo apaga; `CRON_REPORTE_SEMANAL`
  cambia la expresión cron.

### Casos borde

- **Venta sin ninguna propuesta y sin presupuesto en el lead → "s/dato"**. Desde
  v10.7 la comisión se congela sola al ganar y el monto se lee de la propuesta,
  así que solo quedan sin monto las ventas cerradas sin propuesta en el sistema.
  El mail no avisa de la diferencia: la venta se cuenta pero la facturación queda
  corta. Ver el capítulo de [Ventas](02-ventas.md).
- `CRON_REPORTE_SEMANAL` la lee **también** el reporte semanal de traspasos
  (`services/traspasos/reportes.service.ts`): cambiar el horario de uno cambia el
  del otro.
- Todo el bloque de marketing social (seguidores, pauta, consultas de Meta y
  TikTok) queda fuera: necesita integrar esas APIs.

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
