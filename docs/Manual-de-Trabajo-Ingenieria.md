# Manual de trabajo de Ingeniería

**Voltia · Uruguay** · Versión 0.9 — 8 de octubre de 2026 · *en armado*

> Este manual es **el procedimiento, los lineamientos y las herramientas de
> Ingeniería, juntos**: qué se hace, quién lo hace, en qué plazo, con qué
> criterio y en qué pantalla de Voltia PM se hace. Sigue el mismo modelo que el
> Manual de trabajo de Experiencia Solar.
>
> Lo que conecta a Ingeniería con las demás áreas está en el **Procedimiento
> General de Trabajo (PGT) de Voltia**. Acá va el detalle del área.

---

## 1 · Qué hace y dónde termina su trabajo

**Qué hace.** Relevamiento, pre-ingeniería, unifilar, memorias, planos y la lista
de materiales. Después de la validación de Operaciones, cierra el paquete
definitivo.

**Dónde termina su trabajo.** Cuando la lista de materiales está cerrada y no se
toca más. A partir de ahí Logística compra sobre esa lista.

## 2 · Procedimiento

*Por escribir: relevamiento → pre-ingeniería → validación de Operaciones →
ingeniería final.*

## 3 · Lineamientos

### En obra, el criterio del instalador le gana al del proyectista

Si algo del proyecto no cierra en la casa del cliente, **el capataz lo resuelve
ahí**, con su criterio, y no deja la obra parada esperando una respuesta de
Ingeniería. Anota en el proyecto qué cambió y por qué, con una foto.

Para Ingeniería quiere decir dos cosas: **lo que cambió en obra se pasa a los
planos finales** (para que lo presentado a UTE coincida con lo instalado), y lo
que no se puede cambiar en obra —lo que exige UTE y la seguridad— **se marca
como tal** en los documentos, para que el capataz sepa qué consultar antes de
tocarlo.

### Cuando UTE recorta la potencia pedida

Antes de abrir el caso, UTE mira **el balance anual de la cuenta**: lo que la
planta va a generar en un año no puede ser más que lo que la cuenta consume en
un año. Si el consumo del último año no alcanza, contesta la consulta con una
potencia menor ("el balance del último año da para 4,7 kW, ¿abrimos el caso por
esa potencia?").

Cuando el cliente **va a consumir más de lo que consumió hasta ahora** —se muda,
suma un auto eléctrico, una piscina climatizada, cabañas, oficinas, o la obra
todavía está en construcción—, en lugar de aceptar la potencia menor Ingeniería
puede contestarle a UTE con un **informe de justificación de potencia** que
proyecta el consumo que viene. Si el consumo no va a cambiar, lo que corresponde
es aceptar la potencia que da el balance. Con ese informe UTE abrió casos por la potencia
pedida (por ejemplo, 25 kW donde el balance daba 17).

El informe se arma con **criterio conservador**: cargas que el cliente
efectivamente va a tener, con valores razonables, nunca inflados. Lo firma el
ingeniero responsable. Si aun proyectando el consumo la potencia pedida no da,
el informe lo dice y justifica la potencia que sí da.

La **potencia contratada** es otro límite, distinto: no entra en este informe y
se resuelve aparte, pidiendo el aumento de potencia del suministro.

### Proyectos con más de un suministro

Cuando la venta lleva más de un inversor, **cada inversor es un suministro**:
una cuenta UTE aparte, que puede ser de otro titular. Para Ingeniería eso
significa:

- **Un juego de papeles de UTE por suministro**, cada uno con su inversor, sus
  paneles, su cuenta y su titular.
- **Un unifilar por suministro**, cada uno con su inversor y sus paneles.
- **Un solo proyecto de ingeniería y una sola memoria**, que aclaran que son
  dos suministros y describen los dos.

**En Voltia PM:** los suministros se ven en los datos técnicos del proyecto (un
sistema por inversor). **Documentos UTE** tiene una pestaña por suministro: la
sección del cliente pasa a ser "Titular del suministro", y lo que se deja vacío
toma los datos del proyecto. **El unifilar** también tiene una pestaña por
suministro, cada una con sus versiones: el primero de cada suministro viene
precargado con su inversor y sus paneles, y el plano lleva "Suministro N" en el
rótulo. **El Proyecto Final** sigue siendo uno solo: al generarlo con IA, el
borrador ya describe cada suministro por separado.

## 4 · Las herramientas y cómo se usan

Ingeniería trabaja desde la oficina, sin ir a la propiedad del cliente: todo lo
que necesita lo trae la visita de venta (el resumen de la visita, las fotos y
los videos, que al ganar el lead pasan al proyecto).

- **El módulo de Ingeniería de Voltia PM**: el constructor del unifilar, el
  diseño de los gabinetes metálicos, el de los triángulos de aluminio para las
  estructuras y el informe de justificación de potencia ante UTE.
- **Una habilidad de Claude** (un asistente de inteligencia artificial) que ya
  tiene el paso a paso de cómo se hace la ingeniería y, sobre todo, los
  criterios definidos por Voltia. Al hacer el análisis entrega: las memorias
  descriptiva y de cálculo, el pedido para generar los planos en Claude Design,
  las planillas de verificación estructural y de vuelco, y la lista de
  materiales.
- **Claude Design**, donde se hacen los planos.
- **El mapeo de materiales** en Voltia PM: la lista de Ingeniería se cruza con
  los materiales que usa Voltia, y esa lista mapeada es la que reciben
  Validación de Operaciones y Compras.

- **Los documentos de la obra, leídos desde el chat de Claude.** El conector de
  Voltia PM le deja a Claude abrir los adjuntos del proyecto —la memoria, la
  lista de materiales, la propuesta, los reportes, las planillas— y leerlos para
  analizarlos de nuevo, sin descargar ni adjuntar nada. Los planos del unifilar
  y del gabinete se los muestra como dibujo, porque en PDF los rótulos no se
  pueden leer como texto. Un PDF escaneado no lo puede leer: ahí hay que abrirlo
  con el enlace. Se le pide por el nombre del cliente ("traeme los documentos de
  tal obra" y después "leé la memoria y el unifilar").

> Estas herramientas cambian seguido: por eso el detalle está acá y no en el PGT.


### La justificación de potencia ante UTE

**Para qué sirve.** Arma el informe que se le manda a UTE cuando contesta la
consulta con menos potencia que la pedida (ver el lineamiento *Cuando UTE
recorta la potencia pedida*). Sale un PDF con el logo de Voltia, listo para
firmar y adjuntar en la respuesta al mail de UTE.

**Dónde está.** En Voltia PM, en **Ingeniería** → el proyecto → la tarjeta
**Justificación de potencia ante UTE**, al lado de Pre-ingeniería. No es un paso
de la etapa: en los proyectos donde UTE aprueba la potencia pedida no se usa ni
hay que marcar nada.

**Cómo se usa.** Se toca **Armar informe** (o **Nueva versión** si ya hay uno) y
se completa, de arriba hacia abajo:

1. **La consulta a UTE.** Si es una microgeneración nueva o una ampliación, la
   potencia pedida (viene cargada de los documentos de UTE o de los inversores
   del proyecto), la que UTE dijo que da (opcional) y el **consumo del último
   año** de la cuenta, en kWh, si se conoce. La factura no lo trae, y en una
   **cuenta nueva** (cliente que recién contrata, obra en construcción) no
   existe: en ese caso se deja vacío y el consumo del informe sale solo de las
   cargas proyectadas.
2. **Por qué el consumo actual no sirve para dimensionar.** Se elige una de
   cuatro situaciones: se suman cargas nuevas, obra en construcción, instalación
   recién habilitada, o mudanza / unificación de cuentas.
3. **Cargas proyectadas.** Hay una lista de sugerencias (climatización, auto
   eléctrico, bomba de calor de piscina, bomba de la piscina, agua caliente,
   cocina eléctrica, calefacción, unidades nuevas como cabañas, ampliación de
   oficinas, taller, riego, iluminación exterior, lavandería, seguridad,
   electrodomésticos). Al tocar una se suma con valores típicos, que se ajustan
   al caso. Cada carga se estima **desglosada** —potencia en kW × horas por día ×
   días por mes × cantidad— o con un **total mensual** cuando no se puede
   desglosar (por ejemplo, "más oficinas y más personal: 500 kWh por mes").
   **Otra carga** suma una fila libre, y **Cuenta UTE que se unifica** suma una
   cuenta que se da de baja y cuyo consumo pasa a esta (se carga el número de
   cuenta, su potencia contratada y su consumo mensual). No se puede generar el
   informe con una carga en cero.
4. **Balance anual de energía.** Se calcula solo, mientras se completa: el
   consumo del último año más el de las cargas nuevas (por doce meses), contra lo
   que genera la planta en un año. La generación se estima en **1.450 kWh por
   cada kW instalado**, valor que se puede cambiar en cada informe. Un recuadro
   verde dice que da el balance; uno amarillo dice que no da y **hasta cuántos kW
   justifica** el consumo proyectado.
5. **Datos del encabezado.** Cliente, cédula o RUT, cuenta UTE, ubicación e
   ingeniero responsable, precargados del proyecto y editables.
6. **Textos del informe.** Objeto, Antecedentes, Justificación y Conclusión.
   **Completar con texto automático** los arma con las frases de los informes
   que Voltia ya mandó y los números del balance. **Redactar con IA** los
   reescribe adaptados al caso, con los mismos números. Los dos se pueden
   corregir a mano. Lo que quede vacío se completa solo con el texto automático.

Al tocar **Generar informe PDF** queda la versión guardada y el PDF en los
**Documentos del proyecto**. Con **Ver** se abre el PDF de cualquier versión y se
descarga.

**El informe trae**, en este orden: los datos del cliente y la cuenta, el objeto,
los antecedentes, la lista de lo que va a aumentar el consumo, una tabla con
cada carga y su consumo mensual, el balance anual, la justificación, la
conclusión y la **línea de firma** del ingeniero.

**Después.** El PDF se **firma digitalmente** fuera de Voltia PM y se adjunta en
la respuesta al mail de UTE, en el mismo hilo de la consulta.

**A tener en cuenta.**

- Cada vez que se genera, se crea una **versión nueva** (v1, v2…) que arranca
  con los datos de la anterior, **textos incluidos**. Esos textos traen los
  números de la versión anterior: si se cambiaron cargas, consumos o la
  potencia, hay que volver a completarlos o corregirlos (Voltia PM lo avisa con
  un recuadro amarillo). En los Documentos del proyecto queda solo **la
  última**. Las anteriores se siguen pudiendo ver desde la tarjeta.
- Si se borra la última versión, el informe sale de los Documentos del proyecto
  aunque queden versiones anteriores: para que vuelva a estar, se genera una
  versión nueva.
- La herramienta trabaja con la **cuenta principal** del proyecto. En una obra
  con más de un suministro, para el segundo se corrigen a mano la cuenta y los
  datos del encabezado.

### El catálogo de materiales, por rubro y subgrupo

Los materiales que Voltia usa están en un catálogo único, en **Administración →
Materiales**, ordenado en dos niveles: los **rubros** (Paneles solares,
Inversor y monitoreo, Estructuras, Eléctrica, Consumibles) y, adentro de cada
uno, **subgrupos**.

Inversor y monitoreo tiene dos subgrupos: **Inversores**, con los monofásicos y
los trifásicos de todas las marcas juntos, y **Monitoreo y medición**, con los
medidores inteligentes, los dongles y los módulos de comunicación del
inversor.

Eléctrica es el rubro grande —más de la mitad del catálogo— y está abierta en:
Cables, Canalización (caños, codos, cuplas, bandejas, cámaras), Protecciones
(térmicas, diferenciales, descargadores, fusibles), Terminales y conexionado,
Tableros y gabinetes, Puesta a tierra, y Fijación y varios.

Esto importa al armar la lista de materiales de una obra: al agregar un ítem,
los grupos se abren por subgrupo, así que para elegir el cable se entra a
**Eléctrica › Cables** y se ven solo los cables, no las 175 cosas del rubro.

**Un ítem nuevo se carga siempre en el subgrupo**, nunca en el rubro: los rubros
que tienen subgrupos aparecen deshabilitados en el selector. Si un ítem queda en
el rubro, no aparece en ningún subgrupo y hay que ir a buscarlo con el buscador.

Crear o renombrar subgrupos lo hace el administrador. Dar de alta **ítems** del
catálogo lo hace Ingeniería.

### La plantilla de lista de materiales y cómo se arma la lista

La **lista de materiales** de una obra es todo lo que hay que comprar y llevar
para instalarla, con su cantidad. Vive en el proyecto, en la pestaña
**Compras**, y la comparten Ingeniería y Operaciones.

La **plantilla** es el punto de partida de esa lista. Hay **una sola**, la
plantilla **Base**, con todo lo que va en casi todas las obras: paneles, el
inversor Growatt de 6 kW, el medidor, cable solar, conectores, tierra, canalización, protecciones, tableros, terminales,
fijación y sujetadores. **Viene con todas las cantidades en cero**: armar la
lista es completar números, no sacar y agregar renglones.

**No hay una plantilla por tipo de conexión** (monofásica o trifásica). Lo que
cambia entre una y otra es casi siempre la misma pieza en otra medida: el
diferencial de 2 o de 4 polos, el descargador, el medidor, el caño de 1" o de
1¼", el inversor. Eso se cambia en el mismo renglón.

Cómo se arma la lista de una obra:

1. En la pestaña **Compras** del proyecto, **Usar plantilla → Base**. Si la
   lista ya tenía materiales, se agregan solo los que faltan; lo que estaba no
   se toca.
2. La lista se ve **por secciones**, iguales a los subgrupos del catálogo
   (Eléctrica › Cables, Eléctrica › Protecciones…). Se recorre sección por
   sección completando cantidades: **Enter** guarda la cantidad y pasa a la
   siguiente (**Shift + Enter** vuelve a la anterior), así se completa de
   corrido sin el mouse. Los renglones en cero tienen la casilla resaltada y
   cada sección dice cuántos le faltan.
3. Cuando un renglón no es la variante que lleva esta obra, se toca **⇄** al
   lado del nombre y se elige la que va. Solo ofrece materiales del **mismo
   subgrupo**. Se puede cambiar mientras el material está **Pendiente**: si ya se
   pidió, no.
4. Lo que no está en la plantilla se agrega con **+ Agregar** de su sección, que
   abre el catálogo directo ahí. Queda afuera de la plantilla, a propósito,
   **la estructura que depende del techo** (perfiles, tornillos, anclajes,
   losas), porque cambia según el tipo de techo.
5. Al terminar, arriba de la lista aparece cuántos materiales quedaron en cero.
   Si no van en esta obra, **Quitar los que están en cero** los saca todos juntos.

**Un material en cero no existe para compras**: no sale en el PDF de la lista
ni en el consolidado con el que se compra. Por eso la lista no se da por
cerrada con renglones en cero; al exportar el PDF, Voltia PM avisa cuántos
quedan afuera.

**La plantilla la configura Ingeniería**, que es quien la usa: crearla,
editarla y borrarla se hace desde **Administración → Plantillas de
materiales**, y se entra a esa sección aunque no se tenga el resto del panel de
administración. Si un material empieza a ir en casi todas las obras, se suma a
la Base en cero.

*Por escribir: el unifilar, la pre-ingeniería, los triángulos, la visita
técnica y el Proyecto Final de Ingeniería.*

---

## Material que vino del manual de trabajo (v2.2)

### Con qué trabaja

Con lo que el vendedor dejó cargado en el proyecto: el resumen de la visita, la
minuta, las fotos y los videos. **Si falta algo, se lo pide al asesor comercial
de ese proyecto** — está indicado en el proyecto.

### Cuándo entra Operaciones

**Todavía no.** Cuando arranca la pre-ingeniería, Operaciones no sabe nada de
esta obra. Entra recién en la validación, cuando Ingeniería termina.

### La visita de relevamiento

Hay que ir a la propiedad. **Se agenda y se avisa antes** (regla 5 del PGT).
Ingeniería coordina con Experiencia Solar quién le avisa al cliente.

### A quién le pregunta qué

| Necesita saber… | Le pregunta a… |
|---|---|
| Cuándo pueden ir a relevar | Gerente de Operaciones |
| Si lo relevado no coincide con lo vendido | Asesor comercial del proyecto |
| Qué hay que ajustar del paquete | Gerente de Operaciones (después de la validación) |
| Que se corrija algo de la instalación | **Gerente de Operaciones — nunca al capataz** |

### El gabinete metálico que se manda a fabricar

Cuando la obra necesita un gabinete a medida, **no se dibuja a mano ni se reenvía
el plano del pedido anterior**: se arma en el proyecto y Voltia PM da la lámina
para mandarle al fabricante.

Se entra al proyecto en Ingeniería, se abre **Gabinete metálico** y se le da
**Nuevo gabinete**. Viene precargado el que más pedimos —50 × 85 × 26 cm, chapa
galvanizada de 1,5 mm, fondo abierto y pestaña de 3 cm para amurar—, así que
muchas veces solo se cambia lo que difiere.

Mientras se cargan las medidas, **el plano de la derecha se va dibujando solo**.
Con **Ampliar** se ve a pantalla completa. Cuando está, **Emitir lámina**: sale
un PDF que queda guardado en los documentos del proyecto y es el que se le manda
al fabricante.

**Es el gabinete de siempre: todo chapa plegada, sin herrajes y sin perforar.**
La tapa se pide suelta —sin bisagras y sin cierre— y los agujeros para amurar
se hacen en obra. La lámina se lo dice al fabricante con todas las letras, así
no cotiza ni hace cosas que no se le pidieron.

**Ninguna medida queda sin definir.** Todas vienen con un valor cargado —el
espesor de la chapa, el ancho de la pestaña, cuánto solapan las dos piezas en L,
cada cuánto van los tornillos, el reborde del frente del cuerpo, el de la tapa,
cuánto montan entre sí y qué holgura queda—. El proyectista las repasa y corrige
las que no correspondan: lo que no se cambia **sale impreso igual**.

Es **una sola hoja**: el gabinete de frente, de costado, de atrás y en
perspectiva, **el plano de la tapa** aparte, con **cada medida acotada sobre el
dibujo**, más las especificaciones y las notas. Si el fabricante pide un dato que
no tiene casillero, se agrega en **Especificaciones adicionales** y sale impreso
igual.

Si la obra lleva **más de un gabinete** (el del medidor y el de protecciones,
por ejemplo), se hace uno por cada uno. Si hay que corregir algo después de
haber mandado el pedido, se corrige y se vuelve a emitir: la lámina nueva sale
como v2 y **la anterior no se borra**, porque puede ser la que el fabricante
tiene sobre la mesa.

### Qué registra

Cualquier **cambio de alcance o de diseño** que el cliente tenga que saber. Lo
deja como comentario en su etapa y le llega solo a Experiencia Solar.

---

## Anexo · Registro de cambios

| Versión | Fecha | Qué se agregó o modificó |
|---|---|---|
| 0.9 | 8 de octubre de 2026 | En el informe de justificación de potencia, el consumo del último año pasa a ser un dato que se carga solo si se conoce: la factura no lo trae y en una cuenta nueva no existe. La plantilla Base de materiales trae el inversor Growatt de 6 kW, que se cambia en el renglón si la obra lleva otro; en el catálogo, el rubro Inversor y monitoreo reemplaza a los de inversores monofásicos y trifásicos, con dos subgrupos: Inversores y Monitoreo y medición. Al cargar cantidades, Enter pasa a la siguiente. |
| 0.8 | 7 de octubre de 2026 | La lista de materiales se arma desde una sola plantilla, Base, con las cantidades en cero: se agrega cómo se arma la lista paso a paso, el cambio de variante en el mismo renglón, por qué no hay una plantilla por tipo de conexión y que un material en cero no sale para compras. En el catálogo se suma el rubro Monitoreo y medición. |
| 0.7 | 7 de octubre de 2026 | Nuevo lineamiento: cuando UTE recorta la potencia pedida por el balance anual, Ingeniería contesta con un informe de justificación de potencia. Se agrega la herramienta que arma ese informe en Voltia PM, paso por paso. |
| 0.6 | 7 de octubre de 2026 | Se agrega el catálogo de materiales por rubro y subgrupo (Eléctrica abierta en Cables, Canalización, Protecciones, Terminales, Tableros, Puesta a tierra y Fijación), con la regla de cargar el ítem en el subgrupo y no en el rubro; y que las plantillas de lista de materiales las configura Ingeniería. |
| 0.5 | 5 de octubre de 2026 | Nuevo lineamiento: en obra, el criterio del instalador le gana al del proyectista; lo que cambió en obra se pasa a los planos finales. |
| 0.4 | 5 de octubre de 2026 | Se agrega, entre las herramientas, la lectura de los documentos de la obra desde el chat de Claude: qué puede leer, qué no, y cómo se le pide. |
| 0.3 | 1 de octubre de 2026 | Se agregan las herramientas con que se trabaja: el módulo de Ingeniería de Voltia PM, la habilidad de Claude con los criterios de Voltia, Claude Design para los planos y el mapeo de materiales. Ingeniería no hace visita de relevamiento: trabaja con lo que trae la visita de venta. |
| 0.2 | 30 de septiembre de 2026 | Primer lineamiento: los proyectos con más de un suministro llevan un juego de papeles de UTE y un unifilar por suministro, y un solo proyecto y memoria. |
| 0.1 | 29 de septiembre de 2026 | Se crea el manual con el detalle de Ingeniería que estaba en el manual de trabajo general (v2.2). |
