# Manual de trabajo de Ingeniería

**Voltia · Uruguay** · Versión 0.3 — 1 de octubre de 2026 · *en armado*

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
  diseño de los gabinetes metálicos y el de los triángulos de aluminio para las
  estructuras.
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

> Estas herramientas cambian seguido: por eso el detalle está acá y no en el PGT.


*Por escribir: el gabinete metálico está abajo; faltan el unifilar, la
pre-ingeniería, la lista de materiales, los triángulos, la visita técnica y el
Proyecto Final de Ingeniería.*

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
| 0.3 | 1 de octubre de 2026 | Se agregan las herramientas con que se trabaja: el módulo de Ingeniería de Voltia PM, la habilidad de Claude con los criterios de Voltia, Claude Design para los planos y el mapeo de materiales. Ingeniería no hace visita de relevamiento: trabaja con lo que trae la visita de venta. |
| 0.2 | 30 de septiembre de 2026 | Primer lineamiento: los proyectos con más de un suministro llevan un juego de papeles de UTE y un unifilar por suministro, y un solo proyecto y memoria. |
| 0.1 | 29 de septiembre de 2026 | Se crea el manual con el detalle de Ingeniería que estaba en el manual de trabajo general (v2.2). |
