# 03 · Proyectos

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

El pipeline de obra: etapas, subetapas, checklists, ampliaciones y traspasos.

---

## Control de tiempos por etapa (plazos, cuenta regresiva, cumplimiento)

> Esta parte sí está documentada (se trabajó en v9.0). El resto del capítulo
> sigue pendiente.

### Para qué existe

Antes no había forma de ver de un vistazo si un proyecto va en tiempo dentro de
la etapa en la que está. Los datos de tiempo existían (`Stage.actualStartDate` /
`actualEndDate` / `actualDurationDays` / `delayDays`) pero no se comparaban
contra ningún plazo. Ahora cada etapa tiene un **plazo objetivo (SLA) en días
hábiles**, configurable en Administración, contra el que se calcula una **cuenta
regresiva** con semáforo y una **métrica de cumplimiento**.

### Cómo se usa

- **Administración → Plazos por etapa**: tabla con cada tipo de etapa y su plazo
  en días hábiles + un toggle de activo. Editar y "Guardar" por fila. Una etapa
  inactiva o sin plazo no muestra cuenta regresiva.
- **Ficha del proyecto**: el recuadro "Etapa actual" muestra la cuenta regresiva
  grande (días hábiles restantes, o negativos si está vencida).
- **Pipeline**: debajo de cada tarjeta de etapa, la etapa en curso muestra la
  cuenta regresiva y las completadas muestran cuánto duraron y si cerraron en
  plazo.
- **Listado de proyectos**: columna "Plazo etapa" con la cuenta regresiva;
  se puede ordenar por urgencia (vencidos primero) y filtrar con "Solo vencidos".
- **Métricas → duración por etapa**: cada etapa suma "% en plazo" y el desvío
  promedio en días hábiles.

Semáforo: **verde** (ok) si falta más que el umbral, **amarillo** (warning) si
faltan pocos días hábiles (umbral por defecto 2, env `STAGE_SLA_WARNING_DIAS`),
**rojo** (overdue) si ya se pasó, con la cuenta negativa creciendo.

### Cómo funciona

- Modelo `StageSla` (`server/prisma/schema.prisma`, tabla `stage_slas`): una fila
  por `StageType`, campo `diasHabiles` + `activo`. Global a todos los proyectos.
- Servicio `stage-sla.service.ts`: `getSlaMap()` (cache de 5 min, se invalida con
  `clearStageSlaCache()` al guardar) y `computeStageCountdown(stage, slaDias)`,
  que ancla en `actualStartDate`, calcula `deadline = addBusinessDays(...)` y el
  `remainingBusinessDays` con `signedBusinessDaysBetween` (utils `business-days.ts`).
- El countdown se expone en `GET /api/projects` (dentro de `currentStage`) y en
  `GET /api/projects/:id` (en cada `stage` vía `serializeStage`, que ahora acepta
  el SLA como segundo argumento).
- Rutas admin `GET/PUT /api/admin/stage-slas` en `api.routes.ts`, guard
  `authorize(Module.CONFIGURACION, ...)` (igual que las reglas de deadline).
- La métrica de cumplimiento vive en `GET /api/metrics/stages`: compara la
  duración real (en días hábiles) contra el SLA por tipo de etapa.
- Defaults sembrados por `prisma/scripts/seed-stage-slas.ts` (idempotente, no
  pisa lo que el admin ya ajustó); también se corre dentro del `seed.ts`.

### Reglas y decisiones

- **Días hábiles, no corridos**: el plazo se mide en días laborables (lun-vie).
- **El ancla es `actualStartDate`** (cuándo empezó la etapa de verdad), no la
  fecha planificada del template.
- **Un SLA por tipo de etapa**, global; no varía por `tipoObra` (refinamiento
  futuro).
- Distinto del sistema de **deadlines por subetapa** (`DeadlineRule`), que es
  otra cosa: aquel fija fechas límite de subetapas; esto mide el plazo de la
  etapa entera.

### Casos borde

- **No contempla feriados**: sábados y domingos se excluyen, los feriados
  uruguayos todavía no (limitación conocida en `business-days.ts`).
- **Etapas sin arrancar** (sin `actualStartDate`) o **sin SLA** (paralelas /
  indefinidas como Post-Habilitación): sin cuenta regresiva, no rojo por defecto.
- **Cumplimiento retroactivo**: etapas cerradas antes de existir el SLA se miden
  contra el SLA actual.

Ver también el resumen diario de correos en
[12 · Infraestructura](12-infraestructura.md), que reemplazó los mails por evento.

---

## Qué tiene que cubrir este capítulo

- Estructura Proyecto → Etapa → Subetapa → Checklist
- Los tipos de etapa y su mapeo a módulos de permisos
- Avance automático y manual del pipeline
- Ampliaciones sobre instalaciones existentes
- Traspasos T1–T13: qué los dispara y cómo se confirman
- Campos del proyecto y quién puede editar cada uno
- Archivado y borrado lógico

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
