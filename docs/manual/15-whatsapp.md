# 15 · WhatsApp (Cloud API de Meta)

> **Estado al 27-oct-2026:** la base (webhook, envío, plantillas) está en
> producción con las variables cargadas, el webhook verificado por Meta y la app
> "Voltia PM" publicada; ida y vuelta probada con el número de prueba de Meta. La
> conexión de números reales (registro integrado, coexistencia) está hecha en
> desarrollo, **sin deploy**, y depende de que Voltia sea proveedor tecnológico
> de Meta. Todavía no hay ningún número real conectado. Los envíos siguen saliendo
> por el número de las variables de entorno.
>
> **1-nov-2026:** las conversaciones salieron de Administración a la **bandeja de
> Experiencia Solar** (número general), con el botón y la alerta en la ficha del
> cliente (en producción).
>
> **15-nov-2026, en desarrollo sin deploy:** la **bandeja de Ventas** (un número
> por asesor, unida a los leads, con la tarjeta en el panel del lead). Sigue sin
> haber números reales conectados: la configuración de registro integrado en Meta
> todavía no ofrece la variación de WhatsApp (solo "General"), aunque la revisión
> de la app ya se aprobó.
>
> **15/16-nov-2026, en producción:** primer número real conectado, el de July
> Correa (Ventas), en coexistencia. **No por el botón**: Meta no deja que el
> portafolio dueño de la app termine el registro integrado con su propia app, así
> que se dio de alta con el token del usuario del sistema (ver *Números propios
> de Voltia: alta directa*, abajo). El historial no se pudo traer.

## Para qué existe

Para que Voltia PM mande y reciba mensajes de WhatsApp por la API oficial de
Meta, sin intermediarios. El objetivo es que lo que se le dice al cliente quede
registrado solo y que los avisos del recorrido puedan salir automáticos. Voltia
se anota como **proveedor tecnológico independiente** de Meta para poder
conectar números que ya se usan en la aplicación WhatsApp Business del celular
sin sacarlos de ahí (lo que Meta llama "coexistence").

No reemplaza a `services/whatsapp.service.ts` (Twilio), que manda avisos internos
y queda como está.

Los **avisos automáticos al cliente** (disparador → plantilla) usan este módulo
para crear las plantillas en Meta y mandarlas: ver `20-avisos-automaticos.md`.
Las plantillas de los avisos se llaman `aviso_…` y también aparecen en la lista
de plantillas de esta pantalla.

## Cómo se usa

Hay dos lugares, y se separan a propósito: **Administración solo configura**; las
conversaciones se usan desde el módulo de cada área.

**Experiencia Solar → WhatsApp** (la bandeja del número general). La ve y la usa
solo el **responsable** del número (en Administración → WhatsApp) y el admin; a
los demás del área no se les muestra la pestaña ni la tarjeta de la ficha:

- **Se ve como WhatsApp Web** (pedido de Nicolás del 14-nov-2026): dos columnas,
  la lista de chats a la izquierda y el chat abierto a la derecha, con los colores
  de WhatsApp Web (claro) o los de su modo oscuro si Voltia PM está en oscuro.
- A la izquierda, los chats del número, el más reciente arriba. Cada uno lleva un
  **círculo con las iniciales** del cliente si su teléfono está cargado en un
  proyecto (o se asoció a mano); si no, la silueta gris y el número con formato
  (+598 99 123 456). A la derecha, la hora del último mensaje (hoy), *Ayer*, el día
  de la semana (esta semana) o la fecha. Abajo, el último mensaje en una línea, con
  los tildes si lo mandó Voltia. Los **no leídos** llevan el círculo verde con la
  cantidad de mensajes del cliente sin leer, y los **sin contestar** la etiqueta
  roja *Sin contestar*. Filtros *Todos* / *No leídos* / *Sin contestar* (con cuántos
  hay), y un buscador que también sirve para escribir un número: si no tiene chat,
  la lista ofrece *Empezar un chat con este número*.
- A la derecha, el chat (se refresca cada 4 s): fondo beige con un dibujo propio
  (soles, rayos, paneles; no es el de WhatsApp), burbujas verdes a la derecha para
  lo que mandó Voltia y blancas a la izquierda para lo del cliente, con la hora y
  los tildes de enviado, entregado y leído adentro, y separadores *Hoy* / *Ayer* /
  día / fecha. La primera burbuja de cada tanda lleva la "colita" y, si la mandó
  alguien desde Voltia PM, su nombre arriba. Lo escrito desde el celular lleva un
  ícono de teléfono. El nombre del cliente en el encabezado lleva a su ficha.
- **En el celular**, como WhatsApp: se ve la lista; al tocar un chat se abre a
  pantalla completa (tapa el menú de abajo) con la flecha para volver.
- **Mandar**: texto libre si el cliente escribió en las últimas 24 horas (la
  caja de abajo; **Enter manda**, Shift+Enter baja de línea; en pantallas táctiles
  Enter baja de línea y se manda con el botón). Fuera de esa ventana la caja se
  reemplaza por el aviso de las 24 horas y se abre el panel de **plantillas**
  aprobadas, que también se abre con el botón de la izquierda de la caja: se elige
  la plantilla, se completan los valores y se ve cómo va a quedar antes de mandarla.
- **Asociar a un cliente** (ícono de enlace en el encabezado del chat): para una
  conversación sin cliente (escribe desde un número que no está en la ficha). Se busca el cliente por nombre o teléfono. Se
  puede *quitar* después.
- **No hace falta contestar** (doble tilde verde en el encabezado): apaga la alerta de sin contestar (un "gracias", un
  "ok") hasta que el cliente vuelva a escribir.
- La pestaña muestra cuántas conversaciones tienen un mensaje sin contestar.

**Ventas → WhatsApp** (la bandeja del número de cada asesor):

- La misma bandeja que Experiencia Solar, pero con el número que tiene al asesor
  como responsable y las conversaciones unidas a **leads** en vez de clientes. El
  nombre del chat lleva al panel del lead; *Asociar a un lead* busca entre los
  leads que el asesor ve en Ventas.
- **Es del asesor**: la ve y la usa solo él (tampoco la gerencia comercial).
- **El admin** ve arriba un selector con cada asesor con número, y usa la del
  asesor elegido como si fuera suya (manda, asocia, *No hace falta contestar*),
  salvo que abrir un chat no se lo marca leído al asesor (decidido: queda no
  leído hasta que lo abra el dueño del número, aunque ya se haya contestado). *Mi
  número* aparece solo si el usuario tiene uno; si no, entra directo al primer
  asesor (`VentasWhatsApp.tsx`, compara `asesores` con el usuario logueado).
- Sin número propio y sin asesores con número, la pantalla dice cómo conectarlo.
- Se entra por el menú lateral de Ventas → **WhatsApp** (`VentasLayout.tsx`).
- Se entra desde la franja **WhatsApp** del tablero de Ventas (abajo de *Leads sin
  tomar* y de la de Instagram): en ámbar con quiénes esperan respuesta si hay
  conversaciones sin contestar. No aparece si el usuario no tiene número (salvo
  al admin, si hay asesores con número).
- **En el panel del lead**, tarjeta **WhatsApp** (columna derecha, arriba de
  *Pendientes*): los últimos 6 mensajes, la alerta "Escribió hace X y nadie le
  contestó" y el botón *Abrir conversación* / *Escribirle*, que lleva a la bandeja
  con el chat abierto. Se ve por el número propio; si el que mira es el admin sin
  número, por el del asesor asignado al lead. Si no hay número, la tarjeta no
  aparece.

**En la ficha del cliente** (Experiencia Solar → un generador):

- Al lado del teléfono, **WhatsApp**: abre la bandeja con su conversación.
- Tarjeta **WhatsApp** en la columna izquierda: los últimos 6 mensajes y el botón
  *Abrir conversación* (o *Escribirle* si nunca hubo mensajes).
- Si el cliente escribió y nadie le contestó: en la tarjeta, **"Escribió hace X y
  nadie le contestó"** con su mensaje, y en el encabezado la marca roja
  **WhatsApp sin contestar**, que también lleva a la conversación.

**Administración → WhatsApp** (configuración):

- **Números conectados**: los números reales de Voltia conectados a Voltia PM,
  con su **bandeja** (*Experiencia Solar* = el número general, uno solo; *Ventas*
  = el número de un asesor, que es el responsable), el responsable y cómo va la
  sincronización del historial. Poner un número como general pide confirmación,
  porque cambia quién ve sus conversaciones y por dónde salen los avisos
  automáticos. Abajo, **Conectar número**: se elige la bandeja y el responsable,
  y se abre la ventana de Meta. El dueño del número entra con su Facebook, elige
  el portafolio de Voltia, elige "conectar la aplicación WhatsApp Business que ya
  usás" y escanea el código QR con el celular.
- **Plantillas**: las de la cuenta del número general, con su estado (aprobada,
  en revisión, rechazada con el motivo, pausada) y el formulario para crear una y
  mandarla a aprobar.

## Cómo funciona

**Webhook** (`routes/whatsapp-webhook.routes.ts`), en `/webhooks/whatsapp`, sin
prefijo `/api` y sin login:

- `GET`: la verificación que hace Meta al guardar la URL. Devuelve `hub.challenge`
  si `hub.verify_token` coincide con `WHATSAPP_VERIFY_TOKEN`; si no, 403
  (`firma.ts` → `desafioSuscripcion()`).
- `POST`: valida `X-Hub-Signature-256` (HMAC-SHA256 del **cuerpo crudo** con
  `META_APP_SECRET`, comparación en tiempo constante, `firma.ts` → `firmaValida()`)
  y responde 401 si no coincide. Para tener el cuerpo crudo, el plugin registra su
  propio parser de JSON (`parseAs: "buffer"`), encapsulado: no afecta al resto de
  las rutas. Contesta 200 enseguida y procesa con `setImmediate`, porque Meta
  reintenta lo que no se le contesta rápido. Loguea el payload crudo, nunca el
  token.
- `procesarWebhook()` (`webhook.service.ts`) guarda los mensajes entrantes y los
  estados. **Idempotente**: `whatsapp_mensajes.waMessageId` es único y
  `whatsapp_estados` es único por (mensaje, estado); un duplicado se ignora.
- Al mensaje se le deja el **estado más avanzado** (sent < delivered < read <
  failed): "leído" a veces llega antes que "entregado".

**Conexión de números** (`numeros.service.ts`, registro integrado de Meta):

- El navegador (`WhatsAppNumeros.tsx` → `abrirRegistro()`) carga el SDK de
  Facebook y llama a `FB.login` con `config_id` (`WHATSAPP_SIGNUP_CONFIG_ID`),
  `response_type: "code"` y `extras: { version: "v5" }`. En la v5 la opción de
  conectar la app WhatsApp Business del celular (coexistencia) viene activada
  por defecto. **No volver a `featureType: "whatsapp_business_app_onboarding"`
  con `sessionInfoVersion: "3"`**: Meta dio de baja la v3 el 15-oct-2026 y un
  pedido sin versión válida lo atiende con la v4, que ignora ese `featureType` y
  ofrece solo "Agrega tu número de teléfono" (registrar el número para la API,
  que lo saca del celular). Meta devuelve los ids de la cuenta y, en general, del
  número por `postMessage` (tipo `WA_EMBEDDED_SIGNUP`, evento `FINISH…`) y el
  **código de un solo uso** en el callback del login. Llegan en cualquier orden:
  se esperan los dos (5 s de tope para los ids).
- Si Meta informa solo la cuenta (pasa en coexistencia), `conectarNumero()`
  busca el número con `GET /{waba}/phone_numbers` (`numeroDeLaCuenta()`): si la
  cuenta tiene exactamente uno lo usa; si tiene cero o varios, corta con error.
- `conectarNumero()`: canjea el código (`GET /oauth/access_token` con app id y
  secreto; **vence a los 30 segundos**), lee el número (`is_on_biz_app`,
  `display_phone_number`, `verified_name`), suscribe la app a la cuenta
  (`POST /{waba}/subscribed_apps`) y guarda todo en `whatsapp_numeros`, con el
  token cifrado (`email/crypto.ts` → `encryptSecret()`, clave
  `SMTP_ENCRYPTION_KEY`). Reconectar el mismo número actualiza la fila.
- **En coexistencia no se llama a `/register`**: el número ya está registrado en
  la aplicación del celular.
- `sincronizarNumero()`: pide contactos (`smb_app_state_sync`) y después
  historial (`history`) con `POST /{phone_number_id}/smb_app_data`. **Meta deja
  pedir cada uno una sola vez y dentro de las 24 h** de conectar; si falla, queda
  `syncError` y la pantalla ofrece "Reintentar" mientras esté en plazo.

**Webhook de coexistencia** (`procesarWebhook()`):

- `smb_message_echoes`: lo que el dueño escribe desde el celular. Se guarda como
  saliente con `origen = CELULAR`.
- `history`: las conversaciones de hasta 6 meses atrás, por tandas que pueden
  llegar desordenadas. Cada mensaje se guarda con `origen = HISTORIAL`; los del
  negocio se reconocen porque traen `to`. `historialProgreso` solo sube. Si el
  dueño tiene apagado "compartir historial", llega el error 2593109 y queda en
  `historialError`.
- `account_update` con `PARTNER_REMOVED`: el número se desconectó; pasa a
  `DESCONECTADO`. El formato exacto de ese aviso no se verificó con un caso real.
- `smb_app_state_sync` (la agenda del celular) **no se guarda**: los clientes ya
  están en Voltia PM.
- El log del webhook ya no imprime el cuerpo: solo los campos y el tamaño, porque
  el historial trae conversaciones enteras.

**Bandejas** (`bandejas.service.ts`):

- **Qué número es cada bandeja**: `bandejaExperienciaSolar()` toma el número con
  `uso = EXPERIENCIA_SOLAR` y estado `CONECTADO` (el más nuevo; al marcar uno, el
  resto pierde ese uso: `soltarExperienciaSolar()`). **Si no hay ninguno, cae al
  número de las variables de entorno.** Devuelve una `Cuenta` (phone number id,
  WABA y token descifrado) que se pasa a todas las llamadas a Meta.
  `bandejaVentas(asesorId)` toma el número con `uso = VENTAS`, responsable = el
  asesor y `CONECTADO`; **sin número no hay bandeja** (no cae al de las variables
  de entorno, que es el general). Cada `Bandeja` lleva su `area`, que decide si
  las conversaciones se unen a proyectos o a leads.
- **Conversaciones**: `listarConversaciones()` agrupa `whatsapp_mensajes` por
  teléfono **dentro del número de la bandeja** (`phoneNumberId`), con el último
  mensaje y la hora del último del cliente.
- **Cliente de la conversación**: primero la asociación a mano
  (`whatsapp_conversaciones.projectId` en Experiencia Solar, `leadId` en Ventas);
  si no hay, el proyecto (o el lead, en Ventas: `leadsPorTelefono()`) cuyo
  `clientPhone` normalizado coincide (`telefonosDe()` parte el campo si trae más
  de un número; si dos comparten teléfono gana el más nuevo). En Ventas se busca
  entre **todos** los leads no borrados, no solo los del asesor. **Nunca por
  nombre.**
- **No leída**: hay un mensaje del cliente posterior a `leidoHasta`. La cantidad
  (`noLeidos`, el número del círculo verde) cuenta esos entrantes en la misma
  consulta de `ultimosPorTelefono()`; la lista también trae `ultimoEstado` (el
  estado del último mensaje si es saliente) para los tildes de la vista previa. Abrir la
  conversación en la bandeja la marca leída si la abre el responsable del número
  (o cualquiera, si no tiene); el admin mirando el de otro no se la marca. Mirar
  la ficha no la marca.
- **Sin contestar**: el último mensaje de la conversación es del cliente y es
  posterior a `resueltoHasta` (*No hace falta contestar*). Un mensaje escrito
  desde el celular (eco de coexistencia) cuenta como respuesta.
- **Contacto en el historial**: el primer mensaje del día que se le manda a un
  cliente desde la bandeja crea una interacción `WHATSAPP` saliente ("WhatsApp
  desde Voltia PM: …") en su historial (`registrarContactoDelDia()`), para que
  cuente como contacto en la cadencia sin llenar el historial con cada renglón.
  Sin motivo: no cierra pasos del recorrido. Lo escrito desde el celular y lo que
  escribe el cliente **no** pasan al historial. En Ventas es lo mismo con una
  `SalesActivity` del lead (acción "WhatsApp desde Voltia PM", el texto en las
  notas; `registrarContactoDelDiaLead()`).
- `whatsappDeProyecto()` / `whatsappDeLead()`: lo que muestran la ficha y el
  panel del lead (comparten `resumenDeConversaciones()`). Usan los teléfonos
  cargados (salvo los asociados a mano a otro) más los asociados a mano a este.
- **Quién ve y usa cada número** (decisión de Nicolás del 15-nov-2026, reemplaza
  la del 1-nov de "el general lo usa cualquiera de Experiencia Solar"):
  `puedeUsarBandeja()` deja pasar al **responsable** del número y al **ADMIN**; un
  número sin responsable (o el de las variables de entorno) lo usa cualquiera con
  el permiso del módulo. En Experiencia Solar, al que no puede, la lista y la
  tarjeta de la ficha le responden vacías con `deOtro` (el nombre del
  responsable) y la pestaña WhatsApp se oculta; el resto de las rutas, 403. En
  Ventas, todas las rutas aceptan `?asesor=<id>`, que solo el ADMIN puede usar
  para otro asesor (403 al resto). `marcaLeida()`: abrir un chat lo marca leído
  solo si lo abre el responsable (el admin no le apaga los no leídos al dueño;
  *No hace falta contestar* sí los apaga, porque deja resuelto).
  `rutasDeBandeja()` arma las mismas rutas para las dos áreas.

**Envío** (`api.service.ts`): `POST /{GRAPH_API_VERSION}/{phone_number_id}/messages`
con el token de la cuenta que se le pasa (`Cuenta`); sin cuenta, la de las
variables de entorno (`cuentaDelServidor()`).

- `enviarPlantilla()` arma `template` con `components.body.parameters`.
- `enviarTexto()` exige la **ventana de 24 h**: un mensaje entrante de ese
  teléfono **a ese número de Voltia** en las últimas 24 horas (`ventanaAbierta()`);
  si no, `WHATSAPP_VENTANA_CERRADA`. Escribirle a un asesor no abre la ventana del
  número general.
- Cada saliente se guarda con el id que devuelve Meta (`registrarSaliente()`).
  Si el webhook avisó un estado antes de que la fila existiera, se le aplica al
  crearla: esa carrera existe y por eso los estados viven en su propia tabla.
- `normalizarTelefono()`: celulares uruguayos al formato `598…`.

**Plantillas**: `crearPlantilla()` (`POST /{WABA_ID}/message_templates`, categoría
UTILITY o MARKETING, cuerpo con `{{n}}` y un ejemplo por hueco) y
`listarPlantillas()` (en vivo, sin tabla propia). **Las plantillas son de la
cuenta (WABA), no de Voltia**: un número conectado con el registro integrado
puede tener su propia cuenta. Administración y los avisos automáticos usan la
cuenta del número general. Si se cambia el número general por otro de otra
cuenta, las plantillas de los avisos hay que volver a mandarlas a aprobar.

**Errores de Meta**: se devuelven como `502 META_ERROR` con el mensaje de Meta,
porque es lo que hay que corregir (una plantilla mal escrita, un número sin
ventana).

**Tablas** (migración `whatsapp_cloud_mensajes`, aditiva): `whatsapp_mensajes`
(dirección, teléfono, tipo, texto, plantilla, estado, error, quién lo mandó,
payload) y `whatsapp_estados` (cada cambio de estado con el precio que informa
Meta, base para medir el gasto). La migración `whatsapp_numeros_coexistencia`
(aditiva) suma `whatsapp_numeros` y la columna `whatsapp_mensajes.origen`
(`API` | `CELULAR` | `HISTORIAL`). La migración `whatsapp_bandejas` (aditiva)
suma `whatsapp_numeros.uso` y `whatsapp_conversaciones` (por número y teléfono:
`leidoHasta`, `resueltoHasta`, cliente o lead asociado a mano; `leadId` lo usa la
bandeja de Ventas, que no necesitó migración propia).

## Permisos

| Qué | Permiso |
|---|---|
| Bandeja de Experiencia Solar: ver, mandar, marcar, asociar a un cliente; la tarjeta de la ficha | `EXPERIENCIA_CLIENTES:VIEW` + ser el responsable del número general o ADMIN (sin responsable: cualquiera del módulo). Escribirle al cliente es el trabajo del módulo: no se pide EDIT |
| Bandeja de Ventas propia: ver, mandar, marcar, asociar a un lead; la tarjeta del panel del lead | `VENTAS:VIEW` + tener un número de Ventas a su nombre |
| Ver y usar la bandeja de Ventas de otro asesor | `VENTAS:VIEW` + rol ADMIN |
| Administración → WhatsApp (estado, números, plantillas) | `CONFIGURACION:EDIT` |
| Conectar números, editar responsable y para qué, reintentar la sincronización | `CONFIGURACION:EDIT` |
| Webhook | público, protegido por la firma de Meta |

Crear una plantilla y conectar un número quedan en auditoría.

## Reglas y decisiones

- **Meta directo, sin intermediario** (decidido el 17-oct-2026): sin costo fijo
  por número. 360dialog cobra €49 por número por mes y Twilio no permite usar el
  número en el celular a la vez.
- **Una aplicación de Meta aparte** ("Voltia PM"), no la de Indicadores, para que
  la revisión quede limpia.
- **El webhook vive en producción**: el servidor de desarrollo está cerrado a
  internet a propósito, así que en desarrollo solo se prueba con payloads armados
  (ver los tests).
- **La versión de la Graph API va en variable** (`GRAPH_API_VERSION`, por defecto
  `v26.0`, la vigente desde julio de 2026).

- **Coexistencia exige ser proveedor tecnológico** de Meta (Tech Provider). Sin
  eso, la ventana de Meta no ofrece conectar la aplicación del celular.
- **Lo que se pierde al conectar un número** (según Meta): se desvinculan los
  dispositivos vinculados (WhatsApp Web, la computadora) y hay que volver a
  vincularlos; las listas de difusión dejan de andar; por la API no hay grupos,
  llamadas, mensajes temporales ni de ver una vez. El número queda en 20 mensajes
  por segundo. Si el celular pasa unos 14 días sin abrir WhatsApp Business, Meta
  desconecta el número.

## Casos borde

- **Sin variables configuradas** la pantalla avisa qué falta y no manda nada; el
  webhook rechaza todo POST (sin `META_APP_SECRET` no hay firma válida posible).
- **Un número que nunca escribió** solo puede recibir plantillas.
- **Un cliente que escribe desde otro número** aparece solo con su número (sin cliente) hasta que
  alguien lo asocia a mano. La asociación vale solo para ese número de Voltia.
- **Si Meta no devuelve las plantillas**, la bandeja sigue andando sin ellas (se
  loguea el error): el texto libre no las necesita.
- **Fotos, audios, videos, documentos y stickers** (ver *Archivos*, abajo) se
  bajan de Meta al llegar y se muestran en la burbuja. Las reacciones y las
  ediciones se guardan pero se muestran como «[reaction]» / «[edit]».
- **Las plantillas mandadas** se ven como *Plantilla · nombre*: el texto que
  recibió el cliente no se guarda en `whatsapp_mensajes`, así que el chat no lo
  muestra.
- **El nombre de perfil de WhatsApp** de quien escribe llega en el bloque
  `contacts` de cada mensaje entrante y se guarda en
  `whatsapp_conversaciones.nombrePerfil` (se pisa con el último). La bandeja lo
  muestra como «~ Nombre» mientras el chat no sea de nadie. Los chats anteriores
  al 16-nov-2026 no lo tienen hasta que la persona vuelva a escribir. No se puede
  mandar un archivo desde la bandeja.
- **No hay aviso cuando entra un mensaje** (ni campanita ni push): se ve en la
  pestaña, en la bandeja y en la ficha.
- **Plantillas en Ventas**: la bandeja del asesor lista las plantillas de la
  cuenta (WABA) **de su número**. Si el registro integrado le crea una cuenta
  propia, las plantillas aprobadas en la del número general no le sirven y hay
  que aprobarlas de nuevo ahí. Es una suposición sobre cómo arma Meta las cuentas
  al conectar; se confirma con el primer número real.
- **Un asesor con dos números de Ventas**: la bandeja usa el conectado más nuevo.
- **Un lead que se gana** sigue en la bandeja del asesor (unido al lead); la
  conversación no pasa sola a la de Experiencia Solar, que es otro número.
- **Anuncios "click to WhatsApp"**: el primer mensaje trae un bloque `referral`
  (id y título del anuncio, URL, `ctwa_clid`), que hoy queda solo en
  `whatsapp_mensajes.payload`. Al vincular la conversación con un lead (o crearlo
  desde ella) hay que llamar a `origenDesdeAnuncio()` + `completarOrigenSiFalta()`
  de `services/sales/origen-lead.ts` (cap. 02, Origen del lead). Falta verificar
  con un anuncio de prueba que el `referral` llega también con el número en modo
  coexistencia; es una suposición.

## Archivos (desde v14.9)

- **Al llegar** (entrante, eco del celular o historial), `guardarMensaje()` del
  webhook dispara `bajarArchivoDeFondo()` (`media.service.ts`): `GET /{media_id}`
  con el token del número (o el del servidor) da una URL que vence en minutos;
  se baja con el mismo token y se guarda en `storage/whatsapp/<phoneNumberId>/
  <id del mensaje>.<ext>` (`archivoPath`, `archivoMime` de `whatsapp_mensajes`).
  Las fotos se pasan a JPG de hasta 1600 px (`comprimirFoto()`); los videos se
  pasan de fondo a MP4 720p con `transcodeToStandard()` (el de los videos de
  obra); audios y documentos quedan como llegan.
- **Lo que no se bajó** (lo anterior a esto, o si Meta falló) se baja la primera
  vez que se abre: `GET …/bandeja/…/mensajes/:id/archivo` (`archivoDeMensaje()`).
  Meta guarda los archivos unos 30 días; pasado eso queda `archivoError`. La
  pantalla los pide con la sesión (`blobArchivo()`, porque la autenticación va
  por encabezado) y los muestra en `ArchivoWhatsApp` de `BandejaWhatsApp.tsx`.
- **Audios**: después de bajarlos se transcriben con Whisper (`transcribir()`,
  función de IA `whatsapp_audio`, queda en el gasto de IA) a
  `whatsapp_mensajes.transcripcion`. Si falla, el audio se escucha igual.
- **Mandar**: `POST …/enviar-archivo` (multipart: `telefono`, `caption`,
  `notaDeVoz`, archivo) → `mandarArchivo()`: achica (`comprimir()`), convierte
  las notas de voz grabadas en el navegador (webm) a OGG/Opus con ffmpeg
  (`aNotaDeVoz()`: es el único formato que WhatsApp muestra como nota de voz),
  controla los límites de WhatsApp (`LIMITE_ENVIO`: foto 5 MB, audio y video
  16 MB, documento 100 MB), guarda la copia y llama a `enviarArchivo()`
  (`api.service.ts`): `POST /{phone_number_id}/media` y después `/messages` con
  el id. Solo con la ventana de 24 h abierta. El mensaje queda con `archivoPath`
  (no se vuelve a pedir a Meta) y el bloque del archivo en `payload`.
- **Limpieza**: `scripts/whatsapp-limpiar-archivos.ts --dias N [--aplicar]`
  (N ≥ 30) borra los archivos de los mensajes de más de N días; el mensaje queda
  con su texto y su transcripción, marcado `BORRADO_EN_LIMPIEZA` para no volver a
  pedirlo. No corre solo: se corre a mano cuando haga falta.

## Asistente del primer mensaje (Ventas, desde v14.9)

`services/whatsapp-cloud/asistente.service.ts`. Reglas en la automatización
`whatsapp` (`server/config/instagram/whatsapp.md`, editable en Marketing →
Automatizaciones; disparador `whatsapp`), con `{ASESOR}` = primer nombre del
responsable del número y `{DATOS}` = el texto `_datos`. Usa `pedirJson()` del
asistente de Instagram (modelo `INSTAGRAM_MODELO`, función de IA
`whatsapp_asistente`).

- **Cuándo**: `alEntrarMensaje()` desde el webhook, por cada entrante, si el
  número es de Ventas, está CONECTADO, tiene responsable y `asistente` ≠ APAGADO,
  y la automatización está activa. Programa (`asistenteEstado = PROGRAMADO`,
  `asistenteEn` = espera de la automatización, 120–300 s; de 21 a 8 de Uruguay,
  a las 8 + 2–12 min, `cuandoContestar()`) solo si el chat es nuevo: ningún
  saliente, ningún entrante de más de 24 h, y `clienteDe()` sin lead, proyecto ni
  usuario del equipo. Un `unsupported` (131060) no se programa. Cada entrante
  nuevo corre la espera.
- **El job** (`revisarAsistente()`, cada 10 s, arrancado en `index.ts`): toma lo
  vencido una sola vez. `contestar()`: si una persona ya escribió (saliente con
  `origen` ≠ ASISTENTE), pasa a HUMANO; si no, Claude devuelve `{mensajes,
  derivar, motivo}`. `derivar` → `pasarAlAsesor()`; sin mensajes → HUMANO; en
  PRUEBA → SOMBRA con `asistenteSombra`; si no, ENVIANDO con
  `asistentePendientes` y `mandarSiguiente()` de a uno (`enviarTexto()` con
  `origen: "ASISTENTE"`, sin `enviadoPor`), 20–40 s entre uno y otro. Si escribe
  una persona en el medio, se corta (HUMANO). Al terminar, SPEECH.
- **Después del speech**: el próximo entrante del cliente → `pasarAlAsesor()`
  (ASESOR, `asistenteMotivo`, notificación `whatsapp_requiere_asesor` al
  responsable con link a la bandeja). Si es foto o documento, «Mandó la factura:
  para cotizar» y `crearLead()` (origen OTRO, «WhatsApp (contestó el asistente
  de Ventas)», asignado al responsable) asociado a la conversación.
- **Pantalla**: `listarConversaciones()` devuelve `asistente {estado, motivo}`;
  la lista muestra punto verde en SPEECH y el motivo en la etiqueta roja cuando
  pasó al asesor (el «sin contestar» es el de siempre: el último mensaje es del
  cliente). `asistenteDe()` alimenta el aviso arriba del chat (`AvisoAsistente`).
  Administración → WhatsApp: `whatsapp_numeros.asistente` (APAGADO | PRUEBA |
  ACTIVO), solo para números de Ventas, auditado.
- **Género del asesor**: `{ASESOR_CARGO}` y `{ATENTO}` salen de `generoDe()`
  (`proposal/salutation.ts`, la del saludo de las cartas) con el primer nombre
  del responsable: «asesora comercial» / «quedo atenta», «asesor comercial» /
  «quedo atento», o, sin señal, «del equipo comercial» / «quedo a las órdenes».
  Si un nombre sale mal, se agrega a `FEMENINOS` o `MASCULINOS` de ese archivo.
- **Supuesto sin verificar**: que un mensaje que el cliente manda justo mientras
  el asistente manda el speech se tome como respuesta (lo pasa al asesor, que es
  lo seguro).

## Quién es cada chat (CRM, desde v14.9)

`porTelefonoDe()` en `bandejas.service.ts` arma teléfono → quién, de menor a
mayor prioridad:

1. el teléfono suelto del lead (Ventas) o del proyecto (Experiencia Solar), como
   antes (`leadsPorTelefono()`, `proyectosPorTelefono()`);
2. el **contacto** del CRM con ese teléfono (`contactosPorTelefono()`): nombre de
   la persona (con su empresa principal) y, por él, su lead más nuevo (Ventas) o
   su proyecto más nuevo (Experiencia Solar); sin lead ni proyecto, solo el
   contacto (`contactoId`, código «Contacto» o «Contacto de la empresa»);
3. un **usuario del equipo** con ese teléfono en su perfil (`usuariosPorTelefono()`,
   salvo el rol CLIENT, que son los clientes del portal y se llama «Generador»):
   código «Equipo Voltia · <rol>» e `interno: true`.

La asociación a mano gana sobre todo. `whatsapp_conversaciones` tiene, además de
`leadId` y `projectId`, `contactoId` y `usuarioId`; `asociarCliente()` recibe el
id del lead o proyecto, o `contacto:<id>` / `usuario:<id>`, y deja una sola
asociación. Las conversaciones **internas** no cuentan como sin contestar.

En la pantalla (`BandejaWhatsApp.tsx`), el buscador de *Asociar* junta lo de la
bandeja (leads o clientes) con `GET /crm/contactos` y `GET /crm/usuarios`, y
ofrece *+ Crear contacto con este número* (`POST /crm/contactos`, con el nombre de
perfil precargado): una vez creado, el chat se reconoce solo por el teléfono.
Esas dos rutas aceptan VENTAS o EXPERIENCIA_CLIENTES (VIEW para buscar, CREATE
para crear). El nombre del chat lleva al lead o cliente; si solo hay contacto, a
`/ventas/contactos?id=`; un usuario del equipo no tiene enlace.

El WhatsApp del panel del lead y de la ficha del cliente
(`whatsappDeLead()` / `whatsappDeProyecto()`) junta el teléfono del lead o
proyecto con el de su contacto.

## Números propios de Voltia: alta directa

Lo que pasó al conectar el número de July (15-nov-2026), porque va a pasar con
**todos** los números de Voltia:

- **El registro integrado usa la v5 de Meta** (`extras: { version: "v5" }` en
  `abrirRegistro()`). La v3 con `featureType: "whatsapp_business_app_onboarding"`
  se dio de baja el 15-oct-2026; desde entonces Meta atiende ese pedido como v4,
  que ignora el `featureType` y ofrece solo "Agrega tu número" (registrar para la
  API, que saca el número del celular). En la v5 la coexistencia viene por
  defecto.
- **En la v5 no hay una pantalla de "conectar la app WhatsApp Business"**: en
  "Agrega tu número de teléfono" se deja "Crea uno nuevo" y se escribe el número
  que ya está en la app; Meta lo detecta, muestra el perfil del negocio y sigue
  con el QR. Peligro real solo si después pide un **código por SMS**: ahí es el
  camino de número nuevo.
- **El QR se escanea desde el celular**: WhatsApp Business → chat de *Facebook
  Business* → *Conectar*. En un Xiaomi entró en un bucle de "Desbloquea para
  vincular" (huella/PIN) que se resolvió **apagando el desbloqueo facial**.
- **El último paso falla** con `#1690130 "<id> no es un identificador del negocio
  válido"`: el portafolio que elige (Voltia, 297023135227633) es el dueño de la
  app, y Meta no deja "compartirse" el número a sí mismo. El portafolio aparece
  fijo, sin opción de elegir otro. El número **igual queda conectado** en
  coexistencia dentro del portafolio Voltia.
- **Alta directa**: `scripts/whatsapp-alta-directa.ts` lo registra en
  `whatsapp_numeros` con el token del usuario del sistema `voltia-pm`
  (`WHATSAPP_TOKEN`) en vez del token de la integración, con
  `registrarNumero()` de `numeros.service.ts` (lo mismo que hace el botón después
  de canjear el código). Antes hay que darle a `voltia-pm` **acceso total** a la
  cuenta (Configuración del negocio → Cuentas de WhatsApp → la cuenta → Asignar
  personas).
- **Las dos cuentas de Meta**: desde 2026 Meta separa la *cuenta de WhatsApp*
  (la que guarda el número; su id sale en Configuración del negocio → Cuentas de
  WhatsApp, `selected_asset_id`) de la *cuenta de mensajes* (Cuentas → Cuentas de
  mensajes). La API solo acepta la de mensajes: con la otra responde `#100 /
  2388339 "This API is not supported for this WhatsApp Business Account"`. Al
  script se le pasa `--waba <id de la cuenta de mensajes>`, porque el token del
  sistema no tiene `business_management` para listarlas.
- **El historial y los contactos no se traen**: `smb_app_data` responde "This API
  is only available to WhatsApp Business App phone numbers onboarded on to
  WhatsApp Business Platform", porque el registro integrado no terminó. Mandar,
  recibir y los mensajes escritos desde el celular (`smb_message_echoes`) sí
  andan.
- **Mensajes `unsupported` con error `131060 "This message is unavailable"`**:
  limitación de la coexistencia. Pasa con el primer mensaje de alguien que nunca
  le escribió a ese número (le pasó al de prueba de Nicolás y al de un lead nuevo
  el 16-nov) y, según proveedores, cuando el mensaje pasa por un dispositivo
  vinculado que Meta no replica (WhatsApp para Windows, Wear OS). El mensaje está
  en el celular; a la API no llega el contenido y no hay forma de pedirlo. La
  bandeja lo muestra como «Mensaje no disponible acá: miralo en el celular»
  (`TIPOS.unsupported` en `BandejaWhatsApp.tsx`).
- **Para el próximo número**: botón Conectar número hasta el QR (ignorar el error
  del final) → asignar `voltia-pm` a la cuenta de mensajes → Administración →
  WhatsApp → «¿Meta cortó al final…? Terminá el alta acá» (`AltaDirecta` en
  `WhatsAppNumeros.tsx`): se pega la dirección o el ID de la cuenta de mensajes,
  `GET /whatsapp/numeros/directo?waba=` (`numerosDeCuenta()`) lista sus números
  (si sigue en el celular, si ya está en Voltia PM) y `POST
  /whatsapp/numeros/directo` (`altaDirecta()` → `registrarNumero()` con
  `WHATSAPP_TOKEN`) lo da de alta con bandeja y responsable. Si se pega el ID de
  la cuenta de WhatsApp en vez del de mensajes, lo dice. El script
  `scripts/whatsapp-alta-directa.ts` sigue andando para el servidor.
- **Uso `DIRECCION`** (desde v15.0): el número de trabajo de la Dirección. No
  tiene bandeja en Voltia PM; se lee y se contesta desde el chat de Claude
  (capítulo 13, *WhatsApp: el secretario*). Reconoce a cada uno como cliente si
  ya lo es y si no como lead (`contactosPorTelefono()`), sin asistente ni avisos
  automáticos.

## Archivos

- `server/src/services/whatsapp-cloud/`: `config.ts`, `firma.ts`,
  `webhook.service.ts`, `api.service.ts`, `numeros.service.ts`,
  `bandejas.service.ts`, tests (`npm run test:whatsapp`).
- `server/src/routes/whatsapp-webhook.routes.ts`, `server/src/routes/whatsapp.routes.ts`
  (configuración), `server/src/routes/whatsapp-bandejas.routes.ts` (bandejas).
- `server/scripts/whatsapp-suscribir-app.ts`: suscribe la aplicación a la cuenta
  de WhatsApp (`--ver` para solo listar).
- `client/src/pages/admin/WhatsAppAdminPage.tsx`, `WhatsAppNumeros.tsx`,
  `client/src/api/whatsapp.api.ts`.
- `client/src/components/whatsapp/BandejaWhatsApp.tsx` (la bandeja, reutilizable
  por área vía `BandejaApi`; exporta `Burbuja` y `ListaMensajes`, que usa la ficha)
  y `whatsapp-web.css` (paleta `--wa-*` clara y oscura, el dibujo del fondo y el
  hueco de la hora en las burbujas), `client/src/modules/clientes/pages/WhatsAppESPage.tsx`,
  `client/src/modules/clientes/components/ClienteWhatsAppCard.tsx`.
- Ventas: `client/src/pages/VentasWhatsApp.tsx`,
  `client/src/components/sales/whatsappVentas.ts` (la `BandejaApi` por asesor),
  `WhatsAppParaVentas.tsx` (la franja) y `LeadWhatsAppCard.tsx` (el panel del lead).

## Variables de entorno

`WHATSAPP_TOKEN`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `GRAPH_API_VERSION`. Para conectar
números: `META_APP_ID` (público) y `WHATSAPP_SIGNUP_CONFIG_ID` (el id de la
configuración de "Inicio de sesión con Facebook para empresas" del registro
integrado), además de `META_APP_SECRET` y `SMTP_ENCRYPTION_KEY`. Detalle en
`docs/DEPLOY.md` §2 y §6c.
