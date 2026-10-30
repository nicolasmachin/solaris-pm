# 20 · Marketing

> **Estado al 29-oct-2026:** la bandeja de Instagram está hecha en desarrollo,
> **sin deploy** y **sin conectar todavía**: falta que el conector de
> indicadores le mande las conversaciones a Voltia PM y atienda los pedidos de
> mandar y de tomar (`docs/pendientes/marketing-instagram-conector.md`). Las
> pruebas de la lógica pasan (`npm run test:instagram-marketing`), y la ida y
> vuelta se probó en local con un conector de mentira (recibir, firma mala
> rechazada, reenvío sin duplicar, mandar, tomar, devolver, crear lead). Con el
> conector real no se probó porque ese lado todavía no existe. WhatsApp (los
> mensajes que llegan por los anuncios) está anunciado en la pantalla pero no
> empezado.

## Para qué existe

Para que Marketing atienda desde Voltia PM los mensajes que entran por las redes
y los anuncios, sin abrir Instagram en el celular. Lo primero es Instagram: los
privados a @voltia_uy los contesta un asistente con Claude desde el 29-oct-2026,
y hacía falta una pantalla para ver qué contestó, contestar a mano, callarlo
cuando una persona se hace cargo y pasar a Ventas lo que es un cliente.

**El contestador no vive en Voltia PM.** Está en el servidor del conector de
indicadores (indicadores.voltia.com.uy): ahí llega el webhook de Meta, ahí está
el token de la página, ahí contesta Claude con las reglas de Nicolás y ahí se
controla el gasto. Voltia PM guarda una **copia** de las conversaciones y le pide
al conector lo que haya que hacer. Se decidió así el 29-oct-2026 para no
duplicar la conexión con Meta (un webhook por aplicación) y para que el asistente
se entere de todo lo que se contesta a mano.

## Cómo se usa

Menú **Marketing** (`/marketing`, `pages/Marketing.tsx`). Arriba, los canales:
**Instagram** y **WhatsApp** (deshabilitado, "próximamente").

**Instagram** es una bandeja de dos columnas (en el celular, una a la vez):

- **Izquierda, las conversaciones**, la más reciente arriba: nombre o @usuario,
  el último mensaje (con "Asistente:" o "Voltia:" si no lo escribió el cliente),
  un megáfono si la persona escribió por un anuncio, la etiqueta **Derivada** o
  **Tomada**, y la cantidad de mensajes sin leer. Buscador (nombre, usuario,
  texto del último mensaje) y filtros **Todas · Sin leer · Derivadas ·
  Tomadas**. Se refresca cada 10 segundos.
- **Derecha, la conversación**: los mensajes con colores por autor (cliente a la
  izquierda; asistente en celeste; una persona de Voltia en verde, con su
  nombre; ManyChat o el celular en gris). Arriba, quién la atiende, si vino de un
  anuncio y **hasta cuándo se le puede escribir**. Se refresca cada 5 segundos.
- **Tomo yo**: el asistente deja de contestar en esa conversación hasta que
  alguien toque **Devolver al asistente**. No vence sola.
- **Contestar**: caja de texto abajo (Enter manda, Mayúscula+Enter es otra
  línea; hasta 1000 caracteres, el tope de Instagram). Solo se habilita con la
  ventana de Meta abierta. Si se contesta sin tomar la conversación, el
  asistente se calla 30 minutos (regla del conector) y después puede volver a
  contestar.
- **Crear lead**: nombre (precargado con el de Instagram), teléfono y notas.
  El lead nace con el origen ya puesto —«Anuncio en Instagram o Facebook» si
  escribió por un anuncio, «Redes sociales (sin anuncio)» si no— y el detalle
  «Instagram @usuario». **Nace sin vendedor**: va a la franja «Leads sin
  tomar» de Ventas y les llega un aviso a los comerciales; el primero que lo toma
  se lo queda (capítulo 02, "Leads sin tomar"). Desde ahí la conversación
  muestra el link al lead.

Al abrir una conversación queda leída **para todo el equipo** (no es por
usuario).

## Cómo funciona

**Copia de las conversaciones** (`routes/instagram-conector-webhook.routes.ts`,
`services/instagram-marketing/`):

- El conector manda a `POST /webhooks/instagram-conector` (sin `/api`, sin
  login) **la conversación entera** cada vez que cambia, firmada con
  `X-Voltia-Firma: sha256=<HMAC del cuerpo crudo>` con el secreto compartido
  `INSTAGRAM_CONECTOR_SECRETO`. La firma se valida con la misma función que el
  webhook de WhatsApp (`whatsapp-cloud/firma.ts` → `firmaValida()`). Sin secreto
  configurado, rechaza todo.
- `bandeja.service.ts` → `guardarDesdeConector()` es **idempotente**: agrega los
  mensajes nuevos (llave = id de Meta; si no hay, momento + autor + hash del
  texto, `conversacion.ts` → `claveDe()`), corrige el autor de los que cambiaron
  (un eco que el conector primero guardó como "otro") y **nunca borra**. Un
  mensaje mandado desde Voltia PM no cambia de autor.
- Con `historial: true` (la carga inicial) las conversaciones nuevas nacen
  leídas.
- Tablas: `instagram_conversaciones` (una por persona, llave `persona` = id de
  Instagram) e `instagram_mensajes` (autor `CLIENTE`, `ASISTENTE`, `PERSONA` u
  `OTRO`).

**Pedidos al conector** (`conector.ts`): `POST /api/privados/enviar` y
`POST /api/privados/tomar` en `INSTAGRAM_CONECTOR_URL`, con
`Authorization: Bearer <secreto>` y 20 s de tope. Sin las variables, contestan
503 y la pantalla avisa que no está conectado. Al mandar, el mensaje se guarda
enseguida con el id de Meta que devuelve el conector, así el eco no lo duplica.

**Estado y ventana** (`conversacion.ts`, lógica pura con pruebas):

- **Tomada** si alguien la tomó desde Voltia PM; **Derivada** si el asistente la
  derivó hace menos de 7 días; si no, la atiende el **Asistente**.
- Ventana de Meta: 24 h desde el último mensaje del cliente, 7 días si vino de un
  anuncio. Voltia PM la controla antes de pedir el envío y el conector la vuelve
  a controlar.
- **Tomar lo decide Voltia PM**: lo que diga la conversación del conector sobre
  eso no se mira. Primero se le avisa al conector y, si contesta bien, se guarda.

Cada respuesta, toma y devolución queda en la auditoría (`instagram_conversacion`).
El alta del lead usa `crearLead()` de Ventas, con su propia auditoría, sin
vendedor, y después `avisarLeadSinTomar()`.

## Permisos

| Permiso | Qué habilita |
|---|---|
| `MARKETING:VIEW` | Entrar a Marketing y ver las conversaciones |
| `MARKETING:EDIT` | Contestar, Tomo yo / Devolver, Crear lead |

Rol **MARKETING** (nuevo, migración `20261030030100_marketing_permisos`): ve y
edita Marketing, más los permisos de lectura que tienen todos los roles internos
(Documentación y Mi legajo). **ADMIN** también ve y edita. Al resto se le habilita
desde la matriz de permisos si hace falta.

El webhook del conector no tiene permiso de usuario: lo protege la firma.

## Reglas y decisiones

- **Crear el lead no pide `VENTAS:CREATE`**: alcanza con `MARKETING:EDIT`. Es a
  propósito: pasar a Ventas lo que entra por las redes es trabajo de Marketing.
  Para verlo y trabajarlo después sí hace falta Ventas.
- El "leído" es uno solo para todos: la bandeja la atiende un equipo chico y
  sirve más saber si *alguien* la miró.
- La bandeja muestra hasta 300 conversaciones (las más recientes).

## Casos borde

- Si el conector está caído, la bandeja muestra lo último que llegó; mandar y
  tomar dan error ("El contestador de Instagram no responde").
- Si una toma se hizo en Voltia PM pero el conector no la guardó (se cayó entre
  medio), Voltia PM no la marca: primero tiene que contestar bien el conector.
- Los adjuntos (fotos, audios) llegan como el texto que arma el conector
  ("[Mandó: image]"); no se ven las imágenes.
- Una persona que nunca escribió (solo hay mensajes de Voltia) tiene la ventana
  cerrada.
