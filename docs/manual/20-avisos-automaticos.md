# 20 · Avisos automáticos al cliente

## Para qué existe

Para que el cliente se entere de los hechos de su proyecto sin depender de que
alguien se acuerde de escribirle: se confirma la fecha de obra, faltan dos días
para la obra, UTE aprobó el proyecto, UTE habilitó. Cada aviso se arma desde
Administración: se elige **cuándo sale** (el disparador) y **qué dice** (el
mensaje), por **WhatsApp** o por **mail**.

Cambia una regla que regía desde mayo de 2026: "el sistema no le escribe al
cliente por su cuenta". Decisión de Nicolás del 29-10-2026: los avisos que se
configuran acá sí salen solos. Lo demás sigue igual: los mensajes modelo de
Experiencia Solar los sigue mandando una persona, y el resto de los mails
internos sigue con el bloqueo `internal` / `client_facing`.

## Cómo se usa

**Administración → Procesos y reglas → Avisos automáticos.**

1. **Nuevo aviso** → se elige el disparador (agrupados: Venta, Experiencia Solar,
   Obra, Etapas, UTE, Agenda). Debajo se ve en palabras cuándo pasa. En "Faltan N
   días para la obra" se eligen los días.
   - **Sale**: *enseguida* o *después de…* N horas o días del hecho (la demora).
   - **Condición**: *Ninguna*; *Solo si Experiencia Solar no le escribió al
     cliente desde el hecho* (el recordatorio de obra, los cambios de fecha: si
     una persona ya se ocupó, no sale); o, para el acceso al portal, *Clientes
     con mail* / *Clientes sin mail*: el usuario del portal se crea si falta, y a
     cada cliente le sale solo el de su caso (se arman dos avisos con el mismo
     disparador).
2. Se elige el canal (WhatsApp o mail; después no se cambia) y un nombre.
3. Se escribe el mensaje. Los botones de arriba insertan los datos que tiene ese
   disparador (`{{cliente.nombre}}`, `{{obra.fecha}}`…). Abajo se ve cómo le
   llega, con datos de ejemplo.
4. Opcional: **"Paso de Experiencia Solar que deja hecho"**. Cuando el aviso sale,
   ese paso del recorrido (E1/E2/E3) queda tildado, para que nadie le mande lo
   mismo a mano.
5. **WhatsApp**: "Guardar y mandar a Meta". El estado pasa a *En revisión de
   Meta*. Cuando Meta lo aprueba (minutos u horas) pasa a *Aprobado, sin activar*
   y aparece **Activar**. Si lo rechaza, queda *Rechazado por Meta* con el motivo:
   se corrige el texto y se manda de nuevo.
   **Mail**: no pasa por Meta, se guarda y se activa.
6. **Activar**: desde ese momento sale con cada hecho nuevo. **Pausar** lo frena.
7. **Ver envíos** (por aviso) o **Registro de envíos** (todos): cuándo, a qué
   cliente, a qué número o mail, y el resultado — *Enviado* (en WhatsApp además
   entregado / leído), *Falló*, *No se mandó*, con el motivo, o *Programado*
   (con cuándo sale, o "Espera a que Experiencia Solar haga la bienvenida"). Pasando el mouse
   por la fila se ve el texto tal cual salió.

Lo que sale queda además en la **bitácora del cliente** (Experiencia Solar →
ficha → interacciones) como "Aviso automático «nombre»: …", y en la auditoría
del proyecto.

## Cómo funciona

- Catálogo de disparadores: `server/src/services/avisos/disparadores.ts`
  (`DISPARADORES`, `VARIABLES`). Cada disparador está enganchado en un punto del
  código con `emitirHecho()` (`services/avisos/emitir.ts`):

| Disparador | Dónde se engancha |
|---|---|
| `proyecto.creado` (Venta cerrada) | `POST /leads/:id/convert` en `api.routes.ts` |
| `encuesta.creada:<OBRA\|HABILITACION\|ANIVERSARIO>` | `crearEncuestaSiNoExiste()` en `encuestas.service.ts`, solo cuando la crea (ref: id de la encuesta) |
| `reporte.publicado` / `reporte.primero` | `avisarReportePublicado()` en `reportesFv/envio.service.ts`, en los dos lugares donde la emisión queda `publicadoEnPortal`: enviada por mail, o sin mail publicada solo en el portal. `reporte.publicado` lleva de ref la emisión; `reporte.primero` sale si no hay otra emisión publicada del proyecto, sin ref (una vez por proyecto) |
| `es.bienvenida` (Bienvenida hecha) | `recorrido.service.ts` → `alHacerseLaBienvenida()`, cuando se cierra el paso `e1_bienvenida` (a mano en `completarCheck()` o solo en `cerrarChecks()`) |
| `obra.fecha_confirmada` | `PATCH /calendar/:id/confirm`, junto a `activarPorHecho("fecha_confirmada")`, por `avisarFechaConfirmada()` (`cambios-de-fecha.ts`). **No sale** si el cliente esperaba fecha nueva tras una suspensión |
| `obra.suspendida` | `POST /calendar/:id/suspender` (obra confirmada que se suspende sin fecha nueva). Ref: la fecha cancelada, que va fijada como `{{obra.fecha}}` (`datosFijos`): la obra ya no tiene fecha |
| `obra.fecha_nueva_tras_suspension` | `avisarFechaConfirmada()`, al confirmar la fecha de un proyecto con `esperandoFechaNuevaDesde`: borra la marca y sale esto **en lugar de** `obra.fecha_confirmada`. Pero si el aviso de `obra.suspendida` todavía estaba `PROGRAMADO` (el cliente no se enteró de la suspensión), ese se cancela ("No se mandó") y se dispara `obra.reprogramada`, que le cuenta el cambio con la fecha nueva |
| `obra.reprogramada` | `PATCH /calendar/:id` y `PATCH /calendar/:id/reschedule`, solo cuando la fecha ya estaba confirmada y hay motivo (lo mismo que crea el check de reagenda) |
| `obra.proxima` (faltan N días) | job diario `avisosObraProxima()` en `avisos.job.ts`, 9:00 (`CRON_AVISOS_DIARIO`): obras **confirmadas** cuyo primer día es hoy + N. Para `SIN_CONTACTO`, `contactoDesde` es `confirmedAt`: "Experiencia Solar no le escribió desde que se confirmó la fecha" |
| `etapa.completada:<StageType>` (incluye "Obra terminada" = EJECUCION_OBRA) | `syncStageProgress()` en `project.service.ts` (`justCompleted`) y el cierre manual `PATCH /projects/:p/stages/:s` |
| `ute.hito:<campo>` (10 hitos, sin `finalizedAt`) | `PATCH /ute-processes/:id`, solo cuando el hito pasa de vacío a una fecha; y `registrarConsultaUteEnviada()` en `email/send.service.ts` |
| `ute.habilitado` | `marcarHabilitacionEnProyecto()` en `ute-sync.service.ts` (con varios suministros, cuando terminan todos) |
| `agenda.creado:VISITA_TECNICA` / `:MANTENIMIENTO` | `crearAgendaEvento()` en `agenda.service.ts`, si el evento tiene proyecto |

- `emitirHecho()` no espera ni tira error: un aviso que falla nunca frena la
  carga de una fecha. `procesarHecho()` busca los avisos **ACTIVO** del
  disparador y llama a `mandarAviso()` por cada uno.
- `mandarAviso()` reserva y decide; `enviarEnvio()` manda. `salirEn` (el hecho +
  la demora) se guarda al reservar, así el job reintenta lo que tuvo que esperar:
  1. **Reserva el hecho**: crea la fila de `avisos_envios` con
     `claveHecho = disparador|proyecto|referencia` (único por aviso). Si ya
     existe, no hace nada. Así un hecho manda cada aviso **una sola vez**, aunque
     se reabra la etapa o se borre y vuelva a cargar la fecha. La referencia es el
     suministro en los hitos de UTE, la fecha nueva en confirmada / reprogramada /
     faltan N días, el id del evento en la agenda; en etapas y venta, ninguna
     (una vez por proyecto).
  2. **Solo hechos posteriores a la activación**: `ocurrioEn` ≥ `activadoEn` − 1
     día (las fechas de UTE se cargan sin hora). Y no más viejos que
     `ANTIGUEDAD_MAX_DIAS` = 7: una fecha cargada con atraso no avisa algo viejo.
     Se mira **al llegar el hecho**: lo que después espera (la demora, la
     bienvenida) no lo vuelve viejo.
  3. **Demora** (`demoraMinutos`): si el hecho + la demora todavía no llegó, el
     envío queda `PROGRAMADO` con `salirEn`. La demora cuenta desde el hecho, no
     desde que se procesó.
  4. **Nada antes de la bienvenida** (`bienvenidaHecha()`): si el proyecto tiene
     el paso `e1_bienvenida` sin hacer, queda `PROGRAMADO` con el detalle "Espera
     a que Experiencia Solar haga la bienvenida", sin descartarse. Un proyecto sin
     ese paso (los de antes del recorrido) no espera; el aviso de la bienvenida
     misma tampoco. Se vuelve a mirar al salir.
  5. `enviarEnvio()` toma el envío (`PROGRAMADO`/`PROCESANDO` → `ENVIANDO`, para
     que no salga dos veces) y revisa: que el aviso siga `ACTIVO` (si se pausó o
     borró mientras esperaba, "No se mandó"), la bienvenida y la **condición**.
     `SIN_CONTACTO` (`leEscribieronDesde()`): no sale si desde `contactoDesde`
     (el hecho, o lo que diga el disparador) hay una interacción de la bitácora
     saliente o sin dirección, o un WhatsApp saliente a alguno de los teléfonos del
     proyecto (desde cualquier número de Voltia, incluido lo escrito desde el
     celular). Los avisos automáticos no cuentan: en la bitácora empiezan con
     `PREFIJO_BITACORA` y en WhatsApp se reconocen por el `waMessageId` guardado
     en `avisos_envios`.
     `PORTAL_CON_MAIL` / `PORTAL_SIN_MAIL`: primero `asegurarUsuarioPortal()`
     (`portal-user.service.ts`) le crea el usuario si no tiene; si no se puede,
     "Falló" con el motivo. Después sale solo si el usuario es del caso del aviso
     (tiene mail o no); si no, "No se mandó: le corresponde el otro aviso".
  6. Rellena el mensaje con `datosDelCliente()`. Si falta un dato (ej. la obra sin
     fecha), **no se manda** y queda el motivo.
  7. WhatsApp: `enviarPlantilla()` con la plantilla aprobada, al `clientPhone`
     del proyecto. Mail: `sendEmail({ type: "client_facing" })` con el layout de
     marca, al `clientEmail`, desde la casilla general.
  8. Si salió: interacción en la bitácora (`createInteraction`, canal, saliente,
     motivo SEGUIMIENTO, cierra `cierraCheck`) y entrada de auditoría del
     proyecto. El autor es el primer ADMIN (usuario de sistema).
- **Usuario del portal con la venta**: al convertir el lead
  (`POST /leads/:id/convert`) se llama también a `asegurarUsuarioPortal()`, que
  lo crea siempre (decisión de Nicolás del 15-11-2026: el mail no es condición):
  con mail, el usuario es el mail, sin contraseña conocida, y entra con el código
  por mail; sin mail, un alias nombre.apellido sacado de `clientName`
  (`aliasPorNombre`, aunque haya cédula) con `CONTRASENA_INICIAL_PORTAL`
  (12345678, la misma de Experiencia Solar) y `passwordTemporary`, que el portal
  le pide cambiar al entrar. Ese alta **no cierra** el paso
  `e1_portal` del recorrido: lo cierra el aviso de acceso al portal al salir (con
  `cierraCheck`) o Experiencia Solar al mandarlo.
- **Envíos programados**: el job `enviarProgramados()` (`avisos.job.ts`, cada 2
  minutos, `CRON_AVISOS_PROGRAMADOS`) manda los `PROGRAMADO` con `salirEn` ya
  pasado, de a 200. Al hacerse la bienvenida, `alHacerseLaBienvenida()` libera los
  del proyecto sin esperar al job. Los datos del mensaje se calculan al salir
  (ej. la fecha de obra vigente), salvo los que el hecho fijó en `datosFijos`.
- Plantilla de Meta (`plantilla.ts`): el texto con `{{cliente.nombre}}` se pasa a
  `{{1}}`, `{{2}}`… (`aFormatoMeta`); el orden queda en `plantillaVariables`. El
  nombre es `aviso_<nombre>_<4 hex>`, categoría UTILITY, idioma `es`.
- Estados (`AvisoAutomatico.estado`): WhatsApp `BORRADOR → EN_REVISION → LISTO |
  RECHAZADO`, `LISTO → ACTIVO ⇄ PAUSADO`; mail `BORRADOR → ACTIVO ⇄ PAUSADO`.
  El estado de Meta se trae al abrir la pantalla y cada 15 minutos
  (`CRON_AVISOS_PLANTILLAS`) mientras haya avisos de WhatsApp.
- Tablas: `avisos_automaticos` y `avisos_envios` (migración
  `20261030021111_avisos_automaticos`; la demora, la condición y los envíos
  programados, `20261115213917_avisos_demora_bienvenida`, aditiva).

### Variables

| Variable | Qué pone | Con qué disparadores |
|---|---|---|
| `{{cliente.nombre}}` | primera palabra de `nombreCliente` (o `clientName`) | todos |
| `{{cliente.nombreCompleto}}` | `nombreCliente` o `clientName` | todos |
| `{{portal.link}}` | `PUBLIC_APP_URL` (o app.voltia.com.uy) + `/portal` | todos |
| `{{portal.usuario}}` | el usuario del portal del proyecto: su mail, o el alias si no tiene (`usuarioPortalDe()`) | todos (sin usuario, el aviso no sale por falta de dato) |
| `{{portal.acceso}}` | `/login?usuario=<usuario>`: abre el login con el usuario ya escrito (`Login.tsx` lee `?usuario=`) | todos |
| `{{obra.fecha}}` / `{{obra.fechaFin}}` | primer y último día de los tramos de la obra, "martes 3 de noviembre" | los de obra |
| `{{evento.fecha}}` | la fecha del hito o de la visita | UTE y agenda |

## Permisos

- Ver la pantalla y el registro: `CONFIGURACION:VIEW` (`GET /api/avisos`,
  `/avisos/catalogo`, `/avisos/envios`).
- Crear, editar, mandar a Meta, activar, pausar, borrar: `CONFIGURACION:EDIT`.
- La pestaña está en Administración, que hoy solo ven los que tienen
  `USUARIOS:VIEW` (admin completo).

## Reglas y decisiones

- **Ningún aviso sale antes de la bienvenida** de Experiencia Solar (decisión de
  Nicolás, 15-11-2026): lo que pasa antes espera, no se descarta.
- **No hay modo prueba** (decisión de Nicolás, 29-10-2026): el aviso se activa y
  sale. Lo que protege es que solo cuentan hechos posteriores a la activación y
  que cada hecho sale una vez.
- **Cambiar el texto de un aviso de WhatsApp lo apaga**: vuelve a borrador hasta
  que Meta apruebe el texto nuevo (es otra plantilla). En mail el cambio rige al
  instante.
- **Reglas de Meta que se validan antes de mandar**: el mensaje no puede empezar
  ni terminar con una variable, ni tener dos variables seguidas, ni más de un
  renglón en blanco seguido, ni pasar de 1024 caracteres.
- **Fuera de producción no se le escribe a ningún cliente**: WhatsApp va a
  `AVISOS_DEV_TELEFONO` (si está) o no sale; el mail sigue la redirección de
  desarrollo (`DEV_EMAIL_REDIRECT_TO`).
- Apagado general: `AVISOS_AUTOMATICOS=false`.
- Los generadores cargados por planilla (`importedFromCsv`) no reciben avisos.

## Casos borde

- **Desde qué número sale el WhatsApp**: del **número general**, el que tiene la
  bandeja *Experiencia Solar* en Administración → WhatsApp
  (`bandejas.service.ts` → `bandejaExperienciaSolar()`); si no hay ninguno
  conectado, del número de las variables de entorno. La plantilla se crea y se
  consulta en la cuenta de ese número. **Si se cambia el número general por uno
  de otra cuenta de WhatsApp, las plantillas de los avisos ya aprobadas no están
  en la cuenta nueva**: hay que editarlas y volver a mandarlas a Meta.
- **Cliente sin celular o sin mail** cargado en el proyecto → "No se mandó" con el
  motivo. El celular se normaliza a 598…; menos de 10 dígitos se considera
  inválido.
- **Reprogramación sin motivo** no dispara "Obra reprogramada" (es la misma
  condición que el pendiente de reagenda de Experiencia Solar).
- **"Faltan N días"** mira solo obras con fecha **confirmada** y el primer tramo;
  si se reprograma a otra fecha, puede volver a salir para la fecha nueva.
- **Proyectos con la bienvenida sin hacer** no reciben nada hasta que se haga: hay
  clientes ya habilitados que tienen ese paso abierto desde antes de que existiera
  el recorrido; para que les lleguen los avisos, Experiencia Solar tiene que
  tildar la bienvenida.
- **Un aviso que se pausa con envíos programados**: al llegar su hora no salen
  ("El aviso se pausó o se borró antes de salir"). Reactivarlo no los recupera.
- **Cobros, tickets y portal** todavía no son disparadores: los cobros se marcan
  pagados en cinco lugares distintos y no hay un punto único donde engancharlos.
- Una plantilla que Meta pausa o desactiva después de aprobada se ve en el estado
  de la plantilla; el envío falla y queda "Falló" con el error de Meta.
