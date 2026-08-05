# Videos del proyecto

Videos que documentan el proyecto: los **ensayos** de obra (anti-isla y
encendido), que son evidencia con retención permanente y respaldo ante UTE, y los
que graba el operario durante una **visita técnica**.

## Por qué existe

Los ítems de checklist *"Ensayo anti-isla realizado y grabado"*, *"Videos de
ensayos subidos"* y *"Videos de ensayos recibidos y subidos"* existían desde el
pipeline original, pero eran **casillas huérfanas**: nada obligaba a que el video
existiera. Además, subirlo era imposible — el límite global de adjuntos es de
20 MB, faltaba `.mov` (el formato nativo del iPhone) en la whitelist, y el server
no soportaba *range requests*, sin los cuales un `<video>` no reproduce.

## La decisión que sostiene todo: comprimir, no escalar el storage

Un video de celular crudo pesa ~150 MB/min (más en 4K60). Comprimido al perfil de
archivo queda en ~6-23 MB/min según cuánto movimiento tenga. Con 1-3 videos cortos
por proyecto, eso es ~100 MB/proyecto en el peor caso, o sea unos 15-30 GB/año —
que el disco de 150 GB del VPS aguanta durante años.

Por eso **no** se migró a object storage: `env.storagePath` se usa crudo en ~19
lugares y `getStoredFilePath()` devuelve un path de filesystem que ~8 archivos de
rutas leen directo. Reescribir todo eso, y encima resolver los rangos contra S3,
no se justifica para ese volumen. Backblaze B2 entra como **respaldo**
(ver `docs/DEPLOY.md` §3), no como almacenamiento primario.

## Los dos caminos de entrada

| | Desde la sección Videos | Desde la visita técnica |
|---|---|---|
| Endpoint | `POST /api/projects/:id/videos` | `POST /api/projects/:id/visit-inputs/video` |
| Permiso | `OPERACIONES:CREATE` | `OPERACIONES:EDIT` (igual que foto y nota) |
| Tipo | lo elige el usuario (los dos ensayos u "Otro") | siempre `VISITA`, no se elige |
| `visitId` | vacío | la visita activa del operario |
| ¿Destraba el checklist? | solo si es un ensayo | **no** |

El video de visita **no crea un `VisitInput`**: no se transcribe, así que no
aportaría nada al informe de la IA, y meterlo como input obligaría a extender el
motor de informes para un tipo sin texto. Se guarda como `ProjectVideo` atado a
la visita, y se lista y reproduce por las mismas rutas que el resto.

Los tipos que valen como evidencia de ensayo están en `TIPOS_DE_ENSAYO`
(`project-video.service.ts`). Si mañana se agrega otro ensayo al enum, hay que
sumarlo ahí también o el checklist no lo va a reconocer.

## Flujo

1. **Subida** (`POST /api/projects/:projectId/ensayos/videos`, OPERACIONES.CREATE)
   guarda el original en `storage/<projectId>/ensayos/.tmp/`, crea el
   `EnsayoVideo` en `PENDING` y responde **202**. El límite es propio de la ruta
   (`MAX_VIDEO_SIZE_MB`, default 500) vía `request.file({ limits })`; el techo
   global de 20 MB no se toca.
2. **Compresión** en una cola serial en memoria (`video-queue.service.ts`,
   concurrencia 1). Escribe en `.tmp/out_*` y recién al terminar mueve el
   resultado a `storage/<projectId>/ensayos/`, para que un proceso interrumpido no
   deje archivos sueltos entre los buenos.
3. Al quedar `READY` se crea el `FileAttachment` (`toolSource: "ensayos-video"`),
   se borra el original y **se marcan solos** los ítems de checklist con
   `evidenceKind = "ensayo-video"`.
4. **Reproducción**: el front pide un token de 15 min
   (`POST /api/ensayos/videos/:id/stream-token`) y lo pone en la URL del `<video>`.

## Perfil de compresión

`server/src/services/video-transcode.service.ts`. H.264 High@4.0, 720p (lado
largo capeado en 1280 respetando orientación), CRF 21, `maxrate 3M`, 30 fps, AAC
mono 64k, `+faststart`.

Lo que no es negociable:

| | Por qué |
|---|---|
| `-pix_fmt yuv420p` | Los iPhone graban HEVC de 10 bits; sin forzar 8 bits 4:2:0 el resultado no reproduce en Safari ni QuickTime |
| `+faststart` | Sin esto el navegador baja el archivo entero antes del primer frame y los rangos no sirven de nada |
| Tonemapping HDR | Dolby Vision/HLG convertido de forma ingenua queda lavado, que es justo lo que arruina la legibilidad de un display |
| Conservar el audio | La narración del operario es parte de la evidencia del ensayo |
| libx264 (no HEVC/AV1) | Tiene que abrirse en cualquier máquina dentro de diez años |
| CRF 21 y 720p | 480p no alcanza para leer un display de inversor; CRF 21 da margen sobre el 23 por defecto |

Para recalibrar: `docker compose exec server node --import tsx
scripts/probar-compresion-video.ts [ruta-a-un-video]`. Sin argumento genera clips
sintéticos y reporta tamaños y tiempos.

## Decisiones de seguridad

- **El token de streaming no es un token de sesión.** Lleva `typ:
  "ensayo-stream"` y está atado a un video y un usuario; `authenticate` rechaza
  cualquier token que traiga `typ`. Sin esa asimetría, un token filtrado por la
  URL de un `<video>` valdría como sesión completa.
- El query param `?t=` **se redacta en los logs** de Fastify
  (`redactStreamToken` en `server/src/index.ts`).
- **No** se usan blob URLs para reproducir: obligarían a descargar el video entero
  antes del primer frame. Sí para el poster, que reusa `ProtectedImage`.
- `Cache-Control: private, max-age=0, must-revalidate`, **no `no-store`**: el
  reproductor de Chrome se apoya en el caché HTTP para bufferear.
- **Borrar exige rol ADMIN**, además del permiso de módulo. La matriz le da
  `OPERACIONES:DELETE` a los roles de obra, y quien graba el ensayo no debería
  poder hacer desaparecer la evidencia de que lo hizo. Como la matriz es editable
  desde la UI, apoyarse solo en ella dejaría la garantía al azar.
- El borrado es **suave y no toca el archivo físico** — divergencia deliberada
  respecto de las fotos de obra, que sí hacen `unlink`.
- Cadena de custodia: se conservan `originalSha256`, `originalProbe` (ffprobe
  completo), tamaño y mimetype del archivo descartado, más el `sha256` del
  comprimido.
- Se audita el **minteo del token**, no cada pedido de rango: un solo video genera
  decenas de requests. Un token = una sesión de visualización = una fila.

## Archivos

| | |
|---|---|
| Schema | `ProjectVideo`, `TipoVideo`, `VideoProcessingStatus`, `ChecklistItem.evidenceKind` |
| Backend | `routes/videos.routes.ts` (+ `POST /projects/:id/visit-inputs/video` en `visitas.routes.ts`), `services/video-transcode.service.ts`, `services/video-queue.service.ts`, `services/project-video.service.ts`, `saveProjectVideoUpload` en `file-storage.service.ts` |
| Frontend | `api/videos.api.ts`, `components/videos/` (Section, Upload, Card, Player), montado en `components/obra/ProjectObraSection.tsx`; botón Video en `components/ingenieria/visitas/VisitasToolPanel.tsx` |
| Infra | `ffmpeg` en `server/Dockerfile`, `MAX_VIDEO_SIZE_MB` en ambos compose |

## Deuda / pendientes

- **Falta probar en Safari de iPhone.** La reproducción en **Chrome está
  verificada** (5 de agosto de 2026), igual que el endpoint por HTTP (206, rangos
  parciales, 416, HEAD, rango sufijo). Safari es el caso que más depende de
  `+faststart`, de `yuv420p` y del manejo de rangos, así que conviene confirmarlo
  aparte antes de darlo por cerrado en obra.
- Falta probar con un `.mov` real de iPhone, vertical y HDR, filmando un display
  de inversor, y confirmar que los caracteres se leen. Si no, subir a CRF 19 o a
  1600px.
- Ojo si se toca el `Cache-Control` del streaming: con `no-store` el reproductor
  de Chrome se queda cargando para siempre **sin dar error**, porque necesita el
  caché HTTP para bufferear. Está en `private, max-age=0, must-revalidate` por
  eso, no por descuido.
- El gate del checklist alcanza a **79 ítems pendientes** en proyectos en curso
  (los 81 ya tildados no se ven afectados). Avisar a Operaciones antes del deploy.
- `recoverPendingEnsayoVideos()` reencola por proyecto y, si hubiera más de un
  video pendiente del mismo proyecto, aparea originales por antigüedad. Con el
  volumen real no se cruza, pero no es unívoco.
