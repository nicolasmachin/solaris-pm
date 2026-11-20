# 07 · Habilitación UTE

> **Capítulo parcial.** Están documentadas la **solicitud de suministro individual
> / aumento de potencia contratada**, los **trámites con UTE Comercial** y los
> **proyectos con varios suministros**
> (consulta, papeles y trámites por suministro). El resto del módulo (proceso de
> habilitación, subetapas dinámicas, formularios PDF, documentos firmados)
> sigue pendiente de escribir: la funcionalidad existe y está en producción,
> lo que falta es la documentación.

---

# Aviso de obra terminada a quien tramita

Cuando se confirma el traspaso **T7 · Obra terminada**, el aviso (in-app y mail)
les llega a los roles `EXPERIENCIA_SOLAR`, `TRAMITACION_UTE` e **`INGENIERIA`**,
con el Gerente de Operaciones y ADMIN en copia (`TRASPASO_CATALOGO` en
`services/traspasos/catalogo.ts`). Ingeniería está porque **la tramitación ante
UTE la hace Ingeniería**: en producción nadie tiene el rol `TRAMITACION_UTE`, y
hasta el 10-nov-2026 el aviso no le llegaba a quien tenía que arrancar el
trámite (se enteraba días después mirando el proyecto). Si algún día se asigna
el rol `TRAMITACION_UTE` a alguien, también lo recibe; sacar Ingeniería de la
lista es una decisión aparte.

---

# Solicitud de suministro individual / aumento de potencia

## Para qué existe

Antes de conectar un generador fotovoltaico, a veces hay que pedirle a UTE que
le **suba la potencia contratada** al cliente: si el suministro está contratado
en 3,7 kW y se va a instalar un sistema de 5 kW, la instalación no entra. Ese
pedido se hacía fuera de la app —alguien completaba el formulario a mano y lo
mandaba por correo— y no quedaba rastro de si se había pedido, cuándo, ni por
cuánto.

Es un trámite **opcional**: solo lo necesitan algunos proyectos. Por eso no es
una subetapa nueva del pipeline (que habría que marcar "No aplica" en la
mayoría de los proyectos), sino un botón dentro de la subetapa que ya existe.

El mismo formulario sirve para pedir un **suministro nuevo**; cambia el tipo de
trámite y el asunto del correo, no el resto.

Se llega por **dos caminos**: desde el proyecto (subetapa de Onboarding, abajo)
o desde **Trámites UTE → Comercial → "Pedir trámite a UTE"**, que además sirve
para un **cliente sin proyecto** (ver "Trámites de clientes sin proyecto" en la
sección siguiente).

## Cómo se usa

1. En la ficha del proyecto, abrir la subetapa **"Consulta inicial UTE"** de
   Onboarding. Debajo del botón de consulta aparece **"Solicitar aumento de
   potencia u otro trámite comercial"**. (O desde Trámites UTE → Comercial →
   **"Pedir trámite a UTE"** → Proyecto, buscando el proyecto: lleva a la misma
   pantalla.)
2. La pantalla llega con todo precargado desde el proyecto: dirección, datos del
   cliente, cuenta, tarifa, tensión y fases. **Todos los campos son editables**,
   salvo los datos de la firma instaladora y del técnico instalador, que son
   fijos por obligación ante UTE y viven en el texto de la plantilla.
3. Si falta la cuenta o la tarifa, se puede **subir la factura de UTE** ahí
   mismo: la IA la lee y completa esos campos (es el mismo extractor que usa la
   consulta inicial).
4. Elegir la **potencia solicitada**. No es texto libre: es la lista cerrada de
   escalones que acepta UTE, y cambia según el suministro sea monofásico o
   trifásico. Debajo se muestra el salto que se está pidiendo.
5. **"Ver formulario"** descarga el archivo Excel ya completo, para revisarlo
   antes de mandarlo.
6. **"Enviar a UTE"** manda el correo desde la casilla del propio usuario, con
   el formulario adjunto.

Después de enviar, el trámite queda registrado en **Trámites UTE → Comercial**
(ver la sección siguiente) y la subetapa lista los trámites comerciales del
proyecto con su estado; el botón pasa a decir **"Pedir otro trámite a UTE
Comercial"**.

**El formulario se autoguarda mientras se completa.** Si se cierra la ventana,
al volver aparece un aviso con lo recuperado y un enlace para descartarlo y
volver a los datos del proyecto. El borrador se borra al enviar.

## Cómo funciona

**El correo** usa el sistema de plantillas (`EmailTemplate`, clave
`suministro_individual_ute`, sembrada por `seed-templates.ts` →
`seedSuministroIndividualTemplate()`). Como toda plantilla, un ADMIN puede
editar destinatarios, asunto y cuerpo desde Configuración sin tocar código. Va
a `comercial@ute.com.uy` con copia a Voltia, y sale por el SMTP del usuario
(`user_smtp_configs`), no por la casilla del sistema.

**Los datos** se arman en `email/context.service.ts` → `buildEmailContext()`,
que junta `Project` con `UteDocumentConfig`. Este trámite le agregó al contexto
los campos propios del formulario de UTE.

**El formulario adjunto** es el libro Excel que publica UTE, guardado en
`server/src/assets/ute-templates/Solicitud_Suministro_UTE.xlsx`, completado por
`ute-suministro/xlsx.service.ts` → `completarFormularioSuministro()`. El mapa
de qué dato va en qué celda está en `ute-suministro/cells.ts`, y la traducción
desde el contexto del mail en `ute-suministro/mapping.ts`.

**Los endpoints** están en `routes/ute-suministro.routes.ts`:

| Endpoint | Qué hace |
|---|---|
| `GET .../suministro-individual/estado` | Si ya se pidió el aumento, cuándo y por cuánto, y los trámites comerciales del proyecto (`tramites`) |
| `POST .../suministro-individual/preview.xlsx` | Devuelve el formulario completo para revisarlo |
| `POST .../suministro-individual/enviar` | Completa, adjunta, envía y registra |

**Al enviar** se guarda la potencia en `UteDocumentConfig.potSolicitada`, la
fecha en `aumentoPotenciaSentAt`, se registra el trámite comercial
(`ute-comercial.service.ts` → `registrarTramiteEnviado()`), una copia del
archivo en los documentos del proyecto (`FileAttachment` con `toolSource:
"ute-suministro-individual"` y `toolEntityId` = id del trámite comercial) y una
entrada de auditoría. Si falla el registro del trámite, el envío no se cae (el
mail ya salió): queda un warning en el log y la copia del Excel se ata al id
del mail, como antes.

## Permisos

Los dos roles que hacen este trámite tienen permisos **complementarios**:
`ASESOR_COMERCIAL` edita Onboarding pero solo mira Trámites UTE, y
`TRAMITACION_UTE` es exactamente al revés. Por eso los endpoints usan
`authorizeAny`, que deja pasar con **cualquiera de los dos** módulos:

- **Ver el formulario**: Onboarding *o* Trámites UTE, permiso de ver.
- **Enviar**: Onboarding *o* Trámites UTE, permiso de editar.
- **La pantalla**: Trámites UTE, ver (igual que la consulta a UTE).

Quedan afuera de enviar: Finanzas, Experiencia Solar (pueden ver), Logística y
los clientes del portal.

## Reglas y decisiones

- **El formulario se completa con lo que el asesor vio, no con lo que hay en la
  base.** Los datos viajan en el pedido de envío, no se releen del proyecto. Si
  se releyeran, las correcciones hechas en pantalla no llegarían al adjunto.
- **Si el correo falla, no se guarda nada**: ni la fecha, ni el archivo, ni la
  marca de trámite pedido. Lo contrario dejaría el proyecto afirmando que se
  solicitó algo que nunca salió.
- **La fecha del primer pedido no se pisa**, pero la potencia sí se actualiza al
  reenviar: si se corrige el valor y se manda de nuevo, lo guardado tiene que
  ser lo último que se envió.
- **La potencia es una lista cerrada** porque UTE valida el formulario con sus
  propias fórmulas: un valor fuera de los escalones se rechaza. Al cambiar las
  fases, si la potencia elegida no existe en la lista nueva, se limpia.
- **El número de cuenta va en Observaciones.** El formulario de UTE no tiene un
  campo propio para la cuenta; se precarga la frase y queda editable.
- **La plantilla del repo está en blanco a propósito.** El archivo que circula
  viene con un cliente de ejemplo cargado; se limpia con
  `server/scripts/prepare-ute-xlsx-template.py` antes de versionarlo, para no
  guardar datos personales de un tercero ni arrastrarlos al formulario de otro
  cliente.

## Casos borde

- **El libro de UTE no se puede abrir con una librería de Excel.** `exceljs`
  —que está en el proyecto— falla al leerlo: tiene imágenes, objetos
  incrustados, listas desplegables con extensiones y fórmulas de validación
  entre hojas. Por eso el relleno se hace editando el XML de la hoja y copiando
  el resto del archivo tal cual. Un archivo "equivalente" no sirve: UTE valida
  con sus propias fórmulas, así que tiene que ser **su** archivo completado.
- **Si UTE publica una versión nueva del formulario**, hay que volver a correr
  el script de preparación y revisar `cells.ts`. La hoja se busca por nombre
  ("Individual"), así que reordenar hojas no rompe nada; mover un campo de
  celda, sí. Si una celda del mapa no existe, ese dato se pierde **en silencio**.
- **El teléfono se escribe como texto a propósito**: como número perdería el
  cero inicial.
- **"Pasa línea" se normaliza al abrir la pantalla.** El dato viene con el valor
  por defecto de la consulta de microgenerador ("No corresponde"), que no es una
  opción válida del formulario de UTE; se cambia a "No Declara".
- **La tarifa guardada en el proyecto puede no estar en la lista de UTE** (por
  ejemplo "BT1", que viene de la factura). En ese caso se muestra igual como
  opción, pero conviene elegir la equivalente de la lista antes de enviar.
- **El borrador vive en el navegador** (`localStorage`, clave
  `voltia:suministro-individual:<projectId>`, o
  `voltia:suministro-individual:contacto:<contactoId>` para un cliente sin
  proyecto), no en el servidor: queda en esa
  computadora y ese navegador. Desde otra máquina el formulario arranca con los
  datos del proyecto. En modo incógnito o con el almacenamiento bloqueado no se
  guarda nada y la pantalla funciona igual.
- **Al releer la factura de UTE el borrador NO se reaplica**: gana el dato que
  acaba de extraer la IA. Reaplicarlo pisaría justamente lo que se fue a buscar.
- **El borrador se fusiona campo por campo sobre los datos del proyecto.** Si el
  formulario gana un campo nuevo, un borrador viejo no lo deja vacío: toma el
  valor del proyecto y conserva lo escrito en el resto. Si cambia la forma del
  borrador (`BORRADOR_VERSION`), se descarta entero en vez de recuperarse a
  medias.
- **Enviar dos veces no está bloqueado**: se puede corregir y reenviar. Queda
  **una copia del formulario por trámite comercial**: reenviar el mismo trámite
  reemplaza la suya; mandar un trámite de otro tipo (un aumento y después un
  provisorio) deja las dos.
- **`aumentoPotenciaSentAt` se sigue llenando con cualquier trámite**, no solo
  con aumentos (el nombre es histórico). Lo que distingue el tipo es el
  trámite comercial.

---

# Trámites con UTE Comercial

## Para qué existe

Además de la habilitación del generador, a veces hay que pedirle algo a **UTE
Comercial**: un aumento de potencia, un suministro nuevo, un provisorio de obra.
No todos los proyectos lo necesitan, pero cuando hay uno se perdía de vista
porque no tenía dónde seguirse. La sección **Comercial** de Trámites UTE junta
todos esos pedidos, con su estado y cuánto llevan.

## Cómo se usa

- **Trámites UTE** tiene dos secciones arriba: **Habilitación** (el tablero de
  siempre) y **Comercial**, en violeta (`#a78bfa`), con la cantidad de abiertos.
  La sección va en la URL (`/tramites-ute?seccion=comercial`) para poder
  linkearla.
- La tabla muestra cliente (con el suministro si no es el 1), tipo, detalle,
  estado, fecha de pedido, de resolución, días, número de caso y notas. Por
  defecto se ven solo los abiertos (a pedir, pedido, observado); los resueltos
  y cancelados se ven eligiéndolos en el filtro Estado. Hay buscador por
  cliente o código.
- Clic en una fila abre el trámite para editarlo o borrarlo.
- La lista se parte en dos bloques: **Con proyecto** y **Sin proyecto** (el
  cliente es un contacto del CRM; se muestra su nombre, documento y teléfono).
  El buscador busca por nombre del cliente, código del proyecto o documento del
  contacto. Editar estado, número de caso, notas y fechas funciona igual en los
  dos bloques.
- **Pedir trámite a UTE** (botón principal) pregunta **para quién**: un
  **Proyecto** (buscador de proyectos; lleva al formulario del proyecto) o un
  **Cliente sin proyecto** (buscar un contacto del CRM o **Cliente nuevo**:
  nombre, teléfono, email, cédula o RUT; queda creado como contacto). Ver
  "Trámites de clientes sin proyecto".
- **Nuevo trámite comercial** carga uno pedido por fuera de Voltia PM (por
  teléfono, en la oficina de UTE, por mail propio). También pregunta para
  quién (proyecto con buscador, o contacto con búsqueda/alta). El modal ofrece
  el enlace al formulario de UTE por si todavía no se pidió.
- Los que se mandan con el formulario (desde Onboarding o desde "Pedir trámite
  a UTE") aparecen solos. Los íconos de la columna Trámite bajan el
  **formulario enviado** (planilla) y la **factura de UTE** (documento); también
  se bajan desde el modal del trámite, en "Archivos".
- En la subetapa **Consulta inicial UTE** se listan los trámites del proyecto
  con su estado; clic lleva a la sección Comercial.

## Cómo funciona

- Modelo `UteTramiteComercial` (tabla `ute_tramites_comerciales`): **o
  `projectId` o `contactoId`** (uno de los dos; ambos opcionales en el schema y
  la regla la hace cumplir la ruta: el POST rechaza ninguno y ambos),
  `suministro` (número, default 1), `tipo`, `detalle`, `estado`, `caseNumber`,
  `notes`, `solicitadoEl` y `resueltoEl` (solo día, `@db.Date`), `emailLogId` y
  `fileAttachmentId` si vino del formulario, soft delete con `deletedAt`.
- **Tipos** (`UteTramiteComercialTipo`): los siete del campo "Trámite" del
  formulario de UTE (nuevo servicio, aumento, reducción, rehabilitación,
  instalación de enlace, provisorio general, provisorio de obra) más `OTRO`, que
  exige `detalle`.
- **Estados** (`UteTramiteComercialEstado`): `A_PEDIR`, `PEDIDO`, `OBSERVADO`,
  `RESUELTO`, `CANCELADO`.
- **Va aparte de `UteProcess`** porque convive con la habilitación: un proyecto
  tiene una habilitación por suministro y cero o más trámites comerciales,
  que pueden estar abiertos al mismo tiempo.
- **Alta automática** (`ute-comercial.service.ts` → `registrarTramiteEnviado()`):
  traduce el texto del formulario al tipo (`TIPO_DESDE_FORMULARIO`; un texto
  desconocido entra como `OTRO` con el texto tal cual) y arma el detalle con las
  potencias ("de 7 kW a 11,5 kW"). Si ya hay uno **abierto del mismo tipo y
  suministro** (del mismo proyecto o, sin proyecto, del mismo contacto), lo
  actualiza (vuelve a `PEDIDO`, cambia el mail y el detalle,
  conserva la fecha del primer pedido) en vez de abrir otro.
- **Endpoints** en `routes/ute-comercial.routes.ts`: `GET`, `POST`,
  `PATCH /:id` y `DELETE /:id` sobre `/api/ute-tramites-comerciales` (el GET
  acepta `?projectId=`; sin filtro trae los de proyectos no borrados y los sin
  proyecto). La respuesta suma `dias` (del pedido a la resolución, o a hoy si
  sigue abierto; sin fecha de pedido, `null`), el `contacto` y `archivos`
  (formulario y factura del trámite, armado por `archivosDe()`).
  `GET /:id/archivos/:attachmentId` baja uno de esos archivos (verifica que sea
  del trámite).
- **Las fechas siguen al estado** si no se cargan a mano: crear o pasar a un
  estado que no sea "a pedir" sin fecha de pedido la pone en hoy; pasar a
  resuelto pone la de resolución en hoy; reabrir un resuelto la borra. "Hoy" es
  el día de Uruguay (`hoyComoDia()`).
- Auditoría con el tipo `ute_tramite_comercial`: alta, cada cambio de campo
  (fechas en dd/mm/aaaa) y borrado.
- Al implementarse, una migración (`ute_tramites_comerciales_backfill`) pasó
  como **aumentos pedidos** los proyectos que ya tenían
  `aumentoPotenciaSentAt`, con la potencia solicitada en el detalle. Se asumió
  que todos eran aumentos porque los asuntos de los mails enviados lo eran.

## Trámites de clientes sin proyecto

Hay pedidos a UTE Comercial para gente que **no tiene proyecto** en Voltia PM:
alguien que todavía no compró y necesita el aumento antes, o un trámite suelto.
Antes no había cómo mandarlos desde Voltia PM. Ahora el cliente es un
**contacto del CRM** (`Contacto`) y el trámite se cuelga de él.

- **Pantalla**: la misma `SuministroIndividualUte.tsx`, en la ruta
  `/tramites-ute/contacto/:contactoId/suministro-individual` (permiso de ruta:
  Trámites UTE, ver). Detecta el modo por el parámetro (`contactoId` en vez de
  `projectId`) y cambia de dónde lee y a dónde manda.
- **Contexto** (`GET .../contactos/:contactoId/suministro-individual/contexto`):
  `emptyContext()` con el cliente del contacto (nombre, documento, teléfono
  pasado a formato local, email) y la firma del usuario. Se toma como **RUT**
  si el documento tiene 12 dígitos o el nombre parece de empresa
  (`esNombreDeEmpresa()`); en ese caso destino "Comercial." y actividad
  "General". El resto del formulario arranca vacío o con los valores por
  defecto (trámite "Aumento").
- **Factura de UTE** (`POST .../contactos/:contactoId/ute-extract`): la IA la
  lee con el mismo extractor (`factura_ute`) y lo leído **vuelve a la pantalla**
  (`aplicarFactura()` en la página): cuenta, calle, número, localidad,
  departamento, tarifa y potencia contratada se toman de la factura; nombre,
  documento, email y teléfono solo completan lo vacío. **No se guarda nada en
  el contacto.** El archivo sí se guarda como `FileAttachment` sin proyecto
  (`toolSource: "ute-comercial-factura"`, `toolEntityId` = el contacto mientras
  está pendiente); al enviar pasa a `toolEntityId` = el trámite. Subir otra
  reemplaza la pendiente.
- **Vista previa y envío** (`POST .../suministro-individual/preview.xlsx` y
  `.../enviar`, bajo `/api/ute-tramites-comerciales/contactos/:contactoId`):
  igual que con proyecto, con `sendTemplatedEmail()` **sin `projectId`** (así
  no se toca ningún `UteDocumentConfig`). Después del mail:
  `registrarTramiteEnviado({ contactoId, ... })`, el Excel se guarda como
  `FileAttachment` sin proyecto en la carpeta `ute-comercial/<contactoId>`
  (`toolSource: "ute-suministro-individual"`, `toolEntityId` = trámite) y queda
  en `fileAttachmentId` del trámite; un reenvío del mismo trámite reemplaza el
  Excel y la factura anteriores. Auditoría con tipo `ute_tramite_comercial`.
- **Buscar y crear el contacto** tienen endpoints propios de UTE
  (`GET` y `POST /api/ute-tramites-comerciales/contactos`): el alta usa
  `crearContacto()` del CRM, con su control de teléfono repetido.

## Permisos

Módulo **Trámites UTE**: ver para la lista, crear para el alta manual, editar
para cambiar, borrar para borrar. El alta automática no pasa por estos
permisos: la hace el envío del formulario, que pide Onboarding *o* Trámites UTE
editar (sección anterior). Un asesor (`ASESOR_COMERCIAL`, que solo ve Trámites
UTE) puede originar un trámite con el formulario y verlo en la sección, pero no
cambiarle el estado.

Para un cliente sin proyecto: el botón **Pedir trámite a UTE** se ve con
Onboarding *o* Trámites UTE editar; buscar contactos y ver contexto/vista previa
piden Onboarding *o* Trámites UTE ver; **crear el contacto**, leer la factura y
enviar piden Onboarding *o* Trámites UTE editar. Son endpoints de UTE a
propósito: no hace falta permiso del CRM de Ventas para buscar o dar de alta
al cliente. Bajar los archivos del trámite pide Trámites UTE ver.

## Casos borde

- **El formulario siempre registra el suministro 1.** El envío no sabe a qué
  suministro corresponde (igual que `aumentoPotenciaSentAt`, que vive en la
  configuración del suministro 1). En proyectos con varios suministros hay que
  corregir el número a mano en el trámite.
- **Si se cambia el tipo de un trámite a mano**, el próximo envío del formulario
  busca uno abierto del tipo nuevo: el viejo no se reutiliza.
- **Borrar un trámite no borra la copia del formulario** de los documentos del
  proyecto.
- **Sin proyecto, los archivos no aparecen en ningún "Documentos"**: solo se
  bajan desde el trámite. Si el cliente después compra y se crea el proyecto,
  el trámite **no se pasa solo** al proyecto: queda en "Sin proyecto".
- **La factura sin enviar queda guardada** (pendiente, atada al contacto) si se
  sube y no se manda el formulario. No se limpia sola.
- **La factura no viaja adjunta al mail**, igual que con proyecto: solo va el
  formulario.
- **Si se borra el contacto**, el trámite queda (la relación es `SetNull`) y se
  lista como "(contacto borrado)".
- **El borrador con contacto** usa su propia clave en el navegador, así que no
  se mezcla con el de un proyecto.

---

# Proyectos con varios suministros

## Para qué existe

Una propuesta puede llevar **inversores distintos** (el cotizador lo permite
desde el 29-09-2026): el caso típico es un cliente con dos casas, dos padrones o
dos medidores. Para UTE eso son **dos suministros**, dos cuentas, y cada una
lleva su propia consulta, su propio juego de papeles y su propio trámite. Hasta
esto, el sistema asumía una sola cuenta UTE por proyecto.

Lo que se acordó con Nicolás (30-09-2026):

- **Un inversor, un suministro.** Dos inversores sobre el mismo medidor no es un
  caso que se contemple: cada inversor es una cuenta UTE.
- **Cada suministro tiene su trámite**, porque UTE los resuelve por separado.
- **El titular puede ser otro** (dos hermanos, una empresa y su dueño).
- **Contrato y proforma son uno solo** y nombran todos los inversores (ya
  hecho); unifilares, uno por suministro; proyecto de ingeniería y memoria, uno
  solo que aclara que son dos. *(Lo pendiente: ver "Lo que falta" abajo.)*

## Cómo se usa

1. **Al convertir el lead**, si la última propuesta publicada lleva más de un
   inversor, el proyecto nace con **un sistema por inversor** (marca, potencia y
   paneles repartidos como en la propuesta) y un trámite UTE por cada uno. Eso
   vale también para la forma clásica de "varios inversores iguales".
2. En un proyecto ya abierto, **"+ Agregar suministro"** en el panel del
   unifilar (espacio de Ingeniería) abre una pestaña nueva; el suministro se
   crea —su sistema y su trámite— recién al guardar su primer unifilar
   (`volcarUnifilarEnSistema()` → `asegurarTramiteSuministro()`). Desde
   14-oct-2026 la ficha del proyecto ya no agrega suministros.
3. En Onboarding, el botón de la consulta dice **"Enviar consultas a UTE (N
   suministros)"** y cuántas faltan. La pantalla de la consulta muestra una
   **pestaña por suministro**, cada una con su factura, su cuenta, su titular y
   la potencia de su inversor; al mandar una, salta a la siguiente pendiente.
4. **Documentos UTE** (`/ingenieria/proyecto/:id/ute-docs?suministro=N`): una
   pestaña por suministro. Cada uno genera su propio ZIP con su inversor, sus
   paneles, su cuenta y su titular (la sección "Cliente" pasa a ser "Titular del
   suministro N", vacío = igual que el proyecto). En los documentos del proyecto
   hay un par de bloques "generados / firmados" por suministro.
5. **Trámites UTE**: una tarjeta por suministro ("Cliente · Suministro 2"), cada
   una con sus fechas. En la pestaña UTE del proyecto, una pestaña por trámite.
6. **Unifilar** (workspace de Ingeniería): una pestaña por suministro, cada
   una con sus versiones (v1, v2… por suministro). El primero de un suministro
   se precarga con su inversor y sus paneles. El rótulo del plano dice
   "· Suministro N" y, si tiene titular propio, su nombre y su localidad.
7. **Proyecto final (EFP)**: uno solo. La IA recibe los suministros con la
   instrucción de describir cada uno por separado.
8. **Habilitación**: cuando UTE habilita un suministro y queda otro pendiente,
   Experiencia Solar recibe un aviso in-app para decirle al cliente que ya puede
   encender ese inversor. El proyecto se da por habilitado (etapa completa,
   Regla de Oro, Post-Habilitación, E3) cuando termina **el último**.

## Cómo funciona

**No hay una tabla "suministro".** El número de suministro une tres cosas que
ya existían y ahora pueden repetirse dentro del proyecto:

| Qué | Dónde | Clave |
|---|---|---|
| Inversor y paneles | `SolarSystem` | `order` |
| Cuenta UTE y datos de los papeles | `UteDocumentConfig` | `suministro` (único con `projectId`) |
| El trámite | `UteProcess` | `suministro` |

La lógica está en `services/suministros.service.ts`:

- `listSuministros()` — lo que devuelve `GET /projects/:projectId/suministros`:
  por cada número, el inversor, la cuenta, el titular y la dirección resueltos,
  la factura y la fecha de la consulta. Los números salen de los sistemas **y**
  de los trámites vivos, siempre con el 1.
- `datosSuministro()` — resuelve titular y dirección. **El suministro 1 lee
  siempre del proyecto**, como antes. Los demás leen de su `UteDocumentConfig`
  (`titularNombre`, `titularCi`, `titularEmpresa`, `calle`, `numCalle`,
  `localidad`, `departamento`) y **lo que tienen vacío cae al proyecto**. La
  factura y la cédula **no** caen: la factura del 1 no es la del 2.
- `crearSuministrosDesdePropuesta()` — lo llama `POST /leads/:id/convert`. Si
  el proyecto ya tiene sistemas no hace nada. Si falla, la conversión sigue.
- `asegurarTramiteSuministro()` / `retirarTramiteSuministroSinUso()` — al crear
  un sistema se crea su trámite; al borrarlo, el trámite se retira **solo si no
  tiene nada cargado** (ni fechas, ni caso, ni notas).

**La consulta.** `buildEmailContext()` y `prepareEmail()` reciben `suministro`;
`POST /emails/send` recibe `suministro` y, para los que no son el principal,
`datosSuministro`. Después del envío, `registrarConsultaUteEnviada()` (en
`email/send.service.ts`) pone la fecha de consulta **solo en el trámite de ese
suministro** y, si no es el principal, guarda en su config la cuenta, el titular
y la dirección con que salió la consulta: es el primer lugar donde se cargan.

**La factura y la cédula** (`POST/DELETE /projects/:projectId/ute-extract?suministro=N`)
de un suministro que no es el principal se guardan en
`storage/projects/<id>/ute-docs/suministro-N/` y su ruta va a su config, no al
proyecto. `useUteExtract(projectId, suministro)` manda los datos leídos a la
config de ese suministro y no toca el proyecto.

**Quedan en Documentos del proyecto.** Al subir la factura o la cédula (de
cualquier suministro) se crea un `FileAttachment` con `toolSource`
`factura-ute-cliente` o `cedula-cliente` y `suministro` (null = principal), que
**apunta al mismo archivo** de `ute-docs/` (no lo copia): `url` es la misma ruta
que `facturaUtePath` / `cedulaPath`. Lo maneja
`documentos-cliente.service.ts` → `sincronizarDocumentoCliente()`: uno vigente
por documento y suministro, volver a subir lo reemplaza y quitarlo lo retira
(soft-delete). En la lista de Documentos se rotula "Factura UTE" / "Cédula"
(con "· suministro N" si no es el principal), va con los comerciales y no se
puede borrar desde ahí. Hasta el 20-nov-2026 no se creaba el adjunto y el
archivo no se podía descargar; el script
`prisma/scripts/backfill-documentos-cliente.ts` (`--apply`) carga los que ya
estaban subidos, atribuidos a quien hizo la extracción según la auditoría.

**La config de documentos UTE** (`GET/PUT/DELETE /projects/:projectId/ute-docs/config`)
acepta `?suministro=N` (default 1). El DELETE ("Resetear") borra solo la del
suministro pedido; la pantalla vuelve a guardar la cuenta y el titular de ese
suministro, que no son "datos de los papeles".

**Los papeles** (`POST .../ute-docs/generate`, `GET .../ute-docs/generado`,
`GET/POST .../ute-docs/firmados`) aceptan `?suministro=N`. El generador
(`ute-docs/generator.ts` → `generateUteDocs()`) toma el `SolarSystem` de ese
`order`, su config, y el proyecto "visto desde el suministro"
(`proyectoDelSuministro()`: titular y dirección propios encima de los del
proyecto). Los archivos llevan `FileAttachment.suministro` (null = principal) y
cada suministro tiene su ZIP vigente; `UteDocumentGeneration.suministro` queda
para auditoría.

**El unifilar** (`routes/unifilar.routes.ts`): `UnifilarVersion.suministro`,
único por (proyecto, suministro, versión). Listar, crear y previsualizar aceptan
`?suministro=N`; `encabezado()` arma el rótulo. El PDF vigente se guarda como
`FileAttachment` con `suministro` (null = principal) y se reemplaza solo el de
ese suministro. No se puede borrar la única versión **de un suministro**. El
plan de granizo (`polizas.service.ts` → `panelesDeUnifilar()`) suma la última
versión de cada suministro.

**El proyecto final** (`efp.service.ts` → `buildUserPrompt()`): con más de un
suministro agrega la sección "SUMINISTROS — IMPORTANTE" (inversor, paneles,
cuenta, titular propio y localidad de cada uno) y lista el trámite de cada
suministro.

**El trámite del proyecto** (`ute-sync.service.ts` → `regenerateUteSubstages()`,
llamado con cualquier trámite del proyecto): las subetapas de Habilitación UTE
siguen las fechas del principal, pero se calculan sobre `vistaDelProyecto()`:
si algún trámite no terminó, el principal se ve sin finalizar (la última
subetapa queda en curso y no corren ni la Regla de Oro ni Post-Habilitación);
si terminaron todos, la fecha de habilitación es la del último.
`avisarHabilitacionParcial()` manda la notificación a `EXPERIENCIA_SOLAR`
(idempotente por `hab-parcial:<trámite>:<usuario>`). Borrar un trámite
secundario reevalúa el proyecto.

## Permisos

- `GET /projects/:projectId/suministros`: `ONBOARDING:VIEW`, `TRAMITES_UTE:VIEW`
  u `OPERACIONES:VIEW` (cualquiera). Lo usan el botón de Onboarding y la
  pantalla de la consulta, que a su vez exigen `TRAMITES_UTE:VIEW`.
- Lo demás no cambió de permiso: la consulta se prepara y envía con el
  permiso de siempre, la factura con `OPERACIONES:EDIT`, la config UTE con
  `INGENIERIA`, y crear/borrar sistemas con `OPERACIONES`.

## Reglas y decisiones

- **Qué ve todos los trámites y qué ve solo el principal.** El tablero y las
  métricas de Trámites UTE y la banda UTE del panel de operaciones cuentan
  **cada trámite** (cada cuenta es trabajo real con sus propios tiempos). La
  ficha del proyecto (`uteProcess`), el conector y el monitoreo leen el
  **principal** (`UTE_PRINCIPAL`). El portal y la ficha de Experiencia Solar
  muestran el principal pero **"finalizado" solo cuando terminaron todos**
  (`vistaDelProyecto()`); la ficha además lista el estado de cada suministro.
- **Habilitar una cuenta no es habilitar la obra.** Por eso el proyecto espera
  al último trámite, y el aviso intermedio es solo una notificación (sin reloj
  de 24/48 h): el formal es el de la Regla de Oro.
- **Los códigos PS/AS** de la fila del tablero son los del proyecto (principal).
  Los de otro suministro se muestran de lectura, tomados de su config UTE, y se
  cargan en sus Documentos UTE.
- **Los datos del suministro extra se guardan con lo que salió en la consulta**,
  no en un formulario aparte: lo que se le mandó a UTE es lo que vale.

- **Cerrar el trámite exige los hitos, o un motivo escrito.** Dar un trámite por
  finalizado dispara el aviso de "ya podés encender", que tiene plazo de 24-48 h
  y le dice al cliente que prenda su planta. Por eso el PATCH de
  `/ute-processes/:id` rechaza el cierre (`UTE_HITOS_INCOMPLETOS`) si falta
  alguno de los 11 hitos de `UTE_ACTION_KEYS`, y solo lo acepta con
  `cierreSinHitos: true` + `cierreSinHitosMotivo`, que quedan guardados en el
  trámite y se muestran en su detalle. La validación corre **solo cuando el
  trámite estrena el cierre**: editar uno ya cerrado no vuelve a pedir nada.
- **La fecha manda sobre el selector.** `marcarHabilitacionEnProyecto()` exige
  `finalizedAt`: sin esa fecha no escribe `postHabilitacionInicioEn` ni activa
  los pasos de E2/E3. Antes caía a `new Date()`, y mover el selector de etapa a
  "Finalizado" alcanzaba para avisarle a un cliente **que no había hecho la
  obra** que encendiera su planta (Ernesto Cameto, 1-oct-2026). El selector es
  una declaración; la fecha es el hecho.

## Casos borde

- **Borrar el sistema de un suministro que ya tiene consulta** deja el trámite
  vivo, y el suministro sigue apareciendo en la consulta (sin inversor). Es
  historia del trámite: la decide una persona.
- **Trámites cerrados sin hitos de antes.** A 5-oct-2026 producción tenía 6
  trámites finalizados con hitos faltantes. Cuatro (Medina, Labandera, Gambaro,
  Portela) son habilitaciones **reales**: tienen fecha de habilitación y obra
  hecha, y solo les faltan los pasos intermedios, cargados a medias. Esos no se
  tocan. Los otros dos (Cameto, Rodrigo Alvarez) estaban marcados "Finalizado"
  **sin fecha**, y son el error que motivó la validación.
  `scripts/fix-habilitacion-sin-fecha.ts` revierte el disparo falso: borra
  `postHabilitacionInicioEn` y desactiva los pasos de E2/E3 que no estén
  completados, solo en los trámites sin `finalizedAt`.
- **Proyectos existentes**: todos quedaron como suministro 1 (la migración es
  aditiva, sin backfill). A 30-09-2026 ningún proyecto de producción tenía más
  de un sistema ni más de un trámite.
- **"Pot. comprometida generador" no se precarga** con la potencia del
  inversor: sigue siendo manual, igual que en el suministro 1. La pestaña
  muestra el inversor del suministro para que no se cargue la del proyecto
  entero.

## Lo que no cubre

- **La pre-ingeniería** sigue siendo una por proyecto (sus datos eléctricos son
  texto libre y ya admiten varias instalaciones). El proyecto final toma de ahí
  lo técnico y de los suministros la separación por cuenta.
- **"Finalizar trámite" desde la etapa** (`POST /projects/:projectId/ute/finalizar`)
  cierra solo el trámite principal: con otro pendiente, la etapa no se completa.
- **El encabezado del trámite en la ficha de Experiencia Solar** muestra la
  etapa del principal (la lista de suministros de abajo dice el resto).

---

## Lo que falta documentar de este capítulo

- El proceso de habilitación y sus estados
- Subetapas dinámicas: cómo se regeneran
- Los formularios PDF generados y la regla de los checkboxes
- Documentos firmados y su almacenamiento
- Fechas del trámite y qué se autocompleta
- Avance automático del pipeline al finalizar
