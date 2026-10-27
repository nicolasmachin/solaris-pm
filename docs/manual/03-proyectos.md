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

### Ítems de checklist respaldados por evidencia

`services/checklist-evidencias.ts`. Un ítem con `evidenceKind` **no se puede
tildar a mano**: el PATCH del checklist consulta `faltaEvidencia()` y devuelve 422
si el documento no existe. Al revés, quien produce la evidencia llama a
`completarPorEvidencia()` y el ítem se marca solo.

| `evidenceKind` | Qué exige | Quién la marca |
|---|---|---|
| `ensayo-video` | Un video de ensayo `READY` | `project-video.service.ts` |
| `proforma` | Una `ProformaVersion` publicada, **o** un `FileAttachment` del proyecto con `toolSource: "proforma-subida"`, **o** una proforma (`proforma-subida` o `proforma`) en el lead del que salió el proyecto (`lead.convertedToProjectId`) | `publishVersion()`; `POST /projects/:id/proforma/subidas`; el PATCH del proyecto al elegir `FINANCIACION_BANCARIA` |
| `plan-pagos` | Un cobro previsto manual (mismo criterio que `planPagos.service.ts`) | `createPlanPagos()` |
| `modalidad-otro` | `Project.modalidadPagoNota` con texto | el PATCH del proyecto |

Cosas que conviene saber:

- **`completarPorEvidencia()` verifica antes de marcar**, aunque quien la llama
  suele venir de crear la evidencia. Es barato y evita el error que se cometió al
  sincronizar los proyectos viejos: llamarla a ciegas tildó 32 ítems de proyectos
  que no tenían nada hecho.
- **`despintarPorEvidencia()`** hace lo contrario: si la evidencia desaparece (se
  borra la nota), el ítem vuelve a estar pendiente. Sin eso quedaría tildado
  afirmando algo que ya no es cierto.
- **ADMIN está exento del guard**, igual que en el resto del checklist.
- Un `evidenceKind` desconocido **no bloquea**: si se retira una evidencia del
  catálogo, esos ítems siguen funcionando como ítems normales.

### La proforma puede ser generada, subida o venir del lead

Desde el 27-oct-2026 `hayProforma()` (`checklist-evidencias.ts`) acepta tres
fuentes. El caso que lo disparó: Washington Lanfranco, cuya proforma se hizo por
fuera de Voltia PM, y el onboarding obligaba a generar otra solo para avanzar.

1. Una `ProformaVersion` publicada (la herramienta de siempre).
2. Una **proforma subida** al proyecto: `FileAttachment` con `toolSource:
   "proforma-subida"` (`TOOL_SOURCE_PROFORMA_SUBIDA`), `tipo: UPLOAD_MANUAL`.
   Rutas en `proforma.routes.ts`: `GET/POST /projects/:id/proforma/subidas`
   (`ONBOARDING:VIEW` / `ONBOARDING:CREATE`, el mismo que generar) y `DELETE
   /projects/:id/proforma/subidas/:fileId` (`ONBOARDING:EDIT`). Solo PDF, JPG o
   PNG. Subir llama a `completarPorEvidencia`; borrar —por esa ruta o desde
   Documentos (`DELETE /files/:fileId`)— llama a `despintarPorEvidencia`.
3. Una proforma **en el lead** del que salió el proyecto (`toolSource`
   `proforma-subida` o `proforma` con `leadId` y `lead.convertedToProjectId` =
   el proyecto). Se busca en el lead y no solo en la copia que hace
   `copyLeadAttachmentsToProject` al convertir, para que también la vean los
   proyectos convertidos antes. **Ojo:** al 27-oct-2026 Voltia PM no tiene una
   herramienta para generar la proforma desde el lead; esta rama queda lista
   para cuando exista (o para una proforma subida al lead como adjunto con ese
   `toolSource`). Un adjunto común del lead que sea una proforma **no** cuenta:
   no hay forma de saber que es una proforma.

Como un ítem se marca solo cuando se crea la evidencia, y la del lead ya existía,
el PATCH del proyecto llama a `completarPorEvidencia(EVIDENCIA_PROFORMA)` cada
vez que se elige `FINANCIACION_BANCARIA`.

### El Onboarding no cierra sin saber cómo paga el cliente

El filtro de ítems pendientes compara `item.appliesWhenModalidadPago ===
project.modalidadPago`: con `modalidadPago` en null **ningún ítem condicionado se
exige**, así que la subetapa se daba por completada sin proforma, sin plan de
pagos y sin saber cómo paga el cliente. Y además había dos atajos que no miraban
el checklist: `PATCH .../substages/:id` con `status` (el que usan el botón de
completar rápido, el selector de estado y "Mis tareas") y `PATCH
.../stages/:id/complete-all`, que tildaba "Plan de pagos creado" aunque el plan
no existiera.

Desde el 9-oct-2026 la regla es una sola, `checklist-evidencias.ts` →
`definicionesPendientesOnboarding(projectId)`, que devuelve qué falta:

| Modalidad | Exige | Código |
|---|---|---|
| (ninguna) | elegir una | `MODALIDAD_PAGO` |
| `DIRECTO_50_50` | un cobro previsto (`hayPlanDePagos`) **o** cobrado en USD ≥ 99 % del presupuesto | `PLAN_PAGOS` |
| `FINANCIACION_BANCARIA` | una proforma: generada, subida o del lead (ver `hayProforma()`); no exige el crédito aprobado | `PROFORMA` |
| `OTRO` | `modalidadPagoNota` no vacía | `NOTA_MODALIDAD` |

`assertOnboardingDefinido()` (en `substage-update.service.ts`) la convierte en un **409
`DEFINICIONES_PENDIENTES`** con `projectId` y `faltantes` en el cuerpo (el
manejador de errores aplana `details`). Se llama en los cuatro caminos que
pueden cerrar el Onboarding:

- `PATCH /projects/:p/stages/:s/substages/:id` con `COMPLETED` **o `NO_APLICA`**
  sobre la subetapa "Modalidad de pago definida" (y la herramienta
  `marcar_subetapa` del conector, que pasa por el mismo `actualizarSubetapa()`);
- `PATCH /substages/:id/complete` (reemplaza al viejo `MODALIDAD_PAGO_REQUERIDA`);
- `PATCH .../complete-all` si entre las subetapas abiertas está la de modalidad;
- `PATCH /projects/:p/stages/:s` con `COMPLETED` si la etapa es `ONBOARDING`.

**ADMIN no está exento** de esta regla, a diferencia del guard de evidencia.

En el cliente, las mutaciones que completan (`StageDrawer`: completar rápido,
selector de estado, completar todo; `Dashboard`: "Mis tareas") llaman en su
`onError` a `pedirDefinicionesSiFaltan(err, reintentar)`
(`store/definicionesPendientes.store.ts`). Si el error es ese, abre
`DefinicionesPendientesModal` —montado una vez en `AppLayout`, como el aviso de
traspaso— con la lista de faltantes y el `ModalidadPagoPanel` adentro; "Listo,
continuar" reintenta la acción y, si todavía falta algo, el modal se reabre.

**Proyectos viejos:** no hay backfill. La regla se aplica a todo proyecto con el
Onboarding abierto en el momento de cerrarlo; los que ya lo cerraron no se tocan.

`ModalidadPago` tiene tres valores: `FINANCIACION_BANCARIA`, `DIRECTO_50_50` y
`OTRO` (este último obliga a llenar `modalidadPagoNota`).

**El plan de pagos se abrió a `ONBOARDING:EDIT`** con `authorizeAny`, mismo
precedente que la pestaña Cobros de Experiencia Solar: se abre la herramienta, no
el módulo Finanzas entero.

**Los proyectos que ya existían no reciben ítems nuevos del catálogo** — el
checklist se copia al crear el proyecto. Para eso está
`prisma/scripts/sync-checklist-modalidad-pago.ts`, que los agrega a las subetapas
**sin completar** (las cerradas se dejan como están: agregarles un pendiente las
volvería inconsistentes).

### La Pre-Ingeniería no cierra sin los datos de la obra, y pre-ingeniería y unifilar tienen que coincidir

Pedido de Operaciones (14-oct-2026): para agendar hay que saber cuántos paneles
son, si es mono o tri y cómo se monta, y eso se buscaba a mano en la lista de
materiales. Ahora está arriba de todo en **Datos técnicos** de la ficha y en el
espacio de Ingeniería (`DatosTecnicosResumen.tsx`, mismo componente en
`ProjectDetail` e `IngenieriaWorkspace`), y la Pre-Ingeniería no cierra sin eso.

**La fuente es el formulario de pre-ingeniería** (última `PreIngenieriaVersion`):
`cantidadPaneles` (texto, se toma el primer número), `inversor` (texto; los kW
salen de `parseInversorKw()`, el último "N kW"), los tres booleanos `red*`,
`tipoTecho` (+ `tipoTechoOtro`) e `inclinacion`. Se le sumaron:

- **`SUELO`** en `tipoTecho`. La columna es `String`, así que no llevó migración:
  se agregó en el zod de `preingenieria.routes.ts`, en el de la extracción de
  minuta (`minutaExtraction`), en el PDF (`preingenieriaPdf`, una fila más en el
  bloque de checkboxes) y en `TIPO_TECHO_OPTIONS`.
- **`inclinacion`** (`COPLANAR` | `INCLINADO`, columna `String?`, migración
  `preingenieria_inclinacion`). Es aparte del techo porque cualquier techo puede
  ir de las dos formas. Sale en el PDF como "Paneles: Coplanares / Con estructura
  inclinada". La IA de la minuta no lo extrae.

**Se valida contra el unifilar**: la última `UnifilarVersion` de cada suministro.
Se suman `cantidadPaneles` y `potenciaInversorKw` de todos y se juntan las redes
(`TipoRed` → `PhaseType`). Los suministros son 1 más los `order` de los
`SolarSystem`; uno sin unifilar es un faltante.

La propuesta (última `ProposalV2Version` publicada del lead) viaja en la respuesta
pero la pantalla no la muestra, y **no bloquea**: la obra puede cambiar después de la venta, y su
`tipoMontaje` es texto libre inservible para clasificar.

`datos-tecnicos-obra.service.ts` → `getDatosTecnicosObra(projectId)` devuelve
todo eso más `faltantes`, en `GET /projects/:id/datos-tecnicos`
(`authorizeProjectEditAnyPipeline(VIEW)`: cualquiera con `VIEW` en un módulo del
recorrido). Códigos:

| Código | Cuándo |
|---|---|
| `PREINGENIERIA` | No hay pre-ingeniería |
| `PANELES` / `INVERSOR` / `FASE` / `TECHO` / `INCLINACION` | Falta ese dato en la pre-ingeniería. `INVERSOR` también si el texto no trae los kW ("Huawei" a secas no alcanza) |
| `UNIFILAR` | No hay unifilar, o falta el de algún suministro |
| `PANELES_NO_COINCIDEN` | Total de paneles distinto |
| `INVERSOR_NO_COINCIDE` | Diferencia de kW > 0,05 |
| `FASE_NO_COINCIDE` | Alguna red del unifilar no está marcada en la pre-ingeniería |
| `PANEL_W_NO_COINCIDE` | La potencia del panel del unifilar no es la de la pre-ingeniería (`potenciaPaneles`) |
| `SISTEMA` | El proyecto no tiene ningún `SolarSystem` |
| `SISTEMA_NO_COINCIDE` | Los `SolarSystem` (suma de paneles y de kW, potencia de panel, fases) no dicen lo mismo que la pre-ingeniería. Un solo faltante con todas las diferencias |

**Por qué se compara también el sistema** (14-oct, caso visto en prod el mismo día
del deploy): un unifilar guardado **antes** de que existiera el volcado dejó la
pre-ingeniería y el unifilar en 34 × 550 W / 20 kW y el sistema en 30 × 620 W /
30 kW. El sistema es lo que ve Operaciones en la ficha y en la lista, así que
también bloquea. Se arregla guardando de nuevo el unifilar.

**Los datos del sistema solo los carga Ingeniería** (pedido de Nicolás, 14-oct):
editarlos desde la ficha era la forma de que quedaran distintos a la
pre-ingeniería. `POST` y `PATCH /projects/:id/systems` pasaron a
`INGENIERIA:EDIT` (antes `OPERACIONES:CREATE` y cualquier `EDIT` del recorrido).
Los escriben el volcado del unifilar y "Documentos UTE" (marca y modelo). En la
ficha, `SolarSystemsSection` quedó de solo lectura: sin "Editar sistema" ni
"Agregar suministro" (que pasó al panel del unifilar); "Eliminar" de un
suministro extra sigue ahí con `OPERACIONES:DELETE`. `SolarSystemModal` quedó sin
uso. En prod, todos los roles con `INGENIERIA:VIEW` tienen `INGENIERIA:EDIT`, así
que nadie que entre a Documentos UTE perdió la edición.

El resumen (`DatosTecnicosResumen`) muestra solo los cuatro datos grandes y, si
hay `faltantes`, el aviso con cada diferencia: no lista lo que dice cada fuente.

`assertPreIngenieriaDefinida()` (en `substage-update.service.ts`) devuelve el mismo **409
`DEFINICIONES_PENDIENTES`** que el Onboarding, con `etapa: "PRE_INGENIERIA"`.
Se llama en:

- `PATCH /projects/:p/stages/:s` con `COMPLETED` si la etapa es `PRE_INGENIERIA`;
- `PATCH /projects/:p/stages/:s/substages/:id` (`COMPLETED` o `NO_APLICA`; también
  `marcar_subetapa` del conector, por `actualizarSubetapa()`) y
  `PATCH /substages/:id/complete`, cuando `resolverSubetapaCierraPreIngenieria()`
  dice que sí: la subetapa es "Documento pre-ingeniería" **o** es la última
  abierta de la etapa (la etapa se completa sola en `syncStageProgress` cuando se
  resuelven todas);
- `PATCH .../complete-all` sobre la etapa `PRE_INGENIERIA`.

**Agujero conocido:** tildar el último ítem del checklist no pasa por estos
caminos (igual que en el Onboarding). ADMIN no está exento. Sin backfill: los
proyectos que ya pasaron la etapa no se tocan; los que están en Pre-Ingeniería
necesitan una versión nueva de la pre-ingeniería con coplanar/inclinado.

En el cliente, el mismo `DefinicionesPendientesModal` distingue por `etapa`: para
Pre-Ingeniería muestra la lista y **Ir a Ingeniería** (no reintenta: se cierra a
mano cuando esté todo). Guardar una pre-ingeniería o un unifilar invalida la
query `["datos-tecnicos", projectId]`.

**El unifilar alimenta los `SolarSystem`.** Al crear una versión
(`POST /projects/:id/unifilar-versions`), `volcarUnifilarEnSistema()` pisa en el
sistema del suministro (`order = suministro`; lo crea si no existe) paneles,
potencia del panel, modelo del panel si viene, modelo del inversor y fase. La
potencia del inversor solo si no coincide con `inverterPowerKw × inverterQuantity`
(si coincide se respeta la cantidad); si no, queda un inversor con la potencia
del unifilar. La marca solo se completa si falta, deducida del modelo con
`marcaDesdeModelo()` (Growatt, Huawei —también "SUN2000"—, Fronius, SMA, Solis,
GoodWe, Deye, Sungrow, Solax). Deja una auditoría `solar_system` con lo que
cambió. Es best-effort: si falla, la versión del unifilar igual queda.

En la **lista de proyectos** (`GET /projects`), el listado trae **todos** los
sistemas (antes solo el `order: 1`, por eso el "+N" de suministros extra no
aparecía nunca) y `montaje` (techo · coplanar/inclinado de la última
pre-ingeniería, `montajeDePreIngenieria()`); la columna Paneles lo muestra y, con
varios suministros, el total.


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

## El template del pipeline (editor de etapas y subetapas)

### Para qué existe

Las etapas macro del proyecto están definidas en el código
(`PIPELINE_DEFINITIONS`), pero **las subetapas, los checklists, los pesos y las
etiquetas se editan desde la app** (Admin → pipeline). Esa configuración se
guarda como un `Setting` de nivel `SYSTEM` con la clave `PIPELINE_TEMPLATE`, y es
lo que se precarga en cada proyecto nuevo.

### Cómo funciona

`getActivePipelineTemplate()` (en `pipeline-definitions.ts`) devuelve el template
guardado si existe, y si no, `PIPELINE_DEFINITIONS`. **El template guardado pisa
al código**: lo que está en `settings` es lo que se usa al crear un proyecto.

Las dos listas se separan con el tiempo: el template quedó grabado en una fecha,
y las etapas macro se agregan y se retiran después, en el código.
`reconciliarConDefiniciones()` las vuelve a alinear en cada lectura y en cada
guardado: **descarta las etapas que ya no existen en el código, completa las que
falten con su definición por defecto y renumera el orden**. Todo lo que el usuario
configuró en las etapas vigentes se conserva.

### Reglas y decisiones

- **El editor no agrega ni quita etapas macro**, solo lo de adentro. Eso se
  resuelve reconciliando y no rechazando: una etapa retirada que todavía viaje en
  el payload se descarta en silencio.
- **El `PUT` devuelve y audita lo reconciliado, no el payload.** Si devolviera el
  payload crudo, la pantalla se repintaría con etapas que el servidor descartó, y
  el registro de auditoría contaría etapas que nunca se guardaron.

### Casos borde

- **Una etapa retirada del código bloqueaba el editor entero** (septiembre de
  2026). Los dos carriles de Experiencia Solar —`SEGUIMIENTO_PREOBRA` y
  `SEGUIMIENTO_HABILITACION`— se sacaron de `PIPELINE_DEFINITIONS`, pero seguían
  dentro del `Setting` guardado. El `GET` los devolvía y el `PUT` los rechazaba
  con "La etapa X no pertenece al pipeline actual": **el editor cargaba algo que
  no podía guardar**, así que fallaba cualquier cambio, aun en una etapa sin
  relación. Es el caso que motivó la reconciliación.
- **El mismo desfasaje hacía que los proyectos nuevos nacieran con las etapas
  retiradas**, porque el template pisa al código al crear el proyecto. 64
  proyectos las tienen; se limpian con
  `server/prisma/scripts/retirar-carriles-cx.ts`, que hay que correr aparte.
- **Si el template guardado no tiene ninguna etapa reconocible, se ignora entero**
  y se cae a `PIPELINE_DEFINITIONS`. Un template irreconocible es un template
  corrupto, no una configuración.

---

## La lista de proyectos: archivados fuera de la vista

### Para qué existe

Archivar un proyecto es sacarlo de la vista (el caso típico: el cliente no
siguió con la obra). Hasta el 9-oct-2026 el filtro de estado de `/projects`
traía **Archivados** prendido por defecto, así que el proyecto archivado seguía
apareciendo, con su plazo vencido en rojo.

### Cómo funciona

- `DEFAULT_STATUSES` en `pages/Projects.tsx` es Prospectos, Activos y Pausados
  (sin Completados ni Archivados).
- El filtro se guarda por usuario en `localStorage` (`projects-page-filter`).
  La versión 3 de ese guardado (`PAGE_FILTER_VERSION`) **saca ARCHIVED una sola
  vez** de los filtros ya guardados en `loadPageFilter()`: sin eso, todo el que
  hubiera entrado antes los seguía viendo. Si después alguien marca
  "Archivados" a mano, se respeta.
- Botón **Archivados (N)**: pone el filtro de estado en solo `ARCHIVED`. Con ese
  filtro el botón pasa a **Volver a los activos**, que restaura
  `DEFAULT_STATUSES`. Restaurar un proyecto es el mismo ícono de la fila
  (`patchProject` con `status: ACTIVE`).
- Es solo de esta pantalla: el resto ya excluía archivados en el backend (panel
  de operaciones, cobros, agenda, conector MCP) o los ofrece a propósito en
  selectores (movimientos de Finanzas, eventos).

---

## Documentos comerciales en Documentos del proyecto, y el contrato firmado

### Para qué existe

El contrato, la proforma y las condiciones del Plan de Protección contra Granizo
guardaban su PDF solo en la carpeta de su herramienta (`pdfPath` de
`ContractVersion`, `ProformaVersion` y `PlanGranizoVersion`) y no creaban un
`FileAttachment`: quien no entraba a la herramienta no los veía en Documentos del
proyecto. Y el contrato **firmado** no tenía un lugar propio: quedaba como un
adjunto suelto dentro de una subetapa, o no se cargaba.

### Cómo se usa

- **Documentos del proyecto** (`DocumentsStrip.tsx`, también la lista "Documentos
  técnicos generados" del workspace de Ingeniería y su versión compacta en el
  StageDrawer): aparecen "Contrato v2", "Proforma v1", "Plan de Protección v1" y
  "Contrato firmado". El filtro **Comercial** los junta; el filtro Ingeniería ya
  no los cuenta.
- **Bloque "Contrato firmado"** en la ficha del proyecto (`ProjectDetail.tsx`,
  debajo de los documentos del cliente; componente
  `components/contract/ContratoFirmadoBlock.tsx`): dice "Cargado" o "Falta
  cargarlo", abre el archivo en otra pestaña, y tiene **Subir / Reemplazar** y
  **Quitar**. Acepta PDF y fotos (JPG, PNG, WEBP, HEIC/HEIF).

### Cómo funciona

- `services/documentos-generados.service.ts` → `sincronizarDocumentoGenerado(kind,
  projectId)`: deja en Documentos **solo la versión vigente** (última publicada y
  no descartada) de cada documento. Si ya está adjuntada no hace nada; si no,
  copia el PDF desde `pdfPath` con `saveBufferAsAttachment()` y crea el
  `FileAttachment` (`tipo: OTRO`, `toolSource` = `contrato` | `proforma` |
  `plan-granizo`, `toolVersion` = número de versión, `toolEntityId` = id de la
  versión) y retira el anterior (soft-delete + borrado del archivo **copiado**; el
  PDF de la versión en la carpeta de la herramienta no se toca). Sin versión
  vigente, retira los adjuntos. Si el PDF no está en disco, no toca nada.
- La llaman (versión "segura", que no tira abajo la operación si falla)
  `publishVersion()`, `discardVersion()` y `restoreVersion()` de
  `contract/contract-version.service.ts` y `proforma/proforma-version.service.ts`,
  y `publishVersion()` / `setVersionStatus()` de
  `seguro-granizo/documento/documento.service.ts`. Descartar la vigente hace
  volver a Documentos la anterior.
- Rótulos: `etiquetaDocumentoComercial()` del mismo servicio, usada por
  `GET /api/projects/:projectId/documents` (`sourceLabel`) y por
  `buildToolSourceLabel()` de `ingenieria.routes.ts`. En el cliente,
  `toolBadge()` de `DocumentsStrip.tsx` usa ese `sourceLabel` para los comerciales
  (los de Ingeniería siguen con su "Ingeniería · …").
- Contrato firmado: `routes/contrato-firmado.routes.ts`
  (`GET`, `POST` multipart y `DELETE` en `/api/projects/:projectId/contrato-firmado`).
  Se guarda con `saveUploadedFile()` (que convierte HEIC a JPEG) como
  `FileAttachment` `tipo: UPLOAD_MANUAL`, `toolSource: "contrato-firmado"`, sin
  etapa ni subetapa. Subir otro **reemplaza** al vigente (soft-delete + borrado
  del archivo). Audita `file_uploaded` / `deleted` y aparece en la línea de tiempo
  del cliente como documento (`MODULO_POR_TOOL` en `clientes/index.ts`).
- **Aviso al asesor**: el resumen diario por mail le suma a cada asesor la sección
  "Contratos pendientes de firma" (ver capítulo 12,
  `digest/contratos-pendientes.service.ts`).

### Permisos

- Ver Documentos: `OPERACIONES:VIEW` (igual que la descarga de archivos).
- Ver el bloque **Contrato firmado**: `ONBOARDING:VIEW` **u** `OPERACIONES:VIEW`
  (`authorizeAny(PUEDE_VER)` en `contrato-firmado.routes.ts`; en la pantalla,
  `usePermission` de cualquiera de los dos). Se abrió a ONBOARDING:VIEW para que
  lo vea Experiencia Solar, que controla que el contrato quede archivado.
- Subir y quitar el contrato firmado: `ONBOARDING:EDIT` **u** `OPERACIONES:EDIT`
  (`authorizeAny(PUEDE_EDITAR)`).
- Según la matriz de producción al 11-oct-2026: suben ADMIN, ASESOR_COMERCIAL,
  CAPATAZ, COMPRAS, EXPERIENCIA_SOLAR, GERENTE_COMERCIAL, GERENTE_INGENIERIA,
  GERENTE_OPERACIONES, INGENIERIA, INSTALADOR_TERCERIZADO, LOGISTICA,
  OPERACIONES y POSTVENTA; FINANZAS y TRAMITACION_UTE no ven el bloque. Que
  INSTALADOR_TERCERIZADO pueda subir sale de la matriz (tiene ONBOARDING:EDIT),
  no de una decisión de esta feature.

### Reglas y decisiones

- **El contrato firmado no bloquea ninguna subetapa** (decisión de Nicolás,
  11-oct-2026). Se pensó como ítem obligatorio de "Planificación y logística" de
  Ejecución de Obra y se descartó: en su lugar se le recuerda al asesor por mail
  todos los días hasta que lo sube.
- En Documentos queda solo la versión vigente de cada documento, mismo criterio
  que Unifilar, Pre-ingeniería y Justificación de potencia. Las demás se bajan
  desde la herramienta.
- `tipo` es `OTRO`: no se agregó un valor al enum `FileAttachmentTipo` (pediría
  migración y no aporta; el origen fino es `toolSource`).
- Los documentos generados son inmutables en Documentos (no tienen papelera): se
  cambian publicando o descartando versiones en la herramienta. El contrato
  firmado se cambia desde su bloque.

### Casos borde

- Versiones publicadas antes del 11-oct-2026 no tienen adjunto: se crean con
  `prisma/scripts/backfill-documentos-generados.ts` (sin `--apply` muestra cuántos
  crearía, cuántos ya estaban y los PDF que no encuentra en disco; con `--apply`
  los crea). Es idempotente. Los que reporta sin PDF hay que regenerarlos desde la
  herramienta.
- Si falla la copia al publicar, la versión queda publicada igual (se loguea un
  warning) y se arregla corriendo de nuevo el backfill.
- El contrato firmado es uno por proyecto, aunque el proyecto tenga varios
  suministros.

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
