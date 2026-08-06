# Módulo Informes — Especificación Técnica

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

> Sistema de informes con revisión dirigida y visibilidad row-level (autor + destinatarios).
> Ubicación: `client/src/modules/informes/`, `server/src/routes/informes.routes.ts`, `server/src/services/informes/`.
> Spec madre: ninguna (feature nuevo). Versión: 1.0 (draft para validación).

---

## Tabla de contenidos

1. Contexto y objetivo
2. Modelo de datos
3. Lógica / Algoritmo
4. API REST
5. Almacenamiento de adjuntos
6. UI / Componentes (Concepto C)
7. Casos de prueba
8. Fuera de alcance
9. Fasing de implementación
10. Apéndice: glosario y referencias

---

## 1. Contexto y objetivo

Hoy no existe un canal estructurado para que una persona envíe un informe a otra(s) para su aprobación o devolución. El caso disparador: el Gerente de Operaciones sube un informe dirigido a Gerencia, que lo aprueba o lo devuelve con un comentario.

El objetivo es un **módulo privado por relación**, no por cargo. Un usuario ve un informe únicamente si es su **autor** o uno de sus **destinatarios**. No es un módulo "de gerentes": cualquier rol habilitado por la matriz de permisos puede participar, y lo que cambia es *qué filas* ve cada uno.

Patrón conceptual: *submission + directed review*, de una sola pasada (sin reenvío ni ciclo iterativo).

### Decisiones cerradas

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Vínculo a obra/proyecto | Opcional (standalone o atado a `Project`) |
| 2 | Contenido | Texto (escrito en la app) + adjuntos |
| 3 | Flujo | Una sola pasada. Aprobar o Devolver (con comentario). Sin reenvío |
| 4 | UI | Concepto C: documento central + panel de revisión lateral |
| 5 | Visibilidad | Row-level: autor + destinatarios |
| 6 | ADMIN | Ve lista + metadatos de todos; **no** ve cuerpo ni adjuntos salvo que sea destinatario |
| 7 | Creación | Controlada por permiso `Module.INFORMES` + `Action.CREATE` |
| 8 | Destinatarios | Uno o varios; se eligen libremente de la lista de usuarios |
| 9 | Respuesta | Individual por destinatario; definitiva (no se edita una vez dada) |
| 10 | Estado global | Consolidado: `DEVUELTO` gana sobre `PENDIENTE` sobre `APROBADO` |
| 11 | Borrador | Sí: estado `BORRADOR` previo al envío (evita adjunto huérfano). **A confirmar por Nicolás** |
| 12 | Auditoría | `createAuditEntry` en crear, enviar, aprobar, devolver |

---

## 2. Modelo de datos

> Todo el schema vía Prisma migrations. Nada de SQL manual. La estructura exacta de `Module`, `FileAttachment`, `User` y `Project` se confirma en el PASO 0 del prompt antes de escribir la migración.

### 2.1 Enums

```prisma
enum InformeEstado {
  BORRADOR
  PENDIENTE
  APROBADO
  DEVUELTO
}

enum InformeRespuesta {
  PENDIENTE
  APROBADO
  DEVUELTO
}
```

### 2.2 Modelos

```prisma
model Informe {
  id            String        @id @default(cuid())
  titulo        String
  cuerpo        String        // texto del informe (markdown/plano)
  estado        InformeEstado @default(BORRADOR)  // consolidado, materializado

  autorId       String
  autor         User          @relation("InformesCreados", fields: [autorId], references: [id])

  projectId     String?       // vínculo OPCIONAL a obra
  project       Project?      @relation("InformesDeProyecto", fields: [projectId], references: [id])

  destinatarios InformeDestinatario[]
  adjuntos      FileAttachment[]      @relation("InformeAdjuntos")

  enviadoAt     DateTime?     // null mientras BORRADOR
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([autorId])
  @@index([projectId])
  @@index([estado])
}

model InformeDestinatario {
  id           String           @id @default(cuid())
  informeId    String
  informe      Informe          @relation(fields: [informeId], references: [id], onDelete: Cascade)

  usuarioId    String
  usuario      User             @relation("InformesRecibidos", fields: [usuarioId], references: [id])

  respuesta    InformeRespuesta @default(PENDIENTE)
  comentario   String?          // motivo de devolución o nota de aprobación
  respondidoAt DateTime?

  createdAt    DateTime         @default(now())

  @@unique([informeId, usuarioId])  // un usuario no puede ser destinatario dos veces
  @@index([usuarioId])
}
```

### 2.3 Relación con FileAttachment

Los adjuntos los **sube el usuario** (no son generados por herramienta), así que **no** usan el patrón `toolSource/toolEntityId`. Se propone una relación directa:

```prisma
// En el model FileAttachment existente, agregar:
informeId   String?
informe     Informe?  @relation("InformeAdjuntos", fields: [informeId], references: [id], onDelete: Cascade)
```

> PASO 0 debe confirmar la estructura real de `FileAttachment` (campos obligatorios, cómo se crean las filas, helpers de storage) antes de definir esto.

### 2.4 Decisiones de diseño

- **Estado materializado, no derivado.** `Informe.estado` se guarda y se recalcula en cada respuesta. Motivo: necesitamos filtrar e indexar por estado en la lista, y mostrar un único indicador en la sidebar y en el badge de pendientes. Derivarlo en cada query obligaría a traer siempre todos los destinatarios.
- **Cascade en destinatarios y adjuntos.** Si se borra un informe (solo posible en BORRADOR, ver §4), se limpian sus filas hijas.
- **Sin tabla de "hilo de comentarios".** Una sola pasada → una respuesta por destinatario. El campo `comentario` alcanza.

---

## 3. Lógica / Algoritmo

### 3.1 Cálculo del estado consolidado

Se ejecuta tras cada respuesta de destinatario y tras el envío.

```ts
function calcularEstadoConsolidado(
  destinatarios: { respuesta: InformeRespuesta }[]
): Exclude<InformeEstado, 'BORRADOR'> {
  if (destinatarios.some(d => d.respuesta === 'DEVUELTO')) return 'DEVUELTO';
  if (destinatarios.some(d => d.respuesta === 'PENDIENTE')) return 'PENDIENTE';
  return 'APROBADO';
}
```

Regla: **devuelto gana sobre pendiente sobre aprobado**. Un solo destinatario que devuelve marca el informe como `DEVUELTO`, aunque otros hayan aprobado.

### 3.2 Visibilidad (row-level)

Un usuario `u` puede ver un informe `i` si:

```
i.autorId === u.id  OR  i.destinatarios.some(d => d.usuarioId === u.id)
```

Excepción ADMIN: puede listar y ver metadatos de **todos** los informes (cualquier estado salvo BORRADOR ajeno), pero **no** el cuerpo ni los adjuntos salvo que cumpla la condición de arriba.

El BORRADOR solo lo ve su autor (ni destinatarios ni ADMIN).

### 3.3 Transiciones de estado

```
BORRADOR --(autor: Enviar)--> PENDIENTE
PENDIENTE --(recalculo)--> APROBADO | DEVUELTO | PENDIENTE
```

- Solo el **autor** puede pasar de BORRADOR a PENDIENTE (Enviar).
- Tras enviar, el contenido (título, cuerpo, adjuntos, destinatarios) queda **inmutable**.
- Las respuestas de destinatarios son **definitivas**: si ya respondió, se rechaza (409).

---

## 4. API REST

Prefijo `/api/`. Permisos con `authorize(Module.INFORMES, Action.X)` + chequeo row-level adicional en el servicio. Validación con Zod en todos los bordes. TypeScript estricto, sin `any`.

### 4.1 `GET /api/informes`
Lista los informes visibles para el usuario actual (metadatos, sin cuerpo).

- **Auth:** `authorize(INFORMES, VIEW)`
- **Query params:**
  - `box`: `recibidos` | `enviados` | `todos` (default `todos`)
  - `estado`: filtro opcional por `InformeEstado`
  - `projectId`: filtro opcional
  - `search`: texto en título
- **Filtrado row-level** en el servicio. Si el usuario es ADMIN y pide `box=todos`, ve metadatos de todos (sin BORRADOR ajeno).
- **Response:** `Informe[]` con `{ id, titulo, estado, autor{id,nombre}, projectId, project{codigo,nombre}|null, enviadoAt, createdAt, totalDestinatarios, respondidos }`.

### 4.2 `GET /api/informes/:id`
Detalle completo.

- **Auth:** `authorize(INFORMES, VIEW)` + row-level (autor o destinatario).
- ADMIN que no es autor/destinatario → **403** en el detalle (solo ve metadatos vía lista).
- **Response:** `{ ...metadatos, cuerpo, adjuntos[], destinatarios[]{ usuario{id,nombre}, respuesta, comentario, respondidoAt } }`.
- **Errores:** 403 si no tiene visibilidad; 404 si no existe.

### 4.3 `POST /api/informes`
Crea un informe en estado `BORRADOR`.

- **Auth:** `authorize(INFORMES, CREATE)`
- **Body (Zod):**
  ```ts
  {
    titulo: string (1..200),
    cuerpo: string (1..),
    projectId?: string | null,
    destinatariosIds: string[]  // min 1, sin duplicados, distintos del autor
  }
  ```
- **Validaciones:** destinatarios existen y están activos; el autor no puede ser destinatario; si `projectId`, la obra existe.
- **Response:** `Informe` creado (estado BORRADOR).
- **Auditoría:** `createAuditEntry('INFORME_CREADO', ...)`.

### 4.4 `PATCH /api/informes/:id`
Edita un informe **solo en estado BORRADOR**, **solo el autor**.

- **Auth:** `authorize(INFORMES, EDIT)` + autor + estado BORRADOR.
- **Body:** campos parciales de §4.3.
- **Errores:** 409 si no está en BORRADOR; 403 si no es el autor.

### 4.5 `POST /api/informes/:id/adjuntos`
Sube un adjunto. Multipart configurado a `files: 1` → **loop del lado del cliente** para varios.

- **Auth:** autor + estado BORRADOR.
- Guarda vía helper de storage en `${STORAGE_PATH}/informes/{informeId}/` (ver §5).
- **Response:** `FileAttachment` creado.

### 4.6 `DELETE /api/informes/:id/adjuntos/:fileId`
Quita un adjunto en BORRADOR. Auth: autor + BORRADOR.

### 4.7 `POST /api/informes/:id/enviar`
Pasa de BORRADOR a PENDIENTE y lo hace visible a destinatarios.

- **Auth:** autor + estado BORRADOR + al menos 1 destinatario.
- Setea `enviadoAt`, `estado = PENDIENTE`. Contenido queda inmutable.
- **Auditoría:** `createAuditEntry('INFORME_ENVIADO', ...)`.

### 4.8 `POST /api/informes/:id/responder`
El destinatario aprueba o devuelve.

- **Auth:** `authorize(INFORMES, VIEW)` + debe ser destinatario + informe en PENDIENTE/APROBADO/DEVUELTO (no BORRADOR).
- **Body (Zod):**
  ```ts
  {
    respuesta: 'APROBADO' | 'DEVUELTO',
    comentario?: string   // OBLIGATORIO si respuesta === 'DEVUELTO'
  }
  ```
- **Lógica:** si el destinatario ya respondió → **409** (respuesta definitiva). Setea `respuesta`, `comentario`, `respondidoAt`; recalcula `Informe.estado` (§3.1).
- **Auditoría:** `createAuditEntry('INFORME_APROBADO' | 'INFORME_DEVUELTO', ...)`.

### 4.9 `GET /api/informes/:id/adjuntos/:fileId/preview` y `/download`
Descarga/preview autenticada de adjuntos. Usar **`downloadAuthenticated`** del cliente → nunca `<a href>` ni `<img src>` directos. Row-level: solo autor o destinatario.

### 4.10 `DELETE /api/informes/:id`
Borra un informe **solo en BORRADOR**, solo el autor. Tras enviado no se borra (queda registro). Cascade a destinatarios y adjuntos.

### 4.11 `GET /api/informes/pendientes/count`
Contador de informes donde el usuario es destinatario con `respuesta = PENDIENTE`. Para el badge del menú.

---

## 5. Almacenamiento de adjuntos

- Ruta: `${STORAGE_PATH}/informes/{informeId}/` (paralelo a `projects/` e `ingenieria/`).
- Usar los helpers existentes (`saveUploadedFile` / `saveBufferAsAttachment`) — confirmar firma en PASO 0.
- Compresión de imágenes: reusar el pipeline existente (cliente 1600px/JPEG 80% + Sharp thumbnail) si el adjunto es imagen.
- `files: 1` en multipart → subida de a uno desde el cliente.

---

## 6. UI / Componentes (Concepto C)

Layout de tres columnas (responsive: en mobile colapsa a una sola, la lista pasa a scroll horizontal y el panel se ubica debajo del documento).

```
client/src/modules/informes/
  pages/InformesPage.tsx
  components/InformesListSidebar.tsx     // lista lateral + filtro Recibidos/Enviados/Todos + estado
  components/InformeDocument.tsx         // documento central (título, meta, cuerpo, adjuntos)
  components/InformeReviewPanel.tsx      // panel derecho: destinatarios + sus respuestas + acciones
  components/InformeCreateModal.tsx      // alta (título, cuerpo, multi-select destinatarios, obra opcional, adjuntos, Guardar borrador / Enviar)
client/src/hooks/useInformes.ts          // TanStack Query: list, detail, create, send, respond, count
```

### 6.1 Lista lateral (`InformesListSidebar`)
- Filtro superior: segmento `Recibidos | Enviados | Todos`.
- Cada item: título, badge de estado consolidado, autor/destinatarios, chip de obra si aplica.
- Item BORRADOR solo aparece en "Enviados" del autor, con badge propio.

### 6.2 Documento central (`InformeDocument`)
- Título grande, meta (de / obra / fecha), cuerpo, lista de adjuntos (descarga con `downloadAuthenticated`).
- Si es BORRADOR y soy el autor: botones **Editar** y **Enviar**.

### 6.3 Panel de revisión (`InformeReviewPanel`)
- Lista de destinatarios, cada uno con su estado individual (badge) y su comentario si respondió.
- Si **yo** soy destinatario y mi respuesta es PENDIENTE: botones **Aprobar** / **Devolver** + textarea (comentario obligatorio para devolver).
- Si ya respondí: se muestra mi respuesta, sin acciones.

### 6.4 Permisos en UI
- `<CanAccess module="INFORMES" action="VIEW">` para el módulo.
- Botón "Nuevo informe" detrás de `usePermission('INFORMES','CREATE')`.

---

## 7. Casos de prueba

1. **Crear borrador** → estado BORRADOR, solo el autor lo ve, no aparece a destinatarios.
2. **Subir 3 adjuntos** en BORRADOR → loop cliente, 3 FileAttachment con `informeId`.
3. **Enviar** → estado PENDIENTE, `enviadoAt` seteado, ahora visible a destinatarios.
4. **Editar tras enviar** → 409.
5. **Destinatario aprueba** → su respuesta APROBADO; si era el único, informe APROBADO.
6. **Un destinatario aprueba y otro devuelve** → informe consolidado **DEVUELTO**.
7. **Devolver sin comentario** → 422 (Zod).
8. **Responder dos veces** → 409.
9. **Tercero no relacionado entra a `/:id`** → 403.
10. **ADMIN no destinatario** → ve el informe en la lista (metadatos) pero `/:id` → 403.
11. **Borrar informe enviado** → 409; borrar BORRADOR → OK, cascade.
12. **Badge de pendientes** → cuenta solo donde soy destinatario PENDIENTE.
13. **Descarga de adjunto por no relacionado** → 403.

---

## 8. Fuera de alcance (v1)

- Reenvío / ciclo iterativo de devolución → corrección (confirmado: una sola pasada).
- Notificaciones por email o in-app (más allá del badge contador).
- Edición del informe tras el envío.
- Hilo de comentarios / múltiples respuestas por destinatario.
- Adjuntos de video.
- Reasignar destinatarios tras enviar.

---

## 9. Fasing de implementación

- **Fase 1 (este prompt):** Prisma schema + migración + alta del módulo en la matriz de permisos + API REST completa + servicios. Validable con cliente REST.
- **Fase 2 (prompt posterior, tras validar Fase 1):** UI Concepto C completa.

---

## 10. Apéndice: glosario y referencias

- **Informe:** documento con título, cuerpo y adjuntos, dirigido a uno o más destinatarios.
- **Destinatario:** usuario al que se dirige el informe; responde Aprobando o Devolviendo.
- **Estado consolidado:** estado único del informe derivado de las respuestas individuales.
- **Row-level:** control de acceso por fila (relación con el registro), no por módulo.
- Referencias del repo: sistema `Role`/`Permission` + `authorize(Module, Action)`; `createAuditEntry`; helpers de storage `saveUploadedFile`/`saveBufferAsAttachment`; `downloadAuthenticated`; patrón `FileAttachment`.
