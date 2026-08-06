# Videos del proyecto

> ⚠️ **Documento histórico — no es fuente de verdad.**
> Esto es el diseño que se escribió *antes* de construir la funcionalidad, y
> puede diferir de lo que finalmente se implementó. Sirve para entender por qué
> se decidieron las cosas, no para saber cómo funcionan hoy.
> **Cómo funciona hoy: [`docs/manual/`](../../manual/README.md).**

Videos que documentan el proyecto: los **ensayos** de obra (anti-isla y
encendido), que son evidencia con retención permanente y respaldo ante UTE, los
que graba el operario en una **visita técnica**, y los del relevamiento de la
**visita de ventas**, que se cargan en el lead y pasan al proyecto al ganarlo.

## Por qué existe

Los ítems de checklist *"Ensayo anti-isla realizado y grabado"*, *"Videos de
ensayos subidos"* y *"Videos de ensayos recibidos y subidos"* existían desde el
pipeline original, pero eran **casillas huérfanas**: nada obligaba a que el video
existiera. Además, subirlo era imposible — el límite global de adjuntos es de
20 MB, faltaba `.mov` (el formato nativo del iPhone) en la whitelist, y el server
no soportaba *range requests*, sin los cuales un `<video>` no reproduce.

## La decisión que sostiene todo: comprimir, no escalar el storage

Un video de celular crudo pesa ~150 MB/min. Comprimido al perfil de archivo queda
en ~5 MB/min.

Los dos ensayos duran **siempre unos 4 minutos** —UTE exige ver los 180 segundos
de reconexión más lo previo y lo posterior, así que no se pueden acortar—, o sea
unos 20 MB cada uno: **~40 MB por proyecto**. A 300 proyectos por año son 12 GB,
que el disco de 150 GB del VPS aguanta más de una década.

Por eso **no** se migró a object storage: `env.storagePath` se usa crudo en ~19
lugares y `getStoredFilePath()` devuelve un path de filesystem que ~8 archivos de
rutas leen directo. Reescribir todo eso, y encima resolver los rangos contra S3,
no se justifica para ese volumen. Backblaze B2 entra como **respaldo**
(ver `docs/DEPLOY.md` §3), no como almacenamiento primario.

## Los tres caminos de entrada

| | Sección Videos del proyecto | Visita técnica | Visita de ventas (lead) |
|---|---|---|---|
| Endpoint | `POST /api/projects/:id/videos` | `POST /api/projects/:id/visit-inputs/video` | `POST /api/leads/:id/videos` |
| Permiso | `OPERACIONES:CREATE` | `OPERACIONES:EDIT` | `VENTAS:CREATE` |
| Tipo | lo elige el usuario | siempre `VISITA` | siempre `VISITA` |
| Dueño | `projectId` | `projectId` + `visitId` | `leadId` |
| Borrar | `OPERACIONES:DELETE` | `OPERACIONES:DELETE` | `VENTAS:DELETE` |
| ¿Destraba el checklist? | solo si es un ensayo | **no** | **no** |

Reproducir y ver la miniatura lo habilita **Operaciones o Ventas**
(`protegidaVerVideo`): el asesor que graba en la visita comercial no tiene
permisos sobre Operaciones y sin eso no podría ver lo que él mismo subió.

### Del lead al proyecto

Al ganarse el lead, `moveLeadMediaToProject` (en `sales/sales.service.ts`) deja
cada cosa donde el proyecto la muestra: las fotos van a la galería de obra con su
miniatura y `toolSource: "obra-fotos"`, y los videos se **mueven** (no se copian,
son decenas de MB) a `storage/<projectId>/videos/`, con el `ProjectVideo`
apuntando al proyecto. `leadId` se conserva como rastro, así que el lead los
sigue mostrando — a propósito: es el registro de lo que se relevó en esa visita.

Esos dos tipos quedan **excluidos** de `copyLeadAttachmentsToProject`, que si no
los duplicaría sueltos entre los documentos del proyecto.

El video de visita **no crea un `VisitInput`**: no se transcribe, así que no
aportaría nada al informe de la IA, y meterlo como input obligaría a extender el
motor de informes para un tipo sin texto. Se guarda como `ProjectVideo` atado a
la visita, y se lista y reproduce por las mismas rutas que el resto.

Los tipos que valen como evidencia de ensayo están en `TIPOS_DE_ENSAYO`
(`project-video.service.ts`). Si mañana se agrega otro ensayo al enum, hay que
sumarlo ahí también o el checklist no lo va a reconocer.

## Flujo

1. **Subida** — guarda el original en `storage/<owner>/videos/.tmp/`, crea el
   `ProjectVideo` en `PENDING` y responde **202**. `<owner>` es `<projectId>` o
   `leads/<leadId>` (ver `videoOwnerDir`). El límite es propio de la ruta
   (`MAX_VIDEO_SIZE_MB`, default 500) vía `request.file({ limits })`; el techo
   global de 20 MB no se toca.
2. **Compresión** en una cola serial en memoria (`video-queue.service.ts`,
   concurrencia 1). Escribe en `.tmp/out_*` y recién al terminar mueve el
   resultado a `storage/<owner>/videos/`, para que un proceso interrumpido no
   deje archivos sueltos entre los buenos.
3. Al quedar `READY` se crea el `FileAttachment` (`toolSource: "project-video"`),
   se borra el original y —solo si es un ensayo de un proyecto— **se marcan
   solos** los ítems de checklist con `evidenceKind = "ensayo-video"`.
4. **Reproducción**: el front pide un token de 15 min
   (`POST /api/videos/:id/stream-token`) y lo pone en la URL del `<video>`.

## Perfil de compresión

`server/src/services/video-transcode.service.ts`. H.264 High@4.0, lado largo
capeado en 1280 respetando orientación, CRF 23, techo de bitrate **proporcional a
la resolución**, tope de 30 fps, AAC mono 64k, `+faststart`.

Lo que no es negociable:

| | Por qué |
|---|---|
| **Techo de bitrate proporcional** (`BITS_POR_PIXEL`) | Es lo que hace que el archivo pese poco. Un techo fijo no comprime nada cuando el video ya viene chico — ver más abajo |
| `-pix_fmt yuv420p` | Los iPhone graban HEVC de 10 bits; sin forzar 8 bits 4:2:0 el resultado no reproduce en Safari ni QuickTime |
| `+faststart` | Sin esto el navegador baja el archivo entero antes del primer frame y los rangos no sirven de nada |
| Tonemapping HDR | Dolby Vision/HLG convertido de forma ingenua queda lavado, que es justo lo que arruina la legibilidad de un display |
| Conservar el audio | La narración del operario es parte de la evidencia del ensayo |
| libx264 (no HEVC/AV1) | Tiene que abrirse en cualquier máquina dentro de diez años |

### Lo que enseñó el primer uso real (5 de agosto de 2026)

**iOS ya transcodifica el video cuando se sube desde la fototeca.** No llega el
original de la cámara: llegan ~478x850 a ~1,5 Mbps. Eso rompió los tres supuestos
del perfil original, que estaba calibrado para video crudo:

- El escalado a 1280 no hacía nada (ya venía más chico).
- El `fps=30` tampoco (ya venía a 29,6), pero **sí costaba muchísimo tiempo**:
  ffprobe reporta `r_frame_rate=90000/1` en esos archivos —el timebase del
  contenedor, no los cuadros por segundo— y el filtro trabajaba contra ese
  número. Un video de 4 minutos tardaba más de 5 en comprimirse. Por eso el fps
  se lee de `avg_frame_rate` y el filtro se aplica solo si hace falta.
- El techo fijo de 3 Mbps era el doble de lo que el archivo ya traía, así que
  entraba entero: 45 MB salían 38 MB. Ahora el techo se calcula sobre los píxeles
  de salida (~1,4 Mbps en 720p, ~600 kbps en 478x850) y ese mismo caso da 19 MB.

Si el resultado igual no achica, se descarta y se usa el original remuxeado con
`+faststart` (`puedeUsarseSinRecodificar`): guardar una recompresión que pesa lo
mismo es perder calidad a cambio de nada.

**Un video largo pesa, no hay vuelta.** 4 minutos dan ~19 MB aun comprimiendo
bien. Lo que más ayuda es grabar clips cortos, no tocar el perfil.

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
- **Borrar se rige solo por la matriz**, como el resto del módulo. Al principio
  había un guard extra de rol ADMIN para que el operario no pudiera borrar la
  evidencia del ensayo que grabó, pero era incoherente: un video es una cosa más
  dentro del proyecto, y un gerente con `OPERACIONES:DELETE` no podía borrarlo.
  Eso se resuelve en la matriz —hoy el capataz no tiene DELETE— y no con una
  excepción escondida en el código. El módulo que se exige depende del dueño del
  video: `OPERACIONES:DELETE` si ya cuelga de un proyecto, `VENTAS:DELETE` si
  todavía está en el lead.
- El borrado es **suave y no toca el archivo físico** — divergencia deliberada
  respecto de las fotos de obra, que sí hacen `unlink`. Es la red que hace que
  abrir el borrado a más roles no sea perder evidencia.
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
- Falta confirmar la **legibilidad de un display de inversor** con el perfil
  actual (CRF 23 + techo proporcional). Si no se lee, bajar el CRF o subir
  `BITS_POR_PIXEL`; el script de prueba mide qué se paga en tamaño.
- Los videos subidos a producción **antes** del 5 de agosto de 2026 quedaron con
  el perfil viejo (pesan de más). No hay reprocesamiento: para arreglarlos hay
  que borrarlos y volver a subirlos.
- Ojo si se toca el `Cache-Control` del streaming: con `no-store` el reproductor
  de Chrome se queda cargando para siempre **sin dar error**, porque necesita el
  caché HTTP para bufferear. Está en `private, max-age=0, must-revalidate` por
  eso, no por descuido.
- El gate del checklist alcanza a **79 ítems pendientes** en proyectos en curso
  (los 81 ya tildados no se ven afectados). Avisar a Operaciones antes del deploy.
- `recoverPendingProjectVideos()` reencola por dueño y, si hubiera más de un
  video pendiente del mismo proyecto, aparea originales por antigüedad. Con el
  volumen real no se cruza, pero no es unívoco.
