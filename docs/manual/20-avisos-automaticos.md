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

1. **Nuevo aviso** → se elige el disparador (agrupados: Venta, Obra, Etapas, UTE,
   Agenda). Debajo se ve en palabras cuándo pasa. En "Faltan N días para la obra"
   se eligen los días.
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
   entregado / leído), *Falló* o *No se mandó*, con el motivo. Pasando el mouse
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
| `obra.fecha_confirmada` | `PATCH /calendar/:id/confirm`, junto a `activarPorHecho("fecha_confirmada")` |
| `obra.reprogramada` | `PATCH /calendar/:id` y `PATCH /calendar/:id/reschedule`, solo cuando la fecha ya estaba confirmada y hay motivo (lo mismo que crea el check de reagenda) |
| `obra.proxima` (faltan N días) | job diario `avisosObraProxima()` en `avisos.job.ts`, 9:00 (`CRON_AVISOS_DIARIO`): obras **confirmadas** cuyo primer día es hoy + N |
| `etapa.completada:<StageType>` (incluye "Obra terminada" = EJECUCION_OBRA) | `syncStageProgress()` en `project.service.ts` (`justCompleted`) y el cierre manual `PATCH /projects/:p/stages/:s` |
| `ute.hito:<campo>` (10 hitos, sin `finalizedAt`) | `PATCH /ute-processes/:id`, solo cuando el hito pasa de vacío a una fecha; y `registrarConsultaUteEnviada()` en `email/send.service.ts` |
| `ute.habilitado` | `marcarHabilitacionEnProyecto()` en `ute-sync.service.ts` (con varios suministros, cuando terminan todos) |
| `agenda.creado:VISITA_TECNICA` / `:MANTENIMIENTO` | `crearAgendaEvento()` en `agenda.service.ts`, si el evento tiene proyecto |

- `emitirHecho()` no espera ni tira error: un aviso que falla nunca frena la
  carga de una fecha. `procesarHecho()` busca los avisos **ACTIVO** del
  disparador y llama a `mandarAviso()` por cada uno.
- `mandarAviso()`:
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
  3. Rellena el mensaje con `datosDelCliente()`. Si falta un dato (ej. la obra sin
     fecha), **no se manda** y queda el motivo.
  4. WhatsApp: `enviarPlantilla()` con la plantilla aprobada, al `clientPhone`
     del proyecto. Mail: `sendEmail({ type: "client_facing" })` con el layout de
     marca, al `clientEmail`, desde la casilla general.
  5. Si salió: interacción en la bitácora (`createInteraction`, canal, saliente,
     motivo SEGUIMIENTO, cierra `cierraCheck`) y entrada de auditoría del
     proyecto. El autor es el primer ADMIN (usuario de sistema).
- Plantilla de Meta (`plantilla.ts`): el texto con `{{cliente.nombre}}` se pasa a
  `{{1}}`, `{{2}}`… (`aFormatoMeta`); el orden queda en `plantillaVariables`. El
  nombre es `aviso_<nombre>_<4 hex>`, categoría UTILITY, idioma `es`.
- Estados (`AvisoAutomatico.estado`): WhatsApp `BORRADOR → EN_REVISION → LISTO |
  RECHAZADO`, `LISTO → ACTIVO ⇄ PAUSADO`; mail `BORRADOR → ACTIVO ⇄ PAUSADO`.
  El estado de Meta se trae al abrir la pantalla y cada 15 minutos
  (`CRON_AVISOS_PLANTILLAS`) mientras haya avisos de WhatsApp.
- Tablas: `avisos_automaticos` y `avisos_envios` (migración
  `20261030021111_avisos_automaticos`).

### Variables

| Variable | Qué pone | Con qué disparadores |
|---|---|---|
| `{{cliente.nombre}}` | primera palabra de `nombreCliente` (o `clientName`) | todos |
| `{{cliente.nombreCompleto}}` | `nombreCliente` o `clientName` | todos |
| `{{portal.link}}` | `PUBLIC_APP_URL` (o app.voltia.com.uy) + `/portal` | todos |
| `{{obra.fecha}}` / `{{obra.fechaFin}}` | primer y último día de los tramos de la obra, "martes 3 de noviembre" | los de obra |
| `{{evento.fecha}}` | la fecha del hito o de la visita | UTE y agenda |

## Permisos

- Ver la pantalla y el registro: `CONFIGURACION:VIEW` (`GET /api/avisos`,
  `/avisos/catalogo`, `/avisos/envios`).
- Crear, editar, mandar a Meta, activar, pausar, borrar: `CONFIGURACION:EDIT`.
- La pestaña está en Administración, que hoy solo ven los que tienen
  `USUARIOS:VIEW` (admin completo).

## Reglas y decisiones

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

- **Desde qué número sale el WhatsApp**: hoy, del número configurado en el
  servidor (`WHATSAPP_PHONE_NUMBER_ID`). Los números conectados desde
  Administración → WhatsApp (el de Experiencia Solar, etc.) todavía no se pueden
  elegir como remitente; la plantilla además tiene que estar en la cuenta de
  WhatsApp de ese número.
- **Cliente sin celular o sin mail** cargado en el proyecto → "No se mandó" con el
  motivo. El celular se normaliza a 598…; menos de 10 dígitos se considera
  inválido.
- **Reprogramación sin motivo** no dispara "Obra reprogramada" (es la misma
  condición que el pendiente de reagenda de Experiencia Solar).
- **"Faltan N días"** mira solo obras con fecha **confirmada** y el primer tramo;
  si se reprograma a otra fecha, puede volver a salir para la fecha nueva.
- **Cobros, tickets y portal** todavía no son disparadores: los cobros se marcan
  pagados en cinco lugares distintos y no hay un punto único donde engancharlos.
- Una plantilla que Meta pausa o desactiva después de aprobada se ve en el estado
  de la plantilla; el envío falla y queda "Falló" con el error de Meta.
