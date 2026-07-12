# Estado del módulo de Traspasos — handoff

> **Última actualización:** 2026-07-09 21:10 (-03)
> **Estado:** Fases 1–3 ejecutadas y verificadas + **DIFF spec v3 aplicado** (prioridad alta). Listo para el item A (expansión del pipeline).
> **Plan completo:** `~/.claude/plans/m-dulo-de-traspasos-scalable-hare.md`
> **Documentos madre:** `PROTOCOLO_OPERATIVO_ENTREGA_SERVICIO.md` v3 · `TRASPASOS_SPEC.md` v3 · registro de cambios C1–C14 · `mapa_procesos_voltia.html`

## 0. DIFF spec v3 aplicado (2026-07-09)

Se aplicó el DIFF de **prioridad alta** de la spec v3 sobre lo ya implementado (sin commitear todavía), en la migración `20260709205545_traspasos_v3_diff` (tabla `traspasos` vacía → recrear enum seguro):

- **Traspasos 12 → 13:** enum `TraspasoTipo` renumerado, se agregó el **T4** (Validación de Operaciones → Atención al Cliente). Actualizado `catalogo.ts` (destinatarios, `STAGE_TO_TRASPASO`, `STAGE_TO_TRASPASO_EXTRA`, labels, textos de modal) y las referencias en `destinatarios.ts` (T9 ticket) y `traspasos.service.ts` (T8 efecto E3-A).
- **Etapa 3 renombrada (C6):** `StageType.REVISION_CAPATAZ → VALIDACION_OPERACIONES` (aditivo; `REVISION_CAPATAZ` queda muerto hasta Fase 5). Actualizados los 4 mapas `Record<StageType,…>`.
- **T2 → Gerente (C5):** el T2 notifica al sub-rol **GERENTE** (antes Capatacía), con nuevo texto de modal. **Verificado end-to-end** (Gerente primario + ADMIN copia).
- **`NO_APLICA` (C13):** agregado a `SubstageStatus` (sub-tareas condicionales cuentan como resueltas para el cierre).
- **`equipoTercerizado` (C13):** flag agregado a `Project`.

**Decisiones tomadas al aplicar v3 (2026-07-09):**
- **Sin `stageCode`** en `Project` (la v3 lo re-listaba por inercia del texto v2): se mantiene la etapa derivada de `Stage[]` — una sola fuente de verdad.
- **Responsable/deadline (C1/C2): aditivo ahora, remover después.** Se usa el `Stage.responsibleUserId` existente y se deja `Substage.deadline/userId` intactos (no romper el cron `deadline-warnings`); su eliminación va con la migración de datos (Fase 5).

---

## 1. Qué es esto

Módulo que formaliza los **traspasos entre áreas**: cada transferencia de trabajo entre equipos queda como un evento persistente y auditable, con **acuse humano** (modal + confirmación) y **red de seguridad automática** (escalación a ADMIN por SLA vencido). El protocolo completo define 12 traspasos (T1–T12) + tickets + encuestas + calendario + reportes + migración de pipeline (17 pasos, meses de trabajo).

**Esta primera entrega ataca solo la fundación y el camino principal interno.**

---

## 2. Decisiones tomadas con el usuario (2026-07-09)

1. **Alcance de la 1ª entrega:** Motor de traspasos + los 7 traspasos del pipeline técnico (T1–T7). **Nada** de tickets/encuestas/calendario/E3/reportes al cliente.
2. **Pipeline:** expandir el pipeline **real** de 5 a **8 etapas macro** (bloques top-level, no subetapas). Cada bloque del flujo es una etapa de verdad, aunque un área tenga más de una (Ingeniería = Pre-Ingeniería + Ingeniería Final; Operaciones = Revisión Capataz + Compras + Ejecución de Obra). Se hace **expandiendo el enum `StageType`** y reutilizando el modelo `Stage` — **una sola fuente de verdad**.
3. **Email: 100% interno.** Todos los destinatarios de T1–T7 son roles internos + ADMIN, compatible con el guardrail post-incidente de mayo 2026 (`sendEmail({ type: 'internal' })`). **No se reabre el canal a clientes.**
4. **Roles:** se crean `TRAMITACION_UTE` y `ATENCION_AL_CLIENTE`, y se agrega `subRolesOperaciones[]` (CAPATACIA/COMPRAS/GERENTE) a `User`.

### Las 8 etapas del pipeline expandido

| # | Stage (`StageType`) | Área | Traspaso de cierre |
|---|---|---|---|
| 1 | `ONBOARDING` | Ventas | T1 |
| 2 | `PRE_INGENIERIA` | Ingeniería | T2 |
| 3 | `REVISION_CAPATAZ` | Operaciones · Capatacía | T3 |
| 4 | `INGENIERIA_FINAL` | Ingeniería | T4 |
| 5 | `COMPRAS` | Operaciones · Compras | T5 |
| 6 | `EJECUCION_OBRA` | Operaciones | T6 |
| 7 | `TRAMITACION_UTE` | Tramitación UTE | T7 |
| 8 | `POST_HABILITACION` | Atención al Cliente | — (E3-A / E3-B) |

---

## 3. Lo YA EJECUTADO (Fases 1–3)

Todo compila (`tsc` server = **0 errores**), migración aplicada en local, y el motor está **probado end-to-end contra la base real**. **Nada commiteado todavía** (ver §6).

### ✅ Fase 1 — Schema, roles y permisos

- **Migración** `server/prisma/migrations/20260709172854_traspasos_v1_schema/` (puramente aditiva, sin DROP/DELETE de datos).
- **`schema.prisma`:**
  - `StageType` expandido de 5 → **12 valores** (los 4 viejos `INGENIERIA/OPERACIONES/HABILITACION_UTE/POSTVENTA` **conviven temporalmente** con los 7 nuevos; se eliminan en la migración de datos de Fase 5).
  - Enums nuevos: `TraspasoTipo` (12), `TraspasoEstado`, `SubRolOperaciones`, `PostHabilitacionSubFase`.
  - Extendidos: `NotificationType` (+`traspaso_asignado`, `traspaso_escalado`), `AuditEntityType` (+`traspaso`), `AuditAction` (+3), `Module` (+`TRASPASOS`), `Action` (+`CONFIRM`, `ADMIN_REPORT`).
  - Modelos `Traspaso` + `TraspasoDestinatario`.
  - `User`: `subRolesOperaciones[]` + relaciones. `Project`: `postHabilitacionSubFase/InicioEn/FechaAproximada` + relación. **No** se agregó `stageCode` (la etapa se sigue derivando de `Stage[]`).
- **`seed.ts`:** roles `TRAMITACION_UTE` y `ATENCION_AL_CLIENTE` + matriz de permisos `TRASPASOS` (ADMIN: VIEW/CONFIRM/ADMIN_REPORT; demás roles internos: VIEW/CONFIRM). Verificado en la base.
- **4 mapas exhaustivos `Record<StageType,…>` completados** con los 7 valores nuevos: `authorize-by-stage.middleware.ts`, `api.routes.ts`, `pipeline-definitions.ts` (`STAGE_LABELS`), `clientes/index.ts` (`RECORRIDO_BY_STAGE`).

### ✅ Fase 2 — Motor de traspasos (backend)

Carpeta nueva `server/src/services/traspasos/`:
- **`catalogo.ts`** — fuente de verdad declarativa: destinatarios por traspaso, mapeo `StageType → TraspasoTipo` (`STAGE_TO_TRASPASO`), textos de modal (§11), etiquetas.
- **`destinatarios.ts`** — `calcularDestinatarios` (5 reglas: primarios por rol → sub-roles Operaciones → Gerente copia → ADMIN siempre copia → dedupe, excluye al actor) + `previewDestinatarios`.
- **`notificar.ts`** — in-app (`createNotification`) + email `type: 'internal'`, best-effort, marca flags.
- **`traspasos.service.ts`** — `crearTraspaso`, `crearTraspasoSiNoExiste` (idempotente por proyecto+tipo), `confirmarTraspaso` (ownership + transacción + efecto T7→E3-A + audit + notifica), `cancelarTraspaso`.
- **`escalacion.service.ts`** — `escalarVencidos()` (>5 días hábiles → ESCALADO + avisa ADMIN) + cron `0 7 * * 1-5`.
- **`reportes.service.ts`** — `reporteDiarioAdmin` (solo si hay escalados) + `reporteSemanalAdmin` (métricas) + crons.
- **`business-days.ts`** (`utils/`) — días hábiles (excluye fines de semana; **feriados = TODO**, no hay tabla `Feriado`).
- **`index.ts`** — `startTraspasosJobs()`, registrado en `server/src/index.ts`.

### ✅ Fase 3 — Endpoints REST + wiring del motor

- **`routes/traspasos.routes.ts`** (registrado en `routes/index.ts`, prefijo `/api`):
  - `GET /traspasos/pendientes` · `GET /traspasos/:id` · `POST /traspasos/:id/confirmar` · `POST /traspasos/:id/cancelar` (ADMIN) · `GET /traspasos/proyecto/:projectId` · `GET /admin/traspasos/reporte`.
- **Wiring T1–T7:** hook en `PATCH /projects/:id/stages/:stageId` — al pasar una etapa a `COMPLETED`, dispara `crearTraspasoSiNoExiste` según `STAGE_TO_TRASPASO` (idempotente, best-effort).
- **Verificado contra la base real:**
  - Wiring **no** dispara si la completación falla (probado con blockers pendientes).
  - Flujo completo del motor: T1 pendiente → bandeja muestra texto + preview → `confirmar` generó **6 notificaciones in-app** correctas (2 INGENIERIA + 4 ADMIN copia, excluyendo al actor), todas a usuarios internos.

---

## 4. Lo que FALTA

### Dentro de la 1ª entrega (MVP T1–T7)

| # | Pendiente | Notas |
|---|---|---|
| ~~A-backend~~ ✅ | **Expansión del pipeline a 8 etapas (backend) — HECHO (2026-07-09)** | `PIPELINE_DEFINITIONS` reescrito a 8 etapas + `buildInitialStages` (POST_HABILITACION indefinida). **Verificado**: proyecto nuevo genera 8 etapas (ONBOARDING 10 sub incl. "Fecha tentativa de obra" C8; PRE_INGENIERIA; VALIDACION_OPERACIONES = Informe capataz + Fecha confirmada; INGENIERIA_FINAL; COMPRAS 3 sub incl. Logística NO_APLICA; EJECUCION_OBRA 4 sub incl. Control de Costos; TRAMITACION_UTE; POST_HABILITACION sin fechas). Names de herramienta preservados. **Auditoría C11: sin riesgo de datos** (herramientas cuelgan de `projectId`, no de `substageId`); el vínculo es UI por string. **Setting `PIPELINE_TEMPLATE` eliminado en local** (override-aba el const) → prod necesita eliminarlo/regenerarlo. Sub-tareas de etapas nuevas **mínimas** (a refinar con gerencia). |
| ~~A-frontend~~ ✅ | **Vista visual + StageDrawer — HECHO (2026-07-10)** | Componente `PipelineExpandido` (8 etapas + carriles CX en paralelo + conectores T1/T4/T7/T8), mapa central `client/src/constants/stages.ts`, montado en `ProjectDetail`. `StageDrawer` actualizado con conjuntos de etapas (viejas+nuevas): workspace Ingeniería en PRE_INGENIERIA/INGENIERIA_FINAL, **panel del capataz movido a VALIDACION_OPERACIONES** (se mantiene en INGENIERIA para proyectos viejos), fotos de obra en EJECUCION_OBRA, UTE en TRAMITACION_UTE. Header del drawer usa label legible. |
| ~~CX-seguimientos~~ ✅ | **Seguimientos paralelos de Atención al Cliente — HECHO (2026-07-10)** | Backend: enums `InteractionDirection/Reason` + `avisoHabilitacionEn` (migración `20260710011437`); Regla de Oro 24-48hs (`aviso-habilitacion.service.ts`, cron, alerta interna a CX/ADMIN, verificado E2E); `listClientes` devuelve `ultimoContactoEn` + `avisoHabilitacionPendiente`. Frontend: columna "Último contacto" (resalta >7 días) + badge "aviso pendiente" en `ClientesPage`; selectores dirección/motivo + botón "marcar avisado" en `ClienteInteractionForm`. Tracks derivados del recorrido E1/E2/E3 (sin entidad nueva). |
| ~~A-uteSync (C10)~~ ✅ | **Reconciliar ute-sync con el pipeline nuevo — HECHO (2026-07-11)** | `ute-sync.service.ts` ahora matchea **ambos** nombres (`TRAMITACION_UTE`+`HABILITACION_UTE`, `POST_HABILITACION`+`POSTVENTA`, `EJECUCION_OBRA`+`OPERACIONES`), porque conviven proyectos migrados y no. Restaura el sync de subetapas UTE y el auto-avance/cierre. **Sin doble avance**: el efecto de T7 solo setea `postHabilitacionSubFase=E3_A` (no completa etapa); `completeProjectIfAllStagesDone` ya excluye los carriles CX. Script `advance-stuck-posthabilitacion.ts` (dry-run/--execute) reprocesó los 6 proyectos finalizados que quedaron trabados (usa `finalizedAt`, no hoy). **Correr en prod** post-deploy. **Reconciliación extendida al mismo cluster de rename** en `api.routes.ts` (sync `actualUteEnd/actualEngineeringEnd` en transición de etapa 2258/2261; guardas de subetapas UTE automáticas 2384/2812; guarda de fechas en etapa indefinida 2015; `completionPercent` excluye Post-Habilitación + carriles CX 1287; `/metrics/stages` excluye Post-Habilitación) y `project.service.ts:526` (fecha fin a mostrar). Tests nuevos con nombres nuevos en `ute-sync.advance.test.ts` (11 pasan). `STAGE_TYPE_TO_MODULE` y `PIPELINE_TEMPLATE` (endpoint viejo de 5 etapas, legacy) no se tocaron. |
| ~~B~~ ⤳ | **Endpoints dedicados T3+T4 y T6 — CUBIERTO POR B2 (no se construye)** | El resultado funcional ya existe vía B2: completar las sub-tareas de VALIDACION_OPERACIONES dispara **T3+T4** (`STAGE_TO_TRASPASO` + `STAGE_TO_TRASPASO_EXTRA`) y completar las de COMPRAS dispara **T6**. Un endpoint compuesto dedicado sería sólo un disparador alternativo redundante; se decide **no agregar superficie**. Si en el futuro se quiere un botón "Validar Operaciones" de un solo acto, se apoya sobre el mismo motor. |
| ~~B2~~ ✅ | **Motor de completitud de sub-tareas (C4) — HECHO (2026-07-11)** | El traspaso de cierre se dispara desde `syncStageProgress` (`project.service.ts`) cuando la etapa transiciona a COMPLETED por sus sub-tareas resueltas (`COMPLETED` **o** `NO_APLICA`); recibe `actorUserId` (quien resolvió la última) vía `refreshStageProgressAndProject` y los endpoints de subetapa/checklist/complete/complete-all. `NO_APLICA` ahora cuenta como resuelta en `calculateStageProgress`/`syncStageProgress`/`calculateSubstageProgress` (antes trababa la etapa). Dispara principal + extra (`STAGE_TO_TRASPASO` + `STAGE_TO_TRASPASO_EXTRA`, o sea VALIDACION_OPERACIONES → T3+T4). **No se modela "obligatoria" por subetapa**: toda subetapa activa es obligatoria, NO_APLICA es el escape. El bloque manual (`PATCH stage {status:COMPLETED}`) se mantiene como force-complete (idempotente, también dispara extra). E2E verificado (NO_APLICA cierra Onboarding + genera T1 PENDIENTE). Tests: `stage-progress.test.ts` (6). **Gap conocido:** T8 al completar TRAMITACION_UTE por el sync automático de UTE no dispara (no hay actor humano en `regenerateUteSubstages`); requiere actor-sistema, diferido. |
| ~~B3~~ ✅ | **Calendario: estado tentativo/confirmado (C9) — HECHO (2026-07-12)** | La infra ya existía (`InstallationSchedule.confirmedAt` null=tentativo / con-fecha=confirmado, endpoint `PATCH /calendar/:id/confirm` restringido a `OPERACIONES:EDIT` → Ventas agenda pero no confirma). Lo que faltaba era el **render visual**: en `client/src/pages/Calendar.tsx` los helpers `blockBackground`/`tentativeOutline` pintan la obra tentativa **rayada (repeating-linear-gradient 45°) + outline punteado** y la confirmada sólida, en vista mes (`MonthTrackBlock`) y año (`YearTrackBlock`), + leyenda + tooltip "Fecha tentativa (sin confirmar)". **Sin auto-wiring** substage↔schedule (el checklist "Evento de calendario marcado como confirmado" sigue siendo recordatorio manual; decisión: no automatizar). **Bonus C10**: se reconció el cluster de rename en el calendario del backend (`api.routes.ts`: `validateInstallationAgainstOperations`, `isInstallationWorkSubstage`, `serializeSchedule.operationsCompleted`, `installation-check`, y el `finalizedAt` de UTE-finalizar) para matchear `EJECUCION_OBRA`+`OPERACIONES` — antes los 44 proyectos nuevos no validaban coherencia ni pintaban verde la obra terminada. `tsc` client+server = 0. Verificado en navegador (mes julio tentativos rayados; abril mezcla sólido/rayado; panel "Sin confirmar" + botón "Confirmar fecha"). |
| ~~B4~~ ✅ | **Control de costos de obra (C14) — HECHO (2026-07-12)** | La infra de costos ya existía (`GET /projects/:id/cost-summary` + `CostosTab.tsx`, previsto=`ProjectMaterial` / real=`StockMovement EGRESO`). Se agregó: **(1)** métrica **costo real por kW** (`costoRealPorKwUSD` = costo real de obra / `capacityKwp`, guardado div/0) + previsto por kW, nuevo KPI en `CostosTab`. **(2)** **Costo no-material** (decisión del usuario: **carga manual**, no desde Finanzas): modelo nuevo `ProjectNonMaterialCost` (migración `20260712163809`, aditiva) + endpoints `GET/POST/DELETE /projects/:id/non-material-costs` (OPERACIONES VIEW/EDIT, soft-delete, audita en `AuditEntityType.project`) + sección UI con alta/baja (concepto/monto/moneda/fecha). El no-material **suma al costo real de obra** → `costoRealObraTotalUSD`, `margenRealObraUSD/Percent` y el costo por kW lo reflejan; el "Costo previsto vs real" y las secciones Previsto/Real siguen siendo **solo materiales** (previsto de Ingeniería no tiene no-material, apples-to-apples). **(3)** Fotos↔UTE (decisión del usuario: **dejar como está**): la galería de fotos de obra ya está enganchada a EJECUCION_OBRA (`CargarFotosObraButton`, ZIP) y la doc UTE no lleva fotos — no se construyó el vínculo. `tsc`=0, verificado E2E en navegador (alta 800 USD → margen 9.046, costo/kW 125,39; baja → vuelve a 0). Solo necesita rebuild + `migrate deploy` en prod. |
| **C** | **Frontend (Fase 4)** | Módulo `client/src/modules/traspasos/`: `BandejaPage` (`/pendientes`), `ModalConfirmacion`, `PipelineExpandido` (8 etapas + badge E3-A/E3-B), íconos de los tipos nuevos en `NotificationBell`, rutas en `App.tsx`. API en `client/src/api/traspasos.api.ts`. |
| **D** | **Migración de datos (Fase 5)** | `migrate-pipeline-8-stages.ts`: reestructura filas `Stage`/`Substage` de proyectos existentes de 5→8 (divide INGENIERIA→2, OPERACIONES→2), recalcula `postHabilitacionSubFase/InicioEn`. Dry-run + CSV + validación manual antes de ejecutar. **Después** quitar los 4 valores viejos del enum `StageType`. Scripts: `grant-subroles-operaciones.ts`, `check-usuarios-sin-email.ts`. Panel ADMIN `/admin/traspasos`. **La pieza más riesgosa.** |
| ~~E~~ 🟡 | **Tests (Fase 6) — motor de ruteo HECHO (2026-07-12)** | `destinatarios.test.ts` (14 tests, `npm run test:traspasos-destinatarios`): `calcularDestinatarios` T1/T2/T3/T5/T7, Gerente copia, ADMIN copia, **dedupe** (Operaciones con COMPRAS+GERENTE una sola vez), **exclude actor** (incl. actor=ADMIN), **T9 área derivada** (INGENIERIA sin gerente / OPERACIONES con gerente copia), `previewDestinatarios`, + invariantes de catálogo (todo `TraspasoTipo` con entrada/label; mapeos etapa→traspaso válidos; dual C12). Para testear sin DB se **inyectan los fetchers** (`DestinatarioDeps` con default a Prisma; prod sin cambios) — el mock de `prisma.user.findMany` no sirve (delegates proxy de Prisma v6). **Falta (diferido, requiere harness de DB):** integración de `crear/confirmar` (ownership, transacción, efecto T7→E3-A), `escalarVencidos`. Ya verificados E2E manualmente contra la base real. |

### Fuera de la 1ª entrega (fases futuras del protocolo)

- **Tickets** (T8/T9) — módulo nuevo, entidad + endpoints + UI.
- **Encuestas** (T10) — **no existe motor de encuestas** hoy; `EXPERIENCIA_CLIENTES` es CRM de bitácora. Requiere construirlo.
- **Calendario in-house de mantenimientos** (T11) — no existe en el portal; requiere slots/reservas.
- **T12** mantenimiento ejecutado.
- **Reporte mensual al cliente / avisos al cliente** — **reabren el canal `client_facing`** (hoy bloqueado por guardrail): workstream separado y revisado.
- **Transición automática E3-A → E3-B**, config del SLA por-traspaso desde UI, **feriados** en días hábiles (tabla `Feriado`), alertas de plazo vencido por sub-etapa.

---

## 5. Riesgos y notas técnicas

- **Migración pipeline 5→8 (D):** cambia valores del enum `StageType` (usado por muchos servicios) y reestructura `Stage`/`Substage` de todos los proyectos. Requiere dry-run + validación manual proyecto por proyecto. `save.sh` antes.
- **Reconciliar T7 con auto-avance UTE existente** (`ute-sync.service.ts:314`): hoy el trámite UTE finalizado ya avanza automáticamente a POSTVENTA; la confirmación de T7 no debe duplicar ese avance.
- **Prod:** el módulo `TRASPASOS`, los 2 roles y sus permisos son **adiciones netas** a los 137 de prod → correr seed/script + `clearPermissionCache()` en el VPS. La migración es no destructiva.
- **Guardrail de email intacto:** todo T1–T7 es interno; si un destinatario calculado no fuera un `User`, el guardrail lo bloquea.
- **Estado actual del pipeline:** hasta que se haga **A**, el wiring solo puede disparar **T1** (ONBOARDING es la única de las 8 etapas que ya existe); el resto de proyectos siguen con las 5 etapas viejas.

---

## 6. Estado de git / entorno

- **Nada commiteado.** Restore point previo al trabajo: commit `4cc8d70a` (via `save.sh`).
- **Cambios sin commitear** (Fases 1–3 + DIFF v3):
  - Modificados: `schema.prisma`, `seed.ts`, `index.ts`, `authorize-by-stage.middleware.ts`, `api.routes.ts`, `routes/index.ts`, `clientes/index.ts`, `pipeline-definitions.ts`, y en `services/traspasos/`: `catalogo.ts`, `destinatarios.ts`, `traspasos.service.ts`.
  - Nuevos: `migrations/20260709172854_traspasos_v1_schema/`, `migrations/20260709205545_traspasos_v3_diff/`, `routes/traspasos.routes.ts`, `services/traspasos/`, `utils/business-days.ts`.
- **Ambas migraciones aplicadas en la base local** (Fase 1 con `migrate dev`, v3 con `migrate deploy` — hecha a mano porque `migrate dev` no corre non-interactive con borrado de enum). El seed local ya tiene los roles/permisos nuevos.
- Sugerencia al retomar: correr `bash save.sh` para trazar un commit con lo hecho antes de seguir.

---

## 7. Próximo paso sugerido al retomar

**A** (expansión del pipeline a 8 etapas) es el desbloqueante: habilita T2–T7, los endpoints T3/T5 y es prerequisito de la migración. Alternativa: hacer **C** (frontend) primero para *ver y usar* T1 + confirmación antes de tocar la estructura del pipeline.
