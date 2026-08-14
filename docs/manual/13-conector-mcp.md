# 13 · Conector MCP

## Para qué existe

Permite usar Voltia PM **desde el chat de Claude**, en la web y en el celular.
El caso que lo motiva es el trabajo comercial: antes de una visita, consultar la
ficha del cliente potencial y su propuesta; después, dictar el comentario y los
pendientes que salieron, sin abrir la aplicación.

El objetivo de fondo es bajar la fricción de registrar. Lo que cuesta anotar no
se anota, y termina viviendo en la cabeza de una persona.

Es una **fachada sobre la aplicación**, no una vía paralela: usa la misma base,
la misma matriz de permisos y la misma auditoría. Nada que no se pueda hacer
desde la app se puede hacer desde el chat.

## Cómo se usa

Se agrega una sola vez desde la configuración de Claude, en la web, pegando la
dirección del conector. Se abre una pantalla de Voltia PM que pide email y
contraseña, se autoriza, y queda conectado. Desde el celular no se puede
*agregar*, pero sí *usar* una vez agregado.

La conexión dura mientras no se revoque: el permiso se renueva solo.

**Solo pueden conectarse los usuarios habilitados en una lista explícita**
(`MCP_ALLOWED_EMAILS`). Tener usuario en la aplicación no alcanza: exponer los
datos por fuera de ella es una decisión aparte.

## Cómo funciona

Vive dentro del mismo servidor, en `server/src/routes/mcp/`, montado **sin el
prefijo `/api` y sin el hook global de autenticación**, porque los documentos
de descubrimiento tienen que colgar de la raíz del dominio y la pantalla de
autorización tiene que abrirse sin sesión previa. Sigue el patrón de
`videos.routes.ts`: `preHandler` explícito por ruta.

### Las rutas

| Ruta | Qué hace |
|---|---|
| `GET /.well-known/oauth-protected-resource` | Dice qué recurso se protege y quién lo autoriza |
| `GET /.well-known/oauth-authorization-server` | Capacidades del servidor de autorización |
| `GET /oauth/authorize` | Sirve la pantalla de autorización (HTML propio) |
| `POST /oauth/authorize` | Valida credenciales, emite el código y redirige |
| `POST /oauth/token` | Canjea el código o renueva con el refresh |
| `POST /mcp` | El endpoint del protocolo |
| `GET`/`DELETE /mcp` | 405: sin sesión no hay stream que abrir ni cerrar |

### Autorización

Un OAuth 2.1 mínimo sobre el login que ya existe. **No hay registro dinámico de
clientes**: el `redirect_uri` se valida contra una allowlist —el callback de
Claude y los puertos locales de Claude Code—, que es más estricto que confiar en
lo que declare el cliente. El `redirect_uri` es a dónde viaja el código de
autorización: aceptar uno arbitrario es entregarle el acceso a quien lo pida.

**PKCE con S256 es obligatorio** y se verifica en el canje.

Se persisten solo las dos piezas que no pueden ser sin estado:

- **`McpAuthCode`** — código de autorización, hasheado, **un solo uso**, 60
  segundos de vida.
- **`McpRefreshToken`** — hasheado, 30 días, **se rota en cada uso**: el viejo
  queda revocado y apuntando al nuevo, así queda la cadena para auditar.

El **access token es un JWT** con `typ: "mcp-access"`, una hora de vida y `aud`
igual a la URL del conector. No necesita tabla.

### La separación de tokens

Es lo que evita que el conector sea una puerta trasera:

- Un token del conector **no sirve contra `/api/*`**: `authenticate` rechaza
  cualquier token con `typ` (ver [01 · Fundamentos](01-fundamentos.md)).
- Un token de sesión normal **no sirve contra `/mcp`**: el verificador exige
  `typ: "mcp-access"`.

Ambas direcciones están verificadas.

### Permisos

Cada herramienta resuelve el usuario del token y chequea con
**`hasPermission()`**, la misma función que usan las rutas HTTP, con su cache de
5 minutos. No hay lógica de permisos duplicada.

El usuario **se revalida contra la base en cada llamada**: si se lo da de baja o
se lo saca de la allowlist, deja de funcionar en el acto y no cuando venza el
token.

Un fallo de permisos no es una excepción sino un resultado de error legible, que
nombra el permiso faltante y dice dónde se administra. El chat puede explicarlo
en vez de mostrar un error opaco.

### Sin estado

Cada llamada arma un servidor MCP y un transporte, responde y los cierra. No hay
sesiones que expirar ni memoria que se acumule, y reiniciar el servidor no le
corta la conexión a nadie.

### Defensas

- **Límite de intentos** en el `POST /oauth/authorize` (10 cada 10 minutos por
  IP y email). Es el único endpoint de la aplicación que valida contraseñas
  contra pedidos de internet. Es en memoria y por proceso: con varias instancias
  habría que moverlo a la base.
- **Mismo mensaje** para usuario inexistente y contraseña incorrecta.
- **La allowlist se chequea después de validar la contraseña**, para que la
  pantalla no revele quién está habilitado sin credenciales.
- **No se autoriza con contraseña temporal**: el conector quedaría atado a una
  credencial que la app está obligando a cambiar.

## Herramientas

Doce. Cada una chequea su permiso antes de tocar nada, y toda escritura queda
auditada con `metadata.source = "mcp"` y el nombre de la herramienta.

### Diagnóstico

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `estado_conexion` | ninguno | Confirma que la conexión anda y muestra usuario, rol y permisos de ventas. Es lo primero que hay que pedir cuando algo falla. |

### Ventas

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `buscar_lead` | `VENTAS:VIEW` | Busca por nombre, teléfono, email, dirección o código. Excluye los cerrados salvo que se pidan. Devuelve hasta 15. |
| `ficha_lead` | `VENTAS:VIEW` | Todo sobre un cliente: contacto, etapa, fechas, notas, propuestas, pendientes abiertos y últimos 8 comentarios. |
| `ver_propuesta` | `VENTAS:VIEW` | Números comerciales de una propuesta + enlace al PDF. |
| `crear_lead` | `VENTAS:CREATE` | Alta. Se asigna al usuario que la crea. |
| `editar_lead` | `VENTAS:EDIT` | Datos de contacto y relevamiento, con lista blanca. |
| `mover_etapa` | `VENTAS:EDIT` | Cambia la etapa del pipeline. |
| `comentar_lead` | `VENTAS:COMMENT` | Deja un comentario en el historial. |

### Propuestas

Solo **residenciales**. El cotizador B2B no se expone: necesita razón social y
RUT, que no son datos que se dicten de memoria, y conviene que tenga rodaje.

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `preparar_propuesta` | `VENTAS:EDIT` | Arma o corrige el borrador. Devuelve qué falta o, si está completa, precio, ahorro y cuotas. No emite nada. |
| `publicar_propuesta` | `VENTAS:CREATE` | Emite el PDF definitivo. Exige `confirmar: true`. |

**Qué hay que dictar y qué sale solo.** De los veinte campos obligatorios, los
valores por defecto del cotizador y los datos del cliente cubren casi todos. En
la práctica se piden cinco: **ciudad, cuánto paga de UTE por mes, cantidad de
paneles, metros cuadrados de techo y potencia del inversor**. Los tres últimos
de esa lista los pide el conector aunque el esquema los acepte en cero — ver
"Reglas y decisiones".

**La cotización del dólar no se expone.** Es el único parámetro que mueve el
precio y que el asesor no debería tocar. El markup sí: es su holgura para
cotizar más caro o más barato.

**Publicar mueve el cliente.** Al emitir la primera propuesta, el lead pasa solo
a Cotizado y se sella la fecha de envío. La herramienta lo avisa en la respuesta.

### El día del asesor

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `mi_dia` | `VENTAS:VIEW` | Embudo propio, visitas de hoy y mañana, visitas que ya pasaron y siguen sin registrar, quiénes reclamaron, trabados hace 14 días o más, y pendientes que vencen. |

Es la única herramienta que responde sin que haya que nombrar un cliente. Con
`de_todo_el_equipo` muestra el pipeline completo en vez de solo el propio.

### Pendientes

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `listar_pendientes` | autenticado | Los del usuario: pendientes, en espera o completados. Hasta 40. |
| `crear_pendiente` | autenticado | Crea uno **atado a un cliente o proyecto**, con `origin: MCP`. |
| `completar_pendiente` | dueño o asignado | Lo marca hecho. |
| `poner_en_espera` | dueño o asignado | Lo pasa a espera con motivo y fecha de recontacto. |

### Proyectos y obra

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `buscar_proyecto` | `OPERACIONES:VIEW` | Por nombre de cliente o código. **Excluye los importados por planilla** — esos van por `buscar_generador`. |
| `ficha_proyecto` | `OPERACIONES:VIEW` | Estado, etapa actual con el semáforo de plazo, avance, atraso, potencia, fechas, cuadrilla y resumen del trámite UTE. |
| `detalle_etapas` | `OPERACIONES:VIEW` | Etapas y subetapas con responsable y estado. Con `solo_pendientes` muestra únicamente lo que falta. |
| `tramite_ute` | `TRAMITES_UTE:VIEW` | Los once hitos con fecha y el reparto entre días nuestros y días esperando a UTE. |
| `obra_y_materiales` | `OPERACIONES:VIEW` | Materiales con su estado de compra, fotos y videos. |
| `documentos_proyecto` | `OPERACIONES:VIEW` | Documentos generados con enlace de descarga. Excluye las fotos de obra, que son cientos. |
| `historial_proyecto` | `OPERACIONES:VIEW` | El timeline unificado: etapas, comentarios, interacciones, traspasos, tickets y encuestas. |
| `pendientes_proyecto` | `OPERACIONES:VIEW` | Los pendientes de la obra **de todo el equipo**, no solo los propios. |
| `comentar_proyecto` | `OPERACIONES:COMMENT` | Deja un comentario en el historial de la obra. |

Se leen los modelos con los mismos servicios que usa la aplicación
(`getDisplayStage`, `countdownForStage`, `serializeUteProcess`,
`getClienteTimeline`) y no las rutas HTTP: dos de ellas piden `OPERACIONES:EDIT`
para leer, y una consulta no debería exigir permiso de escritura.

**El pipeline no se toca desde el chat.** No hay herramienta para completar
subetapas ni checklists: eso dispara traspasos y avisos a otras áreas, y merece
la pantalla.

### Experiencia Solar

| Herramienta | Permiso | Qué hace |
|---|---|---|
| `buscar_generador` | `EXPERIENCIA_CLIENTES:VIEW` | La cartera completa, **incluidos los cargados por planilla**. |
| `ficha_generador` | `EXPERIENCIA_CLIENTES:VIEW` | Ficha 360: recorrido, trámite, último contacto, próximo mantenimiento por aniversario y el aviso de habilitación pendiente. |
| `reporte_fv` | `EXPERIENCIA_CLIENTES:VIEW` | Último reporte mensual con autoconsumo, ahorro y retorno, más el PDF. |
| `registrar_interaccion` | `EXPERIENCIA_CLIENTES:CREATE` | Anota una llamada, un WhatsApp, un mail o una visita. |

**Por qué hay dos búsquedas de cliente instalado.** Los generadores livianos
—los que se cargaron por planilla y no tienen obra en el sistema— están
excluidos de la lista de proyectos. Buscar uno con `buscar_proyecto` no lo
encuentra; `buscar_generador` sí. Las descripciones de las dos herramientas se
apuntan mutuamente para que el modelo elija bien.

### Lo que las herramientas NO hacen

- **`editar_lead` no toca el nombre ni el asesor.** Renombrar por dictado es
  como se terminan duplicando clientes, y reasignar dueño merece la pantalla.
- **`mover_etapa` a "cerrado ganado" no crea el proyecto**, y lo dice en la
  respuesta: la conversión pide ciudad, departamento y potencia que el cliente
  potencial no tiene.
- **`ver_propuesta` no devuelve margen, costos ni comisiones.** Del snapshot se
  toman solo los campos comerciales, armados a mano.
- **`crear_pendiente` no crea huérfanos.** Sin cliente ni proyecto, pide
  precisión en vez de adivinar.
- **`publicar_propuesta` no se llama sola.** El parámetro `confirmar` es un
  literal `true`: sin él la llamada ni siquiera llega al servidor. La
  descripción dice que solo se pasa después de que la persona haya visto los
  números y los haya aprobado.
- **Ninguna manda correos** a clientes.

### La propuesta exige más que el formulario

`draftDataPublishSchema` acepta `0` en la factura mensual, en los metros
cuadrados de techo y en la potencia del inversor, porque hay borradores
legítimos a medio llenar. Pero publicar con esos ceros produce una propuesta sin
sentido: con la factura en cero, el ahorro calculado da infinito.

Quien cotiza mirando el formulario ve el disparate; quien dicta por chat, no.
Por eso `draftQualityIssues()` (en `draft.service.ts`) agrega esos tres
chequeos, y las dos herramientas los aplican. Se evalúan sobre el objeto crudo y
no después de que el esquema valide, para poder pedir todo lo que falta de una
sola vez en lugar de en dos rondas.

### Propuestas del generador anterior

La mayoría de los clientes históricos tienen sus propuestas en el generador
viejo (Excel + script), que no guarda los números desglosados. Cuando un cliente
solo tiene de esas, `ver_propuesta` lo dice explícitamente y ofrece el PDF, en
vez de responder que no hay ninguna propuesta —que es lo que parecería si solo
mirara las nuevas.

## Enlaces de descarga

Las herramientas que devuelven documentos generan una URL con un token de **15
minutos** atado al documento concreto:

```
/mcp/descargas/proposal-version/<id>?t=<token>      propuestas nuevas
/mcp/descargas/proposal-generation/<id>?t=<token>   propuestas del generador viejo
/mcp/descargas/project-file/<id>?t=<token>          documentos de proyecto y reportes
```

El token lleva `typ: "mcp-download"` y el identificador del recurso. Sin ese
segundo dato, el token de un PDF serviría para bajar cualquier otro conociendo
su id. El usuario se revalida al descargar, y una versión descartada no se sirve.

## Producción y desarrollo

Son **dos instalaciones separadas con dos bases separadas**, y cada conector
apunta a una URL fija: el de producción a `https://app.voltia.com.uy/mcp`, el de
desarrollo a `http://localhost:4000/mcp`. No hay una que "cambie de entorno".

El problema es que **las herramientas se llaman igual en las dos**. Con los dos
conectores agregados, nada en la respuesta diría en cuál se está escribiendo. Por
eso el entorno viaja en tres lugares, derivado de `NODE_ENV`:

| Dónde | En producción | En desarrollo |
|---|---|---|
| Nombre del servidor (visible en la lista de conectores) | `voltia-pm` | `voltia-pm (desarrollo)` |
| Instrucciones que lee el modelo | "apunta a PRODUCCIÓN: todo lo que se cree es real" | "⚠️ NO es producción, los datos son una copia" |
| `estado_conexion` | "PRODUCCIÓN" + la URL | "DESARROLLO" + la URL + "no lo ve el equipo" |

Ante la duda, `estado_conexion` responde en una línea contra qué base se está
trabajando.

## Configuración

| Variable | Qué es |
|---|---|
| `MCP_PUBLIC_URL` | La URL pública del servidor, **exacta**. Si no coincide con la que se tipea al agregar el conector, la conexión no se completa. |
| `MCP_ALLOWED_EMAILS` | Emails habilitados, separados por coma. **Vacío deshabilita el conector entero.** |

En producción hay que sumarlas a `docker-compose.prod.yml`, que solo reenvía un
subconjunto de las variables al servidor.

## Reglas y decisiones

**Una sola implementación de las reglas de negocio.** Las escrituras sobre
clientes potenciales pasan por `server/src/services/sales/leads.service.ts`, que
usan **también** las rutas HTTP. Así el auto-completado de fechas al cambiar de
etapa, el motivo de pérdida obligatorio y la traza en el historial son idénticos
se entre por el chat o por la pantalla. Antes esa lógica vivía suelta dentro de
los handlers; se extrajo al construir el conector.

**Por qué no se devuelven archivos al chat.** El protocolo no manda un PDF como
adjunto de una conversación. Las herramientas que producen documentos devuelven
un **enlace de descarga** con token de vida corta, que se abre de un toque desde
el celular.

**Por qué texto y no datos estructurados.** Los resultados salen como texto
legible: es lo que el modelo lee mejor para responderle a una persona, y ocupa
bastante menos que el equivalente estructurado, lo que importa con un tope de
150.000 caracteres por resultado.

**Por qué la pantalla de autorización es HTML del backend y no una vista de la
aplicación.** Es la única pantalla que se abre desde fuera, se ve una vez cada
varias semanas, y hacerla en el frontend obligaría a abrirle CORS al origen de
Claude y a manejar el intercambio del código desde el navegador.

**Por qué allowlist en vez de un permiso de la matriz.** Mientras el conector es
nuevo, la superficie se mantiene mínima y explícita. Migrarlo a un módulo de la
matriz es el paso natural cuando lo use más de una persona.

## Casos borde

- **La URL tiene que coincidir carácter por carácter.** Una barra final de más
  en `MCP_PUBLIC_URL` rompe la conexión sin un error que lo explique.
- **Si `/oauth/token` devuelve 415**, falta el parser de formularios: ese
  endpoint recibe `application/x-www-form-urlencoded` y Fastify solo parsea JSON
  por defecto.
- **Un resultado de herramienta se corta cerca de los 150.000 caracteres.** Las
  listas tienen que venir acotadas y resumidas.
- **Cambiar `MCP_ALLOWED_EMAILS` exige recrear el contenedor**, no solo
  reiniciarlo.
- **Los códigos vencen en 60 segundos**: al probar a mano hay que pedir uno
  nuevo para cada canje.
