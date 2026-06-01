# Galería de Fotos de Obra + Checklist de Referencia — Especificación Técnica

> Galería única de fotos por proyecto (sin límites, sin vínculo a ítems) +
> checklist de referencia con estado manual. Dos componentes independientes
> en la sección Operaciones del proyecto.
> v2.0 — Mayo 2026 (reemplaza v1.0 que ataba fotos a ítems)

---

## Tabla de contenidos

1. Contexto y objetivo
2. Modelo de datos
3. Pipeline de imágenes
4. API REST
5. UI / Componentes
6. Casos de prueba
7. Fuera de alcance
8. Apéndice

---

## 1. Contexto y objetivo

Al ejecutar una instalación fotovoltaica, el equipo de obra necesita:

1. **Subir fotos de evidencia** de la instalación — todas las que quiera,
   sin límites, en un repositorio único por proyecto.
2. **Seguir un checklist de referencia** que le recuerda qué cosas conviene
   fotografiar/revisar, marcando ítems como OK manualmente.

**Cambio clave respecto a v1:** las fotos y el checklist son **independientes**.
Subir una foto no se ata a ningún ítem, y marcar un ítem OK no requiere foto.
El checklist es una guía visual, no un gate.

Las fotos se almacenan en la VPS con compresión en cliente (1600px lado mayor,
JPEG 80%) + thumbnail en servidor (400px). Esto mantiene bajo el consumo de disco.

---

## 2. Modelo de datos

### 2.1 Plantilla maestra — `ChecklistTemplate`

```prisma
model ChecklistTemplate {
  id          String    @id @default(cuid())
  name        String
  description String?
  order       Int       @default(0)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  instances   ProjectChecklistItem[]

  @@index([isActive, order])
  @@map("checklist_templates")
}
```

Editable solo por ADMIN. `isActive` permite desactivar sin borrar.

### 2.2 Instancia por proyecto — `ProjectChecklistItem`

```prisma
model ProjectChecklistItem {
  id            String    @id @default(cuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  templateId    String?
  template      ChecklistTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  name          String
  description   String?
  order         Int       @default(0)
  status        ChecklistItemStatus @default(PENDING)
  observation   String?
  completedById String?
  completedBy   User?     @relation(fields: [completedById], references: [id], onDelete: SetNull)
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([projectId])
  @@index([projectId, status])
  @@map("project_checklist_items")
}

enum ChecklistItemStatus {
  PENDING
  OK
}
```

**Diferencia clave con v1:** NO tiene relación `photos`. El ítem es puramente
un estado + observación. Sin vínculo a fotos.

### 2.3 Fotos — repositorio único por proyecto

Las fotos se guardan como `FileAttachment` atadas **solo al proyecto**,
con un marcador que las identifica como fotos de obra (para no mezclarlas
con otros documentos del proyecto).

Opción de diseño recomendada: usar los campos `toolSource` / `toolEntityId`
que ya existen en `FileAttachment` (convención del repo para herramientas),
o un campo `category`. A definir en Paso 0 según lo que ya exista.

```prisma
model FileAttachment {
  // ... campos existentes

  // Para identificar fotos de obra: usar toolSource = "obra_fotos"
  // o un campo category nuevo si no existe convención aplicable.
  // projectId ya existe en FileAttachment.
}
```

**Storage path:** `${STORAGE_PATH}/projects/{projectId}/obra/{filename}`
**Thumbnails:** `${STORAGE_PATH}/projects/{projectId}/obra/thumb_{filename}`

**Sin límite de cantidad.** Sin mínimo. Sin máximo.

### 2.4 Inicialización del checklist (lazy init)

Igual que v1: cuando se accede a la sección y no existen `ProjectChecklistItem`
para el proyecto, se instancian desde la plantilla activa.

---

## 3. Pipeline de imágenes

Igual que v1 (no cambia):

### 3.1 Compresión en cliente
1. Input file con `accept="image/*" capture="environment"`.
2. Cargar en `Image()`, escalar lado mayor a ≤ 1600px.
3. Dibujar en canvas, exportar JPEG calidad 0.80.
4. Subir blob (~300 KB).

**Soporte de carga múltiple:** el input permite `multiple`, y se comprime
y sube cada archivo. Indicador de progreso por lote.

### 3.2 Procesamiento en servidor
1. Recibir multipart, validar MIME + tamaño (≤ 5 MB safety net).
2. Con `sharp`: guardar original + generar thumbnail 400px JPEG 70.
3. Crear `FileAttachment` con `projectId` + marcador de categoría obra.

### 3.3 Servicio de archivos
Servir vía endpoint existente. Thumbnail vía `GET /api/files/:id/thumbnail`.

---

## 4. API REST

### 4.1 Plantilla maestra (ADMIN) — sin cambios respecto a v1

- `GET /api/admin/checklist-templates`
- `POST /api/admin/checklist-templates`
- `PATCH /api/admin/checklist-templates/:id`
- `DELETE /api/admin/checklist-templates/:id` (soft delete)
- `PUT /api/admin/checklist-templates/reorder`

Permisos: `authorize(CONFIGURACION, <Action>)`.

### 4.2 Checklist del proyecto

#### `GET /api/projects/:projectId/checklist`

Lazy init si no existen ítems. Devuelve ítems + summary.

**Response:**
```json
{
  "items": [
    {
      "id": "cuid",
      "name": "Revisión de cableado DC",
      "description": "...",
      "order": 1,
      "status": "PENDING",
      "observation": null,
      "isCustom": false,
      "completedBy": null,
      "completedAt": null
    }
  ],
  "summary": { "total": 5, "completed": 2, "pending": 3, "percentComplete": 40 }
}
```

**Nota:** ya NO incluye `photos` por ítem.

#### `POST /api/projects/:projectId/checklist`

Crear ítem custom. `{ name (req), description? }`. `templateId = null`.

#### `PATCH /api/projects/:projectId/checklist/:itemId`

Actualizar `status` y/o `observation`.

**Body:** `{ status?: "OK" | "PENDING", observation?: string | null }`

**Lógica simplificada (sin validación de fotos):**
- Si `status = OK` → setear `completedById = user.id`, `completedAt = now()`.
- Si `status = PENDING` → limpiar `completedById`, `completedAt`.
- **No hay verificación de fotos.** Marcar OK es libre.

#### `DELETE /api/projects/:projectId/checklist/:itemId`

Solo ítems custom. Si `templateId != null` → 400.

### 4.3 Fotos de obra (repositorio del proyecto)

#### `GET /api/projects/:projectId/obra/photos`

Listar todas las fotos de obra del proyecto.

**Response:**
```json
{
  "photos": [
    {
      "id": "cuid",
      "filename": "obra_01.jpg",
      "thumbnailUrl": "/api/files/xxx/thumbnail",
      "fullUrl": "/api/files/xxx/download",
      "size": 312000,
      "uploadedBy": { "id": "...", "name": "..." },
      "createdAt": "..."
    }
  ],
  "count": 24
}
```

Ordenadas por `createdAt DESC` (las más nuevas primero) o ASC — a definir,
recomiendo DESC para ver lo último subido arriba.

#### `POST /api/projects/:projectId/obra/photos`

Upload de una o varias fotos. Multipart.

**Sin límite de cantidad.** Validar solo MIME y tamaño individual.

**Lógica:**
1. Recibir archivo(s) multipart.
2. Por cada uno: validar, guardar original + thumbnail con sharp.
3. Crear `FileAttachment` con `projectId` + marcador de obra + `uploadedById`.
4. Responder con las fotos creadas.

**Response:** `201` con array de fotos creadas.

#### `DELETE /api/projects/:projectId/obra/photos/:photoId`

Eliminar una foto del repositorio.

**Lógica:**
1. Borrar archivos del filesystem (original + thumbnail).
2. Borrar `FileAttachment`.

**Sin efectos secundarios** sobre el checklist (son independientes).

**Auth:** autenticado con acceso al proyecto. Considerar si solo el que subió
o cualquiera con permiso puede borrar — recomiendo cualquiera con permiso de
edición del proyecto.

---

## 5. UI / Componentes

### 5.1 Sección Operaciones del proyecto

```
┌─────────────────────────────────────────────────────────┐
│  Fotos de Obra                         24 fotos         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [+ Subir fotos]  (permite selección múltiple)    │  │
│  │                                                    │  │
│  │  [img] [img] [img] [img] [img] [img]              │  │
│  │  [img] [img] [img] [img] [img] [img]              │  │
│  │  [img] [img] [img] ...                            │  │
│  │  (grid de thumbnails, click → lightbox)           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Checklist de Referencia              2/5 (40%)         │
│  ████████░░░░░░░░░░░                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ☑ Revisión de cableado DC          OK            │  │
│  │  ☐ Verificación de torque           Pendiente     │  │
│  │     Obs: [_____________________]                  │  │
│  │  ☐ Prueba de strings                Pendiente     │  │
│  │  ...                                              │  │
│  │  [+ Agregar ítem de referencia]                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Galería de fotos (arriba):**
- Botón "Subir fotos" con selección múltiple (`multiple`)
- Grid de thumbnails
- Contador de fotos
- Click en thumb → lightbox full con navegación
- Botón eliminar por foto (con confirmación)
- Indicador de progreso durante subida de lote

**Checklist de referencia (abajo):**
- Barra de progreso + conteo
- Cada ítem: checkbox de estado (OK/Pendiente), nombre, observación opcional
- Marcar OK es un click directo, sin requisitos
- Botón agregar ítem custom
- Ítems custom: botón eliminar

### 5.2 Componentes

| Componente | Descripción |
|---|---|
| `ProjectObraSection.tsx` | Contenedor de la sección (galería + checklist) |
| `ObraPhotoGallery.tsx` | Galería de fotos con upload múltiple y lightbox |
| `ObraPhotoUpload.tsx` | Botón + lógica de compresión y subida en lote |
| `ObraChecklist.tsx` | Lista de checklist de referencia |
| `ObraChecklistItem.tsx` | Ítem individual (estado + observación) |
| `AdminChecklistTemplates.tsx` | Gestión de plantilla en Settings |

### 5.3 Compresión en cliente — `compressImage`

Utilidad reutilizable (igual que v1). Ver Paso correspondiente del prompt.

### 5.4 Admin de plantilla

Igual que v1: sección en Settings para CRUD + reordenar templates.

---

## 6. Casos de prueba

### Backend
- [ ] `GET /checklist` inicializa desde plantilla la primera vez
- [ ] `PATCH` status=OK → marca OK sin requerir fotos
- [ ] `PATCH` status=PENDING → revierte, limpia completedBy/At
- [ ] `POST /checklist` ítem custom → templateId null
- [ ] `DELETE` ítem plantilla → 400; ítem custom → 200
- [ ] `POST /obra/photos` una foto → guarda original + thumbnail
- [ ] `POST /obra/photos` múltiples → guarda todas, sin límite
- [ ] `GET /obra/photos` → lista todas las del proyecto
- [ ] `DELETE /obra/photos/:id` → borra archivo + registro, sin tocar checklist
- [ ] Thumbnail 400px generado correctamente

### Frontend
- [ ] Galería y checklist aparecen en Operaciones
- [ ] Subir varias fotos a la vez → todas comprimidas y subidas
- [ ] Click en thumbnail → lightbox
- [ ] Eliminar foto → desaparece, checklist intacto
- [ ] Marcar ítem OK → cambia sin pedir foto
- [ ] Agregar/eliminar ítem custom
- [ ] Barra de progreso del checklist correcta
- [ ] Admin: CRUD + reordenar templates

---

## 7. Fuera de alcance (v2)

- Asociación opcional foto ↔ ítem (explícitamente descartado)
- Mínimo/máximo de fotos (explícitamente descartado)
- PDF de acta de finalización
- Firma digital
- Comparación antes/después
- S3/cloud storage (se evalúa si el disco se llena)

---

## Apéndice

### Glosario
- **Galería de obra:** repositorio único de fotos del proyecto, sin vínculo a ítems
- **Checklist de referencia:** lista guía de qué revisar, con estado manual, independiente de las fotos
- **Lazy init:** los ítems del checklist se crean al primer acceso

### Diferencias con v1 (resumen)
| Aspecto | v1 (descartada) | v2 (esta) |
|---|---|---|
| Fotos | Por ítem (1-3) | Repositorio único, sin límite |
| Foto para OK | Obligatoria | No requerida |
| Vínculo foto-ítem | Sí (`checklistItemId`) | No |
| Borrar última foto | Revierte ítem a PENDING | Sin efecto en checklist |
| Complejidad | Alta | Baja |

### Estimación de storage
- Foto comprimida ~300 KB, thumbnail ~30 KB
- Sin límite, pero uso típico: 30-50 fotos/proyecto = ~10-16 MB
- 30 proyectos/año = ~300-500 MB/año. Manejable.
