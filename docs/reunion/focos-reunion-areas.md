# Focos para la presentación — reunión de áreas

> Notas crudas de Nicolás, ordenadas a medida que llegan. Se arma la presentación
> cuando estén todos.

---

## Foco 1 · Onboarding — seguimiento de la financiación bancaria

**El problema (recurrente):** llega el momento de la obra, todo planificado, y el
cliente frena porque **el banco todavía no le contestó** si le aprueba el crédito.
Nadie le hizo seguimiento a la proforma.

**Por qué se tranca:** el banco pide información al cliente, el cliente nunca ve
el pedido, y **todos quedan esperando algo que no va a pasar solo**.

**Lo que cambia — responsabilidad del asesor comercial:**

1. **Desde el onboarding, define la modalidad de pago**: directo con Voltia o
   financiación bancaria.
2. **Si es financiación bancaria:** arma la proforma y le hace **seguimiento
   semanal**. Habla con **las dos partes** —banco y cliente— para ver qué está
   pendiente y destrabarlo. No alcanza con mandarla.
3. **Si es directo:** crea el **calendario de pagos**: seña + tres cuotas.
   - 50 % previo a la obra
   - 30 % con la obra terminada
   - 20 % al habilitarse

### Qué dice el sistema hoy (verificado)

- La subetapa **"Modalidad de pago definida"** ya existe en Onboarding, a cargo
  del Asesor Comercial, y su checklist **ya es condicional**: si la modalidad es
  financiación bancaria, aparecen *"Proforma enviada al banco"* y *"Crédito
  aprobado"*, este último marcado como **bloqueante**.
- El **plan de pagos** ya trae por defecto las tres cuotas exactas: *Pago previo
  50 %*, *Pago obra terminada 30 %*, *Pago obra habilitada 20 %*.
- **PERO: en producción hay 101 proyectos y NINGUNO tiene la modalidad de pago
  definida.** El campo existe, el checklist condicional existe, el bloqueo
  existe — y no se está usando. Por eso el bloqueo nunca se dispara.

**Conclusión:** el procedimiento ya está modelado en el sistema. Lo que falta es
**usarlo**, y una sola cosa que no existe: **el recordatorio del seguimiento
semanal de la proforma**.

---

## Foco 2 · A quién preguntarle por la venta

**No hay un responsable de ventas.** Pero cada proyecto **tiene su asesor
comercial asignado**, y ese dato está en el sistema.

**La regla:** cualquier duda de cualquier área sobre la venta —qué se prometió,
qué alcance, qué condiciones— **se le pregunta al asesor comercial de ese
proyecto**, no a "Ventas" en general.

---

## Foco 3 · El pasaje del vínculo: del asesor a Experiencia Solar

**Dónde termina el asesor:** su rol se cierra cuando completa el onboarding.

**Pero no se va sin presentar.** Antes de soltar, el asesor comercial hace el
**pasaje de la responsabilidad del contacto, de cara al cliente**:

> «De acá en adelante vas a seguir en contacto con Alejandra», y le pasa el
> contacto.

**Después, y no antes:** al día siguiente como máximo, **Alejandra se pone en
contacto** — pero ya habiendo sido presentada.

**Por qué en ese orden.** Si Alejandra escribe primero, el cliente recibe el
mensaje de alguien que no conoce y **desconfía**: no sabe quién es esa persona ni
por qué le está escribiendo. La presentación previa del vendedor es lo que
convierte ese mensaje en la continuidad de una relación en vez de un contacto
frío.

**Es una entrega en dos tiempos, no un traspaso interno:**

| | Quién | Cuándo |
|---|---|---|
| 1. Presentación | El asesor comercial, al cliente | Al cerrar el onboarding |
| 2. Primer contacto | Alejandra, al cliente | Al día siguiente, máximo |

### Qué dice el sistema hoy

El paso **"Bienvenida y presentación"** ya existe en E1 y su nota dice
literalmente: *"La manda el vendedor al cerrar. Sin esto, Experiencia Solar
contacta en frío."* Es exactamente esto.

Es además uno de los **tres avisos clave** que pintan la fila del cliente de rojo
cuando faltan.

---

## Foco 4 · Pre-Ingeniería y el acompañamiento en paralelo

**Operaciones todavía no existe para esta obra.** Al dispararse la
pre-ingeniería, Operaciones no sabe nada del proyecto. Entra recién en la
validación.

**Con qué trabaja Pre-Ingeniería:** con todo lo que **ya viene cargado desde el
lead** — el resumen de la visita, la minuta, las fotos, los videos. Eso lo carga
el vendedor durante la venta. Si falta, Pre-Ingeniería arranca a ciegas.

### En paralelo: Experiencia Solar con el cliente

Mientras Ingeniería trabaja, **Experiencia Solar es quien está en contacto con el
cliente**, con una **cadencia máxima de una semana**: no puede pasar más de una
semana sin que el cliente sepa algo.

Qué hace en ese tramo:

- Se presenta (después de que la presentó el vendedor).
- Le pasa documentación.
- Le hace seguimiento a los pagos.
- **La fecha de obra la comunica recién cuando Operaciones se la pasa.**

## Foco 5 · Validación de Operaciones

Cuando la ingeniería está hecha, el proyecto pasa a Operaciones. En esta etapa
pasan **cuatro cosas**, no una:

1. **La gerencia de Operaciones marca la fecha en el calendario.**
2. **Esa fecha se le avisa a Experiencia Solar**, que es quien se la comunica al
   cliente. Operaciones no le avisa directo.
3. Se hace la **revisión de la pre-ingeniería**, sobre todo de la **lista de
   materiales**.
4. Hay una **visita técnica de coordinación**.

De ahí salen las **devoluciones a Ingeniería** para que elabore el proyecto final
con esa revisión incorporada.

---

## Foco 6 · Cómo se sigue el trabajo, y cómo se manejan las demoras

**El primer contacto entre Operaciones y Experiencia Solar** es cuando la
gerencia de Operaciones le pasa la fecha. Antes de eso no se cruzan.

### La regla de fondo

> **Todo el seguimiento se hace en la aplicación. No hay que preguntarle a nadie
> en qué está tal cosa.**

Si hay que preguntar, es porque falta un registro. El estado de cada etapa, sus
plazos y sus comentarios están ahí.

### Las demoras: quien se demora avisa

> **No hay pedidos de explicaciones entre responsables de área.**

Ejemplo concreto: Experiencia Solar **no** le pide explicaciones a Operaciones
porque una etapa lleva mucho tiempo en validación.

**Lo que se espera en su lugar:** que Operaciones **deje un comentario indicando
el motivo de la demora**. El que se demora explica por su cuenta; no espera que
le vengan a preguntar.

**La única excepción:** si la demora es excesiva, Alejandra sí puede preguntar
—porque **el cliente le está pidiendo explicaciones a ella**— y necesita algo
cierto que decirle.

**Pero eso no debería pasar:** si ya hay fecha agendada y avisada al cliente y no
se va a cumplir, **corresponde una reagenda**, y ahí se le notifica a Experiencia
Solar. La reagenda es el mecanismo; el pedido de explicaciones es el síntoma de
que no se usó.

**Lo que está fuera de plazo se trata en la reunión de coordinación**, no entre
dos áreas por mensaje.

### Qué dice el sistema hoy (verificado en producción)

- **El control de plazos por etapa existe y está configurado**: hay 10 SLA
  cargados, con cuenta regresiva y semáforo por etapa.
- **Reprogramar una obra confirmada ya exige el motivo** y genera un aviso propio
  por cada reprogramación, con el motivo adentro.
- **Los comentarios que deja cada área en su etapa llegan solos al historial del
  cliente**, con la etiqueta del área. O sea: el comentario de Operaciones
  explicando la demora ya le llega a Experiencia Solar sin que nadie lo reenvíe.

---

## Foco 7 · Quién puede hablar con el cliente — regla dura

> **Solo dos personas se contactan con el cliente: Experiencia Solar y el capataz
> asignado a la obra. Nadie más.**

- El **vendedor ya dejó de tener implicancia** (después del onboarding y la
  presentación).
- **Ni el referente de Operaciones ni el encargado de Compras y Logística**
  contactan al cliente.
- Cualquier cosa que haya que coordinar con él **pasa por una de las dos**.

**El reparto:**

| Quién | Qué |
|---|---|
| **Capataz** | Todo lo de **ejecución de obra**: horarios de llegada y de partida, llegada de materiales, levantada de materiales |
| **Experiencia Solar** | **Todo lo demás** |

### La contrapartida: Alejandra no puede tener que preguntar

Para poder responderle al cliente o informarlo, **no debería tener que
preguntarle nada a nadie**: la información tiene que estar en el PM.

> Por eso es **extremadamente necesaria la documentación diaria** —o al menos de
> **cualquier incidencia o novedad**— por parte de **todas las áreas**: ventas al
> principio, operaciones, compras y logística, experiencia del cliente y
> tramitación UTE. Muchas cosas ya se notifican solas; el resto se anota.

**Experiencia Solar tiene un cuadro de novedades** que se actualiza con cada
incidencia, en tiempo real: un registro, pero **filtrado a lo que le interesa**.

### Qué dice el sistema hoy

Ese cuadro **ya existe y ya funciona así**:

- El **historial de la ficha del cliente** junta todo en un solo hilo, con la
  etiqueta del módulo del que viene cada cosa: Ventas, Ingeniería, Operaciones,
  Proyecto, Trámite UTE, Experiencia Solar, Documentos, Ticket y Encuesta.
- **Cada área anota donde ya está trabajando** y aparece ahí solo. El capataz
  comenta en la etapa de obra desde el celular; no entra al módulo de Experiencia
  Solar.
- Se limpió el ruido: ya no se cuelan cambios de estado de finanzas ni de
  tickets. Solo lo que es novedad del cliente.
- Además hay un **correo diario del Recorrido** con lo vencido arriba y, por
  etapa, quiénes están fuera de cadencia o tienen novedad sin avisar.

---

## Foco 8 · La tabla de referentes que se le entrega al cliente

En una de las **primeras comunicaciones**, Alejandra le pasa al cliente **quiénes
se van a contactar con él**, para que sepa a quién recurrir para cada cosa. Y
también **a quién escalar** si no le responden o si es una urgencia.

| Para… | Escribile a… | Si no te responden o es urgente |
|---|---|---|
| Horarios, accesos y materiales del día de obra | **El capataz asignado** | **Gabriel** — Gerente de Operaciones |
| Todo lo demás | **Alejandra** — Experiencia Solar | **Nicolás** — CEO |

**El escalamiento se entrega desde el principio, pero enmarcado como excepción.**
Decisión tomada: darlo de entrada transmite confianza y es coherente con el resto
del modelo, pero **con la frase que lo encuadra**, no como una columna más de la
tabla. Si se presenta al mismo nivel que el contacto habitual, el cliente aprende
que por ahí lo atienden más rápido y se convierte en el canal de siempre.

La frase, más o menos así:

> «Si alguna vez sentís que no te estamos respondiendo, escribime a mí.»

### Dos salvaguardas para que no se dé vuelta

1. **Se presenta como "este es tu equipo", nunca como "estas son nuestras
   áreas".** La tabla existe para que el cliente sepa a quién escribirle, no para
   explicarle cómo estamos organizados por dentro.
2. **No puede usarse jamás para rebotar** a un cliente que preguntó en el lugar
   equivocado. Si le escribe al capataz algo que no es de obra, el capataz lo
   resuelve puertas adentro — no lo manda a otro lado.

---

## Foco 9 · El cierre de obra: qué tiene que dejar el capataz

**Es responsabilidad de Operaciones —del capataz— y sin eso la obra no se marca
como terminada:**

- Llevarle al cliente **todos los documentos para la habilitación** y traerlos
  firmados.
- Generar **todos los registros fotográficos y de video** necesarios.
- **Cargar todo eso al PM**: documentos firmados, fotos, videos de los ensayos.

> Si algo falta, **es responsabilidad del capataz que eso esté**.

### Qué dice el sistema hoy

El checklist de **Ejecución de Obra** ya pide exactamente esto, ítem por ítem:

- Fotos generales · fotos de tablero y protecciones · fotos de puesta a tierra
- Videos de ensayos subidos
- Checklist firmado subido · Documentación UTE firmada subida
- Firma del cliente en el checklist
- Recorrido y explicación al cliente

O sea: **la lista ya está escrita en el sistema.** Lo que hay que acordar es que
sin eso completo la obra no se cierra.

## Foco 10 · Nadie habla directo con los capataces

> **Experiencia Solar, Tramitación UTE e Ingeniería nunca se comunican
> directamente con un capataz. Siempre con el Gerente de Operaciones.**

Si en la tramitación se detecta que **faltó una firma** o falta un documento, el
reclamo va **al Gerente de Operaciones**, y es él quien lo baja al capataz.

Aplica a los dos casos:

| Quién reclama | A quién |
|---|---|
| **Tramitación UTE** (Luna) | Gerente de Operaciones |
| **Experiencia Solar** (Alejandra) | Gerente de Operaciones |
| **Ingeniería** | Gerente de Operaciones |

### La asimetría, que es a propósito

- **El capataz sí habla con el cliente** — de horarios, accesos y materiales del
  día de obra.
- **Las otras áreas no hablan con el capataz** — hablan con su gerente.

No es una contradicción: el capataz tiene **una sola** interlocución hacia
afuera (el cliente, y sólo de obra) y **una sola** hacia adentro (su gerente).
Todo lo demás pasa por el gerente, que es quien puede priorizar y responder por
el equipo.

---

## Foco 11 · Minimizar las comunicaciones internas

**Lo que se quiere evitar:** que Alejandra le pida cosas a todo el mundo —al
capataz, al gerente, al CEO— y que después Luna le pida **lo mismo** al gerente.
Pedidos duplicados, por distintos canales, a distintas personas.

> **La comunicación entre áreas tiene que ser lo más minimalista posible.**

**Quién pide qué, y a quién:**

| Qué | Quién lo pide | A quién |
|---|---|---|
| Documentación faltante para la tramitación | **Luna** (Tramitación UTE) | Gerente de Operaciones |
| La fecha agendada de obra | La manda **Operaciones** | Experiencia Solar |

**Y poco más.** La comunicación entre Experiencia Solar y Operaciones debería ser
casi sólo eso: la fecha. **El resto de la información tiene que estar en el PM.**

## Foco 12 · El registro de avance de obra — y el desacuerdo

**El pedido:** que Operaciones registre el **estado de avance de la obra**, para
que Alejandra tenga dónde mirar sin preguntar.

**Qué NO es:** no es el detalle de cuántos paneles se subieron al techo ni si se
cambió un cable por otro.

**Qué SÍ es:** el **estado de avance**, para que quien se comunica con el cliente
sepa en qué punto estamos. Nada más.

### El desacuerdo, planteado

**Gerencia de Operaciones:** ¿para qué necesita Experiencia Solar esta
información? La etapa de ejecución de obra es de ellos; hasta que no termine, no
tiene por qué saber nada.

**CEO:** discrepo. **El cliente siempre puede preguntar algo.** Y lo que hay que
evitar a toda costa es que el cliente diga —**como ya nos lo dijeron**— que *no
tenemos comunicación interna entre nosotros*.

**El punto de acuerdo posible:**

> En el mejor de los casos, Experiencia Solar no necesita saber nada durante la
> obra. Pero **si por algún motivo lo necesita, la información tiene que estar
> accesible y centralizada en un solo lugar: el PM.**

No es un pedido de reportar. Es que **el dato exista** por si hace falta — que es
distinto, y mucho más barato, que tener que ir a buscarlo preguntando.

---

## Foco 13 · La pregunta disparadora del avance de obra

**La idea:** en vez de pedirle a Operaciones que "registre el avance" —que es
abstracto y cada uno interpreta distinto—, **hacerle una pregunta concreta** cuya
respuesta ya sirva tal cual para Experiencia Solar.

### La pregunta

> ### «¿Qué le decimos al cliente si pregunta hoy?»

**Por qué esta y no otra.** Cambia el marco de *reportar* —trabajo burocrático,
para alguien que quizá nunca lo lea— a *contestarle al cliente*, que es algo que
el capataz ya sabe hacer y hace todo el tiempo. La respuesta sale sola, en el
lenguaje correcto, y **es directamente utilizable**: Alejandra la copia y la
manda.

Pedirle "el estado de avance" produce *"70 % de montaje"*, que a nadie le sirve.
Pedirle qué decirle al cliente produce *"terminamos el montaje, mañana cerramos
la parte eléctrica"*, que es exactamente lo que hace falta.

### Cómo se responde: de un toque

Escribir es fricción, y **si registrar cuesta, no se registra**. La pregunta viene
con respuestas de un toque, y sólo la última pide texto:

- Arrancamos, todo en orden
- Vamos según lo previsto
- Avanzamos, seguimos mañana
- Terminamos la obra, falta cargar la documentación
- **Hubo un imprevisto** → y ahí sí, dos líneas

La última es la única que importa de verdad: es la que tiene que llegarle a
Experiencia Solar **antes** de que el cliente pregunte.

### Cuándo se pregunta

Al **cerrar cada día de obra**. No al completar subetapas ni por calendario: al
final de la jornada, que es cuando el capataz ya sabe qué pasó y todavía se
acuerda.

### Qué gana cada uno

| | |
|---|---|
| **El capataz** | Tres segundos, un toque, desde el celular. No entra a ningún módulo nuevo. |
| **Experiencia Solar** | Una frase lista para mandar, sin preguntarle a nadie. |
| **La gerencia** | Deja de ser el intermediario de preguntas que no aportan. |

**Esto resuelve el desacuerdo del foco 12**: no se le pide a Operaciones que
reporte para otro. Se le pide que conteste una pregunta que igual le van a hacer.

---

## Foco 14 · Los momentos clave que hay que informarle al cliente

Las **notificaciones importantes** — las que no se pueden pasar por alto:

| | Momento | Criticidad |
|---|---|---|
| 1 | **La bienvenida inicial** | Alta |
| 2 | **Cuando se define la fecha de obra** | Alta |
| 3 | **La habilitación terminada** | Alta |
| 4 | La obra terminada | Menor — el cliente ya estuvo ahí y lo sabe |

**Coincide exactamente con los tres avisos clave que ya están en el sistema** y
que pintan la ficha del cliente de rojo cuando faltan: bienvenida, fecha de obra
y habilitación. La de obra terminada existe como paso pero no está marcada como
clave, que es coherente con que sea menos crítica.

### Que el disparo sea automático

> Estas informaciones **deberían dispararse solas desde el sistema**. Puede haber
> una confirmación de la gerencia de Operaciones avisándole a Alejandra, **pero no
> debería ser necesario**.

**Ya funciona así:**

- Cuando Operaciones **confirma la fecha en el calendario**, se abre solo el
  pendiente de avisarle al cliente, con 2 días hábiles de plazo. Nadie tiene que
  avisarle a Alejandra.
- Cuando **Tramitación cierra el trámite**, se abre el aviso de «ya podés
  encender» con 24-48 h, y a las 48 h escala a Administración.
- Los tres aparecen en el **correo diario** y pintan la fila de rojo.

### ⚠️ A confirmar en la reunión

«Que salga automáticamente del sistema» tiene dos lecturas, y **son muy
distintas**:

**(a) El aviso interno es automático** — el sistema le avisa sola a Alejandra que
tiene que comunicar, sin que nadie se lo diga. **Esto es lo que hay hoy.**

**(b) El mensaje al cliente sale solo** — el sistema le escribe al cliente sin
que intervenga una persona.

La opción (b) **contradice una decisión ya tomada**: *el sistema no le escribe al
cliente por su cuenta; toda comunicación saliente la hace una persona*. Viene de
los guardarraíles posteriores al incidente de correo de mayo de 2026. La única
excepción hoy es el reporte mensual de generación.

**Hay que decidirlo explícitamente**, no dejarlo ambiguo.

---
