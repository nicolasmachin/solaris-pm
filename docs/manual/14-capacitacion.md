# 14. Capacitación

## Para qué existe

Un único lugar donde el equipo encuentra el material para aprender a usar la app
y a hacer su trabajo: videos y documentos, separados por área, y visibles solo
para los roles a los que les corresponden.

Los videos **no viven en la app**: están en [Bunny Stream](https://bunny.net)
(biblioteca "Tutoriales Voltia"). La app guarda la referencia al video, lo
muestra dentro de un reproductor propio y controla quién puede verlo. Los
documentos sí se suben al storage de la app.

## Cómo se usa

### Ver capacitaciones

- Se entra por el **menú del usuario** (arriba a la derecha) → **Capacitación**.
- **Portada** (`/capacitacion`): una tarjeta por área con su imagen, cuántos
  videos y documentos tiene y el avance propio ("3 de 8 videos vistos"). Solo
  aparecen las áreas habilitadas para el rol de quien mira.
- **Área** (`/capacitacion/:seccionId`): pestañas **Videos** (las listas de
  reproducción) y **Documentos**.
- **Reproductor** (`/capacitacion/lista/:listaId?v=<videoId>`): el video grande y
  al costado el resto de la lista, con miniatura, duración y tilde de visto. En
  celular la lista queda debajo del video.
  - **Copiar enlace** copia la dirección de ese video exacto para pasarla por
    chat. Quien la abra tiene que estar logueado y tener el área habilitada.
  - **Marcar como visto / Visto** marca o desmarca a mano.
  - Debajo del video, **preguntas y comentarios** del equipo.
  - Al terminar un video se marca visto y **pasa solo al siguiente**.

### Gestionar (permiso `CAPACITACION:EDIT`)

Botón **Gestionar** en la portada → `/capacitacion/gestion`, con tres pestañas:

- **Contenido**: se elige el área y adentro se crean listas, se agregan videos
  desde la biblioteca de Bunny (buscador, filtro por colección y selección
  múltiple), se reordenan con las flechas y se suben documentos. Si la
  biblioteca tiene colecciones, "Importar colección de Bunny" crea una lista con
  todos sus videos de una.
- **Áreas y roles**: crear, renombrar, ordenar, ocultar y borrar áreas, y tildar
  qué roles ven cada una.
- **Seguimiento**: tabla de personas × listas con cuántos videos completó cada
  una y cuándo fue la última vez.

### Comentar un video

Cualquiera que pueda ver el video escribe debajo de él. El autor edita o borra lo
suyo; quien tiene `CAPACITACION:EDIT` puede borrar cualquiera (moderación).

Al comentar, se notifica **in-app** (campanita) a quien cargó el video y a
quienes ya escribieron en ese hilo, menos a quien acaba de comentar. La
notificación lleva su propio destino (`Notification.link`), así que al tocarla se
abre el reproductor en ese video; el resto de las notificaciones sigue navegando
por tipo, como siempre. No se manda correo.

## Cómo funciona

### Estructura

`CapacitacionSeccion` (área) → `CapacitacionLista` (lista de reproducción) →
`CapacitacionVideo` (referencia a un video de Bunny). Los documentos
(`CapacitacionDocumento`) cuelgan del área y opcionalmente de una lista: los de
una lista se muestran también abajo del reproductor. El progreso vive en
`CapacitacionVista` (una fila por persona y video).

`CapacitacionSeccionRol` dice qué roles ven cada área.

### Visibilidad

`capacitacion.service.ts` resuelve la visibilidad en **cada** lectura, no solo al
listar:

- Con `CAPACITACION:EDIT` se ven todas las áreas, activas u ocultas.
- Sin ese permiso, solo las áreas activas donde el rol figura en
  `CapacitacionSeccionRol`.

Pedir una lista, un video, una miniatura, un documento o guardar progreso de un
área ajena responde **404, no 403**: no se revela que exista.

### Videos de Bunny

`bunny-stream.service.ts` concentra todo:

- **Listar** videos y colecciones (`GET video.bunnycdn.com/library/{id}/...` con
  el header `AccessKey`). Alcanza la **Read-only API Key**; la key nunca sale del
  server, el navegador pega contra `/api/capacitacion/bunny/*`.
- **Firmar el embed**: `firmarEmbed()` arma la URL de
  `iframe.mediadelivery.net/embed/{lib}/{video}` con
  `token = sha256(tokenKey + videoId + expires)` y vencimiento de 4 horas. La
  biblioteca tiene prendido *Embed view token authentication*, así que sin firma
  Bunny devuelve una página de error. Si `BUNNY_STREAM_TOKEN_KEY` está vacía, la
  URL sale sin firma (sirve solo si esa opción está apagada).
- Solo se pueden agregar videos con `status === 4` (procesados). Los que están
  procesándose aparecen deshabilitados en el selector.

### Miniaturas

No se linkea el CDN de Bunny desde el navegador: la biblioteca tiene *Block
direct url file access* y, sobre todo, una URL de Bunny la abre cualquiera que
la copie. Las sirve la app (`miniaturas.service.ts`):

1. la primera vez las baja de Bunny (mandando `Referer`) y las cachea en
   `storage/capacitacion/miniaturas/`;
2. después salen del disco, sin volver a pegarle a Bunny.

### Enlaces de imágenes y documentos

Ni un `<img>` ni un enlace de descarga pueden mandar el header `Authorization`.
El permiso viaja en `?t=`, un **token firmado de 2 horas** (`typ:
capacitacion-media`) que emiten los endpoints normales en el campo `mediaToken`
— el mismo patrón que el stream de los videos de ensayo. La ruta igual valida la
visibilidad del recurso para el usuario del token.

### Progreso

`resolverProgreso()` (en `capacitacion.service.ts`) decide el estado:

- `segundosVistos` guarda el **máximo** alcanzado: retroceder no pierde el avance.
- Se marca visto solo al llegar al **90 %** de la duración (`UMBRAL_COMPLETADO`);
  los últimos segundos suelen ser cierre y mucha gente corta antes.
- El botón manual manda: marca aunque no se haya llegado al 90 %, y desmarca.
- El avance automático **nunca** desmarca.

El front escucha los eventos del reproductor de Bunny por el protocolo player.js
(`useBunnyPlayer.ts`, mensajes `postMessage`): guarda cada 15 segundos mientras
hay avance real, y al terminar marca visto y salta al siguiente.

### Comentarios

Reutilizan el modelo `Comment` —el mismo de proyectos, leads y tareas— con la
columna `capacitacionVideoId`, en vez de una tabla propia: es un hilo plano
ordenado por fecha, sin respuestas anidadas. El borrado es suave (`deletedAt`) y
queda en auditoría (`comment_added` / `comment_deleted`). Si se quita el video de
la lista, sus comentarios se van con él (cascade): no tienen dónde vivir.

## Permisos

| Acción | Permiso |
|---|---|
| Entrar al módulo, ver áreas propias, reproducir, descargar, marcar visto | `CAPACITACION:VIEW` + que el rol tenga el área |
| Crear/editar/ocultar áreas y asignarles roles | `CAPACITACION:EDIT` |
| Crear listas, agregar y ordenar videos, subir documentos | `CAPACITACION:EDIT` |
| Ver el listado de videos de Bunny y las colecciones | `CAPACITACION:EDIT` |
| Ver el seguimiento de quién vio qué | `CAPACITACION:EDIT` |
| Comentar, editar y borrar lo propio | `CAPACITACION:VIEW` + que el rol tenga el área |
| Borrar el comentario de otro (moderación) | `CAPACITACION:EDIT` |

El seed (`services/capacitacion/seed-capacitacion.ts`) da `VIEW` a **todos los
roles internos** (todos menos `CLIENT`) y `EDIT` solo a `ADMIN`. Para que otro
rol gestione, se le tilda `CAPACITACION:EDIT` en Administración → Permisos.

Áreas iniciales y sus roles: Ventas (asesor y gerente comercial); Ingeniería y
Tramitación (ingeniería, gerente de ingeniería, tramitación UTE); Operaciones
(operaciones, gerente, logística, capataz, instalador tercerizado); Experiencia
Solar (experiencia solar, posventa); Finanzas (finanzas, gerente de finanzas);
Otros (todos los internos).

## Reglas y decisiones

- **Los documentos no usan `FileAttachment`.** Ese modelo pertenece a un
  proyecto, lead o informe y tiene un validador de "un solo dueño"; además estos
  archivos no deben aparecer en "Documentos del proyecto". Guardan sus metadatos
  en su propia tabla, en `storage/capacitacion/<seccionId>/`.
- **Quitar un video no lo borra de Bunny** ni borra el progreso de la gente: es
  borrado suave. Si se vuelve a agregar el mismo video a la misma lista, se
  reactiva la fila anterior y el progreso sigue ahí.
- **Un área con contenido no se borra**: responde `SECCION_CON_CONTENIDO` y
  sugiere ocultarla (reversible). Solo se borra vacía.
- **Un área sin roles no la ve nadie** salvo quien gestiona. La pantalla lo
  avisa.
- **Borrar una lista** deja sus documentos en el área, sin lista.
- El seguimiento lista los usuarios activos de los roles del área **más**
  cualquiera con progreso (por ejemplo, alguien a quien después se le cambió el
  rol); esos salen marcados "(otro rol)".
- El seed crea las áreas iniciales **solo si no hay ninguna**: re-correrlo no las
  recrea aunque se hayan renombrado o borrado.

## Casos borde

- **Bunny sin configurar** (faltan `BUNNY_STREAM_LIBRARY_ID` o
  `BUNNY_STREAM_API_KEY`): el selector muestra "Falta configurar la conexión con
  Bunny" (`BUNNY_NO_CONFIGURADO`, 503). Lo ya cargado se sigue viendo, salvo las
  miniaturas que no estén cacheadas.
- **Token de medios vencido** (más de 2 horas con la pantalla abierta): las
  miniaturas dejan de cargar y los enlaces de documentos fallan. Se arregla
  recargando la página.
- **Firma del embed vencida** (4 horas): el video no arranca; se resuelve
  cambiando de video o recargando.
- **Video borrado en Bunny**: la ficha queda en la app y el reproductor muestra
  el error de Bunny. Hay que quitarlo a mano de la lista.
- **Dominios permitidos en Bunny**: si la biblioteca tiene *Allowed domains*, ahí
  tienen que estar el dominio de producción y `localhost` para poder probar en
  local. Si falta, el reproductor muestra **403** adentro del iframe.
- Las miniaturas las baja el **server**, no el navegador, así que usan el
  `Referer` de `BUNNY_STREAM_REFERER` (o `BASE_URL`): en local conviene apuntarlo
  al dominio de producción, que es el que está permitido en Bunny.
- **Comentario en un video que se quita de la lista**: se borra con el video. Si
  el video se vuelve a agregar, los comentarios no vuelven (el progreso sí).
- **El reproductor no reporta avance** (si Bunny cambiara su protocolo): no se
  guarda el progreso automático, pero el botón "Marcar como visto" sigue
  funcionando.

## Archivos

- Backend: `server/src/routes/capacitacion.routes.ts`,
  `server/src/services/capacitacion/` (`capacitacion.service.ts`,
  `miniaturas.service.ts`, `seed-capacitacion.ts`),
  `server/src/services/bunny-stream.service.ts`.
- Script de prod: `server/scripts/seed-capacitacion.ts`.
- Frontend: `client/src/modules/capacitacion/`, `client/src/api/capacitacion.api.ts`.
- Comentarios: `server/src/services/capacitacion/comentarios.service.ts`,
  `client/src/modules/capacitacion/ComentariosVideo.tsx`.
- Tests: `npm run test:capacitacion` (umbral de visto, progreso, orden, firma).
