# 10 · Portal del cliente

> **Capítulo parcial.** Están escritas y al día las secciones "El Inicio del
> portal", "Generación y consumo", "Mis documentos", "Videos", "El menú del
> portal" y "Ver el portal como lo ve el cliente". El resto funciona en producción
> pero todavía no está documentado.

Lo que ve el cliente final: su planta, el trámite UTE, reclamos, documentos, encuestas y reportes.

**El portal reemplaza a la aplicación del inversor** (decidido el 28-oct-2026):
al cliente ya no se le da acceso a la aplicación de la marca. Hubo una sección
"App del inversor" para que creara solo su usuario de Growatt; se sacó entera el
mismo día, antes de llegar a producción (ver capítulo 09, el retiro de
`e3_acceso_inversor`).

**Al cliente se le dice "reclamo", no "ticket"** (28-oct-2026: la gente no
entendía la palabra). En el portal son *Mis reclamos* y *Abrir un reclamo*, y
los avisos que le llegan dicen "Te respondimos tu reclamo" y "Tu reclamo quedó
resuelto" (`notifyCliente` en `tickets.service.ts`). En el código, las rutas
(`/portal/tickets`) y el modelo siguen llamándose tickets.

---

# El Inicio del portal

## Para qué existe

El portal nació para mostrar el avance del trámite UTE, y el Inicio era eso.
Después de la habilitación el trámite ya no le dice nada al cliente (todo en
verde): lo que le importa es su planta. Desde el 28-oct-2026 el Inicio cambia
según dónde está el cliente.

## Cómo funciona

`PortalInicio.tsx` (`/portal`) mira `GET /client/projects` (`uteFinalized` de
cada proyecto) y `GET /client/energia/plantas`:

- **Ningún proyecto habilitado:** el trámite UTE, como antes. Con un solo
  proyecto, el detalle directo (`PortalProjectUte` con `projectId`, sin el
  "Volver"); con varios, la lista.
- **Alguno habilitado:** "Tu planta solar" con la vista de energía de cada planta
  (flujo de ahora + Hora/Día/Mes/Año). Si otro proyecto suyo sigue en trámite,
  arriba va un aviso que lleva a su detalle. Si está habilitado pero no tiene
  planta vinculada (o se le apagó el reporte mensual, la misma regla que la
  vista de energía), un cartel dice que los datos del inversor todavía no están
  conectados.

El trámite queda siempre en el menú, **Trámite UTE** (`/portal/ute`,
`PortalProjects`: con un solo proyecto va directo a `/portal/:id`).

## Casos borde

- "Habilitado" es `habilitado` del listado (`GET /client/projects`): todos los
  trámites del proyecto finalizados (`uteFinalized`), **o** ningún trámite
  cargado y el proyecto importado por CSV o en estado `COMPLETED`
  (`habilitadoSinTramite()` en `portal.routes.ts`). Lo segundo cubre a los
  clientes anteriores a Voltia PM: Alberto Norman anda hace un año y sin esto
  veía el trámite "por empezar". En prod, al 28-oct-2026, son 36 proyectos
  importados sin trámite. Un proyecto con varios suministros y uno pendiente
  sigue mostrando el trámite.
- En *Trámite UTE*, a esos clientes no se les dibuja la línea de tiempo (serían
  once pasos pendientes): un cartel dice que la planta está habilitada y que el
  trámite es anterior al portal (`habilitadoSinTramite` en
  `GET /client/projects/:id/ute`).
- En la vista como cliente, el saludo usa el nombre del cliente
  (`preview.clientName`), no el de quien mira.

---

# Generación y consumo (vista de energía)

En el **Inicio** (ver arriba) el cliente habilitado tiene la misma vista que el
equipo en la ficha, con el flujo de "ahora" arriba: pestañas Hora, Día, Mes y Año, como la aplicación de Growatt, una por
planta. Endpoints `/client/energia/plantas` y `/client/energia/:projectId/*`,
con `PORTAL_CLIENTE:VIEW` y el chequeo de que la planta sea suya. Todo el
detalle (de dónde salen los datos, los totales, los casos borde) está en el
capítulo 09, *Vista de energía*.

Antes había una tarjeta "Generación día a día" (generación por día del mes);
se sacó el 13-oct-2026 porque la pestaña Día muestra lo mismo y además el
consumo. Su endpoint, `GET /api/client/energia/diaria`, y `getPortalEnergiaDiaria`
en `portal.api.ts` quedaron sin uso: se pueden borrar.

---

# Mis documentos

## Para qué existe

Que el cliente tenga a mano lo que firmó —el contrato con Voltia y los papeles
de UTE— y, si lo tiene, su Plan de Protección contra Granizo con sus plazos, sin
pedirlo por WhatsApp.

## Cómo se usa

Pestaña **Documentos** (`/portal/documentos`, `PortalDocumentos.tsx`). Por
proyecto: una tarjeta **Contrato con Voltia**, una **Papeles de UTE** (agrupados
por "Cuenta UTE N" si el proyecto tiene más de una) y, si hay plan, **Plan de
Protección contra Granizo**: el estado con una frase que lo explica, protegido
desde / hasta, paneles, costo por año, próximo pago, lo pendiente de pago si hay,
y el Anexo A firmado y las condiciones. Cada archivo tiene **Ver** (lo abre en
otra pestaña) y descargar.

## Cómo funciona

`services/portal/documentos-cliente.service.ts`:

- `GET /client/documentos` → `documentosDelCliente(userId)`. No hay modelo
  nuevo: son `FileAttachment` que ya sube el equipo, reconocidos por
  `toolSource`:
  - `contrato-firmado`: el bloque Contrato firmado del proyecto. Uno solo
    vigente (subir otro borra el anterior).
  - `ute-docs-firmados`: los papeles UTE firmados que sube Operaciones, uno o
    varios por suministro (`suministro` null = el principal).
  - `plan-granizo-anexo`: el Anexo A (`SeguroGranizoPoliza.anexoFileId`).
  - `plan-granizo`: el PDF de condiciones vigente (`sincronizarDocumentoGenerado`).
- El estado del plan se calcula con `estadoDePoliza()` (el estado guardado no es
  el visible). Al portal van solo estado, fechas, paneles, montos y los dos
  archivos: nada de notas, siniestros, número de serie ni cobros internos.
- `GET /client/documentos/:fileId` → `archivoDelCliente()`: busca el archivo
  con `toolSource` en la lista permitida **y** proyecto del cliente
  (`clients.some.userId`); si no, 404 `DOCUMENTO_NO_ENCONTRADO`. Así una foto de
  obra o un presupuesto del mismo proyecto no salen por acá. Se sirve `inline`
  con su `mimeType`.
- El cliente lo pide con `apiClient` (blob), así lleva la sesión y, en la vista
  como cliente, la cabecera `X-Portal-Preview`. **Ver** abre la pestaña antes
  de pedir el archivo: abrirla después del `await` el celular la bloquea como
  ventana emergente.

## Permisos

`PORTAL_CLIENTE:VIEW` en los dos endpoints, más el filtro por dueño. En la vista
como cliente, el hook del portal reemplaza al usuario (requiere
`EXPERIENCIA_CLIENTES:VIEW`, solo GET). Verificado por API el 28-oct-2026:
archivo propio → 200; de otro cliente o fuera de la lista → 404.

## Reglas y decisiones

- Al cliente se le dice **Plan de Protección contra Granizo**, nunca "seguro".
- Las frases de cada estado están en `ESTADO` y `explicacion()` de
  `PortalDocumentos.tsx`; las reglas (30 días de espera, 15 de gracia) son las
  de `seguro-granizo/estado.ts`.
- No hay "proforma", "contrato generado sin firmar" ni el ZIP de UTE sin
  firmar: solo lo firmado, más las condiciones del plan.

## Casos borde

- **No hay fecha de firma del contrato ni de los papeles UTE**: se muestra
  "Cargado el …" (`createdAt` del archivo). El Anexo A sí tiene fecha de firma
  (`anexoFirmadoEn`).
- **Los papeles UTE no dicen cuál es cuál**: se suben sueltos (a veces un ZIP o
  una foto con varios). Se muestran con el nombre del archivo.
- Si falta el archivo físico (base copiada de producción sin el storage, como en
  dev), el listado lo muestra igual y al abrirlo da 404 `ARCHIVO_NO_ENCONTRADO`.
- Un proyecto que es ampliación de otro no muestra el plan: el plan cuelga del
  proyecto original.

---

# Videos

## Para qué existe

Durante el proceso se le mandan al cliente videos cortos (cómo usar la
aplicación del inversor, qué hacer si se corta la generación, etc.). Por
WhatsApp se pierden entre los mensajes; en el portal quedan juntos para volver a
verlos cuando haga falta.

## Cómo se usa

Pestaña **Videos** del portal (`/portal/videos`): los videos agrupados por lista,
con miniatura, duración y tilde de visto, y los documentos de apoyo. Al tocar uno
se abre el reproductor arriba y debajo el resto de la lista.

## Cómo funciona

Es el módulo **Capacitación** (capítulo 14, sección "Videos para clientes"): se
ve lo de las áreas que tienen tildado el rol del cliente. Los detalles técnicos
están allá.

## Permisos

`PORTAL_CLIENTE:VIEW`. En modo vista previa la pestaña se ve y los videos se
reproducen, pero no se guarda progreso.

## Casos borde

- Sin ningún área para clientes con videos, la pestaña muestra "Todavía no hay
  videos".
- La navegación del portal se describe en "El menú del portal", más abajo.

---

# El menú del portal

## Cómo funciona

Las secciones están en una sola lista, `PORTAL_NAV` en `PortalLayout.tsx`
(ruta, nombre largo, nombre corto e ícono). De ahí salen los dos menús:

- **Computadora** (`sm` en adelante): pestañas debajo del encabezado, con el
  nombre largo.
- **Celular**: `PortalBottomNav`, una barra fija abajo con ícono y nombre corto,
  que respeta el área segura del iPhone (`env(safe-area-inset-bottom)`). El pie
  de página lleva un margen inferior para que la barra no lo tape.

"Inicio" (`/portal`) se marca solo en `/portal`. "Trámite UTE" (`/portal/ute`)
queda activa también en el detalle de un proyecto (`/portal/:id`): `esActiva()`
la marca cuando la ruta no es de ninguna otra sección.

## Reglas y decisiones

- **Ancho de computadora** (28-oct-2026): el encabezado, el menú y el
  contenido (`<main>` en `PortalLayout`) llegan hasta `max-w-6xl`; antes era
  `max-w-3xl` y en la computadora se veía como una pantalla de celular. Cada
  página pone su propio tope (Inicio y Reportes, todo; Videos `5xl`; Trámite UTE
  `5xl` con dos columnas; reclamos y encuestas `4xl`; Documentos `5xl`). En la vista de energía, a partir de `lg` el flujo de
  "ahora" va a la izquierda del gráfico (también en la ficha interna).
- **Se pasó a la barra de abajo porque las pestañas no entraban.** Con cinco
  secciones quedaban cortadas en un celular angosto, y deslizarlas de costado no
  se descubre. Es el patrón de las aplicaciones del teléfono.
- **Para sumar una sección se agrega a `PORTAL_NAV`, y nada más.** En la barra
  entran cinco (`MAX_BARRA`): con una sexta, quedan cuatro a la vista y el resto
  pasa a un botón **Más**, que abre la lista arriba de la barra.

---

# Ver el portal como lo ve el cliente

## Para qué existe

Para poder contestar "¿qué está viendo el cliente en la pantalla?" sin pedirle
una captura ni tener su contraseña.

## Cómo se usa

En **Experiencia Solar → Generadores**, en la última columna de cada fila, hay un
ícono de ojo a la izquierda de la papelera. El mismo acceso está en la cabecera
de la ficha del cliente, como **Ver como el cliente**. Aparece sólo si ese generador ya
tiene usuario de portal creado.

Al hacer clic se entra al portal de ese cliente con una **franja ámbar fija
arriba** que dice que lo que se ve es la pantalla del cliente y que es sólo
lectura. El menú de la cuenta muestra el nombre del cliente, no el propio, y su
única opción es **Salir de la vista del cliente**.

## Cómo funciona

El frontend guarda el modo en `portalPreview.store.ts` (zustand + `sessionStorage`)
y un interceptor de axios agrega la cabecera `X-Portal-Preview: <projectId>` a las
llamadas a `/api/client/*`.

En el backend, `portalPreviewHook` en `portal.routes.ts` **reemplaza
`request.user` por el usuario del cliente**. Todos los endpoints del portal
filtran por `clients.some.userId`, así que con eso funcionan sin cambiar ni una
consulta — y no hay forma de que a algún endpoint se le olvide contemplar el modo
vista previa y termine filtrando datos de otro cliente. Quién está mirando de
verdad queda en `request.portalPreview`.

## Permisos

Hace falta `EXPERIENCIA_CLIENTES:VIEW`, el mismo permiso que se necesita para ver
el listado desde el que se entra: quien puede ver la ficha del cliente puede ver
su pantalla. No hay escalada de privilegios — es la misma información, presentada
como la ve él.

## Reglas y decisiones

- **Es de sólo lectura y no es negociable.** El hook rechaza con 403 cualquier
  método que no sea GET. Ver la pantalla del cliente es una cosa; abrir un ticket
  o responder una encuesta en su nombre es otra, y quedaría registrada como si la
  hubiera hecho él.
- **Vive en `sessionStorage`, no en `localStorage`.** Es un modo temporal y tiene
  que morir al cerrar la pestaña; si sobreviviera entre sesiones, alguien
  terminaría trabajando media mañana creyendo que ve su propia pantalla.
- **El hook se acota a las rutas `/client/*`.** El mismo archivo registra las
  rutas de administración de clientes (`/admin/*`), que un interno usa con su
  propio usuario: suplantar ahí lo dejaría sin permisos a mitad de camino.
- Al salir se hace una recarga dura, para no arrastrar al panel interno consultas
  ya cacheadas con los datos del cliente.

## Casos borde

- **Generador sin usuario de portal**: el botón no aparece, y si se llega igual
  por otro camino el backend responde `SIN_USUARIO_PORTAL` explicando que no hay
  pantalla de cliente que mirar.
- **Varios usuarios de cliente en un proyecto**: se toma el primero. El portal
  muestra lo mismo para todos ellos.
- **Un usuario CLIENT que mande la cabecera a mano** recibe 403: no tiene
  `EXPERIENCIA_CLIENTES:VIEW` (verificado contra la API).

---

## Qué falta cubrir en este capítulo

- Cómo se crea un cliente y su acceso
- El rol CLIENT y sus restricciones de navegación
- Qué ve del proyecto y qué no
- Tickets desde el portal y notas internas
- Encuestas y reportes publicados
- Notificaciones

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
