# 15 · WhatsApp (Cloud API de Meta)

> **Estado al 17-oct-2026:** construida la base (webhook, envío, plantillas y la
> pantalla de Administración → WhatsApp) para la revisión de Meta. Todavía **no
> está conectado ningún número real**: se prueba con el número de prueba de Meta.
> Sin deploy. El plan completo (números por área, conversaciones dentro de la
> ficha, avisos automáticos) está en el informe de indicadores y en
> `docs/pendientes/`.

## Para qué existe

Para que Voltia PM mande y reciba mensajes de WhatsApp por la API oficial de
Meta, sin intermediarios. El objetivo es que lo que se le dice al cliente quede
registrado solo y que los avisos del recorrido puedan salir automáticos. Voltia
se anota como **proveedor tecnológico independiente** de Meta para poder
conectar números que ya se usan en la aplicación WhatsApp Business del celular
sin sacarlos de ahí (lo que Meta llama "coexistence").

No reemplaza a `services/whatsapp.service.ts` (Twilio), que manda avisos internos
y queda como está.

## Cómo se usa

**Administración → WhatsApp** (pestaña del grupo Sistema):

- **Conversaciones**: lista por número, con el último mensaje; a la derecha, el
  hilo con las tildes de enviado, entregado y leído (se refresca cada 3 s). Se abre
  una conversación nueva escribiendo un número.
- **Mandar**: una plantilla aprobada (con un campo por cada `{{n}}`) o texto libre.
  El texto libre solo se habilita si el número escribió en las últimas 24 horas.
- **Plantillas**: la lista de Meta con su estado (aprobada, en revisión, rechazada
  con el motivo, pausada) y el formulario para crear una y mandarla a aprobar.

Es la pantalla que se graba para la revisión de la aplicación en Meta.

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
Meta, base para medir el gasto).

## Permisos

| Qué | Permiso |
|---|---|
| Ver y usar Administración → WhatsApp (estado, conversaciones, enviar, plantillas) | `CONFIGURACION:EDIT` |
| Webhook | público, protegido por la firma de Meta |

Crear una plantilla queda en auditoría.

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

## Casos borde

- **Sin variables configuradas** la pantalla avisa qué falta y no manda nada; el
  webhook rechaza todo POST (sin `META_APP_SECRET` no hay firma válida posible).
- **Un número que nunca escribió** solo puede recibir plantillas.
- **Las conversaciones no están vinculadas todavía a leads ni a clientes**: se
  listan por teléfono. Vincularlas (por teléfono exacto, nunca por nombre) es el
  paso siguiente, junto con la pantalla de Conversaciones de Experiencia Solar.

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
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `GRAPH_API_VERSION`. Detalle en
`docs/DEPLOY.md` §2 y §6c.
