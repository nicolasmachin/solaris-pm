# 11 · Métricas

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

Dashboard, metas del trimestre, indicadores y el reporte semanal por correo.

---

## Qué tiene que cubrir este capítulo

- El dashboard y sus tarjetas
- Metas: cómo se cargan y cómo se calcula el avance
- Métricas de ventas y de portafolio
- El reporte semanal por correo: qué incluye y cuándo sale
- Qué proyectos entran y cuáles quedan fuera de las métricas

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

## Reporte semanal de indicadores por correo

### Para qué existe

Replica por mail el tablero semanal de indicadores con los datos que la app ya
calcula, para tenerlo el lunes sin entrar a la app. Las definiciones son las
mismas de `/metrics/sales` y `/metrics/overview`, así que los números coinciden
con lo que se ve en pantalla.

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
