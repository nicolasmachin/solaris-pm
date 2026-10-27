# 18 · Asistente del equipo (chat con IA)

## Para qué existe

Los asesores y el resto del equipo reciben preguntas de clientes que no saben
contestar solos (cómo paga UTE, qué pasa si se corta la luz, qué garantías hay,
por qué cambió la propuesta) y terminan pasándoselas a la Dirección, que las
resolvía hablando con Claude por su cuenta. El conector MCP (capítulo 13) ya
daba acceso a los datos desde Claude, pero exige cuenta de Claude y conector
instalado.

El asistente pone eso **dentro de Voltia PM**, para cualquier usuario interno,
sin instalar nada: un chat que sabe cómo trabaja Voltia (la **base de
conocimiento**) y consulta los datos reales (las mismas herramientas del
conector). Es **interno**: le habla al equipo, no al cliente. Un bot para
clientes sería otro proyecto.

## Cómo se usa

- **Entrada:** botón violeta con destellos, abajo a la derecha, en todas las
  pantallas internas. Lo ven todos los roles menos `CLIENT`, y queda por encima
  de las ventanas grandes (el panel del lead), para poder abrirlo con un lead
  abierto. Abre un panel lateral **sin fondo oscuro**: la pantalla de atrás se
  sigue usando y el panel queda abierto al cambiar de pantalla; solo se cierra
  con la X (o Escape con el foco en el panel). Cerrarlo no corta la
  conversación, y si se recarga la página (F5) vuelve a abrirse con la misma
  conversación (se recuerda en `sessionStorage` de esa pestaña:
  `asistente-abierto`, `asistente-conversacion`). En celular el panel ocupa
  toda la pantalla, así que para navegar hay que cerrarlo.
- **Formato tipo Claude:** los mensajes propios en burbuja a la derecha, las
  respuestas como texto a la izquierda; abajo, una caja con el clip y el
  micrófono a la izquierda y el modelo y Enviar a la derecha. El botón de
  **pantalla completa** agranda el panel y fija la lista de conversaciones a la
  izquierda (queda recordado en el navegador).
- **Adjuntos:** con el clip, **arrastrando** archivos al panel o **pegando** una
  captura (Ctrl+V). Fotos (JPG, PNG, WEBP, GIF, HEIC), PDF, Excel (.xlsx), Word
  (.docx) y texto (.txt, .csv, .md); hasta 5 por mensaje y 25 MB cada uno. Se
  suben al elegirlos (se ve una ruedita) y se mandan con el mensaje; sin texto,
  el mensaje sale como "Analizá lo que te adjunto.". En la conversación quedan
  como etiquetas que abren el archivo.
- **Micrófono:** graba, se toca el cuadrado para terminar, y el audio se pasa a
  texto en la caja para corregirlo antes de mandarlo. El audio no se guarda.
- **Escuchar:** el parlante de cada respuesta la lee en voz alta con una voz
  natural de OpenAI, en rioplatense de Uruguay. Arranca en uno o dos segundos y
  se corta tocando el parlante de nuevo. Tiene costo: unos 2 centavos de dólar
  por minuto leído, y cuenta para los topes.
- **Conversaciones guardadas:** el reloj del encabezado muestra las
  conversaciones anteriores de quien está logueado (las últimas 50) para
  retomarlas o borrarlas; el **+** arranca una nueva. Cada persona ve solo las
  suyas.
- **Le habla a quien está logueado**, por su nombre, y se adapta a esa persona
  con las notas que fue tomando (ver *Cómo funciona*).
- **Contexto de la pantalla:** si hay un lead abierto (`/ventas?lead=…`) o un
  proyecto (`/projects/:id`, `/clientes/:id`, `/ingenieria/proyecto/:id`,
  `/proyecto/:id/…`), el panel lo dice ("Usa el lead abierto en pantalla") y el
  asistente lo toma como "este cliente".
- **Modelo:** selector abajo. *Automático* (por defecto), *Sonnet*, *Haiku*,
  *Opus*. La elección queda guardada en el navegador. Cada respuesta dice con
  qué modelo salió y cuántas consultas a Voltia PM hizo (el detalle, pasando el
  mouse).
- **Copiar** cada respuesta, para pegarla en WhatsApp o en un documento.
- **Marcas en las respuestas:** ✅ dato (de la base o de Voltia PM), ⚠️
  deducción del asistente (revisar), ❓ no se sabe o lo decide Voltia.
- **Gasto:** el usuario no lo ve. Administración → Gasto de IA muestra lo que
  gastó cada persona por mes (capítulo 12).

## Cómo funciona

- **Backend:** `routes/asistente.routes.ts` (`GET /api/asistente/estado`,
  `POST /api/asistente/chat`) y `services/asistente/`:
  - `chat.service.ts` → `responder()`: arma el prompt, corre el ciclo de
    herramientas (hasta 12 vueltas) y devuelve el texto, el modelo y las
    herramientas usadas.
  - `base.ts` → `leerBase()` y `leerEnciclopedia()`.
  - `herramientas.ts` → `abrirHerramientas()`.
  - `topes.ts` → `chequearTopes()`.
  - `adjuntos.service.ts` → `guardarAdjunto()`, `bloquesDeAdjuntos()`.
  - `historial.service.ts` → conversaciones (`prepararConversacion()`,
    `guardarIntercambio()`, listar, leer, borrar) y notas por persona
    (`notasDe()`, `aprenderDeLaConversacion()`).
- **Conversaciones** en `asistente_conversaciones` y `asistente_mensajes`
  (modelos `AsistenteConversacion`, `AsistenteMensaje`; sin relación con `User`,
  como `ai_usage`). El panel manda solo el mensaje nuevo y el id de la
  conversación; el server lee los últimos 30 mensajes de la base. La pregunta y
  la respuesta se guardan juntas al terminar: si la consulta falla, no queda una
  pregunta suelta. Los resultados de herramientas no se guardan: en el mensaje
  siguiente, si hace falta, el asistente vuelve a consultar. El título es el
  primer mensaje (80 caracteres). Endpoints: `GET /api/asistente/conversaciones`,
  `GET` y `DELETE /api/asistente/conversaciones/:id` (solo el dueño; si no es
  suya, 404).
- **Adjuntos** (`asistente_adjuntos`, modelo `AsistenteAdjunto`):
  `POST /api/asistente/adjuntos` guarda el archivo en
  `storage/asistente/<userId>/` y crea la fila sin `mensajeId`; el chat recibe
  `adjuntoIds` (solo del usuario y sin mandar) y al guardar el intercambio los
  ata a la pregunta. HEIC se pasa a JPEG; las fotos de más de 1.568 px de lado
  se achican (el modelo las reduce igual y cada píxel de más es costo). Al
  modelo: fotos como imagen, PDF como documento (lee texto y páginas), Excel
  como texto hoja por hoja (`exceljs`), Word como texto (`word/document.xml`,
  leído con un lector de zip propio, sin librerías), con tope de 150.000
  caracteres. **Se analizan solo en el mensaje en que se mandan**: en los
  siguientes viajan como "[Adjuntó: nombre]", para no cobrarlos de nuevo; si
  hace falta volver a mirarlos, el asistente pide que se adjunten otra vez. Con
  un PDF, Word o Excel adjunto el modo automático usa Opus. `GET
  /api/asistente/adjuntos/:id` los devuelve solo al dueño.
- **Voz:** `POST /api/asistente/transcribir` recibe el audio (webm, o mp4 en
  iPhone), lo escribe en un temporal, lo transcribe con Whisper
  (`transcribeAudio()`, función `asistente_audio` en `ai_usage`) y lo borra. La
  lectura en voz alta es `POST /api/asistente/voz` (`voz.service.ts` →
  `textoAVoz()`): OpenAI `gpt-4o-mini-tts`, voz `coral`, con indicaciones de
  español rioplatense con voseo (OpenAI no tiene voces por país: el acento sale
  de las indicaciones). Devuelve mp3. El panel saca los símbolos de Markdown y
  las marcas ✅⚠️❓ y pide la voz **de a pedazos**: el primero de ~200
  caracteres, para que suene enseguida, y los demás de ~1500, cada uno pedido
  mientras suena el anterior. La API no informa el uso: se registra como
  `asistente_voz` en `ai_usage` estimando 15 USD por millón de caracteres
  (`costoVoz()`). Se reemplazó a la voz del navegador (`speechSynthesis`), que
  sonaba robótica y lenta.
- **Notas por persona** (`asistente_perfiles`, modelo `AsistentePerfil`): un
  texto corto (máx. 150 palabras, en viñetas) con en qué trabaja, qué suele
  pedir, cómo le gusta que le respondan y qué clientes o temas sigue. Cada 6
  mensajes de la persona, `aprenderDeLaConversacion()` le pasa a Haiku 5.5 las
  notas actuales y la conversación en curso y guarda la versión nueva (función
  `asistente_perfil` en `ai_usage`, cuenta para los topes). Corre sin que la
  persona espere; si falla, se reintenta en el mensaje siguiente. Las notas van
  al contexto de cada consulta de esa persona, después del punto de caché.
- **La base de conocimiento** son los Markdown de `server/conocimiento/` (su
  `README.md` explica cada archivo). Están dentro de `server/` para que viajen en
  la imagen al deployar. Se leen en cada mensaje: una corrección se ve en el
  mensaje siguiente sin reiniciar. Los archivos por tema, las cifras, los
  pendientes y los casos van enteros al prompt; las **dos enciclopedias** (el 70
  % del texto) van solo con su índice de secciones, y el asistente abre la
  sección que necesita con la herramienta propia `leer_enciclopedia`. Cargarlas
  enteras llevaba el prompt de ~48.000 a ~108.000 tokens.
- **Herramientas = las del conector MCP, en proceso.** `abrirHerramientas()`
  arma el mismo servidor que el conector (`buildMcpServer(user)`) y le habla por
  un transporte en memoria (`InMemoryTransport`). Solo se ofrecen las marcadas
  `readOnlyHint: true`: el chat **no escribe** (no crea leads, no mueve etapas,
  no publica propuestas). Una herramienta nueva de lectura del conector aparece
  sola en el chat. La allowlist de emails del conector (`MCP_ALLOWED_EMAILS`)
  **no** aplica acá: cualquier usuario interno usa el chat.
- **Prompt y caché.** Orden: herramientas (ordenadas por nombre) →
  instrucciones → base [punto de caché] → contexto (fecha, quién pregunta, lead
  o proyecto abierto con su nombre y código) → conversación [segundo punto de
  caché, en el último bloque]. Lo fijo se cachea entre consultas de todos los
  usuarios; el caché dura 5 minutos.
- **Modelo automático** (`elegirModelo()`): Sonnet 5.5, salvo que el último
  mensaje parezca trabajo pesado y entonces Opus 5.5: más de 2.500 caracteres, 4
  o más líneas numeradas, 5 o más signos de pregunta, o un pedido de redactar o
  armar una respuesta, informe, nota o mail, o de contestarle al cliente. Es una
  regla fija, no una consulta previa a otro modelo. Esfuerzo `medium` en los
  tres.
- **Gasto:** cada llamada pasa por `createMessage()` con la función
  `asistente_chat` (y las notas, `asistente_perfil`; los audios,
  `asistente_audio`; la voz, `asistente_voz`) y el usuario, así que queda
  en `ai_usage` como todo lo demás.
- **Topes** (`topes.ts`), sobre lo registrado en `ai_usage`: por usuario y por
  día en hora de Uruguay (`ASISTENTE_TOPE_DIARIO_USD`, por defecto 5) y para todo
  Voltia en el mes (`ASISTENTE_TOPE_MENSUAL_USD`, por defecto 200). Al
  superarlos, el chat responde 429 con un mensaje claro. Es una segunda capa: el
  límite de gasto de la cuenta de Anthropic sigue siendo el freno de verdad.

## Permisos

- **El chat en sí no tiene permiso de la matriz**: cualquier usuario autenticado
  que no sea `CLIENT`. Decisión deliberada: lo que cada uno puede **ver** lo
  deciden las herramientas, que chequean la matriz del rol en cada llamada
  (`requirePermission`, igual que el conector). Un asesor sin `FINANZAS:VIEW`
  que pregunta por cobros recibe "no tenés permiso", no los datos.
- **Lo que sí ve cualquiera** es la base de conocimiento entera, incluidas las
  partes internas (markup, costos, errores ya cometidos). Si eso tuviera que
  restringirse por rol, hay que partir la base.
- **El gasto por usuario** lo ve quien tiene `USUARIOS:VIEW` (Administración).
- **Las conversaciones y las notas** solo las ve su dueño desde Voltia PM. No hay
  pantalla para que un administrador las lea; quien tenga acceso a la base de
  datos sí puede.

## Reglas y decisiones

- **Solo lectura**, por ahora (27-oct-2026). Las herramientas de escritura del
  conector existen; habilitarlas es sacar el filtro de `readOnlyHint` y pensar
  confirmaciones en el panel.
- **Solo Claude.** Se evaluó ofrecer ChatGPT con la clave de OpenAI que ya usa
  Whisper; quedó para después: el ciclo de herramientas y el caché son distintos
  y habría que mantener dos versiones del chat.
- **Opus 5.5 es el Opus más barato** (USD 4/20 por millón de tokens contra 5/25
  de Opus 4.8 y Opus 5), así que no tiene sentido bajar a uno anterior.
- **La base no se corrige desde Voltia PM**: se corrige editando los Markdown y
  deployando. Que el asistente proponga agregados (lo que marcó ❓ y alguien
  contestó) para que Nicolás los apruebe es una idea anotada, no está hecha.
- **Ante contradicciones dentro de la base** mandan los archivos por tema y
  `cifras-vigentes.md` sobre las enciclopedias (lo dice su README).

## Casos borde

- **Costo de la primera consulta**: si nadie usó el asistente en los últimos 5
  minutos, la consulta escribe la base en el caché y cuesta unos USD 0,12 con
  Sonnet; las siguientes, entre 1 y 6 centavos según cuántas herramientas use.
  Cada modelo tiene su propio caché: cambiar de modelo vuelve a escribirlo.
- **Whisper inventa texto con audios sin voz** (ruido, silencio): devuelve
  frases tipo "Subtítulos realizados por…". Por eso el texto queda en la caja
  para revisarlo, no se manda solo.
- **Un adjunto subido y nunca mandado** queda en el storage sin `mensajeId`; no
  hay limpieza automática todavía.
- **Respuestas lentas**: no hay streaming; una pregunta que consulta varias
  herramientas tarda 10–30 segundos y el panel muestra "Pensando…".
- **Resultados largos**: el resultado de una herramienta se corta a 60.000
  caracteres.
- **Rechazo del modelo** (`stop_reason: refusal`): responde "No puedo responder
  ese pedido" en vez de fallar.
- **Usuario sin email** (entra con `username`): funciona; el `McpUser` va con
  email vacío.
- **Las notas pueden equivocarse:** las escribe un modelo resumiendo. No hay
  pantalla para verlas ni corregirlas; se borran desde la base
  (`asistente_perfiles`) y se vuelven a armar solas.
- **Una conversación muy larga** solo manda al modelo sus últimos 30 mensajes:
  lo del principio se "olvida".
- **El panel no sabe el nombre del lead abierto**: dice "el lead abierto en
  pantalla"; el nombre lo resuelve el server para el prompt.
