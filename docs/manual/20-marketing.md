# 20 · Marketing

> **Estado al 30-oct-2026:** hecho y probado en desarrollo, **sin deploy**.
> Pruebas: `npm run test:instagram-marketing` (lógica) y
> `scripts/instagram-ensayo.ts` (el circuito entero contra la base de
> desarrollo, con Meta y Claude de mentira). Con Meta de verdad no se probó
> desde Voltia PM: eso es el modo sombra del primer paso de la migración (ver
> «La migración» abajo). WhatsApp (los mensajes de los anuncios) está anunciado
> en la pantalla pero no empezado.

## Para qué existe

Para atender desde Voltia PM todo lo que entra por Instagram (@voltia_uy) sin
ManyChat: un asistente con Claude contesta los privados con las reglas de
Nicolás, hace los lead magnets (una palabra en un comentario → el contenido por
privado), contesta comentarios, hace el seguimiento del día siguiente y deriva a
Ventas lo que es un cliente. Marketing ve todo en una bandeja, puede contestar a
mano y callar al asistente, y tiene la base de contactos con etiquetas y las
consultas por día.

**Decisión del 29-oct-2026** (encargo de Tabaré con el aval de Nicolás): Voltia
PM es el único dueño de la lógica de Instagram. El servidor del conector de
indicadores (indicadores.voltia.com.uy) **sigue siendo el dueño del token de
Meta** (lo renueva solo y lo usan también los anuncios y las métricas) y se lo
pasa a Voltia PM: un solo token, un solo vencimiento. Hasta el 29-oct el
contestador vivía allá y Voltia PM iba a ser una copia; eso quedó al revés.

**Las métricas arrancan de cero** (decisión de Nicolás del 30-oct): el historial
de ManyChat y del contestador de indicadores se importa para verlo (quién vuelve,
a quién ya le llegó el speech), pero no cuenta en ninguna cifra.

## Cómo se usa

Menú **Marketing** (`/marketing`, `pages/Marketing.tsx` y
`components/marketing/InstagramPanel.tsx`). Arriba, los canales: **Instagram** y
**WhatsApp** (deshabilitado, "próximamente").

Arriba de todo, una franja dice en qué está el asistente: **contestando** (verde),
**en sombra** (celeste: arma las respuestas y no las manda) o **apagado**
(amarillo); el gasto del mes contra el tope, y a quién deriva.

Cuatro pestañas:

**Conversaciones.** Bandeja de dos columnas (en el celular, una a la vez):

- Izquierda, las conversaciones, la más reciente arriba: nombre o @usuario, el
  último mensaje ("Asistente:" o "Voltia:" si no lo escribió el cliente), un
  megáfono si escribió por un anuncio, **Derivada** o **Tomada**, y los no
  leídos. Buscador y filtros **Todas · Sin leer · Derivadas · Tomadas**. Se
  refresca cada 10 segundos.
- Derecha, la conversación, con colores por autor (cliente a la izquierda;
  asistente en celeste; una persona de Voltia en verde, con su nombre; ManyChat
  o el celular en gris). Entre los mensajes, en recuadros punteados, lo que
  decidió el asistente cuando **no** contestó ("No contestó: pasó la ventana de
  Instagram") y, en modo sombra, **lo que habría contestado**, con el texto.
- **Tomo yo**: el asistente deja de contestar en esa conversación hasta
  **Devolver al asistente**. No vence sola.
- **Contestar** (Enter manda; hasta 1000 caracteres): sale directo por
  Instagram, solo con la ventana de Meta abierta. Si se contesta sin tomar la
  conversación, el asistente se calla 30 minutos y después puede volver.
- **Crear lead**: nombre, teléfono y notas; nace con el origen puesto («Anuncio
  en Instagram o Facebook» o «Redes sociales (sin anuncio)») y el detalle
  «Instagram @usuario», y queda vinculado a la conversación y al contacto.

**Automatizaciones.** Una tarjeta por automatización, con **PRENDIDA** o
**APAGADA** bien a la vista, qué la dispara, la palabra clave, el link que manda,
la espera, el tope diario y lo que hizo en los últimos 7 días. **Ver flujo**
muestra el texto que sigue el asistente; **Editar** lo cambia (y las palabras y
el link, en las de comentarios); **Prender / Apagar**. Abajo, los dos textos que
usan todas: «Datos de Voltia» y la parte común de los comentarios.

| Automatización | Qué la dispara | Qué hace |
|---|---|---|
| Contestador de mensajes privados (`privados`) | Un privado | Contesta con las reglas de Nicolás (speech, precio, pedir factura y techo), deriva a Ventas |
| Lead magnet AHORRO (`ahorro`) | Un comentario con «ahorro» | Privado con el link https://voltia.com.uy/ahorro y respuesta pública variada |
| Respuestas a comentarios (`comentarios`) | Cualquier otro comentario | Contesta en público si vale la pena, o avisa a Nicolás |
| Seguimiento del speech (`seguimiento`) | 20 a 23,5 h después del speech sin respuesta | Un mensaje corto para retomar |

**Contactos.** La base de contactos (lo que cobraba ManyChat): toda persona que
escribió o comentó, con sus etiquetas. Filtro por etiqueta (con la cantidad de
cada una) y buscador. Los marcados **historial** vienen de la carga de ManyChat;
sus etiquetas se ven en gris.

**Consultas por día.** Los últimos 14 días: cuántos escribieron (nuevos, por
anuncio, orgánico), a cuántos se les contó el speech (la cifra IG de la
planilla), derivadas, leads, lead magnets y comentarios contestados.

## Cómo funciona

Todo en `server/src/services/instagram-marketing/`.

**Entrada.** `routes/instagram-webhook.routes.ts`: `GET /webhooks/instagram`
(verificación de Meta con `INSTAGRAM_VERIFY_TOKEN`) y `POST /webhooks/instagram`
(cada aviso, firmado con la clave de la app de Meta **"Voltia Indicadores"**,
`INSTAGRAM_APP_SECRET`; se valida con `whatsapp-cloud/firma.ts`). Se contesta 200
enseguida y se procesa después. `aviso.ts` lee los mensajes (con los botones
apretados como si fueran texto, los ecos, el anuncio y los adjuntos como
"[Mandó: image]") y los comentarios.

**Privados** (`privados.ts`):

1. `registrarMensaje()` guarda el mensaje (llave = id de Meta: los reintentos no
   duplican; el eco de algo que mandó Voltia PM no cambia nada; un eco que no es
   nuestro queda como `OTRO`: ManyChat o el celular). Si es del cliente y la
   automatización está prendida, agenda la respuesta en `responderDesde` = ahora
   + un tiempo al azar entre `esperaMinSeg` y `esperaMaxSeg` (45-150 s). Cada
   mensaje nuevo corre la espera.
2. El job (`instagram.job.ts`, cada 10 s) toma las vencidas —cada una una sola
   vez, con un `updateMany` condicionado— y llama a `atender()`.
3. `porQueNo()` (lógica pura) decide si no contesta: apagado, ya contestado,
   fuera de la ventana (24 h, 7 días si vino de un anuncio), **tomada**,
   escribió ManyChat o una persona hace menos de 30 minutos, derivada hace
   menos de 7 días, o tope de gasto.
4. Pide el perfil a Meta (usuario, nombre, si sigue a la cuenta) y le pasa a
   Claude la conversación (últimos 30 mensajes; lo de ManyChat y de personas
   como "[Escribió Voltia por otro lado]") con el flujo de la automatización y
   los datos de Voltia (con caché), y aparte lo propio de la conversación (de
   dónde vino, si sigue, si ya recibió el speech, la hora en Uruguay).
5. Claude devuelve JSON: `mensajes`, `derivar`, `lead`, `speech`, `temas`,
   `motivo` (`ESQUEMA`). Si deriva y no puso el WhatsApp, se agrega.
6. Si mientras pensaba escribió alguien más, no manda. Si no, manda de a uno con
   "escribiendo…" y pausas según el largo (2 a 9 s), y corta si alguien se mete.
7. Guarda el speech y la derivación, etiqueta el contacto y, si derivó, manda
   mail a `INSTAGRAM_DERIVAR_MAIL` (Martín) con copia a `INSTAGRAM_AVISOS_MAIL`
   (Nicolás) con la conversación entera.

**Seguimiento** (`revisarSeguimientos()`, cada 10 minutos): `tocaSeguimiento()`
(lógica pura) pide speech mandado, nada del cliente ni de nadie después, no
derivada ni tomada, un solo seguimiento por speech, entre 20 y 23,5 h desde el
último mensaje del cliente (siempre dentro de las 24 h de Meta), de lunes a
sábado de 8 a 21 (Uruguay). Se marca antes de mandar. Hasta 2 mensajes.

**Comentarios** (`comentarios.ts`):

1. `recibir()` descarta los de @voltia_uy y las respuestas dentro de un hilo,
   elige la automatización (`elegirParaComentario()`: primero las de palabra
   clave, que se buscan sin tildes ni mayúsculas y al principio de una palabra;
   si no, la general) y lo guarda en `instagram_comentarios` con su
   `atenderDesde`. La llave es el id del comentario: nunca se atiende dos veces.
2. El job lo levanta (`PENDIENTE` → `PROCESANDO` → `HECHO`) y `atender()`:
   controla que la publicación sea del perfil de @voltia_uy, le pasa a Claude el
   comentario, la publicación, si esa persona ya recibió el privado en los
   últimos 30 días y las últimas respuestas (para no repetirlas).
3. Si Claude pide avisar (quejas, legales, prensa, presupuesto con datos), mail
   a Nicolás y nada más.
4. Si la automatización tiene link, **primero el privado** como respuesta
   privada al comentario, con el botón "Quiero más info" (si Meta no acepta el
   botón, sale sin él), y queda en la conversación con de dónde vino la persona.
   Si el privado falla —por ejemplo porque ManyChat ya lo mandó— no se contesta
   en público. Después la respuesta pública, con los controles de `responder()`:
   hasta 500 caracteres, publicación propia, no es de @voltia_uy ni está dentro
   de un hilo, nunca dos respuestas al mismo comentario (ni en la base ni en
   Instagram) y el tope diario de cada automatización.

**Automatizaciones** (`automatizaciones.ts`): tabla `marketing_automatizaciones`.
Al arrancar el server, `sembrarAutomatizaciones()` crea las que falten desde
`server/config/instagram/*.md` (encabezado entre `+++`, una `clave = valor` por
línea con valores JSON, y el flujo debajo). **Nunca pisa** lo que ya está en la
base: lo que se edita en la pantalla manda. Los que empiezan con "_" son los
textos comunes. En el flujo, `{DATOS}`, `{FLUJO}`, `{LINK}`, `{DERIVAR_A}` y
`{DERIVAR_WHATSAPP}` los completa Voltia PM.

**Contactos** (`contactos.ts`): `instagram_contactos` + `instagram_contacto_etiquetas`
(primera y última vez y cuántas veces). Un contacto se conoce por el id de
Instagram o, si solo comentó, por el usuario; cuando aparecen los dos, se unen.
Etiquetas fijas (`ETIQUETA`) más «Tema: …» (lo que dice Claude), «Comentó
AHORRO», «Recibió AHORRO». Guardar un contacto nunca corta una respuesta.

**Registro** (`registro.ts`): cada decisión queda en `instagram_eventos` (tipo,
resultado, razón, automatización, sombra, speech/lead/derivado, costo, y en
`datos` los mensajes y el motivo). De ahí salen las métricas, la actividad de
cada automatización y lo que se ve en la bandeja.

**Gasto**: lo de Claude queda en `ai_usage` (features `instagram_privados` e
`instagram_comentarios`). Tope `INSTAGRAM_TOPE_USD` (30) por mes de Uruguay;
mail al 80 % y al 100 %, una vez por mes cada uno. Al tope deja de contestar.
Cada respuesta cuesta del orden de US$ 0,0003 con Haiku 5.5.

**Token de Meta** (`meta.ts`): Voltia PM pide el token vigente a
`<INSTAGRAM_CONECTOR_URL>/interno/token-meta` con `Authorization: Bearer
<INSTAGRAM_CONECTOR_SECRETO>` (cacheado 30 min) y con él el de la página Voltia
(cada hora). Ningún token se loguea. Si indicadores no contesta, no se puede
mandar nada (los mensajes se siguen guardando).

**Métricas** (`metricas.ts`): `consultasPorDia()`, en días de Uruguay. Personas =
distintas que escribieron por privado; nuevas = las que no habían escrito en
los 30 días anteriores; anuncio/orgánico según la conversación; speech, derivadas
y leads de los eventos. Solo cuenta mensajes con `importado = false` y eventos
que no son de sombra. Indicadores lo lee por `GET
/webhooks/instagram-conector/consultas?desde=&hasta=` con el secreto compartido
(`routes/instagram-conector-webhook.routes.ts`) y suma el speech a la fuente IG
de la planilla.

**Modo** (`INSTAGRAM_MODO`): `apagado` (default: guarda los mensajes y nada
más), `sombra` (todo menos mandar: ni mensajes, ni etiquetas, ni mails; lo que
habría contestado queda como evento con `sombra = true`) o `envio`. En sombra
no se aplica la pausa por "escribió otro", porque las respuestas del contestador
de indicadores llegan como ecos y lo callarían siempre; tampoco hay seguimientos.

**Historial** (`scripts/instagram-importar.ts`): `conversaciones <carpeta>`
carga las conversaciones del contestador de indicadores (con su speech,
seguimiento, derivación y origen; corrige a "Asistente" los ecos que se
guardaron como "otro") y `contactos <archivo>` la base de contactos de la carga
para atrás de ManyChat. Todo marcado como importado. Idempotente.

**Conector MCP** (`routes/mcp/tools/marketing.ts`, solo lectura, pide
`MARKETING:VIEW`): `instagram_resumen`, `instagram_conversaciones` (con lo que
decidió el asistente y, en sombra, lo que habría dicho),
`instagram_automatizaciones` e `instagram_contactos`.

### Variables (`.env` + bloque `environment` del compose de prod)

| Variable | Qué es |
|---|---|
| `INSTAGRAM_MODO` | `apagado` / `sombra` / `envio` |
| `INSTAGRAM_APP_SECRET` | Clave secreta de la app de Meta "Voltia Indicadores" (la misma que `META_APP_SECRET` del conector de indicadores). **Secreto** |
| `INSTAGRAM_VERIFY_TOKEN` | Texto al azar que se carga igual en Meta al guardar el webhook |
| `INSTAGRAM_CONECTOR_URL` | `https://indicadores.voltia.com.uy` |
| `INSTAGRAM_CONECTOR_SECRETO` | Secreto compartido con indicadores (allá `VOLTIA_PM_SECRETO`). **Secreto** |
| `INSTAGRAM_TOPE_USD` | Opcional; 30 |
| `INSTAGRAM_MODELO` | Opcional; `claude-haiku-5-5` |
| `INSTAGRAM_DERIVAR_A` / `INSTAGRAM_DERIVAR_WHATSAPP` / `INSTAGRAM_DERIVAR_MAIL` | Opcionales; Martín García, 092 365 636, martin@voltia.com.uy |
| `INSTAGRAM_AVISOS_MAIL` | Opcional; nicolas@voltia.com.uy |

### La migración desde el conector de indicadores (encargo del 29-oct)

1. **Sombra (2-3 días):** deploy con `INSTAGRAM_MODO=sombra`; en indicadores,
   `VOLTIA_PM_REENVIO=si`: cada aviso de Meta se reenvía a Voltia PM con su
   firma. Voltia PM guarda todo y arma las respuestas sin mandarlas; se comparan
   con lo que contestó indicadores (herramienta `instagram_conversaciones`).
2. **Cambio, todo junto:** importar lo último de indicadores, en Meta el
   webhook de la app "Voltia Indicadores" pasa a
   `https://app.voltia.com.uy/webhooks/instagram`, `INSTAGRAM_MODO=envio` en
   Voltia PM, `PRIVADOS_ENVIO=no` y `VOLTIA_PM_REENVIO=no` en indicadores.
   Prueba con un mensaje real.
3. **Red de seguridad, 1 semana:** el webhook de indicadores sigue vivo sin
   contestar. Después se retira (y la herramienta `conversaciones_instagram`).
4. **ManyChat** se apaga cuando Voltia PM hace todo lo que hace hoy.

## Permisos

| Permiso | Qué habilita |
|---|---|
| `MARKETING:VIEW` | Entrar a Marketing: conversaciones, automatizaciones, contactos, consultas; las herramientas del conector |
| `MARKETING:EDIT` | Contestar, Tomo yo / Devolver, Crear lead, prender/apagar y editar automatizaciones |

Rol **MARKETING** (migración `20261030030100_marketing_permisos`) y **ADMIN** ven
y editan. Cambiar una automatización queda en la auditoría
(`marketing_automatizacion`); cada respuesta, toma y devolución, en
`instagram_conversacion`. El webhook de Meta no tiene permiso de usuario: lo
protege la firma; lo que lee indicadores, el secreto compartido.

## Reglas y decisiones

- **Las reglas de las respuestas son de Nicolás** (`asesores/tabare/memoria/reglas-privados.md`
  y `reglas-comentarios.md` en voltia-asesores, ajustadas el 29-oct). Lo
  operativo se puede ajustar; las reglas, no sin él.
- **Se nota lo menos posible que es automático** (pedido de Nicolás del
  29-oct): espera al azar de 45-150 s, varios mensajes cortos con
  "escribiendo…", el nombre de la persona, frases distintas cada vez. Pero si
  le preguntan si es un robot, no miente.
- **Lead = mandó la factura o los datos del techo.** Ahí se deriva a Ventas.
- **Crear el lead no pide `VENTAS:CREATE`**: pasar a Ventas lo que entra por
  redes es trabajo de Marketing.
- El "leído" es uno solo para todo el equipo.
- Los mails solo van a usuarios de Voltia PM (guardarraíl de `sendEmail`).

## Casos borde

- **Si indicadores está caído**, no hay token: no sale nada (ni el asistente ni
  lo que se contesta a mano). Los mensajes se siguen guardando y las respuestas
  agendadas se pierden si se pasa la ventana.
- Un reinicio del server no pierde respuestas agendadas (están en la base),
  pero sí corta una tanda de mensajes que se estaba mandando.
- Si ManyChat sigue prendido y manda el privado de un lead magnet primero, el
  nuestro falla y no se contesta en público: no hay duplicados.
- No está confirmado que el id de quien comenta sea el mismo que el de los
  privados: por eso las etiquetas de comentarios se ponen por usuario, y se
  unen cuando sale el privado.
- Los adjuntos llegan como "[Mandó: image]": no se ven las imágenes. Una foto
  después de pedirle la factura cuenta como lead.
- Una persona que nunca escribió (solo le escribió Voltia) tiene la ventana
  cerrada.
- La bandeja muestra hasta 300 conversaciones y los contactos hasta 200 por
  búsqueda.
