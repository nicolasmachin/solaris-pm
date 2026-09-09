# 03 · Proyectos

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

El pipeline de obra: etapas, subetapas, checklists, ampliaciones y traspasos.

---

## Cuál es la etapa que se muestra (y cómo se fija a mano)

### Para qué existe

La etapa del proyecto **avanza sola**: cuando se resuelven todas las subetapas de
una etapa, esa etapa se completa y la siguiente pasa a ser la actual. Ese es el
comportamiento normal y el que debería regir siempre.

El override manual (`Project.stageOverride`) es la **excepción**: sirve cuando el
pipeline no refleja la realidad y hay que corregir lo que se muestra sin tocar el
trabajo registrado. Por ejemplo, la obra ya arrancó pero quedó una subetapa
pendiente de tildar.

### Cómo se usa

En la ficha del proyecto, la barra **"Etapa mostrada"**. El desplegable ofrece
**todas** las etapas del pipeline —"Avanzar a…" y "Retroceder a…"— más **"Volver
a automático"**, que borra el override y devuelve el cálculo por subetapas.

Cuando hay override, al lado de la etapa aparece la marca **manual**.

### Cómo funciona

`getDisplayStage()` en `project.service.ts` decide qué etapa se muestra:

1. Si hay `stageOverride`, **esa** es la etapa mostrada. Manda siempre, para
   adelante y para atrás.
2. Si no hay, se usa la derivada por `getCurrentStage()`: **la primera etapa sin
   completar**, en el orden del pipeline. Si están todas completas, la última.

Que sea "la primera sin completar" y no "la primera en curso" importa: Tramitación
UTE está en curso casi siempre —el trámite arranca al principio y avanza en
paralelo—, y con la regla anterior tapaba cualquier etapa previa que hubiera
quedado abierta. Un proyecto con la obra sin empezar figuraba en "Tramitación
UTE".

El override **no se limpia solo**. Nada lo revierte automáticamente: ni completar
subetapas, ni desagendar la instalación del calendario. Sale solo con "Volver a
automático".

### Permisos

| Acción | Permiso |
|---|---|
| Ver la etapa | `OPERACIONES:VIEW` |
| **Fijar / retroceder / desfijar la etapa** | **`OPERACIONES:FIJAR_ETAPA`** |

`FIJAR_ETAPA` la tienen **solo ADMIN y GERENTE_OPERACIONES**. Es una acción
propia, separada de `EDIT`, y se administra desde Administración → Permisos como
cualquier otra.

Hay **dos** cosas que escriben `stageOverride`:

1. `PATCH /projects/:projectId/stage-override` — el control manual. Deja
   auditoría *"Fijó la etapa mostrada en …"*.
2. **Confirmar un traspaso** (`traspasos.service.ts`): fija la etapa siguiente
   según `TRASPASO_ADVANCE_STAGE`, y **solo si eso adelanta** respecto de lo que
   ya se muestra. No deja auditoría propia de la etapa, solo la del traspaso.

Por eso la mayoría de los proyectos aparecen con etapa fijada sin que nadie la
haya tocado a mano: se la fijó el traspaso. El calendario y el agendado de
instalación **no** la tocan.

### Reglas y decisiones

- **Por qué `FIJAR_ETAPA` y no `EDIT`** (septiembre 2026): con `EDIT` lo podían
  hacer 13 roles, incluidos asesores comerciales, logística y los instaladores
  tercerizados. Un instalador movió una obra a "Ejecución de Obra" el día antes
  de arrancar; la obra se pospuso y la etapa quedó mintiendo. La etapa debería
  avanzar sola, así que fijarla es una excepción que corresponde a quien tiene la
  visión completa de operaciones.
- **Por qué la etapa automática es "la primera sin completar"** (septiembre
  2026): antes era "la primera en curso", y como Tramitación UTE está en curso
  desde el principio, tapaba las etapas anteriores abiertas. Había una excepción
  puntual para ignorar UTE hasta que la obra estuviera completa; se eliminó
  porque con la regla nueva sobra, y además fallaba en los proyectos viejos,
  donde la etapa de obra tiene otro nombre.
- **Por qué el traspaso solo empuja hacia adelante** (septiembre 2026): la
  comparación "solo si adelanta" vivía en `getDisplayStage` y se sacó de ahí para
  poder corregir etapas hacia atrás. Se movió a `traspasos.service.ts`, al
  momento de escribir. Sin eso, confirmar un traspaso con demora —cosa habitual,
  porque se confirman a mano— haría retroceder un proyecto que ya avanzó más.
- **Por qué el override manda en las dos direcciones** (septiembre 2026): antes
  regía "empujón hacia adelante" —se mostraba la más avanzada entre la derivada y
  la fijada—, así que un override anterior al avance real **se ignoraba en
  silencio**. Eso hacía imposible corregir hacia atrás una obra pospuesta. Ahora
  el override manda y quien lo fija se hace cargo; la marca "manual" lo hace
  visible.

### Casos borde

- **Fijar una etapa por debajo del avance real** es posible y no toca las
  subetapas: el trabajo registrado queda intacto, solo cambia lo que se muestra.
  Al volver a automático, la etapa vuelve a donde el pipeline dice.
- **Desagendar una instalación no revierte el override.** Es el agujero que
  provocó el caso de Santiago Pereyra: se borró la programación del calendario y
  la etapa siguió en "Ejecución de Obra". Hoy hay que acordarse de volverla a
  automático a mano.
- Una etapa fijada que no existe en el pipeline del proyecto se rechaza al
  guardar (`STAGE_NOT_IN_PIPELINE`).

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
  grande (días hábiles restantes, o negativos si está vencida). Además, en la
  cabecera del proyecto (al lado del estado "En ejecución") corre un **cronómetro
  en vivo** (`LiveStageCountdown.tsx`) con días/horas/minutos/segundos actualizado
  cada segundo, mismo semáforo de color, que **se pausa los fines de semana** (sólo
  descuenta ms de lun-vie; el `deadline` del countdown es el fin del día hábil
  objetivo). Sólo aparece en la vista de proyecto abierto y si la etapa tiene SLA.
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
  `clearStageSlaCache()` al guardar) y `computeStageCountdown(stage, slaDias, fallbackStart?)`,
  que ancla en `actualStartDate` (o el `fallbackStart` si la etapa aún no arrancó),
  calcula `deadline = addBusinessDays(...)` y el `remainingBusinessDays` con
  `signedBusinessDaysBetween` (utils `business-days.ts`).
- **Arranque de la cuenta al cambiar de etapa** (`handoffStart`): la etapa
  frontera (todas las lineales previas COMPLETED) hereda como inicio la fecha de
  cierre de la etapa anterior; si es la primera etapa del pipeline, arranca en la
  fecha de venta/inicio del proyecto. Así, al resolver una etapa, la siguiente
  muestra su contador de inmediato en vez de quedar en blanco hasta que alguien
  toque una subtarea (que es cuando se setea `actualStartDate`). Las etapas
  futuras (con alguna previa sin cerrar) NO heredan handoff → sin contador.
- El countdown se expone en `GET /api/projects` (dentro de `currentStage`) y en
  `GET /api/projects/:id` (en cada `stage` vía `serializeStage`, que acepta el SLA
  y el `fallbackStart` de handoff como argumentos).
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
