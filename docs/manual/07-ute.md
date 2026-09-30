# 07 · Habilitación UTE

> **Capítulo parcial.** Están documentadas la **solicitud de suministro individual
> / aumento de potencia contratada** y los **proyectos con varios suministros**
> (hasta la consulta a UTE). El resto del módulo (proceso de
> habilitación, subetapas dinámicas, formularios PDF, documentos firmados)
> sigue pendiente de escribir: la funcionalidad existe y está en producción,
> lo que falta es la documentación.

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

## Cómo se usa

1. En la ficha del proyecto, abrir la subetapa **"Consulta inicial UTE"** de
   Onboarding. Debajo del botón de consulta aparece **"Solicitar aumento de
   potencia"**.
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

Después de enviar, el botón de la subetapa pasa a decir cuándo se pidió el
aumento y por cuánto.

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
| `GET .../suministro-individual/estado` | Si ya se pidió, cuándo y por cuánto |
| `POST .../suministro-individual/preview.xlsx` | Devuelve el formulario completo para revisarlo |
| `POST .../suministro-individual/enviar` | Completa, adjunta, envía y registra |

**Al enviar** se guarda la potencia en `UteDocumentConfig.potSolicitada`, la
fecha en `aumentoPotenciaSentAt`, una copia del archivo en los documentos del
proyecto (`FileAttachment` con `toolSource: "ute-suministro-individual"`) y una
entrada de auditoría.

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
  `voltia:suministro-individual:<projectId>`), no en el servidor: queda en esa
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
- **Enviar dos veces no está bloqueado**: se puede corregir y reenviar. Solo
  queda la última copia del formulario en los documentos del proyecto.

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
2. En un proyecto ya abierto, **"Agregar suministro"** en los datos técnicos
   agrega un sistema más, y con él su trámite.
3. En Onboarding, el botón de la consulta dice **"Enviar consultas a UTE (N
   suministros)"** y cuántas faltan. La pantalla de la consulta muestra una
   **pestaña por suministro**, cada una con su factura, su cuenta, su titular y
   la potencia de su inversor; al mandar una, salta a la siguiente pendiente.

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

**La config de documentos UTE** (`GET/PUT/DELETE /projects/:projectId/ute-docs/config`)
acepta `?suministro=N` (default 1). El DELETE ("Resetear") borra solo la del
suministro pedido.

## Permisos

- `GET /projects/:projectId/suministros`: `ONBOARDING:VIEW`, `TRAMITES_UTE:VIEW`
  u `OPERACIONES:VIEW` (cualquiera). Lo usan el botón de Onboarding y la
  pantalla de la consulta, que a su vez exigen `TRAMITES_UTE:VIEW`.
- Lo demás no cambió de permiso: la consulta se prepara y envía con el
  permiso de siempre, la factura con `OPERACIONES:EDIT`, la config UTE con
  `INGENIERIA`, y crear/borrar sistemas con `OPERACIONES`.

## Reglas y decisiones

- **El trámite del suministro 1 es "el trámite del proyecto".** Todo lo que
  habla de "el trámite UTE" —subetapas de Habilitación, tablero y métricas de
  Trámites, portal del cliente, ficha de Experiencia Solar, Regla de Oro,
  monitoreo, conector— filtra por `UTE_PRINCIPAL`. Así, un proyecto con dos
  suministros se ve igual que antes en esas pantallas.
- **Un trámite que no es el principal no mueve el pipeline**:
  `regenerateUteSubstages()` sale sin hacer nada. Si pudiera, habilitar una sola
  cuenta daría el proyecto por habilitado.
- **Los datos del suministro extra se guardan con lo que salió en la consulta**,
  no en un formulario aparte: lo que se le mandó a UTE es lo que vale.

## Casos borde

- **Borrar el sistema de un suministro que ya tiene consulta** deja el trámite
  vivo, y el suministro sigue apareciendo en la consulta (sin inversor). Es
  historia del trámite: la decide una persona.
- **Proyectos existentes**: todos quedaron como suministro 1 (la migración es
  aditiva, sin backfill). A 30-09-2026 ningún proyecto de producción tenía más
  de un sistema ni más de un trámite.
- **"Pot. comprometida generador" no se precarga** con la potencia del
  inversor: sigue siendo manual, igual que en el suministro 1. La pestaña
  muestra el inversor del suministro para que no se cargue la del proyecto
  entero.

## Lo que falta (partes 2 a 4)

- **Documentos UTE** por suministro (hoy el generador usa el suministro 1).
- **Tablero de Trámites UTE** con una tarjeta por suministro, y cuándo se avisa
  la habilitación y se pasa a Post-Habilitación (propuesta: aviso por cada uno;
  Post-Habilitación con el último).
- **Contrato**: la fila "Potencia nominal del inversor" muestra la suma cuando
  hay varios inversores distintos (el contrato ya nombra a todos los inversores y
  suma los paneles, igual que la proforma: `resumirSistemasVarios()`). Falta
  separar la potencia por suministro o rotularla como total.
- **Unifilar** por suministro; pre-ingeniería, proyecto final y memoria que
  mencionen los dos.

---

## Lo que falta documentar de este capítulo

- El proceso de habilitación y sus estados
- Subetapas dinámicas: cómo se regeneran
- Los formularios PDF generados y la regla de los checkboxes
- Documentos firmados y su almacenamiento
- Fechas del trámite y qué se autocompleta
- Avance automático del pipeline al finalizar
