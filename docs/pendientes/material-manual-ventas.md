# Material de referencia para el Manual de Ventas

> Relevamiento del proceso comercial hecho el 24-09-2026, verificado contra el
> código. Es **material de trabajo**, no un manual: sirve para escribir
> `manual-de-ventas.md` sin tener que rehacer la exploración.

# Material para el Manual de Ventas de Voltia — relevamiento completo

Repo: `/Users/nicolasmachin/Dev/voltia-pm`. Todo lo de abajo está verificado en código/seed/docs. Donde no encontré nada, lo digo explícitamente.

---

## 1 · El pipeline de ventas: el enum `SalesStage`

### Definición canónica (backend)

`/Users/nicolasmachin/Dev/voltia-pm/server/prisma/schema.prisma` — `enum SalesStage`, 7 valores, en este orden:

```prisma
enum SalesStage {
  NUEVO_LEAD
  COTIZADO
  RECLAMADO
  AGENDAR_VISITA
  VISITADO
  CERRADO_GANADO
  CERRADO_PERDIDO
}
```

Default del lead: `stage SalesStage @default(NUEVO_LEAD)` en `model SalesLead` (mismo archivo).

### Etiquetas legibles en español — hay TRES lugares (ojo, no están en `client/src/constants/`)

**a) `client/src/types/leads.types.ts`** → `STAGE_LABELS` (es la que se ve en toda la UI de Ventas):

```ts
export const STAGE_LABELS: Record<SalesStage, string> = {
  NUEVO_LEAD: "Nuevo lead",
  COTIZADO: "Cotizado",
  RECLAMADO: "Reclamado",
  AGENDAR_VISITA: "Agendar visita",
  VISITADO: "Visitado",
  CERRADO_GANADO: "Ganado",
  CERRADO_PERDIDO: "Perdido",
};
```

Mismo archivo: `STAGE_COLORS` (borde + punto de color por etapa) y

```ts
export const KANBAN_COLUMNS: SalesStage[] = ["NUEVO_LEAD","COTIZADO","RECLAMADO","AGENDAR_VISITA","VISITADO"];
```

→ **las dos etapas cerradas no son columnas del Kanban**: viven en una pestaña aparte "Cerrados" (ganados + perdidos juntos, cada uno con su badge), armada en `Sales` (`client/src/pages/Sales.tsx`, variable `closedLeads`).

**b) `server/src/routes/mcp/format.ts`** → `ETAPA_LABEL` (lo que ves por el chat de Claude; casi igual pero no idéntico):

```ts
NUEVO_LEAD: "Nuevo", COTIZADO: "Cotizado", RECLAMADO: "Reclamado",
AGENDAR_VISITA: "Agendar visita", VISITADO: "Visitado",
CERRADO_GANADO: "Cerrado ganado", CERRADO_PERDIDO: "Cerrado perdido",
```

**c) `client/src/components/sales/PriorityView.tsx`** → `SECTIONS`, que es **la mejor definición de qué significa cada etapa en criollo** porque cada una trae su `hint`, y **el orden está invertido a propósito** (de más avanzado a menos, para atacar por prioridad):

```ts
{ stage: "VISITADO",       title: "Visitados",      hint: "Listos para cerrar" },
{ stage: "AGENDAR_VISITA", title: "Agendar visita", hint: "Pendientes de coordinar la visita" },
{ stage: "COTIZADO",       title: "Cotizados",      hint: "Seguimiento de la cotización" },
{ stage: "RECLAMADO",      title: "Reclamados",     hint: "Seguimiento tras insistir" },
{ stage: "NUEVO_LEAD",     title: "Nuevos leads",   hint: "Pendientes de cotizar" },
```

Comentario de cabecera del mismo archivo: *"Vista de trabajo priorizada: agrupa los leads activos de más avanzado a menos, para atacarlos por prioridad. Los cerrados (ganado/perdido) no aparecen. Dentro de cada grupo, los que esperan hace más tiempo van arriba."*

**Nota importante:** `client/src/constants/stages.ts` **NO es del pipeline de ventas** — es del pipeline de PROYECTOS (`StageType`: ONBOARDING, PRE_INGENIERIA, …, con `AREA_LABEL`, `STAGE_LABEL`, `STAGE_RECORRIDO` E1/E2/E3, `STAGE_TRASPASO` T1–T8). No confundir en el manual.

### Reglas de movimiento entre etapas

`server/src/services/sales/leads.service.ts` → `moverEtapaLead()`:
- `CERRADO_PERDIDO` **exige motivo**: `if (stage === CERRADO_PERDIDO && !params.lostReason?.trim()) throw badRequest("LOST_REASON_REQUIRED", "Debés indicar el motivo de pérdida")`. En la UI es `LostReasonModal.tsx`.
- No hay validación de orden: se puede saltar etapas y volver atrás. El selector de etapa (`client/src/components/sales/StageSelect.tsx`) lista **las 7** con este comentario: *"Lista completa de stages en el orden visualmente coherente (mismo del enum). El consumidor del componente puede ignorar las que no aplican vía la lógica de su onChange."*
- Cada movimiento deja `SalesActivity` (`action: "stage_changed"`) + entrada de auditoría *"Movió el lead '<nombre>' de X a Y"*.
- Promoción automática a `COTIZADO`: `server/src/services/proposal/promote-lead.service.ts` → `autoPromoteLeadToCotizado()`. Es **forward-only**: *"solo promueve si el lead está en NUEVO_LEAD. Si ya está en una etapa posterior (RECLAMADO, AGENDAR_VISITA, VISITADO, CERRADO_*, etc.) NO retrocede — el caso típico es regenerar la propuesta de un lead que ya está más avanzado o cerrado."*
- En el Kanban, arrastrar a la columna "Cerrado" **no** mueve la etapa directo: abre un selector Ganado/Perdido (`handleDragEnd` en `Sales.tsx`).

### Las tres vistas de Ventas

`client/src/components/sales/SalesViewToggle.tsx` → `useSalesView()`, tipo `SalesView = "list" | "kanban" | "priority"`, default **kanban**, preferencia persistida en `localStorage` clave `voltia.sales.view`. Botones: **Lista**, **Kanban**, **Priorizada**. Título de la página: *"Ventas / Pipeline comercial"*.

---

## 2 · Plazos y controles

### 2.1 · SÍ hay SLA por tramo del embudo (no por etapa)

El plazo comercial **no se mide por `SalesStage`** sino por **pares de fechas del lead**. `server/prisma/schema.prisma`:

```prisma
// Tramos de tiempo del embudo comercial (medidos por pares de hitos del lead).
// Alimentan el Panel de ventas (Embudo & SLA) del Dashboard.
enum SalesFunnelStep {
  LEAD_TO_QUOTE       // leadCreatedAt → proposalSentAt
  QUOTE_TO_SCHEDULED  // proposalSentAt → visitScheduledAt
  SCHEDULED_TO_VISIT  // visitScheduledAt → visitCompletedAt
  VISIT_TO_CLOSE      // visitCompletedAt → closedAt (ganado)
  CLOSE_TO_PROJECT    // closedAt → convertedAt (handoff a proyecto)
}

// Plazo objetivo (días HÁBILES) de cada tramo del embudo comercial. Una fila por
// tramo. Config de administración, editable sin tocar código (mismo patrón que
// StageSla / RecorridoCadencia). Alimenta el Panel de ventas del Dashboard.
model SalesStageSla { step SalesFunnelStep @unique; diasHabiles Int; activo Boolean @default(true) … }
```

Etiquetas en español: `server/src/services/sales-panel.service.ts` → `STEP_LABEL`:

| Tramo | Etiqueta | Default (días hábiles) |
|---|---|---|
| `LEAD_TO_QUOTE` | "Lead → Cotización" | **2** |
| `QUOTE_TO_SCHEDULED` | "Cotización → Visita agendada" | **3** |
| `SCHEDULED_TO_VISIT` | "Agendada → Visita realizada" | **5** |
| `VISIT_TO_CLOSE` | "Visita → Cierre ganado" | **5** |
| `CLOSE_TO_PROJECT` | "Cierre ganado → Proyecto" | **2** |

Los defaults salen de `server/prisma/scripts/seed-sales-stage-slas.ts` → `DEFAULT_SALES_SLAS`, y el archivo advierte que son *"Defaults en días hábiles. Placeholders; el admin los ajusta desde 'Plazos del embudo comercial'."* El seed es idempotente (no pisa lo ajustado).

**Dónde se edita:** Administración → pestaña `plazos-embudo` (`client/src/pages/Admin.tsx` → `TabSalesStageSlas` en `client/src/pages/admin/SalesStageSlasPage.tsx`). Texto literal de la ayuda en pantalla:

> *"Plazo objetivo de cada tramo del embudo comercial — Definí cuántos **días hábiles** (lunes a viernes) debería tardar cada paso del embudo: de lead a cotización, a visita, al cierre y a la conversión en proyecto. Alimenta el panel de ventas del Dashboard (semáforo, % de cumplimiento y leads trabados). Los tramos inactivos no se miden. No contempla feriados."*

**Cómo se calcula** (`server/src/services/sales-panel.service.ts`):
- `currentStep(lead)` decide qué tramo corre AHORA: devuelve `null` si el lead está `CERRADO_PERDIDO` o si ya tiene `convertedAt` (*"ya es proyecto: tramo 5 cerrado"*). Si no, el primer hito vacío manda: sin `proposalSentAt` → LEAD_TO_QUOTE (arrancando en `leadCreatedAt ?? createdAt`); sin `visitScheduledAt` → QUOTE_TO_SCHEDULED; sin `visitCompletedAt` → SCHEDULED_TO_VISIT; visita hecha y no ganado → VISIT_TO_CLOSE; ganado sin convertir → CLOSE_TO_PROJECT.
- `computeStepCountdown()` da el semáforo: `remainingBusinessDays < 0` → **overdue** (vencido), `<= WARNING_THRESHOLD_DIAS` → **warning**, si no **ok**. El umbral es `const WARNING_THRESHOLD_DIAS = Number(process.env.STAGE_SLA_WARNING_DIAS) || 2` — o sea **avisa 2 días hábiles antes de vencer**.
- `getSalesSlaMap()` cachea los SLA activos 5 minutos (`SLA_CACHE_TTL_MS`); solo entran filas con `activo: true` y `diasHabiles > 0`.
- Visibilidad: `puedeVerTodoElEmbudo(role)` → `role === "ADMIN" || role === "GERENTE_COMERCIAL"`. Comentario: *"Gerencia comercial + admin ven todo; el asesor solo los leads que tiene asignados (assignedToId)."*

**Dónde lo ve el asesor:** Dashboard → bloque **"Ventas · Embudo & SLA"** (`client/src/components/dashboard/SalesPanel.tsx`, renderizado en `client/src/pages/Dashboard.tsx` detrás de `canViewVentas`). Tres piezas + una tira:
- **Tira "En riesgo"**: *N vencidos · N por vencer · N en plazo · de N leads abiertos* (endpoint `GET /ventas/risk-summary`).
- **Tarjeta "Leads trabados ahora"** (`GET /ventas/leads-trabados`): solo los que **no** están en `ok`, ordenados por días restantes; muestra nombre, el contador `NR` de reclamos en rojo, el tramo y los días. Estado vacío: *"Todos en plazo 🎉"*.
- **Tarjeta "¿Dónde se rompe el embudo?"** (`GET /ventas/embudo-por-tramo`): promedio real + % de cumplimiento por tramo (histórico) + el lead abierto más trabado de cada tramo.
- **Tarjeta "Por vendedor"** (`GET /ventas/por-vendedor`): leads abiertos, atrasados, en plazo y `complianceRate` por asesor. **Devuelve `{ rows: [] }` si el que mira no es ADMIN/GERENTE_COMERCIAL** — el asesor la ve vacía.

Todos los endpoints `/ventas/*` están en `server/src/routes/api.routes.ts` con `preHandler: ventasGuard` = `authorize(Module.VENTAS, Action.VIEW)`.

### 2.2 · `StageSla` NO es de ventas

`model StageSla` (mismo schema) es **plazo por etapa de PROYECTO** (`StageType`, días hábiles). Defaults en `server/prisma/scripts/seed-stage-slas.ts`: ONBOARDING 15, PRE_INGENIERIA 10, VALIDACION_OPERACIONES 5, INGENIERIA 10, INGENIERIA_FINAL 10, COMPRAS 10, EJECUCION_OBRA 10, TRAMITACION_UTE 20, HABILITACION_UTE 20, OPERACIONES 10. Se edita en Administración → `plazos-etapa`. **Le toca al asesor solo en ONBOARDING (15 días hábiles)**, que es la etapa del proyecto que él ejecuta.

### 2.3 · `RecorridoCadencia` tampoco es de ventas

```prisma
// Cadencia objetivo de contacto por recorrido del cliente (E1/E2/E3): cada
// cuántos días CALENDARIO como máximo debería haber una interacción registrada
// antes de considerar al cliente "sin comunicación". Una fila por recorrido.
// Alimenta el Panel de operaciones (tarjeta "Sin comunicación").
model RecorridoCadencia { recorrido String @unique; diasObjetivo Int; activo Boolean … }
```

Defaults (`server/prisma/scripts/seed-recorrido-cadencias.ts`): **E1 = 3 días, E2 = 5 días, E3 = 10 días** (calendario). Es el control de **Experiencia Solar sobre proyectos/Generadores**, no sobre leads. Se edita en Administración → `cadencia-contacto` (`TabCadenciaRecorrido`). Herramienta del chat: `sin_comunicacion` (`server/src/routes/mcp/tools/operaciones.ts`), gateada por `OPERACIONES:VIEW`.

### 2.4 · Cadencia de contacto sobre LEADS: **NO EXISTE**

Busqué y lo confirmo: **no hay ninguna cadencia configurable de contacto para leads**. Lo más cercano son dos cosas, ninguna configurable:

1. **`daysInStage`** en la tarjeta del lead: se calcula en `server/src/routes/api.routes.ts` (armado de `LeadListItem`) como `Math.max(0, diffInDays(latestActivityDate, new Date()))`, o sea **días desde la última `SalesActivity`**, no desde que entró a la etapa. Es lo que ordena la vista Priorizada (*"los que esperan hace más tiempo van arriba"*).
2. **El umbral "trabado" del chat**, hardcodeado: `server/src/routes/mcp/tools/mi-dia.ts`:
   ```ts
   /** Sin novedades hace más de esto, un lead está trabado. */
   const DIAS_TRABADO = 14;
   ```

### 2.5 · Qué dispara un aviso — la respuesta corta es: NADA automático en ventas

Revisé `enum NotificationType` en el schema. Los valores son: `goals_not_configured`, `deadline_warning`, `prev_substage_completed`, `engineering_completed`, `traspaso_asignado`, `traspaso_escalado`, `traspaso_por_confirmar`, `aviso_habilitacion_pendiente`, `ticket_actualizado`, `encuesta_disponible`, `capacitacion_comentario`, `resumen_experiencia`. **Ninguno es de leads ni de SLA comercial.** Y en `server/src/services/digest/` (`daily-digest.job.ts`, `experiencia-digest.service.ts`) no hay una sola consulta a `salesLead` / `SalesStage`.

Conclusión para el manual: **el semáforo del embudo es "pull", no "push"**. Si el asesor no entra al Dashboard (o no le pregunta a `mi_dia` por el chat), nadie le avisa que un lead se venció. Este es justamente el eje que `docs/pendientes/ESTADO-GENERAL.md` marca para el manual: *"Eje: los leads que se enfrían sin que nadie los toque."*

Los dos únicos empujones que existen:
- **`mi_dia`** por el chat de Claude (`server/src/routes/mcp/tools/mi-dia.ts`, título "Qué tengo hoy", `VENTAS:VIEW`, `de_todo_el_equipo` opcional, default solo los propios). Devuelve bloques con estos títulos literales, calculados sobre las 5 etapas abiertas (`ETAPAS_ABIERTAS`) y con tope de 8 por bloque (`TOPE_POR_BLOQUE`):
  - `EMBUDO` (conteo por etapa)
  - `VISITAS DE HOY Y MAÑANA` (por `visitScheduledAt` entre hoy 00:00 Uruguay y +2 días)
  - `VISITAS QUE YA PASARON Y SIGUEN SIN REGISTRAR` — comentario: *"Agendada hace rato y el lead sigue esperando la visita: o se hizo y no se registró, o se cayó. En los dos casos hay algo que hacer."*
  - `RECLAMARON` (etapa RECLAMADO **o** `reclamosCount > 0`, ordenado por cantidad)
  - `TRABADOS (sin novedades hace 14 días o más)`
  - `PENDIENTES DE HOY` + una línea con los que esperan a un tercero (status `WAITING`, se cuentan pero no se listan: *"no es acción de hoy, y mezclarlo tapa lo que sí lo es"*).
- **Reporte semanal por mail** (`server/src/services/reporteSemanal/reporte-semanal.job.ts`): cron `1 0 * * 1` (lunes 00:01 hora Uruguay, `CRON_REPORTE_SEMANAL`), resumen de la semana lunes–domingo con KPIs `Leads`, propuestas enviadas, `Ventas` (cantidad + monto + asesor), visitas. **Va a una sola casilla**: `process.env.REPORTE_SEMANAL_EMAIL || "nicolas@voltia.com.uy"`. **No le llega al asesor.** Los leads se cuentan por `createdAt` de la semana y las propuestas por `proposalSentAt`.

---

## 3 · Reclamos en ventas: el contador "xR"

### Qué es

Definición en `server/prisma/schema.prisma`, dentro de `model SalesLead`:

```prisma
// Contador de reclamos (insistencias) hechos al lead. Es transversal a la
// etapa: un lead en cualquier stage puede acumular reclamos. Se muestra como
// "xR" en la tarjeta y se incrementa con el botón "+" desde el kanban.
reclamosCount        Int                  @default(0)
lastReclamoAt        DateTime?            @db.Timestamptz(6)
```

**Clave conceptual para el manual: un "reclamo" acá NO es una queja del cliente.** Es **una insistencia del asesor al cliente** (el asesor lo reclamó/lo apuró). La queja del cliente es otra cosa: el módulo **Tickets** (`Module.TICKETS`, ver capítulo 9 del Manual de Trabajo, "Reclamos"). Vale aclararlo explícitamente porque la palabra se pisa.

### Cómo se registra

Endpoint `POST /leads/:id/reclamo` en `server/src/routes/api.routes.ts`, con `preHandler: authorize(Module.VENTAS, Action.EDIT)`. Comentario literal:

> *"Registra un reclamo (insistencia) al lead: incrementa el contador que se muestra como 'xR' en la tarjeta. Es transversal a la etapa — no cambia el stage. Deja traza en SalesActivity + auditoría con la fecha del reclamo."*

Hace exactamente tres cosas:
1. `data: { reclamosCount: { increment: 1 }, lastReclamoAt: now }`
2. `SalesActivity` con `action: "reclamo_added"`, `notes: "Reclamo #<n>"`
3. Auditoría: `fieldChanged: "reclamosCount"`, descripción *"Registró un reclamo al lead '<nombre>' (total: N)"*

Devuelve `{ success, reclamosCount, lastReclamoAt }`.

### En la UI

- **Botón "+"** en la tarjeta del Kanban y en la fila de la lista: `client/src/components/sales/LeadCard.tsx` y `LeadRow.tsx`, con `aria-label="Registrar reclamo"` / `title="Registrar un reclamo"`.
- **Chip "NR"** al lado del nombre cuando `reclamosCount > 0`, con tooltip `"N reclamos realizados"` (singulariza solo).
- Cliente: `client/src/api/leads.api.ts` → `addReclamo(id)`; comentario: *"Registra un reclamo (insistencia) al lead. Incrementa el contador 'xR'."*
- Mutación en `client/src/pages/Sales.tsx` → `reclamoMutation` / `handleReclamo`. Toast de éxito: `Reclamo registrado (N)`. Error: `"No se pudo registrar el reclamo"`.
- En la ficha del lead se muestra por el chat como `Reclamos: N (último: dd/mm/aaaa)` (`server/src/routes/mcp/tools/ventas.ts`).
- También aparece en la tarjeta "Leads trabados ahora" del Dashboard como `NR` en rojo.

### Qué lo resuelve

**Nada. No hay forma de bajar el contador ni de cerrarlo.** Lo verifiqué: el único escritor de `reclamosCount` en todo el server es ese `increment: 1`. No existe endpoint de decremento, reseteo ni "resolver reclamo". El contador es **acumulativo y monotónico para toda la vida del lead**, y sobrevive a los cambios de etapa y al cierre.

Lo que sí hay es la **etapa `RECLAMADO`**, que es otra cosa y conviene distinguirla en el manual:
- La etapa es **dónde está el lead**; el contador es **cuántas veces se insistió**.
- Se "sale" de RECLAMADO moviendo el lead a otra etapa (a mano, con el selector o arrastrando), no tocando el contador.
- El hint de la etapa en la vista Priorizada es *"Seguimiento tras insistir"*.
- `mi_dia` mete en el bloque `RECLAMARON` tanto a los que están en etapa RECLAMADO **como** a los que tienen `reclamosCount > 0` en cualquier etapa (`l.stage === SalesStage.RECLAMADO || l.reclamosCount > 0`).

El propio manual técnico reconoce que esto no está documentado: `docs/manual/02-ventas.md` lista en "Qué falta cubrir" → *"Reclamos: el contador transversal y su diferencia con la etapa RECLAMADO"*.

---

## 4 · Las herramientas del asesor

### Mapa de la UI: el panel del lead

`client/src/pages/Sales.tsx`. El panel se abre en un `LargeModal size="wide"` **a dos columnas**, y también **por URL**: `/ventas?lead=<id>` (comentario: *"es lo que permite enlazar a un cliente desde los otros módulos"*). Header: nombre del cliente + `StageSelect` + código, y debajo o los dos botones grandes **"✓ Marcar como Ganado" / "✗ Marcar como Perdido"**, o el cartel de cerrado.

**Columna izquierda:**
1. Datos del lead (editables + botón "Guardar cambios"): Nombre, Email, Teléfono, Dirección, kWp estimados, Presupuesto USD, UTE mensual USD, Tipo de techo, **Tipo de cliente** (`Residencial` / `Empresa (B2B)`), **Asignado a**, Notas.
2. **"Cambiar etapa"** (select con las 7).
3. **"Fechas del proceso"** (ver §5).

**Columna derecha:**
4. **"Propuestas comerciales"** → botones `Armar propuesta` (residencial), `Cotizador B2B`, `Generar propuesta comercial` (el viejo por Excel) + `LeadProposalsList` (lista unificada).
5. **`LeadTasks`** (pendientes del lead).
6. **"Fotos y videos de la visita"**.
7. **"Adjuntos"**.
8. **"Historial de actividad"** (las `SalesActivity`).
9. `CommentThread level="lead"`.
10. **"Zona de peligro"** → "Borrar lead" (solo con `VENTAS:DELETE`, que el asesor **no** tiene).

### 4.1 · El cotizador (Propuestas v2)

**Dónde:** panel del lead → sección "Propuestas comerciales" → **dos botones**: `Armar propuesta` (RESIDENCIAL) y `Cotizador B2B` (EMPRESA). Los dos abren `client/src/components/proposals-v2/ProposalBuilderModal.tsx`. Comentario del archivo: *"Constructor de propuestas v2 como modal grande (rework post-Fase G). La lista de versiones ya NO vive acá: se ve en la sección de propuestas del panel del lead."* La ruta vieja `/leads/:leadId/propuesta` **se eliminó** (redirige a `/ventas`).

Solo aparecen si `canEditSales`. El botón resaltado (`variant="secondary"`) es el que corresponde al `tipoCliente` del lead; el otro queda `ghost`. **Precarga y resalta, no restringe**: desde cualquier lead se puede abrir cualquiera de los dos, y **cada uno tiene su borrador separado** (se puede tener una residencial y una de empresa vivas sobre el mismo lead sin que se pisen).

**Secciones del formulario** (`client/src/components/proposals-v2/ProposalForm.tsx`, en orden): `Cliente` · `Datos de la empresa` (solo B2B) · `Datos técnicos del sistema` · `Cotización base (Variante A)` · `Ítems adicionales (Variante B)` · `Financiación` · `Notas del asesor`.

**Sub-header con viabilidad en vivo** (`ViabilityIndicators.tsx`): `Ahorro N%` · `Espacio ocupado/disponible m²` (con ✓/⚠/✗ según estado) · `Potencia N kWp` · `Retorno N años` · `US$ N/kW c/IVA` · **`Precio final US$ N c/IVA`** destacado. Muestra `—` si falta el dato y se atenúa al 60% si el autosave está fallando.

**Autosave**: `useDraftAutosave` + `AutosaveIndicator`. El borrador se pide con `initDraft(leadId, variante)`: *"si no existe lo crea el servidor con la precarga, y siempre vuelve con el `data` completo"*.

**Ícono de calculadora** en el encabezado → `CosteoDrawer` (el costeo a medida). **Ícono de bug** → `CalculatorDebugDrawer`, gateado por `VENTAS:DEBUG_CALCULADORA` (**solo ADMIN** por default; grant en `server/prisma/scripts/grant-permission-debug-calculadora.ts`).

**Publicar**: `PublishButton` + `PublishModal` → versión `ProposalV2Version` con `status: PUBLISHED`, `versionNumber` incremental, `publishedAt` y un **snapshot inmutable**. Versiones descartables/restaurables (`discardedAt`). Lista en `LeadProposalsList.tsx` — unificada: nuevas (`ProposalV2Version`) + viejas (`ProposalGeneration`), con acciones `canDownloadFull / canDownloadSummary / canDownloadExcel / canPreview / canDiscard / canRestore` (ver `ProposalListItem` en `client/src/types/leads.types.ts`).

**Permisos del cotizador** (tabla literal de `docs/manual/02-ventas.md`):

| Acción | Permiso |
|---|---|
| Abrir cualquiera de los dos cotizadores, ver borrador y preview | `VENTAS:VIEW` |
| Guardar el borrador y ver el desglose de comisión | `VENTAS:EDIT` |
| Publicar una versión | `VENTAS:CREATE` |
| Editar los parámetros B2B y subir la tapa de empresa | ADMIN (chequeo por rol dentro del handler) |

**Cotizador viejo (v1, por Excel):** botón `Generar propuesta comercial` → Sheet **"Generar propuesta desde Excel"**, acepta `.xlsx`/`.xls`, dice *"Arrastrá o seleccioná un Excel"*, procesa async (`ProposalStatus`: PENDING/PROCESSING/COMPLETED/FAILED) y al terminar ofrece **Previsualizar** y **Descargar PDF**. Al completarse crea un `FileAttachment` en el lead para que la propuesta aparezca en "Adjuntos" (comentario en `model ProposalGeneration`). Estado en `docs/pendientes/ESTADO-GENERAL.md`: *"Propuesta v2 conviviendo con la vieja | 🟡 | Superficie chica (~5 refs a `ProposalGeneration` en 3 archivos). v1 sin descartar/restaurar ni exportar Excel. **Poner fecha de corte.**"*

**Por el chat:** `preparar_propuesta` ("Preparar propuesta residencial") y `publicar_propuesta` ("Emitir la propuesta") en `server/src/routes/mcp/tools/propuesta.ts`; `ver_propuesta` ("Ver propuesta comercial") en `tools/ventas.ts`.

### 4.2 · La visita técnica / el relevamiento — OJO, son dos cosas distintas

**a) El relevamiento de la visita COMERCIAL (lo del asesor):** es simplemente **fotos y videos colgados del lead** + la minuta PDF. No hay formulario ni checklist.

`client/src/components/sales/LeadVisitaMedia.tsx`, docstring literal:
> *"Fotos y videos del relevamiento de la visita comercial, antes de que exista el proyecto. Al ganarse el lead, todo esto pasa al proyecto: las fotos a la galería de obra y los videos a la sección Videos."*

Texto en pantalla (sección "Fotos y videos de la visita" en `Sales.tsx`):
> *"Relevamiento de la visita comercial. Al ganar el lead pasa al proyecto: las fotos a la galería de obra y los videos a la sección Videos."*

Detalles: fotos se comprimen en el cliente (`compressImage`), videos hasta **500 MB** (`MAX_VIDEO_MB`, espeja `MAX_VIDEO_SIZE_MB` del backend) y se comprimen en background con polling cada 4 s mientras están `PENDING`/`PROCESSING`. Borrar video requiere `VENTAS:DELETE` (el asesor **no** lo tiene).

**b) La "Visita Técnica con IA" (`TechnicalVisit`) NO es del asesor y NO cuelga del lead.** Lo verifiqué en el schema: `model TechnicalVisit` tiene `projectId String` (obligatorio, no hay `leadId`). Está en `server/src/routes/visitas.routes.ts` (permisos por módulo **OPERACIONES**: `VisitFloatingButton` usa `usePermission("OPERACIONES", "EDIT")`), página `client/src/pages/VisitaTecnica.tsx`, y graba audio → transcribe con Whisper → genera informe con IA en 7 secciones (`{ datosGenerales, acometida, techo, espacioInversor, canalizaciones, observaciones, proximosPasos }`, ver `model VisitReport`). `enum VisitType { INICIAL, REVISION, COMPLEMENTARIA }`, `enum VisitInputType { AUDIO, PHOTO, NOTE }`.

**c) El "Relevamiento Técnico" formal** es la subetapa 1 de `PRE_INGENIERIA` (SOP **O0**), responsable **"Técnico de Relevamiento"** (`server/src/services/pipeline-definitions.ts`) — 23 ítems de checklist. No es tarea del asesor; el asesor solo tiene que **avisarle al cliente que va a venir** (subetapa 10 de Onboarding, ítem "Informado sobre relevamiento técnico").

### 4.3 · La minuta y el bot de Telegram

**La regla de oro, textual de `docs/manual/02-ventas.md`:**
> *"Cargar la minuta **es** el hito de visita realizada: si hay minuta, la visita se hizo."*

**El bot** (`minutas-bot`, **repo aparte** — no está en este repo, lo confirmo). Al publicar una minuta en un lead hace dos llamadas a la API, en este orden:
1. `PATCH /api/leads/:id` con `visitCompletedAt` = **la fecha que figura en la minuta**, no la de hoy (*"La minuta puede subirse días después de la visita."*)
2. `PATCH /api/leads/:id/stage` con `VISITADO`, si el lead no está ya ahí.

> *"En ese orden: si la fecha se setea primero, el autocompletado de la etapa no la pisa (sólo actúa sobre campos vacíos). Un lead **ya cerrado no se toca**: una minuta que llega tarde no lo devuelve a Visitado. Ambos pasos son no bloqueantes — si fallan, la minuta igual quedó subida y el bot lo reporta como advertencia."*

**Cómo se identifica una minuta** (`server/src/routes/mcp/tools/minuta.ts`):
```ts
/** Un adjunto es minuta si el bot lo dejó marcado, o si el nombre lo delata. */
function esMinuta(a) {
  if (a.tipo === "MINUTA_RELEVAMIENTO") return true;
  if (a.toolSource === "minuta") return true;
  const n = a.filename.toLowerCase();
  return n.includes("minuta") || n.includes("resumen de visita") || n.includes("relevamiento");
}
```

**Leerla por el chat:** tool `minuta_lead`, título "Minuta de relevamiento del cliente", `VENTAS:VIEW`, params `lead_id` + `documento_id` opcional (*"Por defecto, la más reciente."*). Descripción literal:
> *"Devuelve el TEXTO COMPLETO de la minuta de la visita técnica de un cliente potencial: relevamiento del techo con sus medidas, instalación eléctrica, recorrido de la bajada, observaciones y pendientes. No es un resumen: es el documento entero. Usar antes de una visita o cuando se pregunta por cualquier detalle del relevamiento que no esté en la ficha."*

Y la decisión de diseño detrás, que es muy citable para el manual:
> *"La regla que manda acá: el asistente no puede abrir enlaces. Un enlace de descarga sirve para que una persona lo toque en el celular, pero es inútil cuando alguien va manejando y pregunta '¿qué decía la minuta?'. Todo lo que haya que leer viaja en el cuerpo de la respuesta; el enlace acompaña, nunca reemplaza."*

Tope de texto: `TOPE_TEXTO = 100_000` caracteres (*"Una minuta de 13 páginas ronda los 20.000, así que en la práctica nunca se toca"*). Solo mira adjuntos con `mimeType: "application/pdf"`.

**En el Onboarding hay un ítem obligatorio "Minuta de visita guardada"** (subetapa 6, "Organización carpeta digital").

### 4.4 · Los adjuntos del lead

`client/src/components/sales/LeadAttachments.tsx`. Texto literal en pantalla:
> *"Calculadoras de cotización, propuestas, minutas y otros archivos del lead. Cuando el lead se convierte en proyecto, todos estos adjuntos se copian al proyecto."*

Botón "Subir archivo" solo si `canEdit`. Whitelist angosta y tope: *"Tipo de archivo no soportado. Se permiten: PDF, JPG, PNG, Word, Excel."* y `LEAD_ATTACH_MAX_MB` (la spec de proposals-v2 dice **10 MB**: *"adjuntos ajustados a la spec (whitelist angosta, 10 MB, ConfirmDialog)"*). Backend: `server/src/services/sales/sales.service.ts` → `assertAllowedLeadFile()`, `saveLeadAttachment()`, `deleteLeadAttachmentFile()`.

### 4.5 · Los pendientes del lead

`client/src/components/sales/LeadTasks.tsx`, docstring:
> *"Pendientes colgados de un lead, dentro del panel del lead. Muestra los de todos los usuarios (no sólo los del que mira): el trabajo pendiente de un lead es información del lead, igual que sus comentarios o adjuntos."*

Badges de vencimiento: `Vencida hace Nd` (rojo), `Hoy` / `Mañana` / `En Nd` (ámbar, hasta 2 días), fecha suelta si falta más, `Sin fecha`. Estado `WAITING` = esperando a un tercero (ícono `PauseCircle`).

### 4.6 · La conversión de lead a proyecto

**Dónde:** al confirmar "Marcar como Ganado" el flujo es en **3 pasos encadenados** (`Sales.tsx`):
1. `MarkAsWonModal` — texto literal: *"El lead pasa a etapa Cerrado como Ganado. Después vas a poder completar los datos que falten para crear el proyecto (ciudad, provincia, potencia, presupuesto)."*
2. Al confirmar, comentario en el código: *"Etapa 2: primero capturar la comisión; al cerrar ese modal se ofrece convertir a proyecto."* → `CommissionCaptureModal`.
3. `LeadToProjectModal`.

Si el lead ya está ganado y sin convertir, el panel muestra un link **"Convertir a proyecto"**. Si ya se convirtió, muestra *"Convertido al proyecto <CODE>"* + la fila `EnlacesModulos`.

**Precarga del modal** (`client/src/components/sales/LeadToProjectModal.tsx`): `GET /leads/:id/conversion-defaults` — comentario del endpoint: *"Defaults para pre-cargar el modal de conversión: potencia y cotización de la última propuesta publicada, con fallback al estimado grueso del lead."* Campos del form: nombre, dirección, email, teléfono, **capacityKwp**, **locationCity**, **locationProvince** (default `"Montevideo"`), **budgetUsd**, `plannedEndDate`.

**Endpoint:** `POST /leads/:id/convert`, `authorize(Module.VENTAS, Action.CREATE)`. Precondiciones duras:
- `if (lead.stage !== SalesStage.CERRADO_GANADO) throw badRequest("LEAD_NOT_WIN", "El lead debe estar en CERRADO_GANADO para convertirse")`
- `if (lead.convertedToProjectId) throw conflict("ALREADY_CONVERTED", "El lead ya fue convertido a proyecto")`
- Obligatorios post-merge, si no → `MISSING_PROJECT_FIELDS` con `Faltan datos para crear el proyecto: <lista>.`: **nombre del cliente, ciudad, provincia, potencia (kWp)**.

**Prioridad de datos:** *"Cotización y potencia: prioridad body (lo que el usuario editó en el modal) > última propuesta publicada > estimado grueso del lead."*

**Qué crea / copia** (todo en el handler, `server/src/routes/api.routes.ts`):
- `Project` con `code` generado, `status: ACTIVE`, `startDate` = hoy si no viene, `plannedEndDate` = **start + 90 días** si no viene, `estimatedMwhYear = capacityKwp * 1.45`, `co2TonsAvoided = estimatedMwhYear * 0.5`, `salespersonId = lead.assignedToId`, y **`saleDate: lead.closedAt ?? null`** con el comentario *"Fecha de venta = momento en que se cerró el lead como ganado (Tanda 3)."*
- `createInitialPipeline(...)` — nace el pipeline completo, arrancando en ONBOARDING.
- `UteProcess` en `CONSULTA`/`PENDIENTE` + `regenerateUteSubstages`.
- Marca el lead: `convertedToProjectId` + `convertedAt`, `SalesActivity` `action: "lead_converted"` (*"Lead convertido a proyecto <CODE>"*), y dos entradas de auditoría.
- **Cuatro copias best-effort**, cada una en su propio `try` (si falla una, el proyecto ya existe):
  1. `copyLeadAttachmentsToProject` — los adjuntos.
  2. `moveLeadMediaToProject` — fotos y videos, con este comentario: *"Fotos y videos de la visita de ventas: van aparte porque cada uno tiene que quedar donde el proyecto lo muestra (galería de obra / sección Videos), no sueltos entre los documentos."*
  3. `createInstallerPaymentForProject` — *"Deuda de mano de obra con el instalador: se congela acá, al ganarse el proyecto, con lo que decía la propuesta ganadora más IVA. Nace SIN instalador — a quién se le paga se decide después, a mano, desde Finanzas."*
  4. `copyLatestProposalToProject` — *"Copia la propuesta comercial (última versión publicada) como adjunto del proyecto. La v2 guarda los PDF sueltos en disco (sin FileAttachment), por eso no la agarra copyLeadAttachmentsToProject."*

**Limitación declarada (citable):** de `docs/manual/02-ventas.md` §Varias instalaciones → *"**La conversión a proyecto sigue siendo manual.** Nada crea hoy el `SolarSystem` del proyecto desde la propuesta, así que la cantidad se vuelve a cargar a mano al abrir la obra."*

### 4.7 · Lo que el asesor hace después de ganar: la etapa ONBOARDING

Esto no es "una herramienta" pero es la mitad del trabajo del asesor y es lo que el cap. 3 del Manual de Trabajo cubre. `server/src/services/pipeline-definitions.ts` → `PIPELINE_DEFINITIONS[0]`: `StageType.ONBOARDING`, `weight: 18`, **10 subetapas, todas con `responsableRol: "Asesor Comercial"` y `sopCode: "V3"`**. Los ítems con `isBlocker: true` están marcados ⛔:

1. **Confirmación formal por escrito** — Alcance confirmado · Precio final confirmado · Modalidad de pago confirmada · Nota en CRM registrada
2. **Cobro de seña (USD 500)** — Datos de transferencia enviados · ⛔ Pago confirmado · Comprobante guardado en carpeta · Registrado en CRM
3. **Contrato** — Contrato completado con datos del cliente · Enviado al cliente · ⛔ Recibido firmado · Guardado en carpeta
4. **Recolección de datos administrativos** — Mail · Cédula · Teléfono · MEI si corresponde · Foto de cédula guardada · Todo guardado en carpeta
5. **Modalidad de pago definida** — Modalidad de pago definida · *(solo si `FINANCIACION_BANCARIA`)* Proforma enviada al banco · *(solo si `FINANCIACION_BANCARIA`)* ⛔ Crédito aprobado
6. **Organización carpeta digital** — Cotización Excel · Todas las versiones de propuesta · Propuesta final aprobada · Factura UTE · Contrato firmado · Foto de cédula · Datos del cliente · Comprobante de seña · **Minuta de visita**
7. **Registro en planilla de operaciones** — Datos cliente · Sistema vendido · Fecha de venta · Fecha tentativa de obra · Modalidad de pago · Margen esperado · Estado del proyecto
8. **Consulta inicial UTE** — ⛔ Consulta enviada · Guardada en carpeta · Registrada en planilla de trámites UTE · Registrada en CRM
9. **Fecha tentativa de obra** — Fecha tentativa definida · Evento tentativo agendado en el calendario. Comentario del código: *"Ventas agenda la fecha tentativa de obra antes de comunicar al cliente. El evento de calendario nace 'tentativo' (C9) y luego el gerente lo confirma en Validación de Operaciones."*
10. **Comunicación al cliente** — Informado sobre relevamiento técnico · Fecha tentativa de obra informada · Próximos pasos explicados

Cierre de la etapa → traspaso **T1** (`T1_ONBOARDING_COMPLETADO`), que el asesor confirma con `TRASPASOS:CONFIRM`.
Dato de `docs/pendientes/estado-traspasos.md`: *"Calendario: Ventas agenda pero no confirma"* — `PATCH /calendar/:id/confirm` está restringido a `OPERACIONES:EDIT`. La obra tentativa se pinta **rayada + outline punteado**; la confirmada, sólida.

---

## 5 · Las fechas del lead

### Las 5 fechas del lead (todas en `model SalesLead`, todas `Timestamptz(6)` nullable)

| Campo | Etiqueta en la UI | Qué significa | Quién la setea |
|---|---|---|---|
| `leadCreatedAt` | "Fecha de creación" | Alta **comercial** del lead | **Auto al crear** (`crearLead`: *"Si vino explícita (cargar un lead viejo con su fecha real), se respeta; si no, ahora."*). Editable |
| `proposalSentAt` | "Propuesta enviada" | Fecha de la **PRIMERA** propuesta del lead | **Auto** al generar propuesta (`autoPromoteLeadToCotizado`), solo si estaba vacía. Editable |
| `visitScheduledAt` | "Visita agendada" | El día en que se **acordó** la visita, **no** el día en que se va a hacer | **Auto** al pasar a `AGENDAR_VISITA`, solo si estaba vacía. Editable |
| `visitCompletedAt` | "Visita realizada" | El día en que efectivamente se visitó | **Auto** al pasar a `VISITADO` si estaba vacía, **o** por el bot de minutas con la fecha de la minuta. Editable |
| `closedAt` | "Fecha de cierre" | Cierre (ganado o perdido) | **Auto y SIEMPRE se pisa** al cerrar. Editable |

Más dos que el asesor no edita: `convertedAt` (se sella en `POST /leads/:id/convert`) y `createdAt`/`updatedAt` técnicos.

### `saleDate` NO es del lead

`saleDate` vive en **`model Project`**, no en `SalesLead`. Se llena al convertir: `saleDate: lead.closedAt ?? null` (*"Fecha de venta = momento en que se cerró el lead como ganado"*). En proyectos creados a mano el default es hoy (`api.routes.ts`: *"saleDate por defecto: hoy (fecha de creación del proyecto). Editable"*). Editarla es **solo ADMIN** — `gates-hardcodeados-por-rol.md`: *"solo admin edita fechas reales del proyecto (`touchesActualDates`)"*. Etiqueta legible: `"fecha de venta"` (`project-fields.service.ts`). También se usa como inicio de la cuenta regresiva de etapa del proyecto (`project.saleDate ?? project.startDate ?? project.createdAt`).

### El autocompletado, textual del código

`server/src/services/sales/leads.service.ts` → `moverEtapaLead()`:

```
// Fechas que se completan solas al cambiar de etapa:
//  - AGENDAR_VISITA completa la fecha de visita agendada SI está vacía. Si el
//    usuario ya la cargó a mano, no se pisa.
//  - VISITADO completa la fecha de visita realizada, con el mismo criterio.
//  - Cerrar (ganado o perdido) SIEMPRE pisa la fecha de cierre: si el lead se
//    reabre y se vuelve a cerrar, queda la última real.
// Ninguna otra etapa toca fechas, y volver atrás no borra la de cierre.
// Reconfirmar la misma etapa NO es un hito nuevo: mover un lead de Visitado a
// Visitado no significa que se lo haya visitado hoy otra vez. Sin esta guarda,
// reconfirmar una etapa vieja estampa la fecha de hoy sobre un hito que
// ocurrió semanas atrás, y queda peor que el campo vacío.
const cambioDeEtapa = existing.stage !== stage;
```

### La distinción de las dos fechas de visita (citar tal cual)

De `docs/manual/02-ventas.md`, "Qué significa cada fecha de visita" — *"Son dos cosas distintas y se confunden fácil"*:
- **Visita agendada**: *"el día en que se **acordó** la visita con el cliente, no el día en que se va a hacer. Si hoy 8 se coordina para el 9, queda el 8."*
- **Visita realizada**: *"el día en que efectivamente se visitó."*

### Edición manual

Panel del lead → sección **"Fechas del proceso"** → 5 `<input type="date">` + botón **"Guardar fechas"**. Las que tienen valor llevan un chip azul **"Auto"** (en el código: `auto: !!lead.<campo>` — o sea el chip en realidad dice "tiene valor", no "lo puso el sistema"; vale la pena no prometer más de lo que hace).

No hay endpoint aparte de fechas: va por `PATCH /api/leads/:id` (`editarLead()`), que acepta `null` para vaciar. Un día cargado a mano se guarda como **00:00 de Uruguay (03:00 UTC)**: `inicioDiaUruguayIso()` en `client/src/utils/date.ts` y `diaManualUruguay()` en `server/src/utils/uruguay.ts`. Todo cambio de fecha queda auditado con texto legible: *"Actualizó la fecha de visita agendada del lead … de 22/07/2026 a 22/09/2026"* (labels en `FECHA_LABEL` de `leads.service.ts`), con `source: "mcp"` si vino del chat.

Por el chat: `editar_lead` acepta un día (`AAAA-MM-DD`) o `"borrar"` por fecha. *"Es para casos especiales: lo normal sigue siendo que se completen solas."*

### Casos borde documentados (de `docs/manual/02-ventas.md`)

- *"`VISITADO` no completaba la fecha de visita realizada hasta el 8/8/2026"* — el indicador de "días entre visita y cierre" estaba roto.
- *"Hasta v10.9 un día cargado a mano se guardaba a las 00:00 UTC, que en Uruguay son las 21:00 del día anterior."* Arreglado + `scripts/backfill-fechas-lead-uruguay.ts`. Y hasta v10.9 los cambios de fecha **no quedaban auditados**.
- *"Un lead puede llegar a `CERRADO_GANADO` sin pasar por `VISITADO`, y en ese caso no hay fecha de visita: el promedio de 'visita a cierre' lo ignora en vez de contarlo como cero."*
- El filtro por rango de fechas del listado corta en días de Uruguay.

---

## 6 · La comisión del asesor

### Confirmado: se congela sola al ganar, con la última propuesta publicada no descartada

`server/src/services/commission/commission.service.ts` → **`congelarComisionAlGanar({ leadId, userId, userRole })`**, llamada desde `moverEtapaLead()` cuando `stage === CERRADO_GANADO`. Comentario en `leads.service.ts`:
> *"Ganar la venta congela la comisión sola, con la última propuesta publicada (ver `congelarComisionAlGanar`). El modal de comisión queda para cambiar la propuesta elegida, no para que el registro exista."*

Lo que hace, línea por línea:
1. **Idempotente**: `const existing = await prisma.commission.findUnique({ where: { leadId } }); if (existing) return serializeCommission(existing);`
2. Busca `proposalV2Version.findFirst({ where: { leadId, status: "PUBLISHED", discardedAt: null }, orderBy: { versionNumber: "desc" } })` → **la última publicada NO descartada**.
3. `if (!version) return null;` con el comentario: *"Sin propuesta publicada no hay de dónde sacar el monto: queda para cargar a mano (leads viejos, o ventas cerradas sin haber emitido propuesta)."*
4. Llama a `confirmCommission({ leadId, userId, userRole, proposalVersionId })`.
5. Todo dentro de un `try/catch` que loguea y devuelve `null` → **best-effort: si falla, el cambio de etapa no se cae.**

**De dónde sale el número:** `readComisionFromSnapshot()` lee `snapshot.calc.comisionVentasUsdSinIva`. El porcentaje sale de `calc.comisionVentasPctEfectivo` con fallback a `defaults.comisionVendedorPorcentaje` (*"Ambos son FRACCIÓN (0.04 = 4%)"*).

**El cálculo, residencial vs B2B** (`calculator.ts` §4 Pricing, citado en `docs/manual/02-ventas.md`):
```
markup excedente = max(0, markup% − referencia%) × (costo + mano de obra)   ← 0 si no es EMPRESA
comisión         = base% × (costo + mano de obra + markup)
                 + tajada% × markup excedente                                ← 0 si no es EMPRESA
```
O sea: **en residencial es un % fijo sobre (costo + mano de obra + markup); en B2B se le suma una tajada del markup que el asesor consiguió por encima de la referencia.** El porqué, textual: *"en B2B cada negociación es particular: el asesor discute el precio caso por caso, y con la comisión fija del 4% le daba casi lo mismo cerrar con markup 20% que con 30%."* Los tres parámetros viven en el subobjeto `b2b` del singleton `ProposalDefaults` (`markupReferenciaPorcentaje` en %, `comisionBasePorcentaje` y `comisionExcedentePorcentaje` en fracción) y se editan en **Admin → Defaults de propuestas → Propuestas a empresas (B2B)**.

Y una frase importante para el manual: *"La comisión sigue siendo un **costo dentro del precio**: la paga el cliente y la ganancia de la empresa sigue siendo exactamente el markup (`gananciaFinal ≡ markupUsdSinIva`, con test que lo fija)."*

**Qué se guarda** (`model Commission`): `asesorId` (*"SalesLead.assignedTo al cerrar"*), `leadId` (único, una comisión por lead), `proposalVersionId`, `montoUsd`, `porcentaje`, `origenManual`, **`fechaVenta` = `SalesLead.closedAt`**, **`dueDate` = día 1 del mes siguiente** (`firstDayOfNextMonth`), `status` (`PENDIENTE`/`PAGADA`, *"espejo del FinanceMovement linkeado"*), `financeMovementId`.

Y en paralelo un **`FinanceMovement` PREVISTO** (GASTO, `CategoriaPrincipal.VARIABLE`, subcategoría **`"Comisiones ventas"`**). Fuente de verdad del estado: Finanzas (`sync-commission-status.ts`).

### El modal: ya no crea, solo cambia

`client/src/components/sales/CommissionCaptureModal.tsx`, docstring literal:
> *"Modal de comisión (Etapa 2). Se abre al marcar el lead como Ganado, pero ya NO es el que hace que la comisión exista: al ganar se congela sola con la última propuesta publicada (ver `congelarComisionAlGanar` en el backend). Acá se ve con cuál quedó y se cambia si el cliente aceptó otra versión. Si el lead no tiene propuestas nuevas, un ADMIN/FINANZAS carga el monto manual."*

Prop `canManual` = ADMIN/FINANZAS. Al elegir otra versión, `confirmCommission` re-congela sobre la misma comisión (`recongelarDesdePropuesta`): recalcula el monto y arrastra el movimiento de Finanzas. Cambiar la propuesta requiere **`VENTAS:EDIT`**; editar montos/fechas sigue siendo **solo ADMIN**. Una comisión **ya pagada** no se re-congela desde el modal (error `COMISION_PAGADA`).

### Sí, el asesor la ve — en DOS lugares

**a) En el panel del lead ganado**, línea literal:
> `Comisión: US$ 1.234,56 · Pendiente` (o `· Pagada`)

Si el lead está ganado y **no** hay comisión, y el usuario tiene `canEditSales`, aparece un link **"Registrar comisión del asesor"**.

**b) Página propia `/comisiones`** (`client/src/pages/ComisionesAsesor.tsx`), permiso **`COMISIONES:VIEW`** (que ASESOR_COMERCIAL **tiene**). Acceso: **desplegable del avatar arriba a la derecha**, debajo de "Configuración" (`client/src/components/layout/Topbar.tsx`), y en móvil en el drawer (`MobileNavDrawer.tsx`). Tiene tarjetas (saldo total a cobrar destacado, cobrado en el año, ventas cerradas), filtros `todas / PENDIENTE / PAGADA`, ordenamiento por fecha/monto/cliente, y `ComisionesEvolutionChart`. De `docs/pendientes/pruebas-pendientes.md`: *"Un **asesor** entra y ve **solo sus** comisiones (sin columna de asesor)"* y *"Un asesor no ve comisiones ajenas ni entra a Finanzas."*

Por el chat hay tool `comisiones`.

### Reapertura de un lead ganado

`Sales.tsx`: *"Reapertura de un lead ganado con comisión registrada: avisar (la comisión y su pendiente en Finanzas se mantienen)"* → modal "Reabrir lead ganado". Si no hay comisión, el cambio es directo sin aviso.

### Casos borde (de `docs/manual/02-ventas.md`)

- **Venta sin ninguna propuesta publicada**: no se congela nada, hay que cargarlo a mano (ADMIN/FINANZAS).
- **Propuestas viejas (v1, sin snapshot)**: mismo camino manual.
- Ventas cerradas **antes** de este cambio: `server/scripts/backfill-comisiones-ganados.ts` (dry-run por defecto, `--execute`).
- La regla de negocio, textual: *"Se congela aunque nadie confirme nada. La decisión es de negocio: es preferible una comisión de más (que después no se paga) a una venta sin monto."*

### Y de paso: el monto de la venta que leen los informes

`montoDeVenta()` en `server/src/services/metricas/indicadores.service.ts`, usado por `ventasGanadas()` y el reporte semanal. Prioridad: **(1)** la propuesta congelada en la comisión → **(2)** la última propuesta publicada no descartada del lead → **(3)** `estimatedBudgetUsd` del lead. `ventasGanadas` filtra por `stage: CERRADO_GANADO` + `closedAt` en el rango (medianoche de Uruguay).

---

## 7 · Qué dice hoy la documentación

### 7.1 · Capítulo 3 de `docs/Manual-de-Trabajo-Voltia.md`, COMPLETO y textual

```markdown
## 3 · Asesor comercial

### Qué hacés

Vendés, cerrás, cobrás la seña, firmás el contrato, juntás los datos
administrativos y armás la carpeta. Presentás la consulta inicial a UTE y das la
fecha tentativa.

### Dónde termina tu trabajo

**Cuando el onboarding está completo y el cliente sabe cómo sigue.**

### 3.1 · La modalidad de pago — lo que más se nos está cayendo

**En el onboarding definís cómo paga el cliente.** Son dos caminos y cada uno te
deja una tarea distinta:

#### Si paga directo con nosotros

Armás el **calendario de pagos**: la seña más tres cuotas.

| Cuota | Cuándo |
|---|---|
| 50 % | Antes de la obra |
| 30 % | Con la obra terminada |
| 20 % | Cuando se habilita |

**En la app:** en el proyecto, sección de Finanzas → **Plan de pagos**. Las tres
cuotas ya vienen cargadas con esos porcentajes; solo confirmás los montos y las
fechas previstas.

#### Si va con financiación bancaria

Armás la proforma y **le hacés seguimiento todas las semanas hasta que salga**.

> **Este es el problema que más nos está pasando.** Llega el día de la obra, está
> todo planificado, y el cliente no quiere que empecemos porque el banco todavía
> no le contestó.
>
> Lo que pasa siempre es lo mismo: el banco le pide algo al cliente, el cliente
> nunca vio el pedido, y **los dos quedan esperando algo que no va a pasar solo**.

**Tu trabajo es hablar con las dos partes cada semana** y ver qué está pendiente.
No alcanza con mandar la proforma.

**En la app:** en el proyecto, etapa **Onboarding** → subetapa **«Modalidad de
pago definida»**. Al elegir financiación bancaria aparecen dos casillas más:
*Proforma enviada al banco* y *Crédito aprobado*. **La segunda es bloqueante: sin
eso tildado, el proyecto no debería avanzar a la obra.**

### 3.2 · El pasaje del cliente a Experiencia Solar

**Antes de irte, presentás a Alejandra.** No basta con que ella escriba: el
cliente tiene que saber quién es antes de recibir su primer mensaje.

**Van en este orden, y no al revés:**

| | Quién | Cuándo |
|---|---|---|
| 1 | Vos le presentás a Alejandra al cliente | Al cerrar el onboarding |
| 2 | Alejandra le escribe | Al día siguiente, máximo |

Algo así:

> «De acá en adelante vas a seguir en contacto con Alejandra, te paso su
> contacto.»

**Por qué importa el orden:** si Alejandra escribe primero, el cliente recibe un
mensaje de alguien que no conoce y desconfía. La presentación previa convierte
ese mensaje en la continuación de una relación, no en un contacto frío.

**En la app:** en la ficha del cliente, etapa **E1** → paso **«Bienvenida y
presentación»**. Tiene el mensaje modelo listo para copiar.

### 3.3 · Lo que dejás cargado para los que siguen

Todo lo que juntaste en la visita —**el resumen, la minuta, las fotos, los
videos**— tiene que estar cargado en el proyecto. **Con eso trabaja
Pre-Ingeniería.** Si falta, arrancan a ciegas.

### 3.4 · El cotizador

**Ventas → el lead → Armar propuesta.** Cargás los datos y el precio se calcula
solo. Tres cosas que conviene saber:

**Podés cotizar varias instalaciones juntas.** Si el cliente quiere dos techos o
dos padrones, poné más de uno en **Cantidad de inversores**. La potencia que
cargás es la de **un** inversor y los paneles van **sumados** entre las dos. Se
multiplican el inversor y la instalación eléctrica; el resto no.

**Podés ajustar los costos de esa cotización.** El **ícono de calculadora** del
encabezado abre el costeo: el precio de cada ítem, la mano de obra, los costos
fijos y variables. Sirve cuando el caso se sale de la norma —un proveedor que
cambió el precio, una obra con acceso difícil—. **Lo que cambiás vale solo para
esa cotización**, no toca las demás ni la configuración general, y se guarda
solo. Un campo en blanco usa el valor de siempre.

**La comisión se registra sola.** Cuando ganás la venta, el sistema toma el
precio de la última propuesta publicada y congela tu comisión con ese número. Ya
no hay que cargarla a mano; el modal que aparece es para corregirla si el precio
cerrado fue otro.

### A quién le preguntás qué

| Necesitás saber… | Preguntale a… |
|---|---|
| Si entró la seña, cómo se le cobra | Finanzas |
| Qué fecha tentativa podés prometer | Operaciones |

### Y a vos, ¿quién te pregunta?

**No tenemos un responsable de ventas.** Cada proyecto tiene su asesor asignado,
así que **cualquier duda de cualquier área sobre esa venta te la preguntan a
vos**: qué se prometió, qué alcance, qué condiciones especiales.
```

**Lo que el capítulo 3 NO menciona** (y el manual nuevo debería cubrir): el pipeline de 7 etapas, el contador de reclamos, el SLA del embudo y el panel del Dashboard, las fechas del proceso, el bot de minutas, la vista Priorizada, el cotizador B2B, la conversión a proyecto, `mi_dia`, la página `/comisiones`.

**Otros capítulos del mismo manual que le sirven al asesor** (para referenciar en vez de repetir): §2 "Las cinco reglas que valen para todos" (Regla 1 *"Solo dos personas hablan con el cliente"*; Regla 3 *"El que se demora avisa. Nadie pide explicaciones."*; Regla 5 *"Si no está agendado, no se va"*), §9 "Reclamos", §11 "La app, pantalla por pantalla", §12 "Cuando algo sale mal", y los dos anexos ("Las reglas en una página", "Glosario").

### 7.2 · `docs/manual/02-ventas.md` — 642 líneas, capítulo PARCIAL

**Aviso de cabecera, textual:**
> *"**Capítulo parcial.** Están escritas las secciones "Fechas del proceso", "Cotizador de propuestas: precargas y saludo de la carta", "Varias instalaciones en una misma propuesta", "Costeo a medida de una cotización", "Cotizador B2B: propuestas a empresas" y "Comisión del asesor: cómo se registra al ganar". El resto del módulo funciona en producción pero todavía no está documentado."*

Subtítulo: *"Leads, pipeline comercial, reclamos, propuestas, conversión a proyecto y comisiones."*

Estructura por sección (todas siguen la plantilla `Para qué existe / Cómo se usa / Cómo funciona / Permisos / Reglas y decisiones / Casos borde`):

| Sección | Qué cubre |
|---|---|
| **Fechas del proceso** | Las 5 fechas, `dateAutoFills` de `cambiarEtapaLead()`, la tabla de qué etapa completa qué y si pisa, la distinción agendada vs realizada, **el bot de minutas de Telegram** (los 2 PATCH y por qué en ese orden), cómo se guarda un día a mano (00:00 Uruguay = 03:00 UTC), auditoría, y 4 casos borde (el bug de VISITADO hasta 8/8/2026, el bug de UTC hasta v10.9 + backfill, el filtro por rango, ganado sin visita) |
| **Cotizador de propuestas: precargas y saludo de la carta** | El singleton `ProposalDefaults` con `{ value, asesorCanOverride }` ("Fijado por administración"), Admin → Defaults → "Equipos por defecto", el saludo autogenerado de solo lectura, **cómo `saludoPara()` infiere el género** (dos listas explícitas + terminación; "Estimado/a" cuando no hay señal; razón social → "Estimados,"), y la fecha de emisión con `fechaVigente()` corrigiendo solo hacia adelante + `todayIso()` en America/Montevideo |
| **Varias instalaciones en una misma propuesta** | Campo "Cantidad de inversores": potencia = de UNO, paneles = SUMADOS; solo se multiplican inversor e instalación eléctrica. `panelesPorInstalacion = ceil(cantidadPaneles / cantidadInversores)` y por qué (sin eso, dos instalaciones de 12 paneles costarían 50% más de eléctrica). Un ajuste manual del costeo gana. Casos borde: la mano de obra no se duplica, el medidor queda en 1, el documento no separa las instalaciones, **la conversión a proyecto sigue siendo manual** |
| **Costeo a medida de una cotización** | El **ícono de calculadora** del encabezado ("es a propósito discreto: son los costos del negocio… y no tienen por qué estar a la vista de todo el que cotiza"). Tres bloques: **Costeo** (5 ítems + costos fijos y variables), **Pricing** (costos, mano de obra, markup, comisiones, IVA, total), **Flujo de caja** (cobros, pagos, ganancia final, margen, USD/watt). Campo en blanco = valor de lista (placeholder lo muestra); campo pisado queda resaltado con flecha para volver; botón de reset global. Los ajustes viven en `data.costos` del borrador, son **por cotización**, autosave, y viajan en el snapshot |
| **Cotizador B2B: propuestas a empresas** | Por qué existe (el documento residencial tutea y menciona IRPF; no hay dónde poner razón social ni RUT; y la comisión fija no premiaba negociar). Los dos botones y los borradores separados. "Datos de la empresa" (razón social y RUT obligatorios para publicar). **La comisión variable** con la fórmula. El documento (partials namespaceados `EMPRESA/carta`, helper `{{t …}}`, sin afirmar tasa de IRPF: *"con los descuentos impositivos que correspondan según la situación fiscal de la empresa"* — *"Es una decisión consciente, no un olvido"*). **La tapa** (cae a la residencial si no hay B2B; imprime razón social; `acomodarTexto()`: *"dejarlo → encogerlo un poco → partirlo en dos líneas → recortarlo con '…'. Recortar es el último recurso"*). **Tabla de permisos** |
| **Comisión del asesor: cómo se registra al ganar** | Todo lo del §6 de este informe |
| **Qué falta cubrir en este capítulo** | Ver abajo |
| **Plantilla** + **Mientras tanto** | La estructura común y las fuentes a consultar |

**"Qué falta cubrir en este capítulo", textual** — es prácticamente el índice de lo que hay que escribir:
> - El pipeline de 7 etapas y qué significa cada una
> - Reclamos: el contador transversal y su diferencia con la etapa RECLAMADO
> - Propuestas v2: borrador, cálculo, viabilidad, publicación y versionado (los defaults del cotizador y el saludo ya están documentados arriba)
> - Propuestas v1 (generador viejo por Excel) y la lista unificada
> - Conversión de lead a proyecto: precondiciones y qué se copia
> - Comisiones del asesor: el pago y el circuito en Finanzas (el congelamiento al ganar ya está documentado arriba)
> - Adjuntos, fotos y videos de la visita comercial

**"Mientras tanto", textual** (buena advertencia para copiar al manual nuevo):
> *"Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad sobre cómo funciona hoy**: El código, que es lo único que no miente. `CHANGELOG.md` para saber qué cambió y cuándo. `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede contradecir a la implementación. `docs/pendientes/` para saber qué falta."*

---

## 8 · Permisos del rol `ASESOR_COMERCIAL`

Matriz real: `/Users/nicolasmachin/Dev/voltia-pm/server/prisma/seed.ts` → `seedPermissions()`, con esta advertencia: *"Sincronizada con la matriz REAL de producción (137 filas de permisos). No se agregan ni quitan permisos respecto de prod."* La tabla `roles` es **dinámica** (no un enum) y se ajusta desde **Admin → Permisos**, así que esto es el punto de partida, no necesariamente lo que hay hoy en prod.

Rol: `{ name: "ASESOR_COMERCIAL", label: "Asesor comercial" }`. Usuario semilla: `comercial@voltiapm.com`.

| Módulo | Acciones | Qué significa en la práctica |
|---|---|---|
| **VENTAS** | `VIEW, CREATE, EDIT, COMMENT` | Todo el pipeline: crear leads, editarlos, mover etapas, registrar reclamos (`EDIT`), armar y publicar propuestas (`CREATE`), convertir a proyecto (`CREATE`), comentar. **NO tiene `DELETE`** → no puede borrar leads ni videos de la visita. **NO tiene `ACCESS_MEMORIA` ni `DEBUG_CALCULADORA`** (solo ADMIN) |
| **ONBOARDING** | `VIEW, CREATE, EDIT, DELETE, COMPLETE, COMMENT` | El set más completo que tiene. Es "su" etapa del proyecto: completa las 10 subetapas y sus checklists |
| **INGENIERIA** | `VIEW` | Solo mira |
| **OPERACIONES** | `VIEW` | Solo mira. **No puede confirmar fechas de obra** (`PATCH /calendar/:id/confirm` pide `OPERACIONES:EDIT`) ni crear visitas técnicas con IA (pide `OPERACIONES:EDIT`) |
| **HABILITACION** | `VIEW` | Solo mira |
| **POSTVENTA** | `VIEW` | Solo mira |
| **TRAMITES_UTE** | `VIEW` | Solo mira. Comentario en `server/src/routes/ute-suministro.routes.ts`: *"ASESOR_COMERCIAL edita Onboarding pero solo mira Trámites UTE"* |
| **EXPERIENCIA_CLIENTES** | `VIEW, CREATE, EDIT, DELETE` | Ficha del cliente / Generadores: listado, ficha, export, bitácora, **registrar interacciones**. De `server/src/routes/clientes.routes.ts`: *"VIEW (POSTVENTA, ADMIN, ASESOR_COMERCIAL): listado, ficha, export, bitácora / CREATE (…): registrar interacción"*. Solo puede modificar **sus propias** interacciones (`canModifyInteraction` en `services/clientes/ownership.ts`) |
| **COMISIONES** | `VIEW` | Entra a `/comisiones` y ve **solo las suyas** |
| **TRASPASOS** | `VIEW, CONFIRM` | Bandeja de traspasos + confirmar el acuse (T1 al cerrar Onboarding) |
| **TICKETS** | `VIEW, CREATE, EDIT` | Abre y gestiona reclamos de clientes |
| **ENCUESTAS** | `VIEW` | Panel de solo lectura (las genera el sistema, las responde el cliente en el portal) |

**Módulos que NO tiene** (verificado por ausencia en el seed): `METRICAS`, `CONFIGURACION`, `USUARIOS`, `FINANZAS`, `STOCK`, `INFORMES`, `PORTAL_CLIENTE`, `PAGOS_INSTALADOR`. Implicancias concretas para el manual:
- **No entra a Métricas** → su única vista de números es el panel "Ventas · Embudo & SLA" del Dashboard (que es `VENTAS:VIEW`) y `/comisiones`.
- **No entra a Finanzas** → para saber si entró la seña le pregunta a Finanzas (lo dice el cap. 3).
- **No entra a Administración** → no puede cambiar los plazos del embudo ni los defaults del cotizador.
- `CAPACITACION:VIEW` no está en `seed.ts` pero se otorga aparte a todos los roles internos: `server/scripts/seed-capacitacion.ts` (*"`CAPACITACION:VIEW` para todos los roles internos (todos menos CLIENT); `CAPACITACION:EDIT` para ADMIN"*), y la sección "Ventas" está asignada a `["ASESOR_COMERCIAL", "GERENTE_COMERCIAL"]` (`server/src/services/capacitacion/seed-capacitacion.ts`).

**`GERENTE_COMERCIAL`**: rol aparte que **arranca como copia exacta** de ASESOR_COMERCIAL (`server/scripts/seed-nuevos-roles.ts`, `GERENTE_BASE`: `{ name: "GERENTE_COMERCIAL", label: "Gerente Comercial", base: "ASESOR_COMERCIAL" }`; *"Cada rol GERENTE_* arranca como COPIA de los permisos actuales de su rol base (leídos de la DB, así respeta la matriz real de prod)"*). La diferencia funcional **no está en los permisos sino hardcodeada en el código**: `puedeVerTodoElEmbudo(role)` → `ADMIN || GERENTE_COMERCIAL`. Eso es lo que decide si ves todo el embudo o solo tus leads, y si la tarjeta "Por vendedor" trae datos.

Otro detalle de visibilidad: en `Sales.tsx`, `const canListUsers = user?.role === "ADMIN"` → **el filtro "Todos los vendedores" y el select de "Asignado a" con todos los usuarios solo los ve ADMIN**. Un asesor solo puede asignarse a sí mismo.

**Cache de permisos:** el middleware cachea 5 minutos en memoria; tras un grant hay que reiniciar el server. Lo repiten todos los scripts de grant.

---

## 9 · Lo que el sistema NO hace en ventas (limitaciones declaradas)

Ordenado por cuánto le importa a un asesor.

### Alertas y seguimiento

1. **No hay ninguna notificación ni mail por un lead vencido, trabado o sin actividad.** Confirmado por ausencia: ningún valor de `NotificationType` es de ventas, y `server/src/services/digest/` no consulta `salesLead`. El semáforo del embudo solo existe si entrás al Dashboard o le preguntás a `mi_dia`. Esto es exactamente el eje que el propio backlog le asigna a este manual (`docs/pendientes/ESTADO-GENERAL.md`): *"Manual de Ventas para el equipo comercial | ⬜ | `manual-de-ventas.md`. Como el de Posventa pero del rol comercial; después, el resto de las áreas. **Eje: los leads que se enfrían sin que nadie los toque.**"*
2. **No hay cadencia de contacto configurable para leads.** `RecorridoCadencia` (E1/E2/E3) es de proyectos/Generadores. Para leads el único umbral es `DIAS_TRABADO = 14` **hardcodeado** en `mi-dia.ts` y visible solo por el chat.
3. **El reporte semanal no le llega al asesor**: va a `REPORTE_SEMANAL_EMAIL || "nicolas@voltia.com.uy"`.
4. **El SLA del embudo no contempla feriados** (dice el propio texto de Admin: *"No contempla feriados"*). Solo lunes a viernes.
5. **El asesor no ve la tarjeta "Por vendedor"**: el endpoint le devuelve `{ rows: [] }` si no es ADMIN/GERENTE_COMERCIAL. No hay comparativa entre asesores para el asesor.

### Reclamos

6. **No hay forma de resolver, cerrar ni bajar el contador de reclamos.** Solo incrementa. No existe endpoint de decremento.
7. **La diferencia entre la etapa `RECLAMADO` y el contador no está documentada** — listado explícitamente en "Qué falta cubrir" de `docs/manual/02-ventas.md`.

### Conversión y propuestas

8. **La conversión a proyecto no arma el sistema solar.** Textual: *"**La conversión a proyecto sigue siendo manual.** Nada crea hoy el `SolarSystem` del proyecto desde la propuesta, así que la cantidad se vuelve a cargar a mano al abrir la obra. El modelo del proyecto ya tiene `inverterQuantity`, así que el día que se automatice, encaja."*
9. **El cotizador multi-instalación tiene límites conocidos**: *"Todos los inversores son iguales… Cotizar inversores de potencias distintas sería un cambio de modelo de datos."* · *"La mano de obra no se duplica"* · *"El medidor queda en 1, aunque dos instalaciones con dos conexiones a UTE llevarían dos. No se multiplica porque no se pidió."* · *"El documento no separa las dos instalaciones."*
10. **Convive la propuesta v1 (Excel) con la v2**, sin fecha de corte: *"Propuesta v2 conviviendo con la vieja | 🟡 | … v1 sin descartar/restaurar ni exportar Excel. **Poner fecha de corte.**"* (`docs/pendientes/ESTADO-GENERAL.md`)
11. **La familia propuestas/versiones no tiene soft-delete**: *"Soft-deletes no propagados | ⬜ | 26/79 modelos con `deletedAt`. Familia propuestas/versiones sin soft-delete."*
12. **El saludo de la carta se corrige tocando código**, no desde la app: *"Un nombre extranjero fuera de las listas y terminado en consonante (Kevin ya está; Bjorn no) sale como 'Estimado/a'. Se corrige agregándolo a la lista de `salutation.ts`, no desde la interfaz."* Y: *"Un nombre con apellido primero ('Vanoli Daniel') saluda al apellido: la función siempre toma la primera palabra."*
13. **El documento B2B no afirma ninguna tasa de IRPF** a propósito, porque *"no está verificado qué régimen aplica"*.

### Historial y trazabilidad

14. **Los comentarios del lead no se ven en el proyecto convertido.** `docs/pendientes/ESTADO-GENERAL.md`: *"Heredar comentarios/interacciones del lead en el proyecto convertido | 🟡 | El **Historial de la ficha del cliente** (`getClienteTimeline`) ya une comentarios + actividades del lead de origen… **Falta** que la vista de comentarios normal del proyecto (`/projects/:id`) también los muestre, o re-vincular `Comment.leadId` al proyecto al convertir. Decidir enfoque."*
15. **El "Historial de actividad" del panel del lead muestra el `action` crudo** (`stage_changed`, `reclamo_added`, `lead_created`, `lead_converted`), sin traducir a español. Verificado en `Sales.tsx`: `<p …>{activity.action}</p>`.
16. **El chip "Auto" de las fechas en realidad dice "tiene valor"**, no "lo puso el sistema" (`auto: !!lead.<campo>`). No distingue automático de manual.

### Estado / calidad

17. **No hay responsable de ventas**, dicho por el propio manual: *"**No tenemos un responsable de ventas.** Cada proyecto tiene su asesor asignado."*
18. **Ventas agenda la obra pero no la confirma** (`OPERACIONES:EDIT`), y el checklist "Evento de calendario marcado como confirmado" *"sigue siendo recordatorio manual; decisión: no automatizar"* (`docs/pendientes/estado-traspasos.md`).
19. **Pruebas pendientes de comisiones y conversión** sin correr: `docs/pendientes/pruebas-pendientes.md` §"Tanda 2 — Comisiones del asesor" y §"Tanda 3 — Lead → proyecto → ficha" (todos los checkboxes en `[ ]`). Incluye una pregunta de negocio abierta: *"Confirmar si el movimiento de comisión debe datarse en el **mes de la venta** (hoy) o en el **mes de pago**."*
20. **Los gates admin-only del cotizador** están hardcodeados por rol, no son permisos: `docs/pendientes/gates-hardcodeados-por-rol.md` §C — guardar defaults/tapa/overlay, preview admin, descargar versión descartada, **regenerar PDF de una versión** (*"Feature-gate real; se dejó **fuera de alcance** explícito"*).

---

## Archivos clave (rutas absolutas, para volver a consultar)

**Modelo de datos**
- `/Users/nicolasmachin/Dev/voltia-pm/server/prisma/schema.prisma` — `enum SalesStage`, `enum SalesFunnelStep`, `model SalesLead`, `model SalesActivity`, `model SalesStageSla`, `model StageSla`, `model RecorridoCadencia`, `model Commission`, `model ProposalGeneration`, `model TechnicalVisit` / `VisitInput` / `VisitReport`, `enum Module`, `enum Action`, `enum NotificationType`
- `/Users/nicolasmachin/Dev/voltia-pm/server/prisma/seed.ts` — matriz de permisos (`seedPermissions`) y catálogo de roles
- `/Users/nicolasmachin/Dev/voltia-pm/server/prisma/scripts/seed-sales-stage-slas.ts` · `seed-stage-slas.ts` · `seed-recorrido-cadencias.ts`
- `/Users/nicolasmachin/Dev/voltia-pm/server/scripts/seed-nuevos-roles.ts`

**Backend**
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/sales/leads.service.ts` — `crearLead`, `editarLead`, `moverEtapaLead`, `comentarLead`, `generateLeadCode`, `buildLeadSearchFilter`, `FECHA_LABEL`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/sales/sales.service.ts` — `assertAllowedLeadFile`, `saveLeadAttachment`, `copyLeadAttachmentsToProject`, `moveLeadMediaToProject`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/sales-panel.service.ts` — `FUNNEL_STEPS`, `STEP_LABEL`, `getSalesSlaMap`, `currentStep`, `computeStepCountdown`, `puedeVerTodoElEmbudo`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/proposal/promote-lead.service.ts` — `getFirstProposalAt`, `autoPromoteLeadToCotizado`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/commission/commission.service.ts` — `congelarComisionAlGanar`, `confirmCommission`, `readComisionFromSnapshot`, `firstDayOfNextMonth`, `createManualCommission`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/pipeline-definitions.ts` — `PIPELINE_DEFINITIONS` (las 10 subetapas de ONBOARDING)
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/metricas/indicadores.service.ts` — `ventasGanadas`, `montoDeVenta`, `visitasRealizadas`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/services/reporteSemanal/reporte-semanal.job.ts`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/routes/api.routes.ts` — `POST /leads/:id/reclamo`, `POST /leads/:id/convert`, `GET /leads/:id/conversion-defaults`, `GET /ventas/risk-summary|leads-trabados|embudo-por-tramo|por-vendedor`, `GET/PUT /admin/sales-stage-slas`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/routes/mcp/tools/mi-dia.ts` · `minuta.ts` · `ventas.ts` · `propuesta.ts` · `operaciones.ts`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/routes/mcp/format.ts` — `ETAPA_LABEL`
- `/Users/nicolasmachin/Dev/voltia-pm/server/src/routes/visitas.routes.ts`

**Frontend**
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/pages/Sales.tsx` — página + panel del lead
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/types/leads.types.ts` — `STAGE_LABELS`, `STAGE_COLORS`, `KANBAN_COLUMNS`, `LeadDetail`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/components/sales/` — `PriorityView`, `LeadCard`, `LeadRow`, `LeadsListView`, `StageSelect`, `SalesViewToggle`, `LeadAttachments`, `LeadVisitaMedia`, `LeadTasks`, `LeadProposalsList`, `LeadToProjectModal`, `MarkAsWonModal`, `LostReasonModal`, `CommissionCaptureModal`, `ProposalPreviewModal`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/components/proposals-v2/` — `ProposalBuilderModal`, `ProposalForm`, `ViabilityIndicators`, `CosteoDrawer`, `CosteoPanel`, `ComisionB2BPanel`, `PublishModal`, `VersionsList`, `CalculatorDebugDrawer`, `AutosaveIndicator`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/components/dashboard/SalesPanel.tsx`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/pages/ComisionesAsesor.tsx`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/pages/admin/SalesStageSlasPage.tsx` · `StageSlasPage.tsx` · `RecorridoCadenciasPage.tsx`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/api/leads.api.ts` · `salesStageSla.api.ts` · `ventasPanel.api.ts` · `comisiones.api.ts`
- `/Users/nicolasmachin/Dev/voltia-pm/client/src/constants/stages.ts` — **es del pipeline de PROYECTOS, no de ventas**

**Docs**
- `/Users/nicolasmachin/Dev/voltia-pm/docs/Manual-de-Trabajo-Voltia.md` (855 líneas; cap. 3 = "Asesor comercial")
- `/Users/nicolasmachin/Dev/voltia-pm/docs/Manual-Posventa-Experiencia-Solar.md` (987 líneas; el formato a imitar)
- `/Users/nicolasmachin/Dev/voltia-pm/docs/manual/02-ventas.md` (642 líneas; capítulo técnico parcial)
- `/Users/nicolasmachin/Dev/voltia-pm/docs/pendientes/ESTADO-GENERAL.md` · `estado-proposals-v2.md` · `pruebas-pendientes.md` · `gates-hardcodeados-por-rol.md` · `estado-traspasos.md`
- `/Users/nicolasmachin/Dev/voltia-pm/docs/features/proposals-v2/` — `SPEC.md`, `FASE_E/F/G_SPEC.md`, `REWORK_MODAL_SPEC.md`, `DEBUG_CALCULADORA_SPEC.md`

---

## Tres cosas que NO encontré (no las supongas)

1. **Etiquetas de `SalesStage` en `client/src/constants/`**: no existen. Ese directorio solo tiene `stages.ts`, que es del pipeline de proyectos. Las etiquetas de ventas están en `client/src/types/leads.types.ts`.
2. **SLA / cadencia / alerta configurable sobre leads sin actividad**: no existe nada configurable. Solo `daysInStage` (informativo, calculado desde la última `SalesActivity`) y el `DIAS_TRABADO = 14` hardcodeado del chat.
3. **El repo del bot de minutas de Telegram**: no está acá. `docs/manual/02-ventas.md` lo llama *"`minutas-bot`, repo aparte"*. Todo lo que sé de él es lo que ese doc describe (los dos PATCH contra la API) y cómo el backend reconoce sus adjuntos (`tipo === "MINUTA_RELEVAMIENTO"` / `toolSource === "minuta"`). No pude verificar su código.
