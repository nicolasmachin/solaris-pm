# 15 · WhatsApp (Cloud API de Meta)

> **Estado al 27-oct-2026:** la base (webhook, envío, plantillas) está en
> producción con las variables cargadas, el webhook verificado por Meta y la app
> "Voltia PM" publicada; ida y vuelta probada con el número de prueba de Meta. La
> conexión de números reales (registro integrado, coexistencia) está hecha en
> desarrollo, **sin deploy**, y depende de que Voltia sea proveedor tecnológico
> de Meta. Todavía no hay ningún número real conectado. Los envíos siguen saliendo
> por el número de las variables de entorno. El plan completo (números por área,
> conversaciones dentro de la ficha, avisos automáticos) está en el informe de
> indicadores y en `docs/pendientes/`.

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

**Administración → WhatsApp** (pestaña del grupo Sistema):

- **Conversaciones**: lista por número, con el último mensaje; a la derecha, el
  hilo con las tildes de enviado, entregado y leído (se refresca cada 3 s). Se abre
  una conversación nueva escribiendo un número.
- **Mandar**: una plantilla aprobada (con un campo por cada `{{n}}`) o texto libre.
  El texto libre solo se habilita si el número escribió en las últimas 24 horas.
- **Plantillas**: la lista de Meta con su estado (aprobada, en revisión, rechazada
  con el motivo, pausada) y el formulario para crear una y mandarla a aprobar.

- **Números conectados** (arriba de todo): los números reales de Voltia conectados
  a Voltia PM, con para qué se usa cada uno, su responsable y cómo va la
  sincronización del historial. Abajo, **Conectar número**: se completa para qué
  es y el responsable, y se abre la ventana de Meta. El dueño del número entra
  con su Facebook, elige el portafolio de Voltia, elige "conectar la aplicación
  WhatsApp Business que ya usás" y escanea el código QR con el celular.

Las conversaciones y las plantillas son la pantalla que se graba para la revisión
de la aplicación en Meta.

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
  `response_type: "code"` y `extras.featureType: "whatsapp_business_app_onboarding"`
  (coexistencia). Meta devuelve los ids del número y de la cuenta por
  `postMessage` (tipo `WA_EMBEDDED_SIGNUP`, evento `FINISH…`) y el **código de
  un solo uso** en el callback del login. Llegan en cualquier orden: se esperan
  los dos (5 s de tope para los ids).
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

**Envío** (`api.service.ts`): `POST /{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}/messages`.

- `enviarPlantilla()` arma `template` con `components.body.parameters`.
- `enviarTexto()` exige la **ventana de 24 h**: un mensaje entrante de ese número
  en las últimas 24 horas (`ventanaAbierta()`); si no, `WHATSAPP_VENTANA_CERRADA`.
- Cada saliente se guarda con el id que devuelve Meta (`registrarSaliente()`).
  Si el webhook avisó un estado antes de que la fila existiera, se le aplica al
  crearla: esa carrera existe y por eso los estados viven en su propia tabla.
- `normalizarTelefono()`: celulares uruguayos al formato `598…`.

**Plantillas**: `crearPlantilla()` (`POST /{WABA_ID}/message_templates`, categoría
UTILITY o MARKETING, cuerpo con `{{n}}` y un ejemplo por hueco) y
`listarPlantillas()` (en vivo, sin tabla propia).

**Errores de Meta**: se devuelven como `502 META_ERROR` con el mensaje de Meta,
porque es lo que hay que corregir (una plantilla mal escrita, un número sin
ventana).

**Tablas** (migración `whatsapp_cloud_mensajes`, aditiva): `whatsapp_mensajes`
(dirección, teléfono, tipo, texto, plantilla, estado, error, quién lo mandó,
payload) y `whatsapp_estados` (cada cambio de estado con el precio que informa
Meta, base para medir el gasto). La migración `whatsapp_numeros_coexistencia`
(aditiva) suma `whatsapp_numeros` y la columna `whatsapp_mensajes.origen`
(`API` | `CELULAR` | `HISTORIAL`).

## Permisos

| Qué | Permiso |
|---|---|
| Ver y usar Administración → WhatsApp (estado, conversaciones, enviar, plantillas) | `CONFIGURACION:EDIT` |
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
- **Las conversaciones no están vinculadas todavía a leads ni a clientes**: se
  listan por teléfono. Vincularlas (por teléfono exacto, nunca por nombre) es el
  paso siguiente, junto con la pantalla de Conversaciones de Experiencia Solar.
- **Anuncios "click to WhatsApp"**: el primer mensaje trae un bloque `referral`
  (id y título del anuncio, URL, `ctwa_clid`), que hoy queda solo en
  `whatsapp_mensajes.payload`. Al vincular la conversación con un lead (o crearlo
  desde ella) hay que llamar a `origenDesdeAnuncio()` + `completarOrigenSiFalta()`
  de `services/sales/origen-lead.ts` (cap. 02, Origen del lead). Falta verificar
  con un anuncio de prueba que el `referral` llega también con el número en modo
  coexistencia; es una suposición.

## Archivos

- `server/src/services/whatsapp-cloud/`: `config.ts`, `firma.ts`,
  `webhook.service.ts`, `api.service.ts`, `whatsapp-cloud.test.ts`
  (`npm run test:whatsapp`).
- `server/src/routes/whatsapp-webhook.routes.ts`, `server/src/routes/whatsapp.routes.ts`.
- `server/scripts/whatsapp-suscribir-app.ts`: suscribe la aplicación a la cuenta
  de WhatsApp (`--ver` para solo listar).
- `client/src/pages/admin/WhatsAppAdminPage.tsx`, `client/src/api/whatsapp.api.ts`.

## Variables de entorno

`WHATSAPP_TOKEN`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `GRAPH_API_VERSION`. Para conectar
números: `META_APP_ID` (público) y `WHATSAPP_SIGNUP_CONFIG_ID` (el id de la
configuración de "Inicio de sesión con Facebook para empresas" del registro
integrado), además de `META_APP_SECRET` y `SMTP_ENCRYPTION_KEY`. Detalle en
`docs/DEPLOY.md` §2 y §6c.
