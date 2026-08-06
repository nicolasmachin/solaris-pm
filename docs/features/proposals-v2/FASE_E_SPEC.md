# Propuestas v2 — Fase E — Especificación Técnica (v2)

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> Drafts + versiones inmutables + persistencia de PDFs. Backend puro,
> sin UI nueva. Spec madre: `docs/features/proposals-v2/SPEC.md`. Versión: 2.
>
> **Cambios respecto a v1** (tras PASO 0):
> - Pasan de **`projectId` a `leadId`**. La propuesta comercial es la
>   herramienta que convierte un lead en proyecto; se genera durante la
>   fase de venta, cuando todavía no existe proyecto.
> - Scaffold vacío existente (`ProposalDraft` / `ProposalVersion` de la
>   migración 20260624234451) se elimina en la misma migración de 1.1.
> - Convención de permisos del repo: `CREATE` para POST de recursos hijos,
>   `DELETE` para DELETE, `EDIT` para PUT, `VIEW` para lecturas.
> - Estructura de archivos sigue la convención actual del repo
>   (`server/src/services/proposal/` + `server/src/routes/`).
> - `AuditAction` gana 5 valores nuevos en la misma migración.
> - Se extrae el combo tapa+overlay+concat de Fase D a un service reusable
>   (commit de refactor previo al service de versiones).
> - Transacción de publicación usa `prisma.$transaction` interactiva con
>   retry ante `P2002`.

## 1. Contexto y objetivo

Hoy Propuestas v2 puede generar PDFs al vuelo (Fase C+D) pero no persiste
nada. Cada llamada a `/generate-pdf` es efímera.

Fase E introduce dos entidades: **borradores** (mutables, uno por lead) y
**versiones publicadas** (inmutables, numeradas por lead). Al publicar una
versión se toma un **snapshot completo** de los datos que la generaron y se
persisten los dos PDFs (completo y resumen) en disco.

**Por qué lead y no proyecto:** la propuesta comercial es la herramienta que
se le manda al cliente durante la venta. El proyecto se crea cuando el
cliente firma. Colgar las propuestas de `projectId` impediría generarlas
antes de cerrar la venta, que es lo contrario del uso real. El sistema ya
venía coherente con esto: el scaffold vacío de Fase A, el `ProposalGeneration`
viejo y `/proposals/generate` son todos lead-based.

**Coexistencia con lo viejo:** `ProposalGeneration` y `/proposals/generate`
no se tocan en Fase E. Coexisten con lo nuevo. Post Fase G se decide si se
migra o deprecia lo viejo.

Objetivos: trazabilidad de qué se entregó al cliente; re-descargar el mismo
PDF; re-generar desde snapshot si el archivo se pierde (admin explícito);
preparar la UI de Fase F.

**No** incluye UI, marca de "enviada", ni preview persistente del borrador.

## 2. Modelo de datos

### 2.1 Enums

```prisma
enum ProposalV2VersionStatus {
  PUBLISHED
  DISCARDED   // soft-delete
}
```

Además, 5 valores nuevos en `AuditAction` (ver sección 7).

### 2.2 Scaffold viejo se elimina

En la misma migración se dropean `ProposalDraft` y `ProposalVersion` (vacíos,
sin uso). 0 filas, sin historia que preservar.

### 2.3 `ProposalV2Draft`

Un borrador por lead. Mutable. Sin número. Sin PDF persistido.

```prisma
model ProposalV2Draft {
  id          String    @id @default(cuid())
  leadId      String    @unique
  lead        SalesLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  data        Json
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdById String
  createdBy   User      @relation("ProposalV2DraftCreatedBy", fields: [createdById], references: [id])
  updatedById String
  updatedBy   User      @relation("ProposalV2DraftUpdatedBy", fields: [updatedById], references: [id])
  @@index([leadId])
}
```

- `leadId @unique`: máximo un borrador por lead.
- `data` como `Json`; validación fuerte con Zod en el borde.
- Sin `status`: siempre existe y es editable. Cascade al borrar el lead.

### 2.4 `ProposalV2Version`

Inmutable en contenido. Numerada por lead. Soft-deleteable.

```prisma
model ProposalV2Version {
  id            String                  @id @default(cuid())
  leadId        String
  lead          SalesLead               @relation(fields: [leadId], references: [id], onDelete: Restrict)
  versionNumber Int
  status        ProposalV2VersionStatus @default(PUBLISHED)
  snapshot      Json
  fullPdfPath    String
  summaryPdfPath String
  publishedAt   DateTime @default(now())
  publishedById String
  publishedBy   User     @relation("ProposalV2VersionPublishedBy", fields: [publishedById], references: [id])
  discardedAt   DateTime?
  discardedById String?
  discardedBy   User?     @relation("ProposalV2VersionDiscardedBy", fields: [discardedById], references: [id])
  discardReason String?
  @@unique([leadId, versionNumber])
  @@index([leadId, status])
}
```

- `@@unique([leadId, versionNumber])`: no puede haber dos V1 en el mismo lead.
  El service reintenta ante `P2002` si hay carrera.
- Contenido inmutable: `snapshot`, paths, `versionNumber` no se editan; los
  updates se limitan a los campos de soft-delete.
- `onDelete: Restrict` en `lead`: borrar un lead con versiones lo rechaza. El
  soft-delete del lead (`deletedAt`, un UPDATE) no dispara el Restrict.

### 2.5 Numeración: `MAX + 1` con retry

`SELECT MAX(versionNumber) + 1` dentro de la transacción. Si dos publish
concurrentes chocan, el unique rechaza una con `P2002` y el service reintenta
hasta 3 veces. Sin contador en `SalesLead`.

### 2.6 Shape del `data` y del `snapshot`

`data` del draft: inputs que consume la calculadora + template. Zod
`draftDataSchema` en `server/src/services/proposal/schemas/draft.schema.ts`,
`.strict()`.

`snapshot`: superconjunto del `data` + defaults resueltos + config de tapa al
publicar. Ver sección 6.

## 3. Ciclo de vida

### 3.1 Borrador

```
[no existe] --create--> [existe] --update--> [existe]
[existe] --publish--> [existe con misma data + nueva versión]
[existe] --lead.delete--> [borrado por cascade]
```

Publicar no borra el borrador. Primer `PUT /draft` lo crea (upsert lógico).

### 3.2 Versión

```
[no existe] --publish--> [PUBLISHED] --discard--> [DISCARDED] --restore--> [PUBLISHED]
```

Contenido inmutable en cualquier transición.

### 3.3 Publicar — paso a paso

1. Requiere borrador existente para el lead.
2. Validar `data` con `draftDataSchema` (falla → 400).
3. Resolver `ProposalDefaults` singleton.
4. Correr calculadora de Fase B con `data` + defaults resueltos.
5. Armar el `snapshot` (sección 6).
6. Renderizar los dos PDFs (Fase C+D): full con tapa+overlay si hay; summary
   sin tapa.
7. Transacción interactiva (`prisma.$transaction`):
   a. `versionNumber = MAX + 1` para el lead.
   b. Escribir PDFs a `leads/{leadId}/proposals-v2/{versionId}/…`.
   c. INSERT `ProposalV2Version`.
   d. Auditoría.
8. Si el INSERT falla por `P2002`: borrar los archivos escritos y reintentar
   todo el paso 7 (hasta 3 veces). Cada reintento usa un `versionId` cuid
   nuevo → carpetas no colisionan.
9. Retornar la versión.

Errores no-carrera: falla de disco o de PDF → 500, transacción revertida, sin
archivos parciales. Tras 3 reintentos por `P2002` → 500 con mensaje claro.

### 3.4 Descartar / restaurar

- `DELETE /versions/:id`: `status = DISCARDED` + flags (+`discardReason` del
  body).
- `POST /versions/:id/restore`: `status = PUBLISHED`, limpia flags.

PDFs y snapshot intactos.

## 4. API REST

Prefijo `/api/proposals-v2`. Auth en todos. Permisos: lecturas `VENTAS:VIEW`;
crear versión `VENTAS:CREATE`; editar draft `VENTAS:EDIT`; borrar
`VENTAS:DELETE`; regenerar PDF `VENTAS:EDIT` + gate `ADMIN` en el handler.

### 4.1 Draft

- `GET /leads/:leadId/draft` — `VIEW`. 200 con draft, 404 si no existe.
- `PUT /leads/:leadId/draft` — `EDIT`. Body `{ data }`. Upsert. 200/400.
  Auditoría `proposal_v2_draft_updated`.

### 4.2 Versiones — publicar y listar

- `POST /leads/:leadId/versions` — `CREATE`. Body vacío. Requiere draft.
  201/400/500. Auditoría `proposal_v2_version_published`.
- `GET /leads/:leadId/versions` — `VIEW`. `?includeDiscarded=false`. 200
  `{ versions }` orden `versionNumber DESC`, metadatos livianos.
- `GET /versions/:id` — `VIEW`. 200 con snapshot completo.

### 4.3 Descarga de PDFs

- `GET /versions/:id/pdf/full` — `VIEW`. Streamea `fullPdfPath`.
  `attachment; filename="propuesta-{clientLastName}-v{n}.pdf"`. 404 si
  descartada (admin con `?includeDiscarded=true`); 500 si el archivo no está.
- `GET /versions/:id/pdf/summary` — igual, `resumen-{clientLastName}-v{n}.pdf`.

### 4.4 Descartar y restaurar

- `DELETE /versions/:id` — `DELETE`. Body opcional `{ reason }`. 200.
  Auditoría `proposal_v2_version_discarded`.
- `POST /versions/:id/restore` — `EDIT`. 200. Auditoría
  `proposal_v2_version_restored`.

### 4.5 Regeneración

- `POST /versions/:id/regenerate-pdf` — `EDIT` + gate `ADMIN`. Regenera los
  dos PDFs desde el snapshot y sobrescribe. No crea versión ni toca snapshot.
  200. Auditoría `proposal_v2_version_pdf_regenerated`.

## 5. Storage

Rutas relativas a `STORAGE_PATH` (default `./storage`):

```
leads/{leadId}/proposals-v2/{versionId}/proposal-full.pdf
leads/{leadId}/proposals-v2/{versionId}/proposal-summary.pdf
```

- Dos writes secuenciales; si el segundo falla, el catch borra el primero.
- `mkdir` recursivo de `{versionId}/`.
- No se persisten como `FileAttachment` (archivos internos del módulo).
- Paths relativos para portabilidad. Helper reusa la resolución de
  `getStoredFilePath` para que lectura y escritura compartan base.

## 6. Snapshots y regeneración

```ts
{
  version: 1,
  data: {...},                         // draft.data al momento
  defaults: {...},                     // ProposalDefaults.data resuelto
  coverOverlay: {...},
  coverPdfAttachmentId: "..." | null,
  calc: {...},                         // salida completa de la calculadora
  templateVersion: "fase-C-post-D",
  renderedAt: "2026-06-30T15:20:00Z",
}
```

- Guardamos la salida de la calculadora (no solo inputs): las versiones viejas
  reflejan lo publicado aunque cambie una fórmula.
- Tapa por referencia (`coverPdfAttachmentId`), no el binario. Riesgo si se
  borra el FileAttachment; mitigado porque reemplazar tapa deja la vieja
  huérfana sin borrarla.
- `templateVersion` constante (`"fase-C-post-D"`), se incrementa al cambiar el
  template.

## 7. Auditoría

5 valores nuevos en `AuditAction` (misma migración de 1.1):
`proposal_v2_draft_updated`, `proposal_v2_version_published`,
`proposal_v2_version_discarded`, `proposal_v2_version_restored`,
`proposal_v2_version_pdf_regenerated`. `AuditEntityType.proposal` se reusa.

| Acción | Metadata |
|---|---|
| `proposal_v2_draft_updated` | `leadId`, keys cambiadas |
| `proposal_v2_version_published` | `leadId`, `versionNumber`, `versionId` |
| `proposal_v2_version_discarded` | `versionId`, `reason?` |
| `proposal_v2_version_restored` | `versionId` |
| `proposal_v2_version_pdf_regenerated` | `versionId` |

## 8. Casos de prueba

Estrategia: **unit tests `node:test`** para lo aislable (schemas Zod, armado
del snapshot, filename, numeración extraíble) + **script e2e no commiteado**
para lo que depende de BD/disco. La race (caso 6) va en el e2e con dos publish
concurrentes.

Casos: 1) draft crear/actualizar/inválido; 2) unique por lead; 3) publish
happy path V1→V2 con archivos; 4) publish sin draft → 400; 5) publish data
inválido → 400; 6) race de versionNumber; 7) falla de disco (sin registro ni
parciales); 8) discard/restore + listado con/sin flag; 9) descarga PDF +
404 en descartada; 10) regenerar (admin, snapshot intacto); 11) numeración
independiente por lead.

## 9. Fuera de alcance

UI (F); marca de "enviada"; preview persistente del borrador; migración del
`ProposalGeneration` viejo (post-G); protección de la tapa contra borrado;
copia del binario de tapa en el snapshot; backup específico de PDFs; export
masivo (ZIP); traspaso automático de la propuesta al convertir el lead en
proyecto (F).

## 10. Apéndice

- **Draft**: borrador editable, uno por lead, sin PDF.
- **Version**: publicada, inmutable, con PDF + snapshot. Soft-deleteable.
- **Snapshot**: inputs + defaults + salida de calculadora + metadata.
- **Regenerar**: sobrescribir los PDFs desde el snapshot (solo admin).

Referencias: Fase B `server/src/services/proposal/calculator.ts`; Fase C+D
`server/src/services/proposal/` + `server/src/routes/proposals-v2-*.routes.ts`;
refactor 1.3.5 (extraer combo tapa+overlay+concat del route a service);
storage `env.storagePath` + `getStoredFilePath(rel)`.
