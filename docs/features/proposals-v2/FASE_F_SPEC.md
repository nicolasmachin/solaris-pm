# Propuestas v2 — Fase F — Especificación Técnica

> Constructor UI del asesor: página dedicada con formulario + preview en vivo,
> autosave, publicación con validación, lista de versiones y edición del
> jobTitle desde Mi cuenta. Spec madre: `docs/features/proposals-v2/SPEC.md`.
> Fase previa: E (backend de drafts y versiones). Versión: 1.

## 1. Contexto y objetivo

Fase E dejó el backend de drafts y versiones listo pero sin UI. Fase F entrega
el **constructor de propuestas** que usa el asesor para armar, previsualizar y
publicar propuestas.

Objetivos: entrar a un lead → "Armar propuesta" → armar completa sin salir de la
app; preview del PDF real en vivo; autosave; publicación con validación previa;
lista de versiones con descarga/descarte/restauración; edición del `jobTitle`
del asesor para la firma de la carta.

**No** incluye: envío al cliente desde la app, panel del lead a dos columnas
(post-G), catálogo administrable de paneles/inversores más allá de
`ProposalDefaults`, métricas.

## 2. Modelo de datos (cambios respecto a E)

### 2.1 `User.jobTitle`

Nuevo campo opcional `jobTitle String?` en `User`. Si falta, el PDF hace fallback
a `"Asesor Comercial"`. `phone` ya existe. Edición solo por el propio usuario
desde Mi cuenta (admin no edita el de otros). Migración `add_user_job_title`, sin
backfill (queda null).

### 2.2 `draftDataSchema` — evolución

En E quedó con los inputs mínimos. En F crece para reflejar el formulario:
cliente editable inline, datos técnicos (potencia, paneles, inversor, tipo de
montaje), cotización A, ítems adicionales (Variante B), financiación (inputs para
la fórmula, no texto libre), notas del asesor. La estructura exacta se define en
el PASO 0. Toda validación sigue en Zod en el borde.

### 2.3 `snapshot`

Sigue igual estructuralmente (data + defaults + coverOverlay + coverPdfAttachmentId
+ calc + templateVersion + renderedAt). Fase F agrega el `jobTitle`/advisor del
asesor que publica para que el regenerate reproduzca la firma.

## 3. UI / Componentes

### 3.1 Ruta
`/leads/:leadId/propuesta` — página dedicada, no modal. Protegida por
`authorize(Module.VENTAS, Action.EDIT)`. Sin permiso o lead inexistente →
redirect a leads con mensaje.

### 3.2 Layout
Dos columnas (alto completo menos header global): sub-header sticky (volver,
"Propuesta · {clientName}", estado autosave, botón Publicar), form scrolleable
izquierda (6 secciones + lista de versiones al pie), preview PDF fijo derecha
(iframe 45–50% del viewport en desktop).

### 3.3 Form (6 secciones scrolleables, `<h2>` sticky, ancla `id=seccion-*`)
1. **Cliente** — nombre, ciudad. Auto-cargado del lead la primera vez. Editable
   inline. NO propaga al lead.
2. **Datos técnicos** — potencia, cantidad/modelo de paneles, cantidad/modelo de
   inversor, tipo de montaje. Defaults de `ProposalDefaults`, override según
   `asesorCanOverride`.
3. **Cotización base (Variante A)** — precio, condiciones. Defaults, editable si
   el flag lo permite.
4. **Ítems adicionales (Variante B)** — opcional. El asesor decide si activa B.
   Vacía → no aparecen los labels de variante (fix post-E).
5. **Financiación** — inputs para calcular cuotas (cantidad de cuotas / params
   BBVA). El texto es siempre informativo; el asesor NO elige plan.
6. **Notas del asesor** — textarea.

Debajo: **Lista de versiones**.

### 3.4 Preview (columna derecha)
`<iframe>` a un endpoint que renderiza el PDF del borrador actual (ver 4.3).
Spinner semi-transparente al regenerar. Placeholder "Completá los campos
obligatorios para ver el preview" si faltan mínimos. Toolbar mínimo ("Preview").

### 3.5 Botón "Publicar versión"
En el sub-header. Deshabilitado si faltan obligatorios. Click → modal: warning si
no hay cambios ("crea V{n+1} con fecha de hoy, no reescribe V{n}"), confirmación
normal si hay cambios. Confirmar → POST `/leads/:leadId/versions`.

### 3.6 Responsive
Desktop ≥1200 dos columnas; tablet 768–1199 preview 35%; mobile <768 una columna,
preview colapsable. Higiene, no target primario.

### 3.7 Estados vacíos y errores
Lead sin borrador → form con defaults (cliente del lead + singleton); el primer
autosave crea el draft (upsert). Error autosave → "Error, reintentando" +
publicar deshabilitado. Error al publicar → modal con detalle, draft intacto.
Sin permiso → redirect.

## 4. API REST (cambios / agregados)

### 4.1 Reuso de endpoints de Fase E
`GET/PUT /leads/:leadId/draft`, `POST/GET /leads/:leadId/versions`,
`GET /versions/:id/pdf/{full,summary}`, `DELETE /versions/:id`,
`POST /versions/:id/restore`.

### 4.2 jobTitle
- `PATCH /api/users/me` — autenticado. Body `{ jobTitle?, phone? }` (Zod). Solo
  el propio usuario. 200 con user actualizado. Auditoría `user_profile_updated`.
- `GET /api/users/me` — si no existe, se agrega; devuelve id, name, email,
  jobTitle, phone, roles. Si existe equivalente, se reusa.

### 4.3 Preview del borrador (endpoint nuevo)
`GET /api/proposals-v2/leads/:leadId/draft/preview.pdf` — `VENTAS:VIEW`. Genera el
PDF full del borrador al vuelo, sin persistir (pipeline Fase C+D,
`full-with-cover.service`). Content-Type `application/pdf`, Content-Disposition
`inline`. 400 si no valida, 404 si no hay draft. No cachea. El debounce del
cliente (2.5s) evita saturar; caché por hash queda fuera de alcance.

### 4.4 Nada más en backend.

## 5. Autosave y preview con debounce

**Autosave:** cambio → debounce 1.5s → PUT draft. Estado en sub-header
("Guardando…", "Guardado hace Xs", "Error, reintentando" con retry exponencial
1/2/4s max 30s; tras 3 fallos "Error, no se pudo guardar" + reintento manual).
Concurrencia: nunca solapa; 1 en curso + 1 pendiente con el estado más reciente.

**Preview:** mismo trigger, debounce 2.5s. Solo regenera si el último autosave fue
exitoso. Overlay "Actualizando preview…". Error → overlay con detalle, el resto
sigue.

## 6. Validación de campos obligatorios

Lista exacta contra `draftDataSchema` (PASO 0). Referencia inicial: Cliente
(nombre, ciudad); Técnicos (potencia, cantidad de paneles, modelo de paneles,
modelo de inversor, tipo de montaje); Cotización A (precio, plazo de entrega);
Financiación (params del cálculo BBVA). El resto opcional.

Schema Zod del backend = fuente de verdad; el front valida con el mismo. Con
faltantes: botón deshabilitado + tooltip "Faltan N campos", panel agrupado por
sección, cada faltante linkea al campo (scroll+focus), highlight rojo suave. El
backend revalida en el POST (doble red).

## 7. Publicación

Click → modal (título "Publicar versión V{n+1}"; warning si sin cambios) →
confirmar → POST `/leads/:leadId/versions` → spinner, UI bloqueada → éxito:
cierra, refresca lista, toast; error: modal con detalle, draft intacto.
Detección "sin cambios": deep equal del `data` del draft vs `snapshot.data` de la
última versión (ayudín de UX, no del servidor).

## 8. Lista de versiones

Debajo del form. Fila: número grande (V3/V2/V1), fecha relativa, autor, badge de
status (PUBLISHED verde / DISCARDED gris tachado), acciones inline (descargar
full, descargar summary, descartar si PUBLISHED, restaurar si DISCARDED). Orden
`versionNumber DESC`, sin paginación. Toggle "Ver descartadas" (default oculta).
Descarga vía endpoints de E (Content-Disposition attachment, nombre
`propuesta-{clientLastName}-v{n}.pdf`). Descartar → modal con razón opcional →
DELETE → refetch. Restaurar → confirmación mínima → POST /restore → refetch.

## 9. jobTitle en Mi cuenta

Pantalla existente `/mi-cuenta` (o equivalente). Campo `jobTitle` (label "Cargo
(aparece en la firma de las propuestas)", texto libre opcional), guardado según
el patrón de esa pantalla, PATCH `/api/users/me`. Si no existe, se crea mínima con
jobTitle + phone. En el partial de la carta la firma usa
`${user.jobTitle ?? "Asesor Comercial"}`.

## 10. Casos de prueba

Unit (client): 1) debounce autosave no dispara >1 save; 2) debounce preview; 3)
preview no dispara si el último save falló; 4) estado autosave; 5) validación
bloquea publicar; 6) deep equal draft vs snapshot ("sin cambios").

E2E manual (Nicolás): 1) lead nuevo → completar → preview → publicar V1 → aparece;
2) editar → publicar V2 arriba de V1; 3) publicar V3 sin cambios → warning + fecha
actual; 4) descartar V2 → se oculta → toggle la muestra → restaurar; 5) descargar
full/summary con nombre correcto; 6) faltar un obligatorio → publicar deshabilitado
+ tooltip + link al campo; 7) editar jobTitle → publicar → firma cambia; 8) perder
conexión → autosave falla → indicador error → recupera.

## 11. Fuera de alcance

Envío al cliente (post-G); panel del lead a dos columnas (post-G); catálogo
administrable (post-G); métricas (post-G); comparación entre versiones (post-G);
edición del jobTitle por admin; caché del preview por hash (solo si satura);
historial de diffs del draft; migración del ProposalGeneration viejo (coexisten).

## 12. Referencias
Fase E (v2): `docs/features/proposals-v2/FASE_E_SPEC.md`. Spec madre:
`docs/features/proposals-v2/SPEC.md`. Fórmula BBVA a extraer del Excel: pendiente
suelto que impacta la sección Financiación.
