# Novedades

## v8.3

### 1 de agosto de 2026

#### Trámites UTE — la fecha de consulta se completa sola

- Cuando se **envía la consulta a UTE** desde el Onboarding (botón "Enviar consulta a UTE"), la **fecha de consulta** del módulo de Trámites UTE ahora se **completa automáticamente** con el día del envío. Es solo una ayuda: **no reemplaza la carga manual** y podés **modificarla después** cuando quieras.
- Solo se autocompleta si estaba **vacía** (nunca pisa una fecha ya cargada). Para los clientes que ya tenían la consulta hecha pero sin la fecha cargada, se completó hacia atrás con la fecha real del envío (o, si no la había, con la fecha en que se marcó la subetapa de consulta como completada).

### 31 de julio de 2026

#### Asistente Voltia con IA — quitado

- Se **removió el botón del Asistente Voltia con IA** (el que consultaba la base de datos) de todas las pantallas.

#### Traspasos — avisos unificados por rol

- Los avisos de traspaso ahora se dirigen **según el rol real** de cada persona (Gerente de Operaciones, Logística, etc.), no por marcas internas que había que configurar aparte. Cambios concretos:
  - **Materiales recibidos en depósito** → avisa al **Gerente de Operaciones** (antes iba a todo Operaciones).
  - **Ingeniería final completada** → avisa a **Logística** (para la compra/pedido de materiales).
- Cuando un aviso va a un **área** (ej. Ingeniería), ahora **incluye también a su Gerente**, para que la gerencia tenga visibilidad de lo que pasa en su área.

#### Permisos — pantalla rediseñada, más cómoda

- La pantalla de **Administración → Permisos** dejó de ser una tabla gigante con todos los roles y módulos a la vez. Ahora **elegís un rol de una lista** (a la izquierda, agrupada por área con sus sub-roles) y **ajustás solo sus permisos**, en **tarjetas por módulo** con botones claros de cada acción.
- Cada módulo muestra cuántas acciones tenés activas (ej. "3/5") y un botón para **marcar/desmarcar todo el módulo**. Hay un **buscador de módulos** y un botón **"Copiar permisos de…"** otro rol (ideal para armar un rol nuevo partiendo de otro).
- Se agregaron a la pantalla **módulos que antes no se podían configurar** (Tickets, Encuestas, Experiencia Solar, Traspasos, Comisiones, Portal del cliente): ahora todos sus permisos son visibles y editables.

#### Roles — Capataz dentro de Operaciones

- Se agregó un **rol nuevo del área de Operaciones**: **Capataz**. **Arranca con los mismos permisos que Operaciones** y se puede **ajustar por separado** desde **Administración → Permisos** (por ejemplo, dejarle solo lo que necesita en obra).
- Ya aparece al **crear o editar un usuario** y en la pantalla de permisos, como cualquier otro rol.

#### Experiencia Solar — Crear el acceso del cliente al portal desde el listado

- En el listado de **Experiencia Solar** ahora hay una columna **Usuario** que muestra de un vistazo qué clientes **ya tienen acceso al portal** (etiqueta verde "Con acceso") y cuáles **todavía no**. Así detectás al toque a quién le falta el usuario.
- En los que no tienen, aparece el botón **"Crear usuario"**: con un clic se abre una ventana ya **pre-cargada con el nombre, el mail y el teléfono** que tenga ese cliente, genera una contraseña temporal y crea el acceso. Al terminar te muestra las credenciales listas para **copiar** y compartir; el cliente deberá cambiar la contraseña en el primer ingreso.
- Funciona también para los clientes cargados de forma rápida por planilla, así pueden **abrir tickets y responder encuestas** como cualquier otro.
- Si el mail ya pertenece a un cliente existente, en vez de duplicar, **se lo vincula** a este proyecto (útil para un mismo titular con varios generadores).
- Pueden crear estos accesos los roles de **Experiencia Solar** y **Postventa** (además del administrador), directo desde su módulo, sin entrar a la administración de usuarios.

#### Tickets — abrir tickets a clientes de Experiencia Solar

- Al abrir un ticket, el selector de proyecto ahora **también incluye a los generadores de Experiencia Solar** (los cargados por planilla), no solo los proyectos con obra. Así podés abrirles y seguirles reclamos a esos clientes (por ejemplo, los que todavía no tenían un proyecto formal en el sistema).

#### Tickets — editar y eliminar

- Desde el detalle de un ticket ahora se puede **editar** el título, la descripción y la prioridad.
- Un **administrador** puede **eliminar** un ticket (por ejemplo, los que se cargaron de prueba). El resto de los roles puede editar pero no eliminar.

#### Ventas — al pasar un lead a proyecto se hereda más información

- Cuando convertís un lead ganado en proyecto, ahora la **propuesta comercial** del lead pasa **como adjunto** al proyecto (los dos PDF: la propuesta completa y el resumen). Antes quedaba solo en el lead.
- Los **comentarios** que se cargaron en el lead ahora **también aparecen en el proyecto**, con su autor y fecha originales. Se siguen viendo en el lead.
- La **potencia (kWp)** y la **cotización (USD)** se **pre-cargan desde la propuesta comercial** (los mismos números de los que sale la comisión del vendedor), en vez del estimado grueso del lead. Siguen siendo **editables** antes de crear el proyecto.

#### Arreglos

- **Tickets — el administrador no podía eliminarlos**: al intentar borrar un ticket aparecía "no tenés permiso" aun siendo administrador. Corregido: el rol administrador vuelve a poder eliminar tickets.

### 28 de julio de 2026

#### Tarifas de UTE

- Nueva pantalla en **Administración → Configuración del negocio → Tarifas UTE** para cargar los cuadros tarifarios: cargo fijo y cargo por potencia contratada de cada tarifa, los tramos de consumo de la tarifa simple y los precios por franja horaria (punta, llano, valle).
- Los cuadros se guardan **con fecha de vigencia**. Cuando UTE ajusta las tarifas no se pisan las anteriores: se duplica el cuadro vigente, se cargan los precios nuevos y se publica con la fecha en que empezaron a regir. Así los reportes viejos se siguen viendo con los precios que tenían.
- Un cuadro arranca como **borrador**, que se puede editar libremente, y al **publicarlo** queda fijo. Antes de publicar se avisa cuántos reportes ya calculados dependen del cuadro anterior.

### 27 de julio de 2026

#### Proyectos — columna "Asesor" en la vista general

- En la vista general de **Proyectos**, la columna **"Instalación"** se reemplazó por **"Asesor"**: ahora se ve de un vistazo **qué asesor comercial vendió** cada proyecto. La columna es **ordenable** (los proyectos sin asesor quedan al final).

### 26 de julio de 2026

#### Finanzas — Facturación al cliente (facturas pendientes de emitir)

- Nueva pestaña **Facturación** en Finanzas para llevar el control de qué facturas **tenés pendientes de emitir**. No todos los clientes llevan factura, así que ahora cada proyecto tiene un check **"Lleva factura"** y una **nota** libre (para anotar RUT, razón social, a nombre de quién facturar, etc.).
- El check y la nota se cargan al **crear un proyecto** y también se pueden editar después desde la ficha del proyecto (botón **Editar**).
- En la pestaña Facturación ves la lista de proyectos que llevan factura, filtrable entre **Pendientes**, **Emitidas** y **Todas**. Cuando emitís una factura, la marcás con **"Marcar emitida"** (queda registrada con la fecha) y sale de las pendientes; si te equivocaste, podés **Revertir**. La nota se puede editar directo desde el listado.

#### Experiencia Solar — Cobros a clientes

- **Experiencia Solar** ahora tiene su propia pestaña **Cobros**, para revisar y gestionar los pagos de los clientes **sin entrar a Finanzas** (no ve gastos ni el resto de la parte financiera).
- Muestra el listado de clientes con lo **cobrado**, lo **pendiente** y el estado de cobranza, con **buscador** y **filtros** (por estado de cobranza y por activos/todos). Tocando un cliente se abren sus cobros, donde podés: **registrar un cobro nuevo** (pagado o pendiente), **marcarlo como pagado**, y **editar el monto** si el cliente pagó de más o de menos.
- Botón **"Copiar resumen (WhatsApp)"**: copia un resumen prolijo de pagos (presupuesto, cobrado, pendiente y el detalle) listo para pegarle al cliente por WhatsApp.
- Es la **misma información que Finanzas**: cualquier cambio hecho desde Experiencia Solar se ve al instante en Finanzas (Cobros y Movimientos), y al revés.

#### Experiencia Solar — Ver la respuesta de una encuesta

- En **Experiencia Solar → Encuestas**, al tocar una encuesta ahora se abre una **ficha con la respuesta completa** del Generador: la calificación en estrellas, el comentario entero, y quién respondió y cuándo. Antes el clic te sacaba directo a la ficha del cliente y no podías ver lo que había contestado.
- Si la nota fue baja, la ficha lo avisa (recordá que eso genera un seguimiento). Desde la misma ficha tenés un botón **"Ver ficha del cliente"** por si querés ir al proyecto.

#### Arreglos

- **Cobros — planes de pago que no se podían editar**: en muchos proyectos el asistente de plan de pagos te obligaba a "crear el plan desde cero" en vez de dejarte **editar** los cobros que ya tenías, y al recrearlo quedaban cuotas duplicadas. Ahora el plan de pagos es, simplemente, **todos los cobros pendientes (previstos) del proyecto**, sin importar si los cargaste con el asistente o a mano desde "Registrar cobro". Así siempre podés **editarlos** desde el asistente y, al guardar, reemplaza los pendientes sin duplicar.
- **Cobros — al editar un movimiento el cambio ahora se refleja al instante**: si corregías el monto (o el estado) de un cobro desde la pantalla de Movimientos, la vista de **Cobros por proyecto** seguía mostrando el valor viejo hasta recargar la página. Ahora se actualiza sola.

### 25 de julio de 2026

#### Arreglos

- **Documentos con tildes o caracteres especiales en el nombre**: los archivos cuyo nombre tenía tildes, emojis, guiones largos o comillas curvas (típico de nombres armados en Mac) daban error al abrir la vista previa o descargarlos. Ahora **abren y se descargan bien**, conservando el nombre original con sus acentos. Aplica a documentos de proyecto, adjuntos de informes y de leads, y a los PDF y ZIP que genera el sistema.

### 23 de julio de 2026

#### Roles nuevos — Gerencias y Logística

- Se agregaron **roles de gerencia**: **Gerente de Operaciones, Gerente Comercial, Gerente de Ingeniería** y **Gerente de Finanzas**. Cada uno arranca con **los mismos permisos que su equipo** y se puede ajustar aparte desde **Admin → Permisos** (por ejemplo, darle acceso a Métricas o a Finanzas) sin tocar el rol base.
- Nuevo rol **Logística**, con acceso a **Stock** (gestión completa) y lectura de **Operaciones** e **Ingeniería** (para ver materiales y compras).
- Los roles nuevos ya aparecen al **crear o editar un usuario** y en la matriz de permisos. Cada rol se muestra con su propia **etiqueta y color** en el listado de usuarios.

## v8.2

### 22 de julio de 2026

#### Ventas — pipeline más simple, vista priorizada y reclamos

- Se **redujeron las etapas** del pipeline comercial a las que se usan de verdad: **Nuevo lead → Cotizado → Reclamado → Agendar visita → Visitado**, más **Cerrados**. Los leads que estaban en etapas viejas se **reubicaron solos** según su avance real (si tenían visita, cotización, etc.).
- Nueva vista **"Priorizada"** (botón al lado de Kanban y Lista): lista los leads activos **de más avanzado a menos** — Visitados, Agendar visita, Cotizados, Reclamados y Nuevos — para atacarlos por prioridad. Dentro de cada grupo, primero los que esperan hace más tiempo. Usa **las mismas tarjetas que el Kanban** (con nombre, monto, responsable, días y reclamos) acomodadas varias por fila.
- La **búsqueda** y el filtro **"Solo míos"** ahora también funcionan en la vista Priorizada (antes solo estaban en el Kanban).
- Nuevo filtro **por vendedor asignado** en el Kanban y la Priorizada: un desplegable para ver los leads de un vendedor puntual, de todos, o los **"Sin asignar"** (muestra solo usuarios internos del equipo, no clientes del portal). Y podés **colapsar cada etapa** en la vista Priorizada tocando su título.

#### Arreglos

- **Métricas — Ventas**: se quitó la tarjeta **"Tasa de conversión lead → cierre"** del panel de ventas.
- **Proyectos — filtro por "Etapa actual"**: al filtrar por una etapa (p. ej. "Onboarding") ya **no aparecen mezclados** proyectos que muestran otra etapa. Ahora el filtro respeta exactamente la etapa que se ve en la columna "Etapa actual" (antes también traía proyectos que tenían esa etapa u otra corriendo en paralelo, como Tramitación UTE, aunque su etapa mostrada fuera otra).
- **Ventas — filtro por propietario (vista Lista)**: se ensanchó el desplegable para que se lea el nombre completo del vendedor (antes quedaba cortado).
- El kanban suma una **columna "Cerrado"** al final (junta ganados y perdidos, cada uno con su etiqueta). Para cerrar un lead **arrastralo a esa columna** —o usá **"Cerrar lead…"** en el menú de la tarjeta— y elegí **Ganado** o **Perdido**: se abre el lead con el cierre listo (Perdido pide el motivo; Ganado abre la comisión y el pase a proyecto).
- **Contador de reclamos**: cada tarjeta muestra **"xR"** con la cantidad de reclamos hechos al lead, y un botón **"+"** para **sumar un reclamo al instante** desde la propia tarjeta (o desde la vista priorizada), sin abrir el lead.

#### Arreglos

- **Consulta a UTE**: el correo de consulta a UTE volvió a salir **sin el formato de marca** de las notificaciones automáticas. Ese mail es una carta que enviás a UTE desde tu propia casilla, así que va con el texto simple como antes (el diseño nuevo queda solo para las notificaciones internas automáticas del sistema).

### 20 de julio de 2026

#### Métricas de Operaciones — obras realizadas bien contadas

- Se corrigió el conteo de **"Instalaciones realizadas"** (y con él **kWp instalados** y **obras ponderadas**). Ahora una obra cuenta como realizada cuando su etapa **"Ejecución de obra" está finalizada**; en su defecto, cuando el **proyecto está marcado como finalizado**. La fecha usada es la de finalización de la obra (o, si no la tiene, la de finalización del proyecto).
- Antes se miraba una etapa vieja del pipeline que casi ningún proyecto usa ya, por lo que **subcontaba muchísimo** (mostraba apenas unas pocas obras en todo el año). Como todo daba valores mínimos, además **parecía que el filtro por trimestre no cambiaba**; ahora los números reflejan la realidad y cambian bien al elegir otro trimestre.
- Efecto secundario: los **objetivos de kWp instalados** vuelven a mostrar su avance real (antes se veían casi en cero por el subconteo).

#### Consulta a UTE (Onboarding) — potencia del generador obligatoria

- En el generador de **consulta a UTE**, el campo **"Pot. comprometida generador"** ahora es **obligatorio**: aparece marcado con un asterisco y no deja **enviar la consulta** hasta completarlo (el botón queda deshabilitado y avisa si falta).

#### Correos — formato nuevo y más claro

- Todos los correos automáticos (traspasos de etapa, recordatorios de deadline, escalaciones, reportes, avisos de habilitación, "listo para Operaciones", etc.) ahora salen con un **diseño de marca Voltia**: encabezado, título grande con la **referencia clara de lo que se está informando** y el contenido bien legible, para que no se pierda entre el texto.
- Antes solo un tipo de correo tenía formato lindo y el resto llegaban como texto plano; ahora **todos** comparten el mismo estilo.

### 19 de julio de 2026

#### Proyecto — subir adjuntos desde la vista general

- Ahora podés **subir archivos al proyecto directamente desde su vista general**, en la sección **"Documentos"**: hay un botón **"Subir archivo"** y también podés **arrastrar y soltar** el archivo sobre la sección. Antes solo se podía adjuntar entrando a una etapa puntual.
- El archivo subido así queda asociado al proyecto (etiqueta **"Proyecto"**) y aparece en el mismo listado de documentos, junto con los de cada etapa y los generados por las herramientas.

#### Documentos UTE — autoguardado

- El generador de **Documentos UTE** ahora **autoguarda** los cambios mientras completás el formulario (cliente, sistema fotovoltaico, trámite, potencias, fechas). Si se te cierra o recargás la página, al volver a entrar **reabre con lo último cargado** para ese proyecto, sin depender de que hayas apretado "Guardar".
- Junto a los botones aparece un indicador de estado (**"Guardando…"** / **"Autoguardado hace un rato"**) para que sepas que quedó guardado. El botón "Guardar configuración" sigue estando para forzar el guardado cuando quieras.

## v8.1

### 17 de julio de 2026

#### Pipeline — cambiar la etapa del proyecto a mano

- Ahora podés **fijar la etapa mostrada del proyecto a mano**, para avanzarlo aunque quede alguna sub-tarea pendiente (antes la etapa quedaba "clavada" hasta completar todo). En el detalle del proyecto, debajo del pipeline, hay un control **"Etapa mostrada"** con la opción **"Cambiar etapa…"** (solo hacia adelante) y **"Volver a automático"**.
- Es un **empujón hacia adelante**: si después el trabajo real avanza más que lo que fijaste, se muestra la etapa más adelantada; nunca se muestra una etapa anterior a la real. Los proyectos con etapa fijada a mano se marcan con una etiqueta **"manual"** en la lista.
- Al **confirmar un traspaso de etapa**, el popup ahora pregunta si querés **avanzar la etapa mostrada** a la que sigue (viene **tildado por defecto**); podés destildarlo para cambiarla después a mano.

#### Arreglos

- **Etapa "Tramitación UTE" adelantada**: como el trámite de UTE arranca desde el principio, algunos proyectos figuraban en **"Tramitación UTE"** cuando en realidad todavía estaban en una etapa anterior (Validación de Operaciones, Ingeniería, Compras u Obra). Ahora la etapa mostrada refleja el **avance real** del proyecto: UTE recién aparece como etapa actual cuando la **Obra está terminada**.
- **Dashboard "Mis proyectos por etapa"**: ahora agrupa los proyectos por **área** (Ventas, Ingeniería, Operaciones, Trámite UTE, Experiencia Solar). Antes usaba las etapas viejas, así que los proyectos en las etapas nuevas no se contaban y varios tiles quedaban en "0".
- **Filtro de proyectos por etapa**: el desplegable ahora lista las **8 etapas nuevas** (Onboarding, Pre-Ingeniería, Validación de Operaciones, Ingeniería Final, Compras, Ejecución de Obra, Tramitación UTE, Post-Habilitación). Antes tenía las 5 viejas, así que los proyectos en las etapas nuevas no se podían filtrar.
- **Datos técnicos**: ahora se pueden **eliminar los sistemas adicionales** cargados por error. Cada sistema extra tiene un botón "Eliminar" (el sistema principal no se borra desde ahí).

### 16 de julio de 2026

#### Ingeniería — plantillas de lista de materiales

- En la herramienta **Lista de materiales** de cada proyecto se sumó el botón **"Usar plantilla"**: precarga de una sola vez la base de materiales que se repite en casi todas las obras, en lugar de agregar los ítems uno por uno.
- Vienen **tres plantillas** listas según el tipo de instalación — **Monofásico**, **Trifásico 230** y **Trifásico 400** — armadas a partir de los materiales realmente usados en los proyectos anteriores.
- Al aplicar una plantilla se **agregan solo los ítems que faltan**: si ya tenías algunos cargados, respeta sus cantidades y no duplica nada. Las cantidades las ajustás después como siempre.
- Nueva sección **Admin → Plantillas de materiales** para crear y editar plantillas: elegís los ítems del catálogo, fijás cantidades y activás o desactivás cada plantilla.

#### Ingeniería — control de costos en la lista de materiales

- En la herramienta **Lista de materiales** se sumó un panel **"Control de costos"** que muestra el **subtotal sin IVA de cada categoría** y el total general, actualizándose en vivo a medida que ajustás cantidades.
- Si hay precios en distintas monedas, los muestra separados (USD y UYU). El panel es colapsable y respeta los filtros activos (si filtrás por categoría o estado, el total refleja lo mostrado).

#### Traspasos — ver a quiénes se notifica

- En el **popup de confirmación de traspaso** (y en la bandeja de **Pendientes**), además del resumen por área ("Se notifica a: ADMIN (copia) 4…") ahora hay un desplegable **"ver N"** que lista **las personas concretas** que van a recibir la notificación: nombre, área y una etiqueta **"copia"** para quienes van en copia.

#### Experiencia Solar — próximos mantenimientos

- En el listado de **Generadores** se agregó la columna **"Próx. mantenimiento"**: muestra qué **aniversario** de la puesta en marcha cumple cada cliente y **cuánto falta** (ej. "cumple 2 años · en 4 d"). Los que aún no están habilitados muestran "—".
- La columna es **ordenable**: podés listar los clientes por proximidad al próximo aniversario para ver a quién le toca mantenimiento primero.

#### Ventas — pase automático a "Cotizado"

- Cuando un lead tiene una **propuesta comercial generada**, ahora pasa **automáticamente a la etapa "Cotizado"** (antes solo ocurría con el generador viejo; el nuevo no lo hacía). Solo avanza: no mueve leads que ya estén negociando, visitados o cerrados.
- La **fecha de cotización** ("Propuesta enviada") queda registrada con la fecha de la **primera propuesta** generada del lead.
- Se corrigieron los leads existentes que ya tenían propuesta pero habían quedado sin pasar a "Cotizado".

### 15 de julio de 2026

#### Traspasos — aviso en el momento

- Cuando una acción **dispara un traspaso**, ahora aparece un **popup al instante** para confirmarlo, sin tener que entrar a la campana ni a la bandeja de Pendientes.
- Desde el popup (y también desde la bandeja) podés **Confirmar y notificar**, **Cancelar** (lo puede hacer quien disparó el traspaso o un admin) o **Posponer 6 hs**. Al posponer, el traspaso se oculta del popup y de Pendientes durante 6 horas y después vuelve a aparecer; mientras tanto no escala.

#### Finanzas — ingreso de movimientos más rápido

- Al cargar un **gasto**, la categoría por defecto ahora es **"Salida proyecto"** (antes venía en "Costo variable"), que es la más habitual.
- La **cuenta de banco** dejó de ser obligatoria en cobros y pagos: podés registrar un movimiento **sin elegir cuenta**. Si elegís una, se sigue validando que la moneda coincida.

#### Arreglos

- **Admin · Pipeline por defecto** — el editor mostraba las **etapas viejas** (5) y no dejaba editar las subetapas nuevas. Ahora refleja el **pipeline actual completo** (las 8 etapas + los 2 bloques de Experiencia Solar) y permite editar y guardar sus subetapas, checklists, responsables y pesos.
- **Finanzas** — un **gasto asociado a un proveedor** cargado desde Movimientos ahora se registra como **pago concretado** (factura y pago en un solo acto) y ya **no aparece como deuda pendiente** en el estado de cuenta del proveedor. Las facturas pendientes de pagar se siguen ingresando solo desde Proveedores. Los movimientos que habían quedado mal se corrigen solos.
- **Trámites UTE** — la etapa mostraba **subetapas repetidas**: convivían las que administra el módulo de Trámites UTE con otras que se cargaban por defecto de plantillas viejas. Ahora la etapa queda con **un único juego de pasos** (los 11 del trámite) y se limpiaron los duplicados en los proyectos existentes.

### 14 de julio de 2026

#### Encuestas de satisfacción del Generador

- Ahora el Generador puede **calificar su experiencia** en distintos momentos: al **terminar la instalación**, al **finalizar la habilitación de UTE** y en **cada aniversario** de la puesta en marcha. Cada encuesta aparece sola en la nueva sección **"Encuestas"** de su portal, con un aviso en la campana; se responde con una **nota de 1 a 5 estrellas** y un comentario opcional. Todo dentro de la app, sin mails.
- Cuando un Generador deja una **nota baja (3 o menos)**, se genera automáticamente un aviso al equipo de **Experiencia Solar** (aparece en Pendientes) para que lo contacte y atienda su inquietud.
- El equipo cuenta con una nueva pestaña **"Encuestas"** dentro de **Experiencia Solar** para ver todas las respuestas, filtrarlas por tipo, estado o **solo notas bajas**, y entrar a la ficha del Generador. Las encuestas respondidas también quedan registradas en el **historial** del cliente.

#### Proyectos — una sola fecha (Venta) y orden para planificar

- En la lista de **Proyectos** se quitó la columna **"Inicio"**, que confundía a la hora de planificar. Queda la **fecha de Venta**, que es la fecha en que se cerró el lead como ganado (o la que se define al crear el proyecto, precargada con esa fecha de cierre cuando viene de Ventas).
- La lista ahora se **ordena por fecha de venta, de la más vieja a la más nueva** por defecto, para ver primero qué obra hay que agendar. Podés invertir el orden tocando el encabezado **"Venta"**.

#### Arreglos

- **Ingeniería** volvía a aparecer vacío (sin proyectos en la lista ni en el buscador lateral, y las herramientas no se podían abrir). El módulo seguía buscando la etapa de ingeniería con el nombre del **pipeline viejo**, y como los proyectos nuevos usan las etapas **Pre-ingeniería** e **Ingeniería final**, ninguno aparecía. Ahora reconoce las etapas nuevas y muestra cada proyecto con su estado (En cola / En proceso / Completada).

### 13 de julio de 2026

#### Mis tareas — una tarea, varios responsables

- Ahora una **tarea** (tanto las **sueltas** como las asociadas a un proyecto) se puede **asignar a varias personas** a la vez. No se duplica la tarea: es **la misma**, compartida, y **cualquiera de los asignados puede resolverla**, editarla o eliminarla.
- La tarea aparece en **"Mis tareas"** de **cada** persona asignada. Al crearla o editarla, el campo de asignación permite **elegir varios** con buscador; se muestran como etiquetas y se quitan con un toque.
- Las tareas que ya tenías siguen igual: su responsable actual queda como asignado.

### 12 de julio de 2026

#### Portal del Generador — campana de avisos

- El **portal del Generador** ahora tiene su propia **campana de notificaciones** en el encabezado, con un contador de avisos sin leer. Hasta ahora el cliente solo veía el estado de su instalación en la lista; ya no necesita entrar a buscar si hubo novedades.
- Muestra los avisos dirigidos al Generador (por ejemplo, cuando **cambia el estado de uno de sus tickets**). Al tocar un aviso queda marcado como leído y lleva directo a la sección correspondiente; también se pueden **marcar todas como leídas**. Todo dentro de la app, sin mails.

#### Ficha del cliente — Historial más completo

- El **Historial** de la ficha del cliente (Experiencia Solar) ahora **unifica más fuentes** en un solo feed cronológico. Además de las actividades de Ventas, los comentarios y las interacciones, ahora incluye: los **avances de etapa del proyecto** (cuándo arrancó/terminó cada etapa de la obra), los **traspasos entre áreas**, la **apertura y resolución de tickets** y los **documentos generados** para el cliente (contrato, proforma, propuesta).
- Cada evento se distingue con su **color de origen** (Ventas / Proyecto / Cliente / Ticket) y su ícono. Las **interacciones** ahora muestran además el **canal, la dirección (entrante/saliente) y el motivo** que antes no se veían en el historial.

#### Tickets — nuevo sistema de reclamos y consultas

- Se agregó un **sistema de tickets** para seguir reclamos y consultas sobre una instalación. Vive en **"Mis tareas → Tickets"**.
- **Cualquiera del equipo** puede **abrir un ticket** contra un proyecto (con prioridad), **derivarlo** a Ingeniería u Operaciones (les llega el aviso desde **Pendientes**), marcarlo **en progreso**, **resolverlo** (avisa a Experiencia Solar) y **cerrarlo**. Cada ticket tiene una conversación, con la opción de **notas internas** que el cliente no ve.
- **El cliente** también puede, desde su **portal** ("Mis tickets"), **abrir un ticket** y seguir la conversación con el equipo. Es la primera vez que el Generador puede escribirnos desde el portal (todo dentro de la app, sin mails).

#### Menú — "Pendientes" ahora vive dentro de "Mis tareas"

- "Mis tareas" pasa a tener **pestañas**: **Tareas**, **Pendientes** y **Tickets**. La bandeja de traspasos por confirmar, que antes era un ítem aparte en el menú principal, ahora es la pestaña **"Pendientes"** dentro de "Mis tareas". Los enlaces y avisos que llevaban a Pendientes siguen funcionando.

#### Traspasos — el cierre del trámite UTE avisa solo a Experiencia Solar

- Al **finalizar un trámite UTE** (con el botón de la etapa o cargando la fecha de finalización), ahora se genera automáticamente el **traspaso a Experiencia Solar** (queda en **Pendientes** para confirmar) para avisar al Generador que ya puede empezar a producir su energía. Antes ese aviso no se disparaba solo al cerrar el trámite y había que gatillarlo a mano.

#### Costos de obra — no-material y costo por kW

- En la pestaña **Costos** de un proyecto se agregó una sección **"Costo no-material"** para cargar a mano los costos que no salen del stock: **mano de obra, tercerizados, fletes**, etc. (concepto, monto, moneda y fecha opcional). Se pueden agregar y eliminar, y quedan registrados en el historial del proyecto.
- Estos costos se **suman al costo real de la obra**, por lo que ahora el **margen real** y el nuevo indicador **"Costo real por kW"** (costo total dividido por la potencia instalada) reflejan el costo completo, no solo los materiales. El costo por kW muestra además el **previsto por kW** y la potencia como referencia, para comparar la eficiencia entre obras de distinto tamaño.

#### Calendario — fecha de obra tentativa vs. confirmada

- En el **Calendario de instalaciones**, las obras ahora se distinguen visualmente según estén **confirmadas o no**: las **tentativas** (la fecha que agenda Ventas al inicio, todavía sin confirmar) se ven **rayadas y con borde punteado**; las **confirmadas** (que el responsable de Operaciones confirma más adelante) se ven con **relleno lleno**.
- Se agregó una **referencia** arriba del calendario que explica los dos estados, y al pasar el mouse por una obra tentativa el globo aclara "Fecha tentativa (sin confirmar)".
- Además, en el pipeline nuevo de 8 etapas, el calendario vuelve a **reconocer correctamente la etapa de obra** (para pintar en verde las obras ya terminadas y para los avisos de coherencia de fechas), que había dejado de detectarse con el cambio de etapas.

#### Estado de resultados — los pagos a proveedores del mes ahora se ven siempre

- El **Estado de resultados** ahora muestra los **pagos a proveedores según la fecha en que se pagaron**, por su monto real. Antes, si pagabas **una parte** de una factura grande (o una cuenta con varias facturas), ese pago **no aparecía** hasta saldar la factura completa, y cuando aparecía lo hacía con la fecha de la factura, no la del pago.
- Ahora cada pago cae en el mes en que salió la plata, aunque la factura siga parcialmente pendiente. Así el resultado del mes refleja **todas las salidas reales** a proveedores.

### 11 de julio de 2026

#### Generadores importados por CSV — fuera de Proyectos, contados como obras históricas

- Los Generadores que se cargan por **CSV** en Experiencia Solar son registros **livianos** (un cliente, sin obra ni pipeline). Ahora **dejan de aparecer en la lista de Proyectos** —donde figuraban sin instalador y ensuciaban la vista— y quedan **solo en Experiencia Solar**.
- En **Métricas**, estos importados **ya no cuentan** como proyectos activos, pero **sí se suman como obras realizadas** en el año de su **Fecha entrega** cargada (2023, 2024…), para poder medir las obras de años anteriores.
- Se aplicó también a los **ya cargados** anteriormente.

#### Borrar proyectos, Generadores y leads

- Ahora se puede **borrar un proyecto** desde su ficha: al lado del lápiz de editar aparece un botón de papelera.
- En **Experiencia Solar**, cada Generador del listado tiene un botón de **papelera** para borrarlo.
- Para evitar borrados accidentales, la confirmación pide **escribir en letras un número** que se muestra en pantalla (ej. "tres"). Mismo criterio en la **lista de proyectos** (antes había que tipear el código completo) y al **borrar un lead** en Ventas (antes un cartelito del navegador).
- En todos los casos es un **borrado que se puede deshacer**: el proyecto/Generador/lead desaparece de todas las listas de la app, pero queda guardado por si hace falta recuperarlo. Solo lo ven quienes tienen permiso para borrar.

#### Traspasos que se disparan al completar las tareas

- El **traspaso al área siguiente** ahora se genera **cuando se completan las sub-tareas** de la etapa, no cuando alguien marca la etapa entera a mano. Al resolver la última tarea, la etapa se cierra y queda el traspaso **pendiente de confirmar** en "Pendientes".
- Las sub-tareas marcadas **"No aplica"** cuentan como resueltas (antes dejaban la etapa trabada sin poder cerrarse).

#### Finanzas — el pago a proveedor se descuenta solo del estado de cuenta

- Al **registrar un pago a un proveedor** (desde la ficha del proveedor o desde Pagos), el pago ahora se **descuenta automáticamente de las facturas adeudadas, de la más vieja a la más nueva**, sin tener que elegir factura por factura. Si el pago supera la deuda, el sobrante queda **a favor del proveedor**.
- Antes, un pago registrado desde el proveedor quedaba **"sin aplicar"** si no se seleccionaban las facturas a mano: no descontaba la deuda y **no aparecía en el Estado de resultados**. Ahora aparece en el mes del pago, como corresponde.
- El pago hecho desde **Movimientos** (aplicado a una factura puntual) sigue funcionando igual que antes.

#### Arreglos

- **Habilitación UTE → cierre del proyecto**: con el pipeline nuevo de 8 etapas, los proyectos cuyo trámite UTE ya estaba **finalizado** no avanzaban solos a Post-Habilitación ni quedaban marcados como **Completados**. Ahora vuelve a hacerlo automáticamente, usando la **fecha real de finalización** del trámite (no la de hoy), y se corrigieron los proyectos que habían quedado trabados.

## v8.0

### 10 de julio de 2026

#### Experiencia Solar (antes "Atención al Cliente")

- El área de atención al cliente pasa a llamarse **Experiencia Solar**, y a los clientes ahora los llamamos **Generadores**. El cambio se ve en el menú, en el portal (**"Portal de Generadores"**) y en las comunicaciones del área.

#### Pipeline del proyecto — 8 etapas + Experiencia Solar en paralelo

- La vista del proyecto muestra el **pipeline expandido a 8 etapas** (Onboarding, Pre-Ingeniería, Validación de Operaciones, Ingeniería Final, Compras, Ejecución de Obra, Tramitación UTE y Post-Habilitación), con **color por área** y la etapa en curso resaltada.
- Debajo, en **paralelo**, aparecen los bloques de **Experiencia Solar** (Seguimiento Preobra y Habilitación): son **clickeables** y tienen sus propias sub-tareas para llevar el acompañamiento del Generador durante todo el proceso.
- Las **etapas completadas se ven en verde**, claramente identificables de un vistazo; la etapa en curso queda resaltada.
- (Aplica a los proyectos nuevos.)

#### Traspasos entre áreas

- Al cerrar una etapa se genera un **traspaso** hacia el área que sigue. Llega una notificación para **confirmarlo** desde la nueva sección **"Pendientes"**; recién al confirmarlo se avisa al área correspondiente. Así ninguna entrega entre áreas se traspapela.

#### Experiencia Solar — importar y editar Generadores

- Nuevo botón **"Importar"**: subís un **CSV** con Generadores anteriores (la misma estructura que el "Exportar"), ves una **vista previa** con los **duplicados marcados** y las columnas faltantes avisadas, y confirmás. Se cargan sin tener que crear el proyecto completo.
- En el **listado** ahora se pueden editar **todos los datos** con un clic: nombre, departamento, potencia, asesor, estado y etapa (con desplegables), además de mail, teléfono y fecha de entrega.

#### Aviso de habilitación al Generador

- Cuando UTE finaliza el trámite, si en **24 a 48 horas** no se registró el aviso al Generador, Experiencia Solar recibe un recordatorio (y a las 48 h se escala a administración). El listado marca a los Generadores con **aviso pendiente**.

## v7.1

### 8 de julio de 2026

#### Onboarding — Generador de proforma BBVA

- Nueva herramienta en la subetapa **Modalidad de pago definida** del onboarding: un **generador de proforma** para solicitar financiación al banco (BBVA), con el mismo estilo que el contrato —formulario a la izquierda con datos **precargados** del cliente y del sistema, y **vista previa en vivo** a la derecha. El **monto solicitado** se carga a mano; el resto se completa o ajusta.
- Con **"Generar proforma BBVA"** se crea una **versión** en PDF (documento branded con el diseño de Voltia: logo, tabla de financiación, descripción del sistema, firma y datos de la empresa). Cada generación queda **listada** para **previsualizar** o **descargar** y enviar al banco. El archivo se llama "Proforma BBVA Voltia - {cliente} - V{n}".

#### Onboarding — Generador de contrato

- Nueva herramienta en la subetapa **Contrato** del onboarding: un **generador de contrato** con el mismo estilo que el de propuestas —formulario a la izquierda con los datos **precargados** del cliente, el sistema y el precio, y la **vista previa del contrato en vivo** a la derecha. Lo que falte se completa a mano (los campos obligatorios se marcan).
- Con **"Generar contrato"** se crea una **versión** en PDF; cada generación queda **listada** en la subetapa para **previsualizar** o **descargar** y enviársela al cliente. El archivo se llama "Contrato Voltia - {cliente} - V{n}".

#### Cotizador — costo de instalación eléctrica por tamaño

- El **costo de instalación eléctrica** ahora **escala con el tamaño del sistema**: cuantos más paneles, mayor el costo (antes era un valor fijo por tipo de suministro, sin importar la cantidad). Se aplica por tramos de cantidad de paneles.
- La **tabla de multiplicadores es editable** desde **Admin → Propuestas → Defaults**, en la nueva sección **"Instalación eléctrica — multiplicador por tamaño"** (7 tramos: 1–10, 11–20, 21–30, 31–40, 41–50, 51–100 y 101+).

#### Cotizador — más información arriba

- La barra de indicadores del cotizador ahora muestra también el **precio final con IVA** (destacado), además del ahorro, el espacio, la potencia pico, el retorno y el precio por kW.
- El **markup** vuelve a poder **editarse desde el cotizador** por el asesor.

#### Propuestas — nombre del archivo

- El PDF (y el Excel) de la propuesta se descargan con un nombre claro: **"Propuesta Comercial Voltia - {Nombre del cliente} - V{número de versión}"** (el resumen agrega "- Resumen"). Antes usaba un nombre corto con solo el apellido.

### 6 de julio de 2026

#### Comisiones del asesor comercial

- **Nueva sección "Comisiones"** en el menú: cada asesor ve sus comisiones (pendientes y pagadas) con el **saldo total a cobrar** destacado, lo **cobrado en el año**, la **cantidad de ventas cerradas**, un **gráfico mensual** (cobradas vs. proyectadas) y una **tabla** con filtros (todas / pendientes / pagas) y orden por fecha o monto. Un asesor ve solo las suyas; Administración y Finanzas ven las de todos.
- **Al marcar un lead como Ganado** se abre un paso para **elegir qué propuesta aceptó el cliente** (por defecto la última) y así **registrar la comisión**: se calcula automáticamente sobre esa propuesta y queda **congelada**. Si la venta se cerró con una propuesta vieja, un administrador puede **cargar el monto a mano**.
- La comisión genera un **pendiente en Finanzas**. Cuando Finanzas lo marca como **pagado**, la comisión pasa sola a **Pagada**. Ese movimiento **no se puede borrar** desde Finanzas (se gestiona desde Comisiones).
- Si se **reabre** un lead que ya estaba ganado y tenía comisión, se muestra un **aviso** (la comisión y su pendiente se mantienen).
- **Comisión manual**: desde el dashboard de Comisiones, Administración/Finanzas pueden **cargar una comisión suelta a un asesor** (monto, fecha y concepto), sin necesidad de un lead. Genera su pendiente en Finanzas igual que las demás.

#### Ficha del cliente — Fecha de venta e Historial

- La ficha del cliente ahora muestra la **Fecha de venta** (el momento en que se cerró el lead como ganado), además de la Fecha de entrega. Se completa automáticamente al convertir el lead en proyecto.
- Nueva pestaña **"Historial"** en la ficha: un único hilo con todo lo que pasó con ese cliente —cambios de etapa en Ventas, comentarios del lead y del proyecto, e interacciones— ordenado por fecha y con una etiqueta que indica de dónde viene cada cosa (Ventas / Proyecto / Cliente).

#### Propuestas y calculadora

- **Propuestas viejas (Excel)**: desde el panel del lead ahora se puede **descargar el Excel** de una propuesta vieja y **descartarla o restaurarla** (con confirmación), igual que las nuevas.
- **Admin → Propuestas → Defaults**: se agregó la sección **"Generación y dimensionamiento"** para editar el rendimiento anual, los metros cuadrados por panel y los **factores estacionales de generación** (los 12 meses) sin tocar código.
- **Constructor de propuestas**: la barra de indicadores de arriba ahora muestra también la **potencia pico** (kWp), el **tiempo de retorno** (en años) y el **precio por kW con IVA**, además del ahorro y el espacio.

### 28 de junio de 2026

#### Proyectos — Cierre automático al finalizar el trámite UTE

- Cuando se marca el **trámite UTE como finalizado**, el proyecto **avanza solo a la etapa Post-Habilitación** y queda en estado **Finalizado**, usando la **fecha real del trámite** (no la del día en que se procesa). Antes había que cerrarlo a mano y varios quedaban "colgados" en Habilitación UTE.
- En la sección **Clientes**, esos proyectos pasan a **E3 · Post-Habilitación** automáticamente, derivado del avance real del proyecto.

#### Arreglos

- **Filtro de etapa en Proyectos:** filtrar por **"Post-Habilitación"** ahora trae también los proyectos ya completados que están en esa etapa (antes devolvía 0 aunque se vieran en el listado). El filtro quedó alineado con la etapa que se muestra.

<!-- Nota interna (Ola 3): el filtro de "Mis tareas" oculta tareas de proyectos en estado Finalizado/Completado. Revisar cuando Post-Habilitación empiece a generar tareas (mantenimientos, etc.), porque esas tareas quedarían ocultas. -->

## v7.0

### 28 de junio de 2026

#### Recorrido del cliente — "Postventa" pasa a llamarse "Post-Habilitación"

- La etapa final del recorrido del cliente y del pipeline, antes **"Postventa"**, ahora se llama **"Post-Habilitación"** en toda la app: el chip del cliente (E3), los filtros y tableros del módulo Proyectos, y la ficha del proyecto. Refleja mejor que es la etapa que arranca una vez habilitado el sistema y se extiende en el tiempo (mantenimientos, reportes). *(Solo cambia el nombre visible; la lógica y los datos quedan igual.)*

#### Experiencia de Clientes — Nueva sección para ver toda la cartera

- **Nueva sección "Clientes"** (menú Experiencia de Clientes): un listado con todos los clientes para ver de un vistazo en qué anda cada uno. Se puede **buscar** por nombre, mail o teléfono y **filtrar** por estado, etapa, asesor y departamento, además de **ordenar** por nombre, etapa, potencia o fecha de entrega.
- **Etapa en dos niveles:** cada cliente muestra en qué **etapa del recorrido** está (E1 Pre-obra, E2 Habilitación, E3 Post-Habilitación) y, debajo, la **etapa puntual** del proyecto (Onboarding, Ingeniería, Operaciones, Habilitación UTE o Post-Habilitación).
- **Cartera enfocada:** por defecto se ven los clientes **activos y finalizados**; los que están en cotización o archivados quedan fuera salvo que los pidas con el filtro de estado.
- **Ficha del cliente:** al entrar se ven sus datos (contacto, potencia, fecha de entrega, dirección, asesor), el **estado del trámite UTE** (etapa actual y desde cuándo) y una **bitácora de interacciones** para registrar cada contacto (WhatsApp, mail, llamada, visita u otro). Incluye botón para **ir al proyecto**.
- **Exportar:** botón para bajar el listado filtrado a un archivo (abre bien en Excel), con columnas separadas de **Recorrido** y **Etapa**.

#### Pendiente de activación (acción de un administrador)

- Para que el equipo de Experiencia de Clientes vea esta sección, un administrador debe **habilitar los permisos del módulo** y **asignar el rol Postventa** a la persona a cargo (Alejandra). Hasta que se haga, la sección no aparece para ese usuario. *(Paso manual pendiente — no se ejecutó automáticamente.)*

### 24 de junio de 2026

#### Ya podés instalar Voltia PM como app en el celular

- **Voltia PM ahora se instala como una app.** Desde el celular: en Android, Chrome ofrece **"Instalar app"**; en iPhone, Safari → Compartir → **"Agregar a inicio"**. Queda con su **ícono propio** en la pantalla de inicio y abre **a pantalla completa**, sin la barra del navegador.
- Cierre de la adaptación a móvil: las secciones de uso en campo (Ventas, Operaciones y Finanzas) quedan cómodas en el celular y la app se siente como una aplicación instalada.

### 23 de junio de 2026

#### Portal de cliente — Seguimiento del trámite UTE más claro

- **Fechas correctas:** las fechas de cada hito del trámite ahora coinciden exactamente con las que carga el equipo (antes se mostraban con un día menos).
- **La etapa que se está esperando ya no parece cumplida:** el hito en el que está parado el trámite se ve como pendiente (gris), igual que los que faltan. Cada hito tiene dos estados nada más: hecho (con su fecha) o pendiente.
- **"Último avance":** el último hito con fecha lleva un rótulo chiquito **"Último avance"** para que se note de un vistazo dónde está el trámite. No aparece cuando el trámite ya está finalizado.

#### Finanzas — Más ventanas cómodas en el celular

- El resto de las ventanas de Finanzas (nuevo movimiento, transferencia entre cuentas, factura a pagar, pago y pendiente manual, conciliar cuenta, registrar cobro, alta y edición de proveedor) ahora se abren como **panel desde abajo** en el celular y siguen centradas en la computadora.

#### Finanzas — Pendientes en el celular

- La pestaña **Pendientes** ahora se ve cómoda en el celular: cada compromiso se muestra como **tarjeta** (fecha, monto destacado, descripción) en vez de una tabla ancha que se salía de pantalla. El botón **"⋯"** de cada tarjeta abre las acciones (marcar pagado, editar, reagendar fecha, y eliminar con su texto correcto según el tipo: "Saltear este mes", "Anular factura", etc.).
- Los **filtros** (tipo, proyecto, proveedor) pasan a un panel **"Filtros"** con contador, y las métricas de arriba se acomodan en 2 columnas. En la computadora se ve igual que antes.

### 22 de junio de 2026

#### Finanzas — Tablas más legibles en el celular

- **Proveedores y Cobros como tarjetas:** en el celular, estas listas dejan de ser tablas anchas con scroll lateral y se muestran como **tarjetas apiladas**, con el nombre/cliente arriba y el saldo o pendiente destacado. Tocar una tarjeta abre el detalle. En la computadora se ven igual que antes.
- **Flujo de fondos:** la tabla de eventos proyectados también se ve como tarjetas en el celular (la fecha se sigue pudiendo editar tocándola), y los KPIs y el gráfico siguen como estaban.
- **Cuentas:** el historial de conciliaciones dentro del panel de una cuenta ya no se aprieta en pantallas chicas (ahora se desliza de costado para verlo completo).

#### Finanzas — Borrar movimientos desde el celular y ventanas más cómodas

- **Borrar un movimiento desde el celular:** al abrir un movimiento para editarlo, ahora hay abajo una **zona de peligro** con el botón **"Eliminar movimiento"** (pide confirmación). Antes solo se podía borrar desde la computadora.
- **Ventanas como panel desde abajo:** "Editar movimiento", "Plan de pagos" y "Aplicar pago a facturas" se abren como **panel desde abajo** en el celular (más cómodos de usar con una mano) y siguen centrados en la computadora.

### 21 de junio de 2026

#### Ventas — Kanban más cómodo en el celular

- **Mover tarjetas sin arrastrar:** cada tarjeta del Kanban tiene ahora el ícono **⋮⋮** que abre una lista con las etapas para mandar el lead a otra columna con un solo toque. Ideal en el celular, donde arrastrar entre columnas es incómodo.
- **Arrastrar ya no se pelea con el scroll:** en el celular el arrastre arranca con un **toque sostenido** (mantené el dedo apretado un instante sobre la tarjeta). Así podés deslizar la pantalla para arriba y para abajo sin que se "enganche" una tarjeta sin querer.
- **Columnas de a una:** el tablero se desliza de costado mostrando **una columna por pantalla** (con un asomo de la siguiente) y se acomoda sola al soltar, para que siempre quede una columna prolija a la vista.

#### Ventas — Pantallas de ventas más cómodas en el celular

- **Nuevo lead y "Generar propuesta desde Excel":** estos formularios ahora se abren como **panel desde abajo** en el celular (más cómodo de completar con una mano) y siguen como ventana centrada en la computadora.
- **Filtros del Kanban:** en el celular el buscador y "Solo míos" pasaron a un botón **"Filtros"** que abre un panel; el botón muestra un contador cuando hay filtros activos. Los botones de **Nuevo lead** y el cambio entre **Kanban/Lista** quedan siempre a la vista.
- **Vista Lista en el celular:** la tabla de leads se muestra como **tarjetas apiladas** y fáciles de leer en pantalla chica; en la computadora sigue siendo la misma tabla, con orden por columna y todo igual que antes.
- **Detalle del lead:** al abrir un lead en el celular, los botones del fondo (como borrar o los comentarios) ya **no quedan tapados** por la barra de navegación inferior.

## v6.2

### 20 de junio de 2026

#### Arreglos

- **Proyectos — etapa al crear:** un proyecto nuevo ahora arranca con la etapa **Onboarding** activa (en curso) desde el momento de la creación. Antes nacía sin ninguna etapa marcada como actual, así que no se veía en qué etapa estaba parado el proyecto.

### 19 de junio de 2026

#### Finanzas — Copiar resumen de cobros para WhatsApp

- En el detalle de cobros de un cliente hay un nuevo botón **"Copiar resumen"** (arriba, junto a "Registrar cobro" y "Ver proyecto"). Copia al portapapeles un mensaje ya formateado para pegar en WhatsApp: presupuesto, cobrado y pendiente, más el detalle de pagos recibidos y próximos pagos con sus fechas y montos. Las negritas de WhatsApp ya vienen aplicadas.

#### Arreglos

- **Métricas — objetivo de kWp instalados:** las tarjetas de Métricas mostraban "sin objetivo" cuando la métrica tenía cargado solo el objetivo **anual** (sin objetivo trimestral) y la pantalla estaba en vista de trimestre, como pasaba con los **kWp instalados**. Ahora, si no hay objetivo del trimestre, la tarjeta compara contra el objetivo anual en vez de decir que no hay objetivo.

### 17 de junio de 2026

#### Arreglos

- **Propuesta comercial — gráfico de retorno de inversión:** en proyectos de montos altos (decenas o cientos de miles de dólares) el gráfico de "Retorno de Inversión" mostraba números sin escala y difíciles de leer. Ahora los montos arriba de cada barra y los del eje se muestran completos con separador de miles (por ejemplo `500.000`), igual de claros para proyectos chicos y grandes.
- **Propuesta comercial — montos del Excel con separadores de miles:** corregido el gráfico de retorno de inversión cuando los montos del Excel usan separadores de miles uruguayos (el punto). Antes un valor como `USD 46.616` se interpretaba como 46 y el gráfico mostraba cifras mil veces más chicas; ahora se lee correctamente como 46.616.

### 15 de junio de 2026

#### Ingeniería — Editar a mano el calibre de los cables del unifilar

- En el **Plano Unifilar** ahora podés **modificar el calibre (sección en mm²) de los cables**, no solo de las protecciones. El sistema lo sigue **calculando y sugiriendo** por corriente admisible, pero podés sobrescribirlo cuando necesitás ajustar por **caída de tensión** o **material**, que el cálculo automático no contempla.
- Se puede ajustar en **todos los tramos del plano**: cable **DC** (paneles ↔ tablero), cable **AC inversor → ICP de la IMG**, cable **AC ICP → tablero de la casa** y el **conductor PE a la jabalina**.
- Cada campo arranca en **Automático** y muestra entre paréntesis el valor sugerido. Si lo dejás en automático usa esa sugerencia; si escribís un número, ese se imprime en el plano. El prefijo (2x/3x/4x) y el "PE" se siguen armando solos según el tipo de red.

### 14 de junio de 2026

#### Finanzas — El flujo de fondos descuenta el saldo a favor de proveedores

- En **Flujo de fondos**, la proyección de deuda a proveedores ahora resta el **saldo a favor** (pagos que tenés a favor sin imputar a una factura): proyecta el **saldo neto** que realmente vas a desembolsar, no el bruto de la factura.
- El crédito se aplica a la factura que **vence primero** y por moneda (dólares con dólares, pesos con pesos). Si el saldo a favor cubre una factura entera, esa factura deja de proyectarse; si el crédito supera toda la deuda, el proveedor no proyecta salida.
- Ejemplo (FIVISA): factura de USD 9.701 con USD 5.000 a favor → el flujo proyecta **-USD 4.701** (antes mostraba -9.701). Coincide con el saldo neto de la ficha del proveedor.

### 13 de junio de 2026

#### Mails — Enviar la consulta a UTE desde la app

- Nueva pantalla para **enviar la Consulta de Nuevo Microgenerador a UTE** desde el proyecto: se abre con el botón **"Enviar consulta a UTE"** dentro de la subetapa **Consulta inicial UTE** del Onboarding.
- El formulario viene **prellenado** con los datos del proyecto y muestra una **previsualización del mail en vivo** al costado: lo que ves es exactamente lo que se envía.
- **Destinatarios con chips:** Para, Cc y Cco se editan agregando con Enter o coma y quitando con la cruz; las direcciones mal escritas se marcan en rojo.
- **Persona física / empresa:** un toggle cambia el encabezado, el rótulo C.I./RUT y el destino del servicio.
- **Cargar factura UTE:** desde la misma pantalla podés subir la factura y la IA completa cuenta, tarifa, potencia y más; revisás y ajustás antes de enviar.
- **Configuración de correo:** cada usuario configura su **servidor SMTP** en **Configuración → Email** (con botón "Probar conexión"). La contraseña se guarda cifrada.
- **Plantillas de email:** los administradores pueden editar la plantilla de la consulta (asunto, cuerpo, destinatarios) desde **Admin → Plantillas de email**.

### 10 de junio de 2026

#### Informes — Nuevo módulo de informes y revisiones

- Nueva sección **Informes** en el menú: permite escribir un informe, elegir a quién va dirigido (uno o varios destinatarios) y, opcionalmente, asociarlo a una obra.
- **Borradores:** mientras el informe no se envía, podés editar el título y el contenido, **adjuntar archivos** y borrarlo. Una vez enviado queda firme.
- **Revisión dirigida:** cada destinatario puede **Aprobar** o **Devolver** el informe. Para devolver hay que dejar un comentario explicando por qué. La respuesta de cada uno es definitiva.
- **Estado a la vista:** el informe muestra su estado general (Pendiente, Aprobado o Devuelto) y el detalle de qué respondió cada destinatario, con su comentario y fecha.
- **Privacidad:** cada quien ve solo los informes que escribió o que recibió. El menú marca con un **contador** los informes que tenés pendientes de responder.

#### Informes — Adjuntar al crear y ver/descargar archivos

- Ahora podés **adjuntar varios archivos directamente al crear** el informe, en un solo paso: elegís los archivos en la ventana de "Nuevo informe" y al confirmar se suben solos (ya no hace falta guardar borrador primero y adjuntar después). El adjunto es opcional.
- Si la subida se corta a la mitad, el informe **queda como borrador** con lo que sí se subió y te avisa para que lo completes — no se pierde nada ni se envía a medias.
- En el informe, cada adjunto tiene **Ver** y **Descargar**. La vista previa abre el archivo en una ventana dentro de la misma pantalla (igual que las propuestas de Ventas); PDF e imágenes se ven ahí mismo.

#### Informes — Editar y borrar tus informes en cualquier momento

- Como autor ahora podés **editar y borrar** tus informes en cualquier estado, no solo en borrador. Editar un informe ya enviado guarda los cambios sin reenviarlo.
- Al cambiar los destinatarios de un informe enviado, los que se mantienen **conservan su respuesta**; solo los nuevos quedan pendientes.

### 9 de junio de 2026

#### Métricas — Obras ponderadas usa el objetivo de instalaciones

- El KPI **"Obras ponderadas"** ahora se mide contra el **mismo objetivo** que "Instalaciones realizadas" (no necesita un objetivo propio): muestra el avance del valor ponderado contra esa meta del trimestre y del año.

#### Ventas — Borrar leads y buscar en el Kanban

- **Borrar lead:** dentro del detalle de un lead hay un botón **"Borrar lead"** (con confirmación). Disponible para quien tenga permiso de eliminar en Ventas.
- **Búsqueda en el Kanban:** arriba del tablero hay un buscador para filtrar las tarjetas por texto y un toggle **"Solo míos"** para ver solo tus leads. (La vista **Lista** ya tenía búsqueda y filtros por etapa, responsable y fechas.)

#### Stock — Operaciones puede gestionar productos

- **Arreglo:** crear, editar o eliminar productos en Stock dependía del permiso de **Configuración** (Admin), por eso un usuario con permiso de **Stock** no podía hacerlo aunque lo tuviera habilitado. Ahora alcanza con el permiso del módulo **Stock**. El rol **Operaciones** pasa a poder dar de alta y administrar productos y movimientos de stock.

### 8 de junio de 2026

#### Mis Tareas — Ver tareas sueltas completadas

- Las **tareas sueltas** ya no desaparecen al completarlas: con el toggle **"Completadas"** (el mismo de las tareas de proyecto) ahora podés ver las tareas sueltas que terminaste, ordenadas por fecha de finalización. Desde ahí podés reabrirlas si hace falta.

### 5 de junio de 2026

#### Métricas — Obras ponderadas

- Cada proyecto tiene ahora un **"Peso de obra"** (cuántas obras vale, por defecto 1) que se edita desde la ficha del proyecto. Solo los **administradores** pueden cambiarlo; el resto lo ve en solo lectura.
- En **Métricas** se agregó el KPI **"Obras ponderadas"** al lado de "Instalaciones realizadas": en vez de contar 1 por obra, suma el peso de cada una (ej. una obra grande con peso 5 suma 5). Con todos los pesos en 1 da igual al conteo simple. El conteo de instalaciones no cambia.

#### Trámites UTE — Finalizar el trámite desde la etapa del proyecto

- En la etapa **Habilitación UTE** de un proyecto ahora hay un botón **"Marcar trámite como finalizado"** que cierra el trámite (queda Finalizado y Cerrado) y **completa la etapa**, sin tener que cargar las fechas de cada paso del trámite.
- La fecha de finalización del trámite se toma de la **fecha de fin de la etapa Operaciones**. No se cargan las fechas intermedias, así que los tiempos por paso del trámite no se ven afectados.

#### Métricas — Instalaciones se cuentan al iniciar la obra

- "Instalaciones realizadas" ahora cuenta el proyecto cuando la etapa **Operaciones arranca** (fecha de inicio real), no cuando se completa. Se agrupa por trimestre/año según la fecha de inicio de la obra.

#### Pre-ingeniería — Nueva versión arranca con los datos de la anterior

- Al crear una **nueva versión** de pre-ingeniería, el formulario ahora viene **pre-cargado con los datos de la última versión** (cliente, techo, datos eléctricos, red, notas). Solo ajustás lo que cambió en vez de cargar todo de cero. Las fotos no se copian (se agregan aparte si hacen falta).

#### Unifilar — Calibre de protección DC

- El campo **Calibre** de la protección DC ahora sugiere también las variantes **3P** (16A 3P, 25A 3P, etc.) además de las 2P. Igual que siempre, podés escribir cualquier valor a mano si necesitás uno que no está en la lista.


#### Finanzas — Editar y eliminar facturas de proveedor

- En el detalle de un proveedor, cada factura ahora tiene botones para **editar** (descripción, monto, moneda, fechas) y **eliminar**.
- Al eliminar una factura que ya tenía pagos aplicados, esos pagos no se pierden: quedan como **saldo a favor del proveedor**, listos para reaplicar a otra factura (te avisa cuántos se liberaron).

### 4 de junio de 2026

#### Finanzas — Cobros previstos en el detalle del cliente

- En el detalle de cobros de un proyecto, la tabla ahora muestra los **cobros previstos** del plan de pagos junto con los ya cobrados, ordenados por fecha. Los previstos se distinguen con una etiqueta **PREVISTO** y el monto en ámbar.
- Cada previsto tiene un botón **"Marcar pagado"** que abre el mismo formulario que Pendientes (fecha del cobro + cuenta donde entró el dinero) y lo registra como cobrado sin salir del detalle.
- Los totales y el estado de cuenta siguen contando solo lo efectivamente cobrado (los previstos no inflan el "Cobrado").

### 2 de junio de 2026

#### Arreglos

- **Mis Tareas:** las subetapas que tenían fecha límite (visible en el detalle de la etapa) aparecían como "Sin fecha" en Mis Tareas. Ahora muestran su fecha correctamente y se ordenan por urgencia.

### 1 de junio de 2026

#### Documentos — Vista de lista

- En la sección **Documentos** del proyecto ahora podés cambiar entre **grilla** (tarjetas) y **lista**. La vista de lista muestra cada archivo en una fila con el nombre completo bien visible, ideal para encontrar algo cuando hay muchos adjuntos. La app recuerda tu elección.

#### Documentos UTE — Generados y firmados

- Al generar los documentos UTE desde Ingeniería, el ZIP ahora **queda guardado** en el proyecto y aparece en un bloque **"Documentos UTE generados"** dentro de Documentos, con su fecha y un botón para descargarlo. Al regenerar, reemplaza al anterior (queda siempre el último).
- Nuevo bloque **"Documentos UTE firmados"**: cuando Operaciones vuelve de la obra con los documentos firmados por el cliente, los sube ahí (PDF, fotos o un ZIP). Se pueden subir varios juntos y se van acumulando.
- Cada firmado muestra quién lo subió y cuándo; lo elimina quien lo subió o un administrador.
- Los documentos UTE no aparecen mezclados en el listado general de Documentos: tienen sus propios bloques destacados.

#### Obra — Bloque destacado y carga de fotos

- Las fotos de obra y el checklist ahora son un **bloque destacado "Obra del proyecto"** en la página del proyecto (debajo de Tareas), bien visible. Ya no están escondidos en una pestaña.
- Al subir fotos podés **elegir entre cámara, galería o archivos** — antes, en el celular, abría directo la cámara.

#### Arreglos

- El botón **"Cargar fotos de obra"** de la ficha del proyecto no se podía tocar en algunos celulares (quedaba fuera de pantalla); ahora funciona bien en mobile.

#### Obra — Accesos directos a la galería

- Ahora llegás a las fotos de obra de un proyecto desde tres lugares, sin tener que buscar el tab: un botón amarillo **"Cargar fotos de obra"** en la ficha del proyecto (junto al equipo instalador), el mismo botón dentro del panel de la etapa **Operaciones**, y un acceso directo en el **inicio** (para Operaciones y administradores).
- Desde el inicio, como no hay un proyecto elegido, se abre un buscador para elegirlo (por cliente, código o ciudad) y te lleva directo a su galería.
- Al entrar por cualquiera de estos accesos, la página baja sola hasta la galería.

### 31 de mayo de 2026

#### Obra — Galería de fotos y checklist

- Nuevo apartado **"Obra"** dentro de cada proyecto: arriba la galería de fotos y abajo el checklist de referencia.
- **Subir fotos:** podés elegir varias a la vez (o sacarlas con la cámara del celular). Se comprimen solas antes de subir para que pesen poco, con un contador **"Subiendo X de N"**.
- **Galería:** las fotos se ven en miniatura; al tocar una se abre a pantalla completa con flechas para pasar de una a otra. Cada foto se puede eliminar.
- **Descargar todas:** un botón baja todas las fotos del proyecto en un ZIP.
- **Checklist de referencia:** lista de puntos a verificar en obra con barra de progreso. Marcás cada ítem como OK o pendiente con un toque, podés dejar una observación, y agregar ítems propios al proyecto. Los ítems propios se pueden borrar; los de la plantilla, no.
- **Plantilla de checklist (Administración):** en *Procesos y reglas → Plantilla de checklist* se administran los ítems base que se copian al checklist de cada proyecto nuevo. Se pueden crear, editar, reordenar y activar/desactivar.

#### Finanzas — Estado de resultados en dólares

- El **Estado de resultados** ahora muestra todos los montos en dólares (USD). Antes los convertía a pesos. Los movimientos cargados en pesos se convierten al tipo de cambio.

#### Finanzas — Flujo de fondos

- **Costos fijos proyectados:** se corrigió un error por el que los costos fijos que vencen a fin de mes (día 31) se "salteaban" un mes —aparecían recién el mes siguiente—. Ahora se proyectan en todos los meses.
- **Filtro por tipo de movimiento:** podés prender y apagar los tipos (cobros pendientes, deuda a proveedores, costos fijos, materiales proyectados) para ver solo lo que te interesa, tanto en el listado como en el gráfico y los totales. Incluye atajos **"Todos"** y **"Ninguno"**.

## v6.1

### 27 de mayo de 2026

#### Ventas — Fechas automáticas del proceso

- En el panel **"Fechas del proceso"** del lead apareció el campo **"Fecha de creación"** (alta comercial). Se llena solo al crear el lead pero podés editarla después.
- **Visita agendada** ahora se carga automática cuando movés el lead a la etapa "Agendar visita". Si ya la habías cargado a mano, no se pisa.
- **Fecha de cierre** se llena/actualiza siempre que pasés el lead a "Cerrado ganado" o "Cerrado perdido". Si reabrís y volvés a cerrar, queda la fecha del último cierre.
- Los leads viejos que no tenían fecha de alta comercial quedaron con la fecha original del día que se cargaron.

#### Ventas — Modal "Alta comercial" más alto

- En pantallas chicas (laptops o ventanas no maximizadas) el formulario nuevo lead se cortaba arriba y abajo. Ahora el header "NUEVO LEAD / Alta comercial" y los botones "Cancelar / Crear lead" quedan siempre visibles y los campos del medio scrollean internamente si no entran.

#### Tareas — Vista unificada con comentarios

- **Un solo modal "Detalle de tarea"** reemplaza a los dos modales viejos (uno para crear desde proyecto y otro para tareas sueltas). Sirve para crear y editar cualquier tarea.
- **Comentarios con markdown** en cada tarea. Podés escribir `**en negrita**`, `*cursiva*`, listas con `- ítem` y `código inline`. Las menciones rotas y links externos no se renderizan, solo formato seguro.
- Solo el autor edita o borra sus comentarios. Los administradores ya no tienen privilegio extra sobre comentarios ajenos en tareas.
- **Click en una tarea de proyecto desde "Mis Tareas"** ya no te lleva al proyecto — abre el modal de detalle directamente y desde adentro hay un link "↗ Ir a {proyecto}" si querés navegar.
- Click en subetapa sigue navegando al proyecto, sin cambio.

### 26 de mayo de 2026

#### Mis Tareas — Vista calendario

- Toggle **Lista / Calendario** en el header de Mis Tareas. La vista lista no cambió.
- **Calendario con dos modos**: Semana (7 columnas lun–dom) y Mes (grilla del mes con días vecinos atenuados).
- Cada ítem aparece como pill con color por tipo: **azul = subetapa**, **violeta = tarea de proyecto**, **ámbar = tarea suelta**.
- Click en un pill abre el modal/navegación correspondiente; click en un día vacío abre el modal de nueva tarea con la fecha pre-llenada.
- Navegación con ← → para semanas/meses + botón "Hoy" para volver al día actual.
- Items sin fecha o completados no aparecen en el calendario.

### 25 de mayo de 2026

#### Tareas sueltas en Mis Tareas

- En la página "Mis Tareas" ahora hay un tercer bloque **"Tareas sueltas"** abajo de los dos existentes.
- Botón **"+ Nueva"** para crear una tarea sin proyecto asociado. Podés ponerle título, descripción, fecha de vencimiento, asignarla a alguien y opcionalmente vincularla a un proyecto desde el selector.
- Las tareas sueltas tienen estado **Pendiente / Completada**. Click en la fila abre el modal de edición; checkbox al lado marca completada y desaparece del listado.
- Badge de fecha con color por urgencia (rojo si vencida, ámbar si es hoy/mañana, gris si es futura).

#### Constructor de unifilares — Calibres editables y fix de inputs

- **Calibres AC del ICP IMG son editables**: nueva sección "Protección AC" en el form con dropdowns para Térmica AC y Diferencial AC. Si los dejás en "Automático" el sistema elige el calibre según potencia del inversor y tipo de red. Si querés un valor específico, sobrescribís.
- En **trifásico** la tabla automática usa calibres menores (la corriente por fase es ~1/√3 de la equivalente monofásica). Monofásica se mantiene como estaba.
- El **calibre de protección DC** pasó de campo libre a dropdown editable con sugerencias 16A/25A/32A/40A/50A/63A (con polaridad 2P).
- **Arreglo de inputs numéricos**: en el form del unifilar, antes si borrabas el campo de "Potencia panel" para escribir 580 desde cero, el valor se reseteaba al mínimo y no podías terminar de escribir el número. Ahora podés tipear libremente; el valor se confirma cuando salís del campo o presionás Enter.

## v6.0

### 25 de mayo de 2026

#### Propuestas comerciales — Previsualizar y descargar

- **Nuevo botón "Previsualizar"** al lado de "Descargar PDF" en la lista de propuestas del lead y en el modal de generación cuando termina. Abre el PDF embebido en una ventana grande sin tener que descargarlo primero, con un botón "Descargar" adentro por si querés guardarlo.
- **Arreglo del botón "Descargar PDF"**: antes abría una pestaña que terminaba en una pantalla de error de login porque no llevaba la sesión. Ahora descarga directamente el archivo con el nombre `Propuesta Comercial Voltia - {cliente} v{versión}.pdf`.

### 21 de mayo de 2026

#### Privacidad — Eliminado envío automático a clientes

- **Incidente**: el campo "Email de notificación" del proyecto contenía emails de clientes y el sistema lo estaba usando para mandarles **notificaciones internas automáticas** (cambios de etapa, hitos, etapas vencidas, etc.). Llegaron mails con información interna a 27 clientes. Se cortó el envío en producción de emergencia y se aplicó este fix.
- **El campo se renombró** a "Email del cliente" (y el de teléfono a "Teléfono del cliente"). En la ficha del proyecto y en los formularios ahora aclara explícitamente: *"Solo para contacto manual. No se usa para enviar notificaciones automáticas."*
- **Se eliminaron las notificaciones automáticas multicanal**: tarea por vencer, etapa retrasada, hito de progreso, subetapa bloqueada, proyecto con desvío, cambio de estado de etapa. Eran las que iban por el flujo roto. Se conservan únicamente las notificaciones internas seguras: "subetapa anterior completada", "ingeniería completada → operaciones", "alertas de plazos" y "objetivos del trimestre no configurados".
- **Guardrail de seguridad**: el envío de email y WhatsApp ahora valida por default que el destinatario sea un usuario interno de Voltia. Solo se permite enviar a externos si el código pasa explícitamente `type: 'client_facing'`. Esto previene que un cambio futuro vuelva a re-conectar avisos internos al email del cliente.
- **Los datos del cliente se preservan**: el email/teléfono que estaba cargado en cada proyecto sigue ahí (renombrado), sigue siendo clickeable como `mailto:` / `tel:` para contacto manual, y se sigue usando para los PDFs de UTE donde corresponde poner el contacto del cliente.

### 19 de mayo de 2026

#### Materiales — Editar cantidad inline

En la lista de materiales del proyecto, la columna **Cantidad** ahora es editable: hacés clic sobre el número, lo cambiás y al salir del campo (o presionando Enter) se guarda. Antes la cantidad solo se podía setear al agregar el material (en 1) y no había forma de modificarla después. Funciona para todos los roles con permiso de edición de materiales.

### 18 de mayo de 2026

#### Arreglos

- **Formularios que se cerraban al seleccionar texto**: si dentro de un modal (alta de proyecto, formulario UTE, pre-ingeniería, materiales, finanzas, etc.) seleccionabas texto desde un input y soltabas el mouse fuera del campo, la ventana se cerraba y perdías los datos cargados. Ahora los modales solo cierran cuando hacés clic directamente sobre el fondo oscuro, no cuando el gesto empezó dentro del formulario.

### 14 de mayo de 2026

#### Proyectos — Extracción de datos del cliente con IA

Nueva sección **"Documentos del cliente"** en cada proyecto, arriba del bloque "Sistema fotovoltaico". Permite subir:

- **Cédula de identidad** (JPG, PNG o PDF, máx 10MB)
- **Factura de UTE** (PDF, JPG o PNG, máx 10MB)

Al subir, una IA (Claude Haiku) analiza el documento y extrae los datos relevantes: nombre, CI, dirección (calle y número separados), ciudad, departamento, y para la factura UTE además cuenta, caso, oficina, tarifa, potencia contratada, email y teléfono.

- **Modal de validación**: antes de guardar, te aparece un cuadro con todos los datos extraídos editables. Lo que no haya podido leer queda con placeholder "no encontrado" en gris.
- **Edición libre**: corregís lo que esté mal o completás lo que falte.
- **Guardado en el proyecto**: al confirmar, los datos pasan al proyecto (no solo al form UTE), entonces aparecen también en `/proyectos`, en el detalle, y se precargan automáticamente en el form de Documentos UTE.
- **El archivo queda guardado** en el storage del proyecto. Si subís uno nuevo del mismo tipo, reemplaza al anterior.
- **El reset** del form UTE no borra estos datos (son del proyecto, no de la config UTE).

Detrás de escena se mueve `ciCliente`, `calle`, `numCalle`, `personaFisica`, `empresa` de la config UTE a Project — por eso quedan accesibles a todo el sistema, no solo al generador.

#### Ingeniería — Generador de documentos UTE

Nueva herramienta dentro del workspace de Ingeniería para generar los **8 PDFs** que UTE pide para habilitar una instalación FV (Solicitud IMG, DAR, Jurada Mínima, Jurada Técnica, Convenio, Solicitud de Habilitación, Acta de Habilitación, Contrato).

- **Acceso**: workspace de ingeniería del proyecto → botón **"Documentos UTE"** arriba a la derecha. También por URL: `/ingenieria/proyecto/:id/ute-docs`.
- **Configuración por proyecto**: cada proyecto tiene su propia configuración UTE persistente. Cargás CI cliente, nº cuenta y caso UTE, datos del representante (si aplica), datos técnicos del sistema (potencias, tensión, fases, factor de potencia, normas) y fechas (documento + habilitación). Los datos del proyecto (cliente, dirección, capacidad) se rellenan automáticamente, los UTE-específicos los cargás vos.
- **Validar antes de generar**: la página primero te muestra todo el formulario para que revises/edites lo que falte (hay un cliente nuevo o algún campo cambió). Después seleccionás qué PDFs querés y descargás el ZIP.
- **Selector de docs**: 8 checkboxes, todos marcados por defecto. Podés generar solo los que necesités.
- **Descarga automática**: al confirmar se descarga un ZIP `docs_ute_{cliente}_{fecha}.zip` con los PDFs listos para imprimir y firmar.
- **Reemplaza el script local**: antes el proceso era manual (completar `datos.txt` + correr Python en la PC). Ahora todo en Voltia PM, queda registro de cada generación.

Las plantillas PDF originales viven en el server y se normalizan automáticamente al hacer build de la imagen Docker (los originales vienen encriptados con password vacío, no compatibles con la lib de generación).

### 13 de mayo de 2026

#### Proyectos — Fecha de venta

Cada proyecto tiene ahora un campo **Fecha de venta**, separado de la fecha de inicio de obra.

- **Al crear el proyecto**, la fecha de venta se autocompleta con la fecha del día. Podés editarla antes de confirmar (por si registrás un proyecto vendido la semana pasada).
- **Después de creado**, se edita desde el botón **✎ Editar** del detalle del proyecto, junto con el resto de los datos del cliente.
- **Nueva columna "Venta"** en la lista de proyectos, con su flecha de orden — al hacer click, ordena por venta más reciente primero. Volvé a hacer click para invertir.
- **Backfill automático**: los proyectos que ya estaban en el sistema adoptan su fecha de creación como fecha de venta (podés ajustarla manualmente desde el detalle si la real es otra).

#### Calendario — Filtro de proyectos al agendar instalación

El selector de proyectos del modal **"Nueva instalación"** ahora solo muestra proyectos elegibles: los que no tienen instalación agendada todavía y no están completados ni archivados. Antes mostraba todos y dependía del usuario evitar los duplicados. El mensaje cuando no quedan proyectos también es más claro.

#### Finanzas — Asistente de plan de pagos

La pestaña Cobros de cada proyecto ahora arma el plan de cobros previstos por vos. Cuando un proyecto tiene presupuesto cargado y no hay cobros previstos todavía, aparece un banner amarillo con el botón **"Crear plan de pagos →"**. Click abre un asistente con 4 cuotas pre-cargadas: seña fija de USD 500 + Cuota 1 (50% incluyendo seña) + Cuota 2 (30%) + Cuota 3 (20%), todas con fechas escalonadas a 7, 30, 60 y 90 días.

- **Edición libre** antes de confirmar: cambiá el monto o el porcentaje de cualquier cuota — el otro se recalcula solo. Cambiá la fecha de cada una. Renombrá las descripciones. Agregá o eliminá cuotas (incluida la seña, mientras quede al menos una).
- **Eliminar redistribuye**: cuando borrás una cuota, su monto se reparte proporcionalmente entre el resto.
- **Indicador de suma en vivo**: total en verde con ✓ cuando coincide con el presupuesto (tolerancia ±USD 1 por redondeo), rojo con "Faltan X" o "Excede por X" cuando no cierra. Si no cierra, no se puede confirmar.
- **Validaciones**: si la seña supera el 50% del presupuesto, aparece un warning amarillo pero permite confirmar (puede ser intencional). Si la seña iguala o supera el presupuesto, error bloqueante.
- **Una sola transacción**: al confirmar se crean todas las cuotas como cobros previstos en Finanzas. Si algo falla, no se crea ninguna.
- **Modo edición**: cuando el plan ya existe, el banner se reemplaza por un botón discreto **"✎ Editar plan de pagos"**. Al confirmar cambios, los previstos viejos del plan se reemplazan por los nuevos en una sola operación. Los previstos sueltos (creados desde "Registrar cobro" sin pertenecer al plan) **no se tocan**, y los cobros ya pagados tampoco.

Los previstos creados por el asistente aparecen en la pestaña global Pendientes y en el Flujo de fondos como salidas proyectadas (en realidad, ingresos esperados).

#### Proyecto Final de Ingeniería — rediseño completo del PDF

El generador del PDF del Proyecto Final de Ingeniería se reescribió de cero. Mejoras visibles:

- **Diseño nuevo en HTML+CSS** con paleta Voltia (azul Francia + amarillo + blanco). Portada con banda superior, ficha del cliente y banda azul de KPIs en una sola página (antes la portada ocupaba una página entera con la mitad vacía).
- **Datos congelados al aprobar la versión**: cada versión del EFP guarda un snapshot del proyecto, pre-ingeniería, trámite UTE y materiales al momento de crearse. Antes, si cambiaba la capacidad del proyecto después de aprobar v1, el PDF de v1 mostraba la nueva capacidad. Ahora cada versión queda anclada a su momento.
- **Fusión real de anexos PDF** al final del documento: los PDFs adjuntos al EFP se appendean al final con sus separadores "ANEXO A / B / C…". Las imágenes y otros archivos quedan listadas como separador (sin contenido fusionable).
- **Toggle "Incluir en PDF"** por cada adjunto: permite excluir adjuntos pesados o irrelevantes del documento final sin tener que borrarlos.
- **Sin código de proyecto ni caso UTE** en el PDF: información administrativa interna que no debería estar en el documento técnico final.
- **Tipografía Inter** sin el bug de ligaduras (antes aparecían "fjos" en lugar de "fijos", "Confguración" en lugar de "Configuración" por un problema del font anterior).
- **Sin páginas en blanco** dispersas (antes había páginas 4-9 con solo header/footer).

#### Materiales — Lista colaborativa entre Ingeniería y Operaciones

La lista de materiales del proyecto pasa de ser "lista que genera Ingeniería" a "lista colaborativa". Operaciones y Ingeniería comparten la misma tabla y pueden marcar cada material con:

- **Estado de compra**: Pendiente · Pedido · Recibido · En stock (pill clickeable que abre dropdown).
- **Tachado** de items completados o cancelados (el texto sigue siendo legible).
- **Color de fondo libre** por fila (6 colores pastel + sin color) para códigos de color personales.
- **Notas internas** por ítem (texto libre hasta 500 caracteres).

La tabla suma:

- **Barra de filtros** con búsqueda libre + dropdowns multi-select de categoría, estado, color, y agregado por (manual vs auto-generado).
- **Chips de filtros activos** en banda amarilla suave, con × individual y "Limpiar todo".
- **Cards de stats arriba**: Total, Pendiente, Pedido, Recibido, En stock. Click en una stat agrega ese estado como filtro.
- **Persistencia de filtros en la URL**: copiá el link de la pantalla con filtros aplicados y compartilo; quien abra ese link ve los mismos filtros.
- **Última edición** en el header: "Última edición Operaciones hace 2h".

La lista también se expone como nuevo **tab "Compras"** en la ficha del proyecto, visible para usuarios con permiso de Ingeniería o de Operaciones — antes solo era accesible desde el módulo Ingeniería.

En el **Consolidador de Materiales** apareció una nueva **"Vista compras"** opcional: muestra el estado agregado de cada ítem (Pendiente / Pedido / Recibido / En stock / Mixto cuando los proyectos difieren) y permite cambiarlo en cascada para TODOS los proyectos del consolidado en un click. Mismo flujo con la acción de tachar.

#### Finanzas — Pendientes refactor

La pestaña Pendientes incorporó 3 mejoras:

- **Materiales agrupados** en 2 niveles colapsables: primero por proyecto, dentro de cada proyecto por categoría de material (Paneles, Inversores, Estructuras, Eléctrica, etc.). Antes los materiales aparecían como filas planas mezcladas entre proyectos.
- **Botón "+ Pendiente manual"** para agendar un gasto o un cobro que viene pero todavía no tiene factura. Toggle Gasto / Cobro, descripción, monto, moneda, fecha esperada y proyecto opcional (obligatorio si es Cobro).
- **Toggle Cobrado / Previsto** en el modal "Registrar cobro" de cada proyecto: si elegís Previsto, el cobro se agenda como pendiente con fecha esperada sin tocar las cuentas.

Los ingresos previstos se muestran en verde con prefijo `+` y los gastos en rojo con `-`. La barra de cards arriba pasó de 4 a 5 totales (sumando "Pendiente manual").

#### Finanzas — Cargar facturas a pagar a proveedor

Hasta ahora solo se podían **registrar pagos** a proveedores; no había forma de **cargar una factura pendiente** sin pagarla. Ahora se carga:

- Desde el listado de Proveedores con botón **"+ Nueva factura a pagar"**.
- Desde la ficha de cada proveedor con botón **"+ Cargar factura"** al lado de "Registrar pago".

La factura queda en estado **"A pagar"** con fecha de vencimiento y aparece automáticamente en la cuenta corriente del proveedor, en Pendientes (con flag rojo si está vencida) y en Flujo de fondos como salida proyectada el día del vencimiento. Cuando llegan pagos parciales o totales, el estado evoluciona y el saldo restante se actualiza en todas las vistas.

#### Ventas — Generador de propuesta comercial integrado

El generador en PDF de la propuesta comercial que antes corría en la PC del vendedor ahora vive dentro de Voltia PM. Desde la ficha del lead se sube el Excel CALCULADORA, se aprieta "Generar" y en pocos segundos queda el PDF listo para descargar.

- Versionado automático por lead (v1, v2, v3…). Cada versión se conserva.
- El PDF también aparece en la sección Adjuntos del lead con el nombre `"Propuesta Comercial Voltia - {Cliente} v{N}.pdf"`.
- Indicador de progreso en vivo en el modal (Pendiente → Procesando → Completado).
- Si el Excel no tiene la hoja "CALCULADORA" o falla por otro motivo, el estado queda como "Falló" con el error puntual.

#### Pendientes — Editar fecha desde la tabla y borrar con impacto en flujo de fondos

- **Click sobre la fecha** de cualquier pendiente (excepto costos fijos) abre un mini editor con calendario · Guardar / Cancelar. Sirve para reagendar una cuota del plan de pagos a otro día, mover una factura a proveedor, etc. — sin abrir el modal completo.
- **Borrar** (ícono ✕ rojo) de un previsto ahora también lo saca del **Flujo de fondos** automáticamente: ya no se sigue contando como ingreso esperado / gasto proyectado. Útil cuando una previsión quedó cubierta por otra compra/cobro real.
- Costos fijos no se pueden reagendar inline (su fecha es el "día del mes" configurado en Administración).

#### Pendientes — Reagendar / sacar materiales proyectados a cualquier nivel

En la tarjeta de **Materiales proyectados** ahora aparecen dos íconos de acción (📅 reagendar · 🗑 sacar) en cada nivel de la jerarquía:

- **Por ítem**: reagenda o saca de Pendientes un único material.
- **Por categoría**: reagenda todos los ítems de "Paneles" (por ejemplo) a una misma fecha, o los saca todos juntos.
- **Por proyecto**: reagenda o saca de Pendientes todos los materiales de un proyecto en un click.

"Sacar de Pendientes" no borra el material del proyecto — solo le quita la **fecha esperada** y deja de aparecer en Pendientes y en el Flujo de fondos. Útil cuando esos materiales ya quedaron cubiertos por una factura real o por otra compra.

#### Arreglos

- **Pendientes**: los botones **"Marcar pagado"** y **"Editar"** ahora funcionan sobre las cuotas del plan de pagos y otros previstos manuales. Marcar pagado abre un cuadrito para elegir fecha real y cuenta destino; al confirmar registra el cobro/pago y la cuota desaparece de Pendientes (queda como movimiento PAGADO en el flujo de fondos). Editar permite cambiar descripción, monto y fecha esperada antes de cobrarla. Antes los dos botones no hacían nada.

### 11 de mayo de 2026 (cuarta parte)

#### Ventas — Generador de propuesta comercial integrado

El generador de propuesta comercial en PDF que antes corría a mano en la PC del vendedor ahora vive dentro de Voltia PM. Desde la ficha del lead, subís el Excel CALCULADORA y la propuesta queda lista en segundos como un PDF descargable.

- Botón **"Generar propuesta comercial"** en la sección Propuestas del lead.
- Modal con upload del Excel + indicador de progreso en vivo (Pendiente → Procesando → Completado).
- El servidor corre el script Python en background (sin bloquear la UI) y genera el PDF con los gráficos de generación mensual y retorno de inversión a partir de los datos de la hoja CALCULADORA.
- **Versionado automático** por lead: la primera generación queda como **v1**, la siguiente **v2**, y así sucesivamente. Cada versión se conserva — no se pisan.
- El PDF generado también aparece en la sección **Adjuntos del lead**, con el nombre *"Propuesta Comercial Voltia - {Cliente} v{N}.pdf"*, así se puede descargar desde ahí o desde la sección Propuestas.
- Si el Excel no tiene una hoja "CALCULADORA" o falla por cualquier otro motivo, el estado de la propuesta queda como **Falló** y muestra el error puntual.

### 11 de mayo de 2026 (tercera parte)

#### Finanzas — Cargar facturas a pagar a proveedor

Hasta ahora solo se podían **registrar pagos** a proveedores; no había forma de **cargar una factura pendiente** sin pagarla todavía. Eso rompía el circuito: la deuda no se reflejaba en Pendientes, no aparecía en Flujo de fondos como salida proyectada, y el saldo del proveedor no era confiable hasta que llegaba el pago.

- **"+ Nueva factura a pagar"** arriba a la derecha en el listado de Proveedores.
- **"+ Cargar factura"** en la ficha de cada proveedor, al lado de "Registrar pago".
- Formulario corto: proveedor (prefijado si entrás desde su ficha), descripción, número de factura (opcional), monto, moneda, fecha de emisión (default hoy), **fecha de vencimiento** (obligatoria) y proyecto (opcional).
- La factura cargada queda en estado **"A pagar"** y aparece automáticamente en:
  - **Cuenta corriente del proveedor** — la deuda total se actualiza al toque.
  - **Pendientes** — con fecha de vencimiento; si la fecha ya pasó queda marcada como **Vencido** en rojo.
  - **Flujo de fondos** — como salida proyectada el día del vencimiento.
- Cuando se aplica un pago parcial, la factura pasa a **"Parcialmente pagado"** y el saldo restante sigue figurando en Pendientes y Flujo. Cuando se cubre el total, pasa a **Pagado** y desaparece de Pendientes y Flujo, pero sigue en el historial del proveedor.

Internamente: la factura es un movimiento de gasto (categoría "Pago a proveedor") con status "A pagar" y fecha de vencimiento; reutiliza todo el sistema existente de pagos parciales y aplicaciones.

### 11 de mayo de 2026 (segunda parte)

#### Finanzas — Pendientes: agrupación por proyecto y manuales

Tres mejoras a la pestaña **Pendientes** para que sea más prolija y más útil:

- **Materiales proyectados agrupados.** Antes los materiales aparecían como una fila por cada ítem (paneles, inversor, cable, etc.), una al lado de la otra, y se mezclaban con los demás pendientes. Ahora se agrupan en una sola tarjeta colapsable con **dos niveles de desplegable**: primero por proyecto (cliente + código) y dentro de cada proyecto por categoría de material (Paneles solares, Inversores, Estructuras, Eléctrica, etc.). Cada nivel muestra su total y la cantidad de ítems vencidos.
- **"+ Pendiente manual".** Nuevo botón arriba a la derecha del filtro. Sirve para agendar un gasto o un cobro que sabés que viene pero todavía no tiene factura ni movimiento. Toggle Gasto / Cobro, descripción, monto, moneda, fecha esperada y proyecto opcional (obligatorio si es Cobro). Los manuales aparecen con un badge **verde "Pendiente manual"** para distinguirlos de los costos fijos y deudas a proveedores.
- **Cobros previstos desde un proyecto.** En la ficha de Cobros de cada proyecto, el modal "Registrar cobro" ahora tiene un toggle **Cobrado / Previsto** arriba. Si elegís Previsto, el cobro se agenda como pendiente (no toca cuentas, no impacta el saldo todavía) con fecha esperada. Cuando llegue el dinero, se marca como pagado desde Pendientes.

Además, los pendientes que son ingresos (cobros previstos) se muestran en verde con prefijo `+`, mientras que los gastos siguen en rojo con prefijo `-`. La tira de tarjetas arriba pasó de 4 a **5 totales** (sumando "Pendientes manuales").

### 11 de mayo de 2026

#### Ventas — Adjuntos en el lead

Cada lead ahora tiene una sección **"Adjuntos"** en el panel lateral. Sirve para guardar todos los archivos que se generan durante el ciclo de venta: calculadoras Excel de cotización, propuestas comerciales en PDF, minutas de visita técnica, datasheets, fotos del sitio, etc.

- **Subir** archivos directamente desde el panel (Excel, PDF, Word, PowerPoint, imágenes, ZIP, CSV).
- **Descargar** o **eliminar** cualquier archivo cargado.
- Cuando el lead se cierra como ganado y se convierte en proyecto, **todos los adjuntos del lead se copian automáticamente al proyecto** (los originales se preservan en el lead).

### 10 de mayo de 2026 (sexta parte)

#### Finanzas — Movimientos: vista anual por defecto, sin paginación

La pestaña Movimientos ahora arranca mostrando **todo el año en curso** en una sola vista. Hay un toggle "Año en curso" / "Por mes" para alternar; el filtro de mes solo aparece cuando elegís "Por mes". La paginación de a 20 desapareció: la tabla muestra todos los movimientos juntos y scrolleás con la página normal. Arriba aparece un contador del estilo "N movimientos en 2026" para saber cuántos hay.

#### Finanzas — Movimientos: editar y eliminar con botones visibles

En la columna de Acciones ahora aparecen botones claros con etiqueta ("Editar" + lápiz, y el ícono de papelera con borde rojo al hacer hover). Los pagos a proveedores muestran "Editar en Proveedores" porque su edición vive en la cuenta del proveedor, no en Movimientos.

#### Finanzas — Flujo de fondos: gráfico a escala temporal

El gráfico ahora usa **escala de tiempo real** en el eje X: cada día ocupa el mismo ancho, sin importar cuántos eventos haya. Antes la mitad derecha (futuro) se veía estirada porque tenía más eventos que la izquierda (pasado). Ahora los 3 meses de pasado y los 3 meses de futuro ocupan la misma anchura visual, y la línea vertical "Hoy" queda exactamente en el centro.

### 10 de mayo de 2026 (quinta parte)

#### Finanzas — Flujo de fondos con histórico

El gráfico de Flujo de fondos ahora muestra **6 meses** en pantalla: los **últimos 3 meses reales** (saldo de cuentas día a día, según los movimientos pagados) y los **próximos 3 meses proyectados**.

- La curva del pasado se dibuja en **gris azulado**, más fina, indicando que es contexto histórico.
- La curva de la proyección se mantiene en **azul Voltia**, más gruesa, porque es lo que importa para decidir.
- Una **línea vertical punteada con la etiqueta "Hoy"** marca el día actual en el medio del gráfico.
- El punto donde termina el pasado y arranca la proyección coincide en valor: la transición es continua.
- La zona roja sigue apareciendo solo en la parte futura cuando el saldo proyectado cae a negativo (no marca pasado).
- Abajo del gráfico hay una leyenda con tres ítems: "Pasado (real)", "Proyección (futuro)" y "Saldo bajo / negativo".

### 10 de mayo de 2026 (cuarta parte)

#### Finanzas — Pestaña Pendientes (nueva)

Nueva pestaña entre **Movimientos** y **Proveedores** que centraliza **todo lo que está comprometido a pagar y todavía no se pagó**, en una sola lista. Las pestañas de Finanzas pasan a ser **siete**: Movimientos, Pendientes, Proveedores, Cobros, Flujo de fondos, Estado de resultados, Cuentas.

Lo que se ve en Pendientes:

- **Costos fijos del mes** que aún no se pagaron (alquiler, contador, internet, etc), según los configurados en Administración → Costos fijos.
- **Materiales proyectados de obras** que tienen fecha esperada de compra cargada desde Ingeniería.
- **Deuda a proveedores** (facturas pendientes o parcialmente pagadas).
- **Otros compromisos** manuales (sueldos, comisiones — los movimientos en estado "A pagar" sin proveedor).

Cada fila muestra fecha esperada, descripción, origen, categoría y monto. Los **vencidos** aparecen en rojo arriba con la nota "Vencido". Hay filtros por tipo de pendiente, por proyecto y por proveedor, y cuatro tarjetas de resumen arriba con los totales de cada tipo.

Cada pendiente tiene su botón **"Marcar pagado"** que actúa según el origen: para los compromisos manuales (sueldos / comisiones) los pasa a estado Pagado directo; para los de proveedor abre la cuenta del proveedor; para los costos fijos abre el formulario de nuevo movimiento; para los materiales abre el módulo de Ingeniería del proyecto.

#### Finanzas — Movimientos: editar y eliminar

Cada fila de Movimientos ahora tiene **dos botones a la derecha**: lápiz para editar y papelera para eliminar.

- **Editar** abre un modal con todos los campos modificables: descripción, categoría, monto, moneda, cuenta, fecha, proveedor (si es gasto) y proyecto. No se puede cambiar el tipo (ingreso/gasto) ni el estado.
- **Eliminar** pide confirmación y hace borrado seguro (soft-delete): el movimiento desaparece de la lista pero no se pierde de la base, así que en caso de error se puede recuperar.
- Los pagos a proveedores no se editan desde acá: hay que hacerlo desde la cuenta del proveedor.

#### Finanzas — Movimientos: solo lo ejecutado

La pestaña Movimientos ahora muestra **solo movimientos en estado Pagado**. Los compromisos pendientes (sueldos, comisiones, costos fijos no pagados, etc) dejan de mezclarse acá y viven en la nueva pestaña Pendientes.

### 10 de mayo de 2026 (tercera parte)

#### Finanzas — Pestaña Estado de resultados

La pestaña Estado de resultados deja de ser un placeholder y muestra el P&L real del período elegido (mensual, trimestral o anual), con desplegables por categoría para ver el detalle de cada ítem.

- **Selector de período** arriba: Mensual / Trimestral / Anual + selector del mes / trimestre / año correspondiente.
- **Ingresos en verde** + **egresos por categoría en rojo** (Costos fijos, Costos variables, Salidas por proyecto, Pago a proveedores, Compras de stock, Otros). Las categorías sin movimientos en el período no se muestran.
- **Click en una categoría** abre el detalle: cada ítem con fecha, descripción, proveedor o cliente, y monto.
- **Salidas por proyecto** se agrupan automáticamente por proyecto: click en el proyecto muestra los movimientos individuales adentro.
- **Costos fijos** muestran el nombre del costo fijo predefinido (no la descripción del movimiento), si está vinculado.
- **Resultado** abajo: ingresos − egresos. Verde si positivo, rojo si negativo.
- **Rentabilidad** en porcentaje (resultado / ingresos × 100).
- Los movimientos en USD se convierten a UYU usando el tipo de cambio actual para que todos los totales estén en una sola moneda. Se excluyen los ajustes de conciliación porque no son operación.

### 10 de mayo de 2026 (segunda parte)

#### Finanzas — Pestaña Flujo de fondos

La pestaña Flujo de fondos deja de ser un placeholder y muestra una proyección del saldo a 3 meses con un gráfico de evolución y la tabla detallada de cada evento futuro.

- **Gráfico de línea** que arranca en el saldo actual y va sumando ingresos / restando egresos en orden cronológico. Cuando el saldo cae debajo de cero, aparece una **zona roja** y un cartel de alerta arriba.
- La tabla lista cada evento futuro: costos fijos pendientes, materiales proyectados de obras, deuda pendiente a proveedores y cobros pendientes de clientes. Cada fila muestra fecha, descripción, tipo y el impacto en el saldo (positivo o negativo).
- **Las fechas son editables** desde la tabla (click en la fecha) para reflejar cuándo realmente se va a pagar o cobrar. La fecha de los costos fijos no es editable acá: se modifica desde Administración → Costos fijos.
- Las filas que llevan el saldo a negativo se marcan con un fondo rojo claro y la nota "saldo en rojo".

#### Materiales proyectados de Ingeniería ya no ensucian Movimientos

Los materiales proyectados de un proyecto (los que aparecen al elegir una "fecha esperada de compra" desde Ingeniería) ya **no generan movimientos PREVISTO** en Finanzas. La fecha tentativa vive ahora directamente en el material y alimenta el flujo de fondos sin pasar por la pestaña Movimientos.

- Si tenías 14 PREVISTO de proyectos en la pestaña Movimientos, **ya no aparecen** ahí.
- Los materiales proyectados **siguen visibles** en el módulo de Ingeniería con su fecha prevista, igual que antes.
- Cambiar la fecha del material desde el flujo de fondos actualiza el gráfico y la tabla en tiempo real.

### 10 de mayo de 2026

#### Finanzas — Costos fijos predefinidos

Nueva pestaña en Administración → **Costos fijos** para pre-cargar gastos que se repiten (alquiler, contador, seguros, sueldos, etc).

- Cada costo fijo tiene nombre, día del mes en que se paga y periodicidad: mensual, bimensual (con selector de meses pares o impares) o anual (con selector del mes del año).
- En el formulario de "Nuevo movimiento", al elegir categoría "Costo fijo" aparece un selector con los costos fijos que **faltan pagar este mes**. Al elegir uno, se autocompleta la descripción (no el monto, que siempre lo cargás vos).
- Si ya pagaste el alquiler este mes, no vuelve a aparecer hasta el mes que viene. Para los bimensuales, solo aparece en los meses que corresponden. Para los anuales, solo en el mes del año configurado.
- El selector muestra como referencia el último monto pagado de cada costo fijo, así sabés el orden de magnitud al cargar el monto real.

#### Finanzas — Pestaña Proveedores

La pestaña Proveedores deja de ser un placeholder y muestra la lista completa de proveedores con su saldo actual y filtros (activos / todos / inactivos, búsqueda por nombre/RUT/contacto). Click en un proveedor abre la cuenta corriente con el historial de facturas y pagos.

#### Finanzas — Pagos a proveedores aparecen en Movimientos

Los pagos registrados a proveedores ahora aparecen automáticamente en la pestaña **Movimientos** como salidas ejecutadas, junto al resto de los movimientos del mes. Antes solo se veían dentro de la cuenta corriente del proveedor.

### 9 de mayo de 2026

#### Finanzas — pestañas y rediseño de Movimientos

La pantalla principal de finanzas pasa a tener seis pestañas: **Movimientos**, Proveedores, Cobros, Flujo de fondos, Estado de resultados y Cuentas. La navegación entre las distintas vistas ahora vive en un solo lugar.

- **Movimientos** se rediseñó para mostrar solo entradas y salidas ya ejecutadas (estado Pagado), más los pendientes sin proveedor (sueldos, comisiones). Los previstos de ingeniería y los a-pagar con proveedor dejan de aparecer en esta vista.
- Arriba de la lista quedan dos tarjetas con el saldo actual en pesos uruguayos y en dólares.
- El formulario de "Nuevo movimiento" se simplificó: ya no pregunta si el movimiento corresponde a una factura existente o a un proyectado.
- Las pestañas Proveedores, Flujo de fondos y Estado de resultados muestran por ahora un placeholder "Próximamente disponible". Cuentas y Cobros funcionan igual que antes, ahora dentro del nuevo layout.

## v5.2

### 6 de mayo de 2026

#### Proyecto Final de Ingeniería — borrador más conciso y rápido

El borrador con IA ahora apunta a un PDF de 6 a 10 páginas, no de 19. Cada sección tiene un alcance acotado, no se repite información entre secciones, y la sección Anexos pasa a ser solo una lista de archivos adjuntos disponibles (sin redactar contenido técnico ahí, como hacía antes).

- **Asignación clara por sección**: los datos del cliente van en Datos generales, los datos técnicos en Resumen ejecutivo, el techo y la instalación existente en Análisis del sitio, etc. La misma información no se repite en dos lugares.
- **Más rápido**: la generación bajó de ~4 minutos a ~75 segundos en proyectos típicos.
- **Más barato por borrador** (alrededor de un tercio del costo anterior).
- **Checklist por sección** ahora tiene un máximo de 5 ítems para mantenerla accionable.

#### Arreglos

- **Generador de borrador del Proyecto Final de Ingeniería** ahora funciona en proyectos con muchos materiales o varias visitas técnicas. Antes la IA fallaba con un error genérico cuando la respuesta era muy larga (cliente con 60+ materiales o 2+ visitas). Ahora se completa correctamente y genera las 7 secciones aunque la respuesta sea grande.

#### Aviso a Operaciones cuando Ingeniería termina

Cuando un proyecto sale de la etapa de Ingeniería, ahora avisa automáticamente al equipo de Operaciones (y a los administradores) para que puedan empezar a planificar la instalación. El aviso llega tanto por la campanita de la app como por email.

- **Dos formas de disparar el aviso**: marcar la etapa "Ingeniería" del proyecto como Completada, o aprobar el Proyecto Final de Ingeniería desde su página dedicada (botón "Aprobar" arriba a la derecha, junto al estado).
- **Una sola vez por proyecto**: aunque se den las dos cosas (marcar la etapa Y aprobar el Proyecto Final), cada destinatario recibe el aviso una sola vez. Si se vuelve atrás y se vuelve a marcar como completada, no se duplica.
- **Estado visible del Proyecto Final**: ahora aparece un cartelito con el estado actual (Borrador / En revisión / Aprobado / Archivado) junto al título de la página del Proyecto Final. Si ya está aprobado, el botón cambia a "Reabrir" para volver a borrador.
- **Permisos**: solo INGENIERIA y ADMIN pueden aprobar o reabrir.

### 5 de mayo de 2026

#### Nueva herramienta: Proyecto Final de Ingeniería

Nueva herramienta dentro del workspace de Ingeniería para que el proyectista arme el documento integrador del proyecto, combinando la pre-ingeniería + visitas técnicas + criterio profesional. La IA arma el primer borrador y el proyectista lo refina inline.

- **7 secciones predefinidas**: datos generales, resumen ejecutivo del sistema, análisis del sitio, equipamiento y materiales, diseño eléctrico, diseño mecánico/instalación física, anexos.
- **Generación inicial con IA**: modal pide qué visita(s) usar como base. La IA recibe pre-ingeniería + datos del proyecto + materiales presupuestados + visitas seleccionadas y devuelve las 7 secciones en markdown + una checklist de "qué verificar" por sección.
- **Edición inline estilo Notion**: cada sección tiene botón Editar/Guardar. Auto-save con debounce de 1.5s mientras se escribe — no hay que clickear "Guardar" cada vez.
- **Versionado completo**: botón "Regenerar con IA" crea v2, v3… Botón "Snapshot" duplica la versión actual sin IA (útil antes de hacer cambios grandes). Selector de versiones para volver a versiones anteriores en lectura.
- **Cambios respecto a versión anterior** que la IA destaca arriba del documento.
- **Anexos extras**: subir imágenes/PDFs (datasheets, planos, fotos adicionales) que aparecen al pie y también en Documentos del proyecto.
- **Exportar PDF profesional**: botón descargar PDF con header (logo Voltia + datos del proyecto + versión), las 7 secciones renderizadas, listado de anexos al final.
- **Permisos**: solo INGENIERIA y ADMIN pueden editar/regenerar. Otros roles del módulo pueden ver.
- **Acceso**: tarjeta "Proyecto Final de Ingeniería" en el workspace `/ingenieria/proyecto/:id` que abre la página dedicada `/ingenieria/proyecto/:id/proyecto-final`.

### 4 de mayo de 2026

#### Visita técnica — botón flotante de audio + UX más simple

- **Botón flotante amarillo de audio** estilo WhatsApp en la esquina inferior derecha. Tap para arrancar (botón pasa a rojo y muestra duración pulsante), tap para detener. Después aparece un dialog con preview, descripción opcional y guardar/descartar.
- Aparece **sólo en pantallas de proyecto** (`/projects/:id` y `/projects/:id/visita/:id`). En otras pantallas no aparece para no abultar.
- El botón "Audio" del bloque superior salió — el FAB lo reemplaza. Quedan **Foto** y **Nota** en el panel.
- En la página de visita el botón **"Regenerar informe"** salió. El informe se actualiza solo con cada input nuevo (audio cuando termina la transcripción, foto/nota inmediato). El indicador "Transcribiendo N audios…" muestra cuándo está procesando.

#### Informe sin contexto del pre-proyecto

La IA ahora genera el informe **sólo** con la info que el operario relevó (audios, fotos, notas). No usa más datos previos del proyecto (capacidad, dirección, materiales pre-cargados, etc.). El proyectista hace la integración después manualmente en el módulo Ingeniería con el informe consolidado.

#### Un informe por visita (update in-place)

Cada visita tiene **un solo informe** que se va completando con cada regeneración. Antes generaba múltiples versiones (v1, v2, v3…) y aparecía un selector. Ahora hay un único informe por visita y se va actualizando — más simple de leer y consistente con "el informe se actualiza solo".

## v5.1

### 4 de mayo de 2026

#### Nueva herramienta: Visita técnica con IA

Nueva herramienta dentro de la etapa Ingeniería del proyecto. El operario, durante la visita al sitio, carga **audios, fotos y notas** desde el panel "Visita técnica" del StageDrawer del proyecto. La IA arma automáticamente un informe estructurado en 7 secciones (datos del sitio, acometida, techo, espacio para inversor, canalizaciones, observaciones, próximos pasos).

- **Una visita = un operario en un proyecto.** Cada operario tiene su propia visita activa por proyecto. Los inputs se autoacumulan ahí (si pasaron más de 7 días desde el último input, se crea una visita nueva). Los demás operarios ven la visita en lectura, no se mezclan los datos.
- **Audios grabados en el browser** (`MediaRecorder`) — funciona en Chrome desktop, Android, iOS Safari (mp4/m4a). Se transcriben automáticamente con OpenAI Whisper en español.
- **Auto-regeneración del informe**: cada vez que el operario suma un input, el informe se actualiza solo. No hay que clickear "Generar". Si hay audios todavía transcribiendo, se espera a que terminen.
- **Vista previa del PDF** del informe + descarga.
- **Botón en el Dashboard del operario** ("Cargar entrada de visita técnica") como atajo grande arriba de todo. Lleva a `/visita-rapida` que pide elegir el proyecto y muestra los 3 botones (Audio / Foto / Nota) directos.
- **Versionado**: cada regeneración crea una versión nueva del informe. Selector para ver versiones anteriores.
- **Permisos finos**: el operario edita/borra sólo SUS inputs. Los demás (incluido el proyectista) ven en lectura. ADMIN puede todo.

#### Módulo Ingeniería — accordion "Visita técnica (operario)"

Nueva entrada read-only en el workspace `/ingenieria/proyecto/:id`. El proyectista ve la lista de visitas que el operario cargó desde el StageDrawer del proyecto, con nombre, fecha, cantidad de inputs y versión del informe. Click "Abrir" lleva al detalle de la visita.

#### Borrar visita o input limpia los archivos del proyecto

Al borrar una visita técnica completa o un input individual (audio/foto), el `FileAttachment` correspondiente del proyecto se soft-deletea y el archivo físico se borra del storage. Antes quedaban huérfanos en la sección Documentos del proyecto.

## v5.0

### 3 de mayo de 2026

#### Módulo Ingeniería — workspace técnico por proyecto

Nuevo módulo accesible desde la barra superior (sólo roles con permiso `INGENIERIA`). Incluye:

- **Dashboard** en `/ingenieria` con estadísticas (proyectos en cola / en proceso / completados últimos 30 días) y listado de proyectos del módulo con filtros y búsqueda.
- **Workspace por proyecto** en `/ingenieria/proyecto/:id` con sidebar lateral persistente (mismo patrón que el sidebar de Proyectos), header con datos del cliente, indicador de estado y progreso de la etapa, y herramientas técnicas en formato accordion (2 columnas, una sola abierta a la vez).
- **Sección "Documentos técnicos generados"** que junta los PDFs producidos por las herramientas y permite descargarlos. La misma sección aparece en formato compacto en el StageDrawer del proyecto, accesible para roles que ven el proyecto pero no entran al módulo.

#### Generador de unifilar (inline)

El generador de unifilares dejó de ser una página dedicada y vive ahora dentro del workspace de Ingeniería como herramienta inline:

- Lista de las 3 últimas versiones generadas en la card abierta, con botones Ver / Duplicar / Descargar SVG / Descargar PDF / Eliminar.
- Si hay más de 3 versiones, botón "Historial completo" que abre un modal con la tabla entera + búsqueda por etiqueta + filtro por tipo de red.
- Modal "+ Nueva versión" más ancho (1400px) con form a la izquierda y preview SVG en vivo a la derecha (debounce 300ms).
- Cada versión genera y guarda automáticamente el PDF como documento técnico del proyecto. Las versiones anteriores quedan en el historial pero el "PDF vigente" en Documentos se reemplaza automáticamente.

#### Lista de materiales — movida al módulo Ingeniería

La lista de materiales ya no aparece en el StageDrawer del proyecto. Se accede desde la herramienta correspondiente del workspace de Ingeniería (mismo componente, misma funcionalidad: agregar ítems, generar previstos, exportar PDF con/sin precios). Los PDFs exportados se versionan independientemente para "con precios" y "sin precios" — cada modo mantiene su secuencia.

#### Cálculos estructurales (triángulos) — movida al módulo

La calculadora de triángulos isósceles de aluminio también dejó el StageDrawer y vive ahora como herramienta independiente del workspace. El botón principal del modal pasó a llamarse **"Generar PDF y guardar"** para reflejar mejor lo que hace (genera el PDF y queda como documento técnico del proyecto). Cada cálculo nuevo soft-deletea la versión anterior del PDF.

#### Pre-ingeniería ("Resumen Técnico")

Nueva herramienta que reemplaza el documento que se hacía a mano en una herramienta externa antes de cada proyecto. Genera un PDF A4 con:

- Página 1: formulario fijo con datos del cliente, datos del sitio (tipo de techo, info, altura), datos eléctricos (9 campos texto libre para soportar multi-instalación), tipo de red (multi-select para casos como COVITEJA con mono + trifásico), notas adicionales.
- Páginas siguientes: una foto por página (subidas por el usuario, ya anotadas externamente).

Funcionalidades:

- **Pre-rellenado desde una versión de unifilar existente** — botón que mapea automáticamente la sección/calibre de cables, cantidad de paneles, modelo de inversor, tipo de red, etc.
- **Datos del cliente pre-rellenados** desde el proyecto (nombre, dirección, ciudad concatenada con provincia, celular).
- **Subida de fotos múltiples** con thumbnails, etiquetas opcionales por foto, reordenamiento por flechas, eliminar.
- **Vista previa del PDF** generado embebida en la app (mismo patrón que unifilar).
- Versionado 1:N inmutable: cada versión queda guardada con su snapshot completo. El PDF "vigente" en Documentos se reemplaza al crear v+1.

#### Extracción de minuta con IA

Si tenés la minuta del relevamiento técnico-comercial en PDF (la que genera el bot externo a partir del audio), la podés subir al modal de "Nueva pre-ingeniería" y la IA pre-rellena los campos del formulario automáticamente:

- Tipo de techo (chapa / hormigón / tejas / isopanel / otro)
- Info techo (texto multi-línea con dimensiones, sectores, interferencias)
- Cantidad de paneles, inversor, líneas DC, longitudes de cables (cuando aparecen)
- Tipo de red (mono / trifásica 230 / trifásica 400)
- Notas adicionales (pendientes, aspectos comerciales, plazos)

Cada campo extraído se marca con un ícono ✨ al lado del label. Cuando lo editás, el ícono desaparece. Validado contra 3 minutas reales (Diego Trías, Percovich, Edgar Valdés) con 100% de acierto en los campos críticos. Modelo: Claude Haiku 4.5. Latencia ~5 segundos. Costo aproximado USD 0.005 por minuta.

#### Consolidador de materiales

Nueva herramienta global del módulo Ingeniería (vive en el dashboard, no en un proyecto específico). Pensada para el comprador: seleccionás los proyectos a comprar y obtenés:

- **Vista en pantalla** con tabla agrupada por categoría: filas = ítems, columnas = una por proyecto + TOTAL.
- **PDF descargable** (A4 horizontal si 4+ proyectos, vertical si 2-3) con el mismo layout.
- **Excel descargable** (XLSX) listo para editar y usar en compras: encabezados de categoría como filas separadoras, totales en negrita, auto-width.

Sólo se ofrecen como opciones los proyectos que tienen lista de materiales cargada. Las versiones generadas quedan en un historial con descarga + "Ver tabla" + Eliminar. La advertencia visible: agrupa por ID exacto del catálogo, así que dos ítems con el mismo nombre pero distinto ID no se unifican.

#### StageDrawer del proyecto — limpieza

La etapa Ingeniería del StageDrawer ya no muestra la lista de materiales ni el botón de la calculadora — ambos viven en el workspace del módulo. Lo que sigue ahí: subetapas, notas, archivos, comentarios, sección "Trabajar en este proyecto" (botón "Abrir workspace") y sección "Documentos técnicos generados" en lectura.

#### Documentos del proyecto — badge y filtros

- Badge azul **"Ingeniería · Unifilar v3"**, **"Ingeniería · Materiales v2 (con precios)"**, **"Ingeniería · Triángulos v1"**, **"Ingeniería · Pre-ingeniería v4"** según el origen del documento.
- Filtro por origen agregado al sidebar de Documentos.
- Lock inmutable: los documentos generados desde herramientas no se editan ni eliminan desde Documentos del proyecto — la única forma de "reemplazar" es generar una versión nueva desde la herramienta (que soft-deletea la anterior automáticamente).

## v4.9

### 1 de mayo de 2026

#### Trámites UTE — fix en cálculo de tiempos

La fecha de "Caso abierto" (acción intermedia de UTE) ya no le sumaba días por error a Voltia en la cola del proceso. En trámites con la última acción siendo "Caso abierto" sin más actividad, el tiempo en espera ahora se atribuye correctamente a UTE. Caso testigo: Fernando Ciaran (99 días en espera) ahora figuran del lado de UTE, no nuestro.

#### Métricas — "Duración real por etapa" arreglada

La sección dejó de estar vacía:
- Se removió el filtro `project.status = COMPLETED` que excluía todas las etapas (ningún proyecto está marcado COMPLETED).
- La duración por etapa se calcula on-the-fly desde `actualEndDate - actualStartDate` (la columna persistida estaba siempre nula).
- Se agregó soporte de filtros año/trimestre del PeriodSelector que ya tenía el resto de la página.

#### Métricas /overview — "proyectos completados"

Ahora considera proyectos cuyo stage OPERACIONES está en estado COMPLETED (antes usaba `project.status = COMPLETED`, que ningún proyecto tiene, dejando el KPI en 0).

#### Nueva sección "Evolución de tiempos UTE"

Vive abajo del bloque UTE en `/metricas/ute`.

**3 tarjetas grandes lado a lado**: Tiempo Total · Tiempo Voltia · Tiempo UTE.
- Cada tarjeta = un gráfico de barras con los últimos 8 trimestres con datos.
- Valor = promedio por trámite finalizado en ese Q (cada trámite aporta una observación: suma de todas sus etapas Voltia / UTE / total).
- Se llenan al cerrar el primer trámite; mientras tanto el resto de la sección sigue mostrando datos por etapa.

**Grilla de mini-gráficos por etapa**: una mini-card por cada etapa cerrada (Caso abierto, Consulta aprobada, Solicitud enviada, Proyecto aprobado, Docs 1, Ensayos, Docs 2, Finalizado, etc.).
- Cada etapa cerrada se asigna al Q de su fecha de cierre (no requiere que el trámite esté finalizado).
- Color según responsable: verde Voltia, naranja UTE.
- Muestra promedio del último Q + total de observaciones acumuladas.

**Indicador de tendencia**: cada gráfico tiene un badge con flecha y % vs promedio últimos 4 Q.
- Verde + flecha hacia abajo = MEJORANDO (los tiempos bajan).
- Roja + flecha hacia arriba = EMPEORANDO.
- Gris = ESTABLE (cambio dentro de ±5%).

**Detalles visuales**: la barra del Q actual va con color full opacity; las anteriores con 50% para resaltar el período en curso. Tooltip con contraste arreglado y conteo de trámites.

## v4.8

### 30 de abril de 2026

#### Asistente IA con Text-to-SQL (Claude Sonnet 4.5)

Nueva integración que permite a usuarios **ADMIN** consultar datos de la app en lenguaje natural. El asistente genera SQL con Claude, lo valida contra reglas de seguridad, lo ejecuta con un usuario PostgreSQL de sólo lectura, y resume el resultado en lenguaje natural.

**UI**:
- Botón flotante violeta abajo a la derecha (sólo visible para ADMIN).
- Click → panel lateral con sugerencias iniciales y chat conversacional.
- Cada respuesta tiene un collapsible "Ver SQL" con: SQL ejecutado, cantidad de filas, costo USD y duración.
- Mensajes diferenciados (usuario / IA / error).

**Seguridad (defensa en capas)**:
- Sólo usuarios con `role.name = ADMIN` pueden invocar el endpoint.
- Validador de SQL en backend rechaza: queries no-SELECT, palabras prohibidas (INSERT/UPDATE/DELETE/DROP/ALTER/etc.), tablas sensibles (`audit_logs`, `ai_queries`, `ai_rate_limits`, `file_attachments`, etc.), múltiples statements.
- Ejecución vía usuario PG `voltia_readonly` con `GRANT SELECT` exclusivamente sobre tablas no sensibles. Doble cinturón.
- LIMIT 500 forzado automáticamente si el SQL no tiene uno.

**Rate limiting**:
- Modelo `AIRateLimit` por usuario: default 100 consultas/día y USD 50/mes.
- Cada `/ai/ask` registra una `AIQuery` con status (SUCCESS / SQL_INVALID / EXECUTION_ERROR / RATE_LIMIT_EXCEEDED / AI_ERROR), tokens consumidos, costo, duración y SQL generado para auditoría.

**Endpoints nuevos**:
- `GET /api/ai/status` — chequeo si está habilitado.
- `POST /api/ai/ask` — pregunta + respuesta + SQL.
- `GET /api/ai/history` — historial del usuario.
- `GET /api/ai/logs` — historial global (admin).

**Costos esperados**: ~USD 0,015 por consulta. Modelo: Claude Sonnet 4.5.

**Configuración del server**:
- `ANTHROPIC_API_KEY` en `.env` de la raíz del repo.
- `DATABASE_URL_READONLY` para el pool readonly (configurado en `docker-compose.yml`).
- Migración Prisma `20260430190912_add_ai_assistant` aplicada.

#### Indicador visual: Movement pagado vía Payment

En la lista de movimientos, cuando un GASTO PAGADO está totalmente cubierto por Payment(s) aplicados, el saldo USD aparece en gris itálica y el badge cambia a "Pagado vía pago" (en lugar de "Pagado"). Tooltip aclara que esa fila es informativa: el descuento real ocurrió en el Payment asociado.

El detail panel del Movement ahora incluye un panel azul cuando aplica, con botón "Ver pago asociado →" que abre directamente el panel del Payment.

#### Detalle de movimientos en P&L mensual

En la vista mensual de `/finanzas/resultado`, cada categoría dentro de Ingresos / Costos directos / Gastos operativos ahora se puede expandir para ver la lista de movimientos individuales que la componen (fecha, descripción, proyecto/proveedor, cuenta, monto USD). Cada categoría es expandible independientemente. Click en una fila tipo Pago abre el panel lateral del Payment.

---

## v4.7

### 30 de abril de 2026

#### Estado de resultado (P&L) mensual y anual

Nueva sección `/finanzas/resultado` con tabs **Mensual** y **Anual**.

**Tab Mensual** — Estructura contable formal:
- INGRESOS BRUTOS → expandible por categoría → cada categoría expandible con la lista de movimientos individuales (fecha, descripción, proyecto/proveedor, cuenta, monto USD).
- (-) COSTOS DIRECTOS (PROYECTO_SALIDA + PAGO_PROVEEDOR + COMPRA_STOCK + Payments del mes).
- = MARGEN BRUTO (con %).
- (-) GASTOS OPERATIVOS (todo lo demás).
- = RESULTADO NETO destacado en bloque emerald/red según signo.
- Mini bar chart de los 12 meses + tabla de evolución mensual con totales del año.
- Click en una fila tipo Pago → abre el panel lateral del Payment.
- Click en la descripción de un movement → lleva a la lista filtrada.

**Tab Anual** — Planilla mes a mes (estilo P&L formal):
- Tabla con 14 columnas (Concepto + Ene-Dic + Total).
- Secciones con bandas de color: emerald (ingresos), red (directos), amber (operativos), azul (margen bruto / resultado neto).
- Sticky vertical (header) y horizontal (primera columna "Concepto").
- Convención contable: ingresos sin paréntesis, costos/gastos en `(USD x)`, ceros como `—`.
- Click en cualquier celda → abre `/finanzas/movimientos` con los filtros de mes + categoría + tipo pre-aplicados (auditable).

**Reglas de cálculo** (aplican a ambas vistas):
- Solo plata real: INGRESOS cobrados + GASTOS PAGADOS + Payments.
- Excluye `categoria=AJUSTE_CONCILIACION` (correcciones contables, no operativas).
- Anti-doble-conteo: GASTOS con PaymentApplication activa los cuenta el Payment correspondiente.
- Conversión USD vía TC del movimiento o último TC global como fallback.
- Vista anual: una sola query del año, agrupación en memoria por mes y categoría (eficiente).

#### Aplicar saldo a favor del proveedor a una factura nueva

Cuando un proveedor tiene Payments con saldo sin aplicar (saldo a favor), al cargar una factura A_PAGAR / PARCIALMENTE_PAGADO el sistema detecta automáticamente y ofrece aplicar ese saldo a la factura nueva.

- Modal post-save con total disponible, monto aplicable, saldo después, detalle FIFO colapsable.
- Aplicación FIFO (más antiguo primero) en una transacción atómica. Recalcula status de la factura.
- No afecta saldo de cuentas: redistribuye Payments existentes.
- Botón "Aplicar saldo a favor (X)" también en el detail panel del movement.

#### Lista de movimientos unificada (Movements + Payments)

`/finanzas/movimientos` ahora incluye Payments mezclados cronológicamente con los Movements. Cada fila lleva un `_type` discriminador.

- Filas tipo Pago tienen badge violeta "Pago", método y count de aplicaciones. Click abre el panel del Payment.
- Anti-doble-conteo en el saldo: GASTOS con PaymentApplication no descuentan dos veces.
- Nuevos filtros: `rowType` (MOVEMENT/PAYMENT/ALL), `supplierId`, `accountId`.

#### Cobros por proyecto (`/finanzas/cobros`)

Espejo de Proveedores pero por cliente/proyecto. Lista todos los proyectos con presupuesto vs cobrado, estado de cobranza (Pendiente / Parcial / Completo / Excedido / Sin presupuesto), KPIs globales y filtros de búsqueda. Detalle por proyecto con KPIs por moneda, tabs de cobros y estado de cuenta, y botón "Registrar cobro" pre-cargado.

#### Fix doble conteo en facturas parcialmente pagadas

El saldo final proyectado descontaba el monto total de la factura aunque parte ya estuviera pagada vía Payment, generando doble descuento. Ahora se proyecta solo `saldoPendiente = monto - Σ applications`. La lista muestra saldoPendiente como monto principal con el monto factura como subtítulo. El detail panel tiene un panel destacado de 3 columnas: Factura / Pagado / Pendiente.

---

## v4.6

### 30 de abril de 2026

#### Aplicar saldo a favor del proveedor a una factura nueva

Cuando un proveedor tiene Payments con saldo sin aplicar (saldo a favor), al cargar una factura A_PAGAR / PARCIALMENTE_PAGADO el sistema detecta automáticamente y ofrece aplicar ese saldo a la factura nueva.

- **Detección**: post-save de la factura, el sistema consulta `GET /finance/suppliers/:id/saldo-a-favor` y, si hay > 0, abre el modal.
- **Modal**: muestra total disponible, monto aplicable (= mín entre saldo a favor y saldo pendiente de la factura), saldo después, detalle FIFO colapsable con cada Payment con saldo sin aplicar.
- **Aplicación FIFO**: el endpoint `POST /finance/movements/:id/apply-saldo-a-favor` recorre los Payments del proveedor (ordenados por fecha ASC) y crea PaymentApplications hasta cubrir la factura o agotar el saldo. Recalcula el status de la factura (PAGADO o PARCIALMENTE_PAGADO).
- **No afecta saldo de cuentas**: sólo redistribuye Payments existentes, no mueve plata.
- **También disponible desde el detail panel** del movement (botón "Aplicar saldo a favor (X)" en gastos A_PAGAR/PARCIALMENTE_PAGADO con saldo a favor del proveedor).

#### Lista de movimientos unificada (Movements + Payments)

La lista `/finanzas/movimientos` ahora muestra Movements y Payments mezclados cronológicamente. Cada fila tiene un discriminador `_type`:
- **MOVEMENT**: factura/gasto/ingreso normal.
- **PAYMENT**: pago a proveedor, badge violeta "Pago" + descripción "Pago a {proveedor}", muestra el método y la cantidad de aplicaciones. Click abre el detail panel del Payment.
- Anti-doble-conteo en el saldo: si un GASTO tiene PaymentApplication activa, su monto NO se descuenta del saldo (sólo lo hace el Payment).
- Filtros: nuevo `rowType` (MOVEMENT/PAYMENT/ALL), supplierId/accountId aplicados a ambos tipos. Los filtros movement-only (categoria/status/projectId) excluyen Payments automáticamente.

#### Cobros por proyecto (`/finanzas/cobros`)

Espejo de Proveedores pero por proyecto. Lista todos los proyectos con su presupuesto vs lo cobrado, estado de cobranza (Pendiente / Parcial / Completo / Excedido / Sin presupuesto) con badges de color, KPIs globales (presupuestado / cobrado / pendiente / a favor cliente), búsqueda por cliente o código. Detalle por proyecto con KPIs por moneda (USD / UYU), tabs de cobros y estado de cuenta, y botón "Registrar cobro" con modal pre-cargado (crea un INGRESO `PROYECTO_ENTRADA`).

#### Fix: doble conteo en facturas parcialmente pagadas

El saldo final proyectado descontaba el monto total de cada factura A_PAGAR / PARCIALMENTE_PAGADO, sin importar si parte ya estaba pagada vía Payment. Resultado: factura USD 50 con Payment USD 1 aplicado descontaba USD 51 del flujo (50 proyectado + 1 real) en vez de los USD 50 reales.

**Fix**: el future loop ahora proyecta sólo `saldoPendiente = monto - sum(applications)`. Si la factura está totalmente pagada por applications, no proyecta nada. La lista muestra el saldo pendiente como monto principal con el monto original como subtítulo. El detail panel tiene un panel destacado de 3 columnas: Factura / Pagado / Pendiente.

---

## v4.5

### 30 de abril de 2026

#### Fix: doble descuento al conciliar con movimientos del mismo día

Cuando conciliabas una cuenta con `fecha=hoy` después de haber cargado movimientos del día, esos movimientos quedaban activos y se aplicaban EN ADEMÁS del saldoReal recién fijado, generando un descuento doble. Ej.: cargás un GASTO de USD 4.000 hoy, mirás el banco (que ya descontó esos $4k), conciliás con saldo real → el sistema te restaba otros $4.000.

**Causa**: el filtro `fecha >= fechaSaldoInicial` incluía el mismo día, así que los movimientos del día de la conciliación se sumaban encima del saldoReal.

**Fix**: cambio a comparación estricta `fecha > fechaSaldoInicial`. Semántica nueva: `fechaSaldoInicial = X` significa "saldo al **cierre** del día X". Movimientos con fecha = X quedan absorbidos en `saldoInicial`; sólo los del día X+1 en adelante afectan el saldo calculado.

**Cambios**:
- `computeAccountBalance`: filtro `fecha: { gt: fechaCorte }` en ingresos, gastos directos y payments.
- `validateFinanceInvariants`: comparación `<=` en lugar de `<` al filtrar movimientos absorbidos por el saldoInicial.
- Modal de conciliación: texto actualizado — explica que el saldoReal es el "cierre del día X" e incluye TODOS los movimientos de ese día.
- Admin → Cuentas: leyenda del campo "Fecha del saldo" actualizada.

**Validación manual** (qué deberías ver tras este fix):
1. BBVA con saldo calculado X y movs del 29/04 cargados.
2. Conciliás con saldoReal=33.791, fecha=29/04.
3. Saldo de BBVA queda en 33.791 (los movs del 29/04 NO se restan otra vez).
4. Cargás un GASTO de USD 100 con fecha 30/04 → saldo = 33.691.
5. Cargás un GASTO de USD 50 con fecha 29/04 → saldo sigue 33.691 (ese mov ya está absorbido en el cierre del 29/04).

---

## v4.4

### 30 de abril de 2026

#### Conciliación simple (el banco siempre dice la verdad)

Se simplificó el flujo de conciliación de cuentas para que sea consistente con la regla de oro: el saldo real (lo que dice el home banking) es el ground truth, sin "ensuciar" el listado de movimientos con gastos/ingresos falsos.

**Cómo funciona ahora**:
- Si el saldo real coincide con el calculado: solo se registra la conciliación en el historial.
- Si hay diferencia: se actualiza `saldoInicial = saldoReal` y `fechaSaldoInicial = fecha de la conciliación` en una sola transacción.
- **Ya no se crean movimientos de ajuste** (categoría AJUSTE_CONCILIACION). Cada conciliación queda registrada en `account_reconciliations` como auditoría.
- Movimientos anteriores a la fecha de conciliación pasan a histórico (no afectan al saldo nuevo).
- Movimientos posteriores se aplican sobre el saldo recién fijado.

**UI del modal**:
- Se eliminó el toggle "Crear movimiento de ajuste automático".
- Si hay diferencia, panel ámbar explica explícitamente lo que va a pasar al confirmar (saldo nuevo, fecha de corte, sin movimiento creado).
- Botón único "Confirmar conciliación".
- Toast nuevo: "Saldo actualizado a X. Diferencia anterior: Y." o "Conciliación exitosa. La cuenta cuadra." según el caso.

**Historial de conciliaciones**:
- Las conciliaciones nuevas muestran badge **"Saldo actualizado"** cuando tuvieron diferencia.
- Las conciliaciones legacy (de v4.3 o anteriores con `ajusteMovementId`) muestran **"Ajuste legacy"** y siguen vinculadas a su movimiento de ajuste; no se modifican.
- Las conciliaciones sin diferencia muestran "Sin diferencia".

**Beneficio**: el listado de movimientos ya no se contamina con AJUSTE_CONCILIACION cada vez que conciliás. La realidad de la cuenta es lo que dice el banco; el sistema se ajusta.

---

## v4.3

### 29 de abril de 2026

#### Salud financiera: regla de oro y monitoreo continuo

Se establece la **regla de oro del sistema**: el saldo total de cuentas (bancos + caja) debe ser igual al saldo del flujo de fondos hasta hoy, considerando SOLO movimientos PAGADOS/COBRADOS (plata real). Los proyectados, comprometidos o A_PAGAR no afectan al saldo de caja.

**1. `fechaSaldoInicial` ahora es funcional**:
- En `computeAccountBalance` se filtra `fecha >= account.fechaSaldoInicial`. Sólo movimientos posteriores (o iguales) afectan el saldo.
- Sirve como "punto cero" de cada cuenta: el saldoInicial representa el balance al fechaSaldoInicial; movimientos anteriores quedan como histórico ya consolidado.
- Si la cuenta no tiene `fechaSaldoInicial` (legacy), no hay corte.

**2. Validación de fechas**:
- Backend rechaza `fechaSaldoInicial` futura con mensaje claro.
- Frontend: input con `max={hoy}` impide elegir fechas futuras desde el datepicker.
- Movimientos PROYECTADO / COMPROMETIDO / A_PAGAR / PARCIALMENTE_PAGADO con fecha pasada generan warning (no bloqueo). El front muestra toast: "El movimiento tiene fecha pasada pero su estado es A_PAGAR. Verificá si debería estar pagado/cobrado."

**3. Test de invariante automático**:
- Nuevo helper `validateFinanceInvariants()` que computa **dos formas independientes** del saldo total USD:
  - Suma de `computeAccountBalance` por cuenta activa (convertido a USD).
  - Walk cronológico: saldoInicial total + movimientos PAGADOS/COBRADOS con fecha ≤ hoy y ≥ fechaSaldoInicial + Payments con misma condición.
- Si difieren > $0.01, el sistema lo detecta como descalce.
- Hooks en operaciones críticas (POST/PATCH/DELETE de movimientos, payments, applications, account; reconcile): si tras la operación el invariante queda roto, deja warning en logs del servidor (no bloquea la operación, pero queda traceable).
- Endpoint `GET /api/finance/invariant-check` devuelve el estado actual.

**4. UI de salud**:
- **Widget en /admin** (debajo del header): muestra "✓ Salud financiera: coherente" o el descalce con botón directo a `/finanzas/cuentas` para conciliar.
- **Banner global en /finanzas/***: aparece sólo si hay descalce, en cualquier página de Finanzas. Re-chequea cada minuto y al volver el foco a la pestaña.

**5. Script de limpieza**:
- `server/scripts/fix-future-fecha-saldo-inicial.ts` — idempotente, lleva las cuentas con `fechaSaldoInicial` futura a hoy. Útil para corregir el estado pre-v4.3 detectado en el reporte de diagnóstico (BBVA y BROU con fecha 2026-04-30). Tras correrlo, si el saldo no matchea la realidad, conciliá la cuenta.

---

## v4.2

### 29 de abril de 2026

#### Aplicar Payment a facturas pendientes desde "Nuevo movimiento"

Hasta ahora, al crear un GASTO PAGADO con proveedor en `/finanzas/movimientos`, el sistema generaba un Auto-Payment (v3.8) aplicado únicamente al movimiento nuevo. Si el proveedor tenía facturas A_PAGAR/PARCIALMENTE_PAGADO, había que registrar el pago aparte desde "Pagos → Registrar pago" y luego aplicarlo manualmente.

Ahora el flujo de "+ Nuevo movimiento" detecta automáticamente las facturas pendientes del proveedor y permite distribuir el monto del pago entre ellas y/o el movimiento nuevo, en una sola operación atómica.

**Cómo funciona**:
- Cuando completás GASTO + PAGADO + proveedor + cuenta + monto, el form consulta facturas pendientes del proveedor en la misma moneda.
- Si hay facturas pendientes, aparece un panel azul ofreciendo aplicar el pago a esas facturas.
- Al hacer click, abre un modal con la lista de facturas (saldo pendiente, vencimiento) y un input "a aplicar" por fila.
- Default: el modal pre-distribuye el monto del pago en orden de vencimiento, hasta consumirlo.
- Resumen abajo: aplicado a facturas + resto al movimiento nuevo.
- Al confirmar, la distribución queda guardada en el form. Recién al "Registrar movimiento" se persiste todo.

**Comportamiento al guardar**:
- Si **no hay sobrante** (todo el pago se aplicó a facturas), no se crea movimiento nuevo. El flujo equivale a "Registrar pago" desde Pagos.
- Si **hay sobrante**, se crea el movimiento nuevo con monto = sobrante (no el monto original del form), y el sobrante se aplica al movimiento.
- El Payment se crea con monto total y se reparte entre las facturas pendientes + el movimiento nuevo (si corresponde).
- Toda la operación es atómica (transacción Prisma).
- Las facturas afectadas pasan automáticamente a PAGADO o PARCIALMENTE_PAGADO según el saldo restante.

**Validaciones**:
- Mismo proveedor en todas las aplicaciones.
- Misma moneda.
- Cada aplicación ≤ saldo pendiente de su factura.
- Suma de aplicaciones ≤ monto del pago.
- Cuenta válida y activa.

**Endpoints**:
- Nuevo: `GET /api/finance/movements/pending-by-supplier?supplierId=&moneda=` devuelve facturas elegibles.
- Extendido: `POST /api/finance/movements` acepta `applyToPendingInvoices: [{ movementId, monto }]` opcional.

---

## v4.1

### 29 de abril de 2026

#### Fix saldo de cuentas vs columna "Saldo USD"

Bug doble que generaba inconsistencia entre el KPI "Saldo actual en cuentas" y la columna "Saldo USD" del último movimiento concretado en `/finanzas/movimientos`.

**Síntomas**:
- KPI de saldo actual mostraba un valor (ej. USD 38.081) y la columna de saldo del último PAGADO/COBRADO mostraba otro (ej. USD 5.872).
- Movimientos con fecha "hoy" o futura PAGADOS aparecían debajo del marcador "HOY" como si fueran proyectados, y se contaban dos veces (una en el saldo actual, otra al proyectar hacia adelante).

**Causa 1 — split por fecha en lugar de por concretado**:
El cálculo dividía los movimientos en "pasados" y "futuros" según `fechaEfectiva < hoy`. Eso ponía mal a los PAGADOS de hoy (o del futuro) en el grupo "futuro" y los volvía a aplicar sobre el saldo actual, que ya los incluía → doble conteo en la columna saldo.

**Fix 1**: ahora el split es por **concretado vs no-concretado** (no por fecha).
- Concretados (PAGADO/COBRADO/AJUSTE): caminan DESC desde `saldoActualCuentas`. El más reciente queda con `saldoUSD == saldoActualCuentas` exacto. Para los anteriores se revierte cada efecto (regla cronológica).
- No-concretados (previstos, pendientes, en proceso): caminan ASC desde `saldoActualCuentas`, proyectando hacia adelante.

**Causa 2 — doble débito en `computeAccountBalance`**:
La función sumaba los GASTOS con `pagado=true` Y todos los Payments de la cuenta. Pero desde Auto-Payment (v3.8), un GASTO PAGADO directo crea **ambas cosas** para el mismo evento (el FinanceMovement con `pagado=true` y un Payment + PaymentApplication). Resultado: el saldo de la cuenta venía descontado dos veces.

**Fix 2**: el agregado de gastos ahora excluye los movimientos que ya tienen `PaymentApplication` activa (`paymentApplications: { none: { payment: { deletedAt: null } } }`). Si tiene Payment, se cuenta sólo por el Payment.

**Coherencia garantizada**: el último concretado en orden cronológico tiene siempre `saldoUSD == saldoActualCuentas`. Si por alguna razón no coincide, el backend deja un warning en logs.

**KPIs CON IVA preservados**: los KPIs `saldoFinalProyectado` y `saldoMinimoFuturo` siguen calculándose en paralelo con IVA (como introdujo v3.7). Lo único que cambia a SIN IVA es el valor numérico de la columna saldo, para que matchee con el cálculo de cuentas.

---

## v4.0

### 29 de abril de 2026

#### Fix sistémico de zonas horarias en fechas

Bug crónico que mostraba el día anterior en muchas fechas (saldoInicial, deadlines, fecha de movimientos, conciliaciones, etc.) cuando se mostraban en zona Uruguay (UTC-3).

**Causa**: las fechas "sin hora" (ej. `"2026-04-29"`) al pasar por `new Date()` se interpretan como medianoche UTC. Al formatearlas con `toLocaleDateString('es-UY')` el navegador las convierte a hora local (UTC-3) y muestra `28/04/2026`.

**Fix central** (un solo cambio que se propaga a 65+ usos):
- Nuevo helper [`client/src/utils/date.ts`](client/src/utils/date.ts) con `toDateOnlyISO`, `parseDateOnly`, `formatDate`, `toInputDate`, `todayLocalISO`. Trabaja con strings `"YYYY-MM-DD"` directamente (sin `new Date()`), evitando shifts.
- `fmtDate` (en `lib/finance.ts`) ahora delega en el nuevo helper.
- Cualquier fecha date-only que llegue del backend (sea como `"2026-04-29"` o `"2026-04-29T00:00:00.000Z"`) se renderiza siempre como `29/04/2026`.

**Form defaults para "hoy"**:
- Reemplazado `new Date().toISOString().slice(0, 10)` por `todayLocalISO()` en todos los formularios que tomaban "hoy" como default. El patrón anterior podía devolver `2026-04-30` cuando localmente era 22:00 del `2026-04-29` (Uruguay). Ahora siempre devuelve la fecha local correcta.
- Archivos tocados: ReconcileAccountModal, NewPaymentForSupplierModal, FinancePayments, FinanceSupplierDetail, FinanceMovements, Finance, Stock, ProjectDetail, FinanceAPagar, EngineeringMaterials, materials.api.

**Backend**: el helper `parseDateOnly` ya parseaba correctamente `"YYYY-MM-DD"` a medianoche UTC, no requirió cambios.

**No se migra la DB**: las fechas existentes están guardadas correctamente en UTC. Lo que estaba mal era solo el display en frontend.

---

## v3.9

### 29 de abril de 2026

#### Conciliación bancaria de cuentas

Nueva funcionalidad para verificar periódicamente que el saldo del sistema coincide con la realidad de cada cuenta (banco, caja, tarjeta).

- **Botón "Conciliar"** en cada cuenta de `/finanzas/cuentas`. Abre un modal donde se ingresa el saldo real (según home banking) y la fecha del corte.
- **Diferencia en vivo**: el modal muestra al instante si hay diferencia y cuál (con texto explicativo: "tenés más / menos plata de la que el sistema cree").
- **Ajuste automático opcional**: si hay diferencia, un toggle permite generar un movimiento de **categoría nueva "Ajuste conciliación"** (INGRESO o GASTO según el signo de la diferencia) para que el saldo calculado iguale al real.
- **Atomicidad**: todo (movimiento de ajuste + registro de conciliación) se hace en una sola transacción.
- **Historial por cuenta**: el drawer de detalle muestra una tabla con todas las conciliaciones (fecha, real, calculado, diferencia y si se aplicó ajuste).
- **Badge en cada cuenta**: indica "✓ Conciliada hace Xd", "Conciliar (hace Yd)" o "Nunca conciliada" según los días desde la última.
- **Banner global** en `/finanzas` cuando hay cuentas sin conciliar (>30 días o nunca).
- **Audit log** dedicado en cada conciliación con metadata (`reconciliationId`, `ajusteMovementId`).

#### Modelo nuevo

- `AccountReconciliation`: punto verificado en el tiempo (fecha, saldoReal, saldoCalculado, diferencia, ajusteMovementId, notas, createdBy).
- Categoría `AJUSTE_CONCILIACION` agregada al enum `CategoriaPrincipal`.

#### Endpoints

- `GET /api/accounts/reconciliation-alerts` — cuentas que necesitan conciliarse (con días desde la última).
- `GET /api/accounts/:id/reconciliation-preview?saldoReal=X` — preview del impacto antes de confirmar.
- `POST /api/accounts/:id/reconcile` — aplica la conciliación y opcionalmente crea el movimiento de ajuste.
- `GET /api/accounts/:id/reconciliations` — historial de la cuenta.

---

## v3.8

### 29 de abril de 2026

#### Auto-Payment al crear movimiento PAGADO

Antes, al crear un GASTO directamente en estado PAGADO con un proveedor + cuenta, el sistema marcaba la factura como pagada pero NO generaba el `Payment` correspondiente. Resultado: el saldo del proveedor quedaba mal y la pestaña "Pagos" del proveedor no reflejaba el pago.

Ahora:

- **Al crear** un GASTO directamente PAGADO con `supplierId` + `accountId` se crea automáticamente un `Payment` aplicado al movimiento completo, en una sola transacción atómica (si falla algo, no queda inconsistencia).
- **Al transicionar** un movimiento existente a PAGADO (sin pasar por el flujo manual de Payment) y si todavía no tiene applications activas, también se dispara el auto-Payment.
- El Payment automático lleva `metodo: OTRO`, `referencia: "Auto-pago: {descripción}"` y notas claras explicando que fue generado automáticamente.
- Audit log dedicado con metadata `{ autoGenerated: true, sourceMovementId }`.

#### Backfill de movimientos legacy

Nuevo script [`server/scripts/backfill-auto-payments.ts`](server/scripts/backfill-auto-payments.ts) que recorre todos los movimientos GASTO PAGADO con proveedor que NO tienen `Payment` asociado y les genera uno retroactivo (referencia con prefijo `[BACKFILL]`). Idempotente: correr varias veces no duplica.

Si un movimiento legacy no tiene `accountId`, el script asigna automáticamente la primera cuenta activa con la misma moneda.

Ejecutar con: `docker compose exec server npx tsx scripts/backfill-auto-payments.ts`

#### Badge "Auto" en la pestaña Pagos del proveedor

En `/finanzas/proveedores/:id` → tab Pagos, los pagos automáticos (auto-payment + backfill) muestran un pequeño badge `Auto` al lado del método. Tooltip explica el origen exacto.

---

## v3.7

### 28 de abril de 2026

#### IVA en KPIs y saldos de Finanzas

Hasta ahora todos los KPIs y saldos del módulo Finanzas mostraban montos sin IVA. Pero lo que realmente sale/entra de las cuentas es el monto **con IVA**. Ahora todas las pantallas de Finanzas muestran ambas versiones, y los saldos proyectados se calculan con IVA.

- **Pantalla de Movimientos**: el card *Saldo proyectado final* y *Punto mínimo de liquidez* muestran el valor **con IVA** como principal (ese es el real impacto en la cuenta) y el sin IVA debajo en gris como referencia.
- **Dashboard de Finanzas**: los KPIs *Ingresos del mes*, *Gastos del mes*, *Resultado*, *Pendiente cobro* y *Pendiente pago* muestran ambas versiones (sin IVA arriba, con IVA debajo).
- **Flujo de fondos proyectado**: las tiles *Saldo actual*, *Por cobrar*, *Por pagar*, *Proyectado* y los compromisos *Previsto / Comprometido / A pagar* muestran ambas versiones.
- **Últimos movimientos** en el dashboard: cada movimiento muestra el monto sin IVA (color por tipo) y debajo *c/IVA: X*.
- **Detail panel del movimiento**: ahora muestra dos filas — *Monto (sin IVA)* y *Monto c/IVA (22%)*.
- **Cálculo de saldos**: la proyección del saldo de cuentas usa el **monto con IVA** porque ese es el que realmente impacta en la cuenta. Los movimientos con `ivaTasa = null` se asumen 22% por defecto.

#### Endpoints extendidos

- `GET /finance/movements`: agrega `saldoFinalProyectadoSinIva` y `saldoMinimoFuturoSinIva`. Los campos `saldoFinalProyectado` y `saldoMinimoFuturo` ahora son **con IVA** (cambio de comportamiento).
- `GET /finance/reports/dashboard`: agrega `ingresosConIva`, `gastosConIva`, `resultadoConIva`, `pendienteCobroConIva`, `pendientePagoConIva`. Cada item de `ultimosMovimientos` incluye `ivaTasa`.
- `GET /finance/reports/cashflow`: agrega versiones con IVA de `porCobrar`, `porPagar`, `saldoProyectado`, `previstoTotal`, `comprometidoTotal`, `aPagarTotal`, `saldoProyectadoSinPrevistos`.

#### Componente reutilizable

Nuevo `AmountWithIva` para mostrar pares sin/con IVA de manera consistente en KPIs y celdas.

---

## v3.6

### 28 de abril de 2026

#### Monitoreo de liquidez en Movimientos

Tres KPIs nuevos arriba de la lista de Movimientos para ver de un vistazo la salud financiera de la operación:

- **Saldo actual en cuentas**: suma de todas las cuentas activas convertidas a USD con el último tipo de cambio.
- **Saldo proyectado final**: liquidez resultante después de aplicar TODOS los movimientos previstos del período (incluye PREVISTO, COMPROMETIDO, A_PAGAR).
- **Punto mínimo de liquidez**: el saldo más bajo que se proyecta alcanzar en el futuro, con la **fecha** en la que ocurre. Si el mínimo es **negativo**, el card se resalta en rojo y muestra un badge "Riesgo de insuficiencia".

Estos KPIs se recalculan en tiempo real cuando se crean/editan/anulan movimientos o se toggle/borra/crea/edita una cuenta. Las invalidaciones de queries se centralizaron en `invalidateFinanceLiquidity` para mantener consistencia.

#### Endpoint de movimientos extendido

`GET /api/finance/movements` ahora devuelve, además del listado paginado, los campos: `saldoActualCuentas`, `saldoFinalProyectado`, `saldoMinimoFuturo`, `fechaSaldoMinimoFuturo`, `sinCuentasActivas`, `usaFallbackTipoCambio`.

---

## v3.5

### 28 de abril de 2026

#### Columna "con IVA" en Ingeniería, Costos, Finanzas y catálogo

Hasta ahora todos los precios del sistema eran sin IVA. Para poder comparar contra el precio que se le cobra al cliente (que sí incluye IVA), se agregó una columna calculada "con IVA" en los módulos relevantes.

- **Cada material guarda su propia tasa de IVA** (`ivaTasa`, default 22%). Editable a nivel ítem del catálogo, ítem del proyecto y línea de invoice.
- **Lista de materiales del proyecto (Ingeniería)**: nuevas columnas **IVA %** (editable inline por fila) y **Subt. c/IVA**. La cabecera de cada categoría muestra subtotal con IVA, y el footer suma "Total sin IVA" + "Total con IVA" por moneda.
- **Pestaña Costos del proyecto**: el total previsto y el total real ahora muestran la versión con IVA debajo (ej: *Total sin IVA: $5.000,00 USD · Con IVA: $6.100,00 USD*).
- **Movimientos de Finanzas (detail panel + modal de desglose)**: nuevas columnas IVA % editable y Subt. c/IVA. El total que se valida contra el monto del movimiento sigue siendo sin IVA (la tolerancia de $1 no cambia).
- **Catálogo de materiales (Admin)**: campo IVA % en el form de crear/editar y columnas IVA % + Precio sug. c/IVA en la tabla.
- **PDF con precios** de la lista de materiales: al pie ahora muestra dos totales: "Total sin IVA" + "Total con IVA" por moneda.
- **Cost-summary endpoint** extendido con campos `costoPrevistoConIvaUSD`, `costoRealConIvaUSD` (totales y desglose por categoría/ítem).
- Helpers `calculateConIva` y `formatPriceWithIva` centralizados en backend (`server/src/utils/iva.ts`) y frontend (`client/src/utils/iva.ts`).

---

## v3.4

### 28 de abril de 2026

#### Previstos agrupados por categoría

Antes, cuando se "Generaban previstos" desde la lista de materiales de Ingeniería, se creaba **un movimiento PREVISTO por cada ítem** (un panel, un inversor, un cable…). La pestaña Movimientos quedaba inundada de líneas.

Ahora se agrupan:

- **Un movimiento PREVISTO por categoría** (ej: "Previsto: Paneles solares", "Previsto: Estructura de montaje").
- Si dentro de una categoría hay ítems en USD y otros en UYU, se separan en dos movimientos por moneda (ej: "Previsto: Estructura (USD)" y "Previsto: Estructura (UYU)").
- El **detalle de cada material individual** se conserva como `InvoiceItems` del movimiento previsto (mismo desglose que ya tenían los movimientos A_PAGAR/PAGADO de Fase D), así no se pierde información.
- Cada `ProjectMaterial` queda referenciando al movimiento PREVISTO de su categoría/moneda (relación N:1).

#### Regenerar seguro: preserva los avanzados

Al click en "Regenerar previstos":

- **Modal con preview** que muestra cuántos movimientos se van a eliminar y cuántos se conservan.
- Se eliminan **solo los movimientos en estado PREVISTO**.
- Los movimientos en estados avanzados (**Comprometido, A pagar, Parcialmente pagado, Pagado**) se **preservan automáticamente**, no se tocan.
- Lista colapsable con el detalle de los avanzados que se conservan (descripción, estado, monto, moneda).
- Toast con resultado: *"X previstos creados por categoría · Y conservados sin tocar"*.

#### Nuevos endpoints

- `GET /api/projects/:id/materials/regenerate-impact` — preview de qué se borraría/conservaría
- `POST /api/projects/:id/materials/regenerate-previsto` ahora devuelve `deletedCount`, `preservedCount` y `preservedDetails`

---

## v3.3

### 28 de abril de 2026

#### Fechas reales automáticas

- La **fecha de inicio real** de una subetapa se llena sola cuando hay primera actividad: comentario, cambio de estado, subida de archivo o cualquier edición. Si ya tenía fecha, no se sobrescribe.
- La **fecha de fin real** se setea automáticamente al marcar la subetapa como completada. Si después la reabrís, se limpia.
- ADMIN puede editar manualmente las fechas reales si quedaron mal cargadas (`PATCH /api/substages/:id/actual-dates`).
- El drawer de la subetapa ahora muestra "Iniciada" / "Completada" con sus fechas reales cuando existen.

#### Notificaciones por usuario (in-app, email, WhatsApp)

- En **Configuración** apareció una nueva sección **"Notificaciones de proyecto"** donde cada usuario elige si quiere recibir, y por qué canales:
  - **Alerta 3 días antes de un deadline** (canales: in-app, email, WhatsApp).
  - **Aviso cuando se completa la subetapa anterior a la suya** (canales: in-app, email, WhatsApp).
- Se agregó un campo de **teléfono** al usuario (necesario para WhatsApp).
- **Cron diario a las 9 AM**: recorre todas las subetapas con deadline en los próximos 3 días, no completadas, y dispara las notificaciones según las preferencias del responsable. Cada subetapa se marca como notificada para no duplicar.
- Si se cambia el deadline (manual, reset a automático, o recálculo del proyecto), se **resetea la marca de notificación** para que se vuelva a avisar del nuevo plazo.
- Al **completar una subetapa**, automáticamente se notifica al responsable de la **siguiente subetapa lógica** del proyecto (misma etapa siguiente en orden, o primera de la próxima etapa). Best-effort: si falla el envío, no bloquea el cambio de estado.

#### Widget "Deadlines próximos" en el Dashboard

- Nuevo card en el Dashboard que lista las **subetapas asignadas al usuario actual con deadline en los próximos 7 días**, ordenadas por urgencia y con código de colores (rojo vencido, naranja ≤3d, amarillo ≤7d).
- Click en una fila lleva al proyecto.

---

## v3.2

### 28 de abril de 2026

#### Sistema de deadlines automáticos por subetapa

- **Reglas configurables en Admin** (nueva tab "Reglas de Deadlines"): cada regla define cuándo debe completarse una subetapa según uno de cuatro tipos:
  - **Días desde creación del proyecto** (ej: "Pre-Proyecto Ingeniería = 5 días desde alta").
  - **Días antes de la instalación** (ej: "Lista de materiales = 7 días antes de empezar la obra").
  - **Manual**: el usuario lo pone a mano.
  - **Sin deadline**: la subetapa no tiene fecha.
- Las reglas se aplican por **etapa + subetapa** (sopCode o nombre) y son globales: una regla impacta a todos los proyectos.
- **Cálculo automático al crear un proyecto**: las subetapas reciben su deadline según las reglas activas.
- **Recálculo automático al cambiar la fecha de instalación**: cuando se mueve un tramo en el calendario, los deadlines tipo "días antes de instalación" se recalculan. Si hay deadlines editados manualmente, **el sistema pide confirmación** antes de pisarlos.
- **Edición manual desde el drawer de la etapa** (ADMIN y OPERACIONES): cada subetapa muestra su deadline con badge "manual" si fue editado, y se puede volver al cálculo automático con un click.
- **Código de colores en el drawer**: rojo si vencido, naranja si quedan ≤3 días, amarillo ≤7 días, verde si la subetapa ya se completó.

#### Fechas de etapa coherentes en Mis Tareas

- El badge de "vence" a nivel etapa en Mis Tareas ya no usa la fecha planificada que se calculaba automáticamente al crear el proyecto (que solía mostrar fechas viejas y confusas).
- Ahora muestra la **fecha más urgente entre sus subetapas pendientes**.
- Además, el StageDrawer expone un campo **"Fecha límite"** editable a nivel etapa para todos los roles.

#### Lista de materiales colapsable

- La sección "Lista de materiales" en Ingeniería ahora se puede **colapsar/expandir** con un click en el título.
- Cuando está colapsada se muestra un resumen mini (cantidad de ítems + total).
- El estado se recuerda por proyecto (si dejaste un proyecto colapsado, al volver sigue así).

#### Calculadora de triángulos de aluminio

- Nueva calculadora dentro de Ingeniería para resolver triángulos isósceles (caso típico de soportes inclinados de paneles).
- Tres modos de cálculo: **L + ángulo**, **L + altura**, **altura + ángulo**.
- Soporta unidades milímetros, centímetros y metros.
- Visualización en SVG con todas las medidas anotadas.
- Acciones: **Descargar SVG**, **Copiar medidas** al portapapeles y **Guardar en el proyecto** (genera JPG + PDF con la imagen y las medidas, ambos quedan en Documentos del proyecto con tipo "Cálculo triángulos").

#### Toggle de precios en el PDF de materiales

- El botón "Exportar PDF" en la lista de materiales ahora es un **desplegable con dos opciones**: "Sin precios (para proveedores)" y "Con precios (uso interno)".
- **Sin precios**: PDF con 3 columnas (Ítem, Cant., Unidad). Pensado para compartir con proveedores sin revelar los precios internos.
- **Con precios**: PDF con 5 columnas (Ítem, Cant., Unidad, Precio, Subtotal) más total al pie por moneda.
- Cada variante se guarda con nombre descriptivo en Documentos.

#### Fecha esperada al generar previstos

- Al generar movimientos previstos desde la lista de materiales, ahora se pide la **fecha esperada de compra** (obligatoria, viene precargada con la fecha de inicio planificado del proyecto o la fecha de hoy).
- Los previstos se crean con esa fecha como `expectedDate`, lo que mejora la proyección de flujo de fondos.

---

## v3.1

### 27 de abril de 2026

#### PDF de materiales con/sin precios

- El botón "Exportar PDF" en la lista de materiales ahora es un **desplegable con dos opciones**: "Sin precios (para proveedores)" y "Con precios (uso interno)".
- **Sin precios**: PDF con 3 columnas (Ítem, Cant., Unidad). Pensado para compartir con proveedores sin revelar los precios internos.
- **Con precios**: PDF con 5 columnas (Ítem, Cant., Unidad, Precio, Subtotal) más total al pie por moneda. Para uso interno del equipo.
- Cada variante se guarda con nombre descriptivo en los Documentos del proyecto y genera un toast diferenciado al completarse.

---

### 27 de abril de 2026

Release grande que cierra el módulo de Finanzas: se agregaron **Cuentas (caja/bancos)** con saldos en tiempo real, se replanteó la **lista de materiales** y el **stock unificado**, se introdujo el ciclo completo de **Pagos** (parciales, notas de crédito, aplicación a facturas), apareció la pestaña de **Costos previsto vs. real** por proyecto, y la lista de Movimientos ahora tiene un **saldo USD proyectado** que considera todo el flujo de caja. También se mejoró fuerte la pantalla de **Mis Tareas** con alertas de vencimiento.

#### Cuentas (caja, bancos, tarjetas)

Para saber en cualquier momento cuánta plata hay y dónde.

- **Nuevo módulo Cuentas** con tipos: Banco, Efectivo, Tarjeta, Otro. Cada cuenta tiene moneda fija (USD o UYU), saldo inicial con fecha y notas.
- **Página `/finanzas/cuentas`** con cards por cuenta mostrando saldo actual, total por moneda y total unificado en USD con el último tipo de cambio. Click en una cuenta abre un drawer con sus movimientos y pagos asociados.
- **Pestaña "Cuentas" en Admin** para crear/editar/desactivar cuentas (no se pueden eliminar si tienen movimientos: pasan a inactivas).
- **Cuenta obligatoria** cuando un movimiento concreta dinero (gasto pagado o ingreso cobrado) o cuando se registra un pago. La moneda de la cuenta tiene que coincidir con la del movimiento/pago. El backend rechaza con un mensaje claro si falta o no coincide.

#### Catálogo unificado de Materiales y Stock

Antes había dos tablas: catálogo de Materiales (Ingeniería) y productos de Stock. Ahora son la misma cosa.

- **Catálogo único** con toggle **"Gestiona stock"**: si está prendido es un producto físico que entra/sale del depósito; si está apagado es un servicio (mano de obra, trámites) que no impacta inventario.
- Campo nuevo **"Ubicación depósito"** por ítem.
- **Página Stock rediseñada**: tabla con producto, categoría, unidad, stock, mínimo, ubicación y precio sugerido. Filas de servicios se distinguen con badge. Crear/editar es el mismo modal en Stock y en Admin → Materiales. Filtro "Incluir servicios (sin stock)" — por default sólo se muestran físicos. "Valor inventario" se calcula con precio sugerido.
- **Cantidades enteras en todo el sistema**: stock, ingreso/egreso, lista de materiales del proyecto, ítems de desglose de factura. Si se intenta cargar un decimal el backend rechaza con "Las cantidades deben ser enteras".
- **Modal de Ingreso de stock** pide ahora la causa: Factura / Devolución de proveedor / Ajuste de inventario / Importación inicial / Otro.
- **Bloqueo**: los ítems sin gestionaStock no pueden tener movimientos de stock manuales.

#### Lista de materiales por proyecto + previstos

- **Sección "Lista de materiales"** dentro del drawer de la etapa Ingeniería de cada proyecto. Tabla agrupada por categoría con buscador del catálogo, edición inline de cantidad / precio / proveedor (blur o Enter guarda) y notas por ítem.
- **Botón "Generar previstos"**: crea un movimiento `PREVISTO` por cada material de la lista vinculado al proyecto. Si ya hay generados, propone generar sólo los faltantes.
- **Regenerar previstos** (solo admin): borra los actuales y los vuelve a generar.
- Al eliminar un material que ya tenía previsto, se borra también el movimiento.
- **Limpieza de previstos al registrar compra real**: en el form de un movimiento Comprometido / A pagar aparece un botón "🧹 Limpiar previstos asociados…" que abre un modal con los previstos pendientes agrupados por proyecto y permite eliminar los que ya quedaron cubiertos por la compra real.
- **Modal "Registrar consumo"** del proyecto: selector con buscador filtrable **por categoría** arriba del dropdown; sólo lista productos físicos (gestionaStock=true).

#### Movimientos: ciclo de vida, desglose y saldo USD proyectado

**Estados del ciclo de vida** de un movimiento de gasto:
- **Previsto** (gris): proyección desde la lista de materiales.
- **Comprometido** (azul): compra acordada, sin fecha de pago.
- **A pagar** (ámbar): con fecha de vencimiento.
- **Parcialmente pagado** (ámbar oscuro): tiene pagos aplicados pero saldo > 0.
- **Pagado** (verde): cerrado.

**Listado de Movimientos**:
- Filtros nuevos: **Estado** (incluye "Parcialmente pagados") y **"Pendientes de desglose"** (A pagar/Pagado sin desglose ni "sin materiales").
- Columna **"Vence"**: filas vencidas (A pagar con fecha pasada) en rojo con ⚠.
- **Saldo USD proyectado** (columna nueva) — el saldo acumulado considerando TODOS los movimientos del sistema (ingresos suman, gastos restan), ordenados por **fecha efectiva**: si el movimiento ya concretó dinero la fecha real, sino la fecha esperada → vencimiento → fecha. Filas reales (PAGADO/cobrado) se ven con texto sólido; las proyectadas en gris itálico. Tooltip por fila explica el cálculo. Footer muestra el "Saldo proyectado final USD".
- **Acciones rápidas**: "→ A pagar" (pide vencimiento), "→ Pagado" (pide fecha). Si la transición a A pagar / Pagado es para un gasto con proveedor sin desglose y no marcado "sin materiales", **abre automáticamente el modal de desglose**.
- **Default categoría "Consumo stock"** al crear un gasto nuevo.
- **Identificación por nombre del cliente** en lugar del código del proyecto en todos los selectores y columnas (el código sigue existiendo internamente pero no se muestra al usuario).

**Desglose de factura → ingreso al stock** (para movimientos en A pagar / Pagado):
- En el form de Nuevo movimiento aparece un panel ámbar con dos opciones: **"Cargar desglose ahora"** (guarda y abre el modal) o toggle **"Esta factura no tiene materiales"** (servicios, mano de obra). Si se ignora, queda como "Desglose pendiente" con badge ámbar **⚠ Desglose pendiente**.
- **Modal de desglose**: header con monto objetivo, tabla editable inline (cantidad entera + precio unitario con blur/Enter), selector de productos del catálogo agrupado por categoría con buscador, **botón "+ Crear nuevo material"** que abre un mini-form (nombre, categoría, unidad, precio sugerido, moneda) y agrega el ítem creado al desglose con cantidad 1 (requiere permiso CONFIGURACION). Footer con total ítems vs monto del movimiento y diferencia en rojo si no cuadra; "Confirmar desglose" deshabilitado hasta que la diferencia sea menor a un centavo.
- **Al confirmar**: se generan movimientos de stock tipo Ingreso (causa Factura) y la factura queda marcada con badge verde **✓ Stock**.
- **Anular movimiento** (en el detalle): botón rojo que revierte automáticamente todos los ingresos de stock asociados con un movimiento espejo (sale lo que entró). El movimiento queda con `deletedAt` para auditoría.

#### Pagos como entidades separadas

Antes una factura era todo o nada (A pagar / Pagado). Ahora cada **pago real** (transferencia, cheque, efectivo) es una entidad separada que puede aplicarse a una o varias facturas del mismo proveedor.

- **Página `/finanzas/pagos`** con tabla, filtros (proveedor, rango de fechas, "solo con saldo sin aplicar") y 3 KPIs: Pagos del mes, Total aplicado, Saldo sin aplicar.
- **Cuenta obligatoria** en cada pago (con moneda compatible).
- **Botón "+ Registrar pago"** abre modal con buscador de proveedor + datos del pago + cuenta + toggle "Aplicar a facturas ahora". Si está activo, después de guardar abre el modal de aplicación.
- **Pagos negativos permitidos** (notas de crédito o devoluciones del proveedor). Se identifican con badge azul **"Nota de crédito"** en el listado y aviso al guardar. Se aplican como saldo a favor del proveedor para compensar facturas positivas.
- **Drawer de cada pago**: datos, lista de aplicaciones (con "Quitar aplicación"), "Aplicar a más facturas" si hay saldo, y botón rojo **"Anular pago"** que revierte todas las aplicaciones y restituye el estado correcto de cada factura asociada (vuelve a A pagar, Parcialmente pagado o Pagado según corresponda).
- **Modal "Aplicar pago a facturas"**: lista las facturas del mismo proveedor + moneda. Cada fila checkbox + monto editable, pre-cargado con `min(saldo pendiente, saldo del pago sin aplicar)`. Footer con total a aplicar, saldo después y validación de no exceder.
- **Borrar un movimiento con pagos aplicados** ahora libera correctamente esos pagos como saldo a favor del proveedor (antes quedaban "huérfanos"). Confirmación clara en la UI antes de borrar: "Este movimiento tiene pagos aplicados por X. Al borrar, esos pagos quedarán como saldo a favor del proveedor."
- **Bloqueo** de la transición manual a PAGADO cuando el movimiento tiene proveedor: el flujo correcto es registrar un pago. Para gastos sin proveedor (ajustes contables) la transición manual sigue.

#### Vista detallada del proveedor

Acceso desde la lista de Proveedores o desde cualquier movimiento.

- **Header** con datos del proveedor + botones Editar / Registrar pago / Nuevo gasto.
- **3 KPIs**: Total adeudado (rojo si > 0), Saldo a favor (info si > 0), Saldo neto (verde si tenemos crédito, rojo si debemos).
- **3 tabs**:
  - **Facturas** con monto, pagado, saldo, vencimiento, estado. Filtros: Todas / Pendientes / Parciales / Pagadas. Vencidas resaltadas en rojo.
  - **Pagos** con monto, aplicado, saldo sin aplicar. Filtros: Todos / Con saldo / Aplicados.
  - **Estado de cuenta** con línea de tiempo cronológica unificada y saldo acumulado en USD.
- **Lista de proveedores rediseñada**: columnas Saldo neto (rojo si debemos / verde si saldo a favor), N° facturas pendientes, Última actividad. Saldos por moneda separados.
- **Datos de contacto**: el form persiste correctamente RUT/CUIT, persona de contacto y dirección. La tabla los muestra. El nombre del proveedor es **único entre activos**.

#### Página "A pagar"

- Nueva vista en `/finanzas/a-pagar` con todo lo Comprometido, A pagar y Parcialmente pagado, ordenado por vencimiento ascendente.
- **4 KPIs**: Comprometido total, A pagar total, Vencido (rojo si > 0), Vence esta semana. Calculados sobre saldos pendientes, no montos totales.
- **Filtros**: rango (Vencidos / Esta semana / Este mes / Próximos 30 días / Todos), proyecto, proveedor. Persistentes.
- Columna "Monto" muestra el **saldo pendiente** (no el monto total): "saldo $X · de $Y" cuando hay diferencia.
- **Acciones por fila**: "💲 Pagar" (abre el flujo de Payment) si tiene proveedor, o "→ A pagar" / "Marcar como pagado" para gastos sin proveedor.
- **Apertura automática del modal de desglose** al transicionar un gasto a A pagar (mismo flujo que en Movimientos).

#### Costos del proyecto: previsto vs. real

La pestaña Costos del proyecto se rediseñó para mostrar los dos lados de la moneda.

- **3 KPIs arriba**: Presupuesto, Desviación previsto vs. real (rojo si gastamos de más, verde si de menos), Margen real estimado.
- **Dos secciones paralelas**:
  - **Previsto**: total (USD + UYU desglosados) con equivalente en USD, margen previsto vs. presupuesto y desglose por categoría — basado en la lista de materiales cargada por Ingeniería (cantidad × precio unitario).
  - **Real**: ídem, basado en los egresos de stock vinculados al proyecto (consumos), valorados al costo unitario que tenían al consumirse o al precio sugerido del catálogo (con marca `cat.`).
- **Tabla "Comparación por ítem"** que une previsto y real por material: cantidad prevista vs. real (Δ), USD previsto vs. real (Δ con color rojo si gastamos más, verde si menos).
- **Tabla detalle de consumos reales** con ítem, categoría, cantidad, precio, subtotal y fecha.
- UYU se convierte a USD con el último tipo de cambio cargado; se aclara abajo.

#### Mis Tareas: alertas de vencimiento + bug fix de herencia

**Bug crítico arreglado**: cuando una subetapa tenía un responsable explícito distinto al de la etapa, igual aparecía en la lista de Mis Tareas del responsable de la etapa. Ahora el filtro respeta:
- Si la subetapa tiene responsable explícito → aparece sólo para ese usuario.
- Si la subetapa no tiene responsable → la hereda el responsable de la etapa.
- Si la subetapa tiene un responsable explícito **distinto** del de la etapa → no aparece para el responsable de la etapa.

**Sistema de alertas de vencimiento**:
- **Banner** arriba de la lista cuando hay tareas vencidas o que vencen hoy: "Tenés X tareas vencidas y Y que vencen hoy." (con pluralización correcta). Icono ⚠ con animación de "ring pulse".
- **Filas con alerta**:
  - Fondo sutil rojo claro (vencidas), amarillo claro (vence hoy / próxima a vencer).
  - **Dot pulsante** (animación radar) al lado del nombre cuando es vencida o vence hoy.
  - Texto contextual: "vencida hace Nd" / "vence hoy" / "vence en Nd" / "vence el DD-mes".
  - **Badge** a la derecha con el plazo en formato corto: "Nd atraso" / "Hoy" / "Nd".
- **Dark mode** soportado: las animaciones y colores usan tokens que cambian según el tema.
- **Accesibilidad**: respeta `prefers-reduced-motion` (las animaciones se desactivan).

#### Flujo de fondos

- El widget muestra ahora también Previsto total, Comprometido total y A pagar total.
- Toggle **"Incluir previstos en proyección"**: con previstos = visión pesimista; sin previstos = sólo compromisos firmes.

#### Alertas globales

- En el **Dashboard general** y en el **Dashboard de Finanzas**, banners ámbar arriba si hay facturas con stock sin desglosar (sólo para usuarios con permiso FINANZAS.VIEW).

#### Cambios técnicos importantes

- Nuevas migraciones: `add_payments_and_applications`, `unify_stock_with_materials_and_invoice_items`, `add_accounts`. Tablas nuevas: `payments`, `payment_applications`, `invoice_items`, `accounts`. Tabla `stock_products` eliminada (los movimientos de stock apuntan a `material_items`). Tabla legacy `finance_payments` eliminada. Enum `FinanceMovementStatus` ampliado con `PARCIALMENTE_PAGADO`. Enum nuevo `AccountType`.
- El cálculo de status de cada factura es **automático** al aplicar/quitar pagos (no se setea manualmente).
- El módulo Comprobantes (legacy, sin datos) quedó **oculto en la UI** pero el backend y la base de datos lo conservan por si hace falta restaurarlo.
- Endpoints nuevos: CRUD de `/api/accounts` + `/balance` + `/summary`; CRUD de `/api/finance/payments` + `/applications`; `GET/POST/PATCH/DELETE /api/finance/movements/:id/invoice-items`, `/invoice-items/confirm`, `/mark-no-materials`, `/cancel`, `/pending-detail`; `GET /api/projects/:id/cost-summary` con previsto/real/comparación.

## v2.1

### 25 de abril de 2026

#### Modo claro renovado con identidad Voltia
- El **modo claro** ahora tiene una paleta cálida que se siente parte del producto, no un blanco frío genérico. Fondos crema suave (`#fefdf8`), bordes cálidos en lugar del azul gris anterior, acentos amarillo Voltia consistentes.
- **Headers de tabla** ahora son una franja oscura (zona focal del estilo Voltia), antes eran del mismo color que el fondo y se confundían.
- **Hover de filas** en tablas con tono amarillo muy suave, más cálido que el azul claro previo.
- **Botón primario** (ej: "+ Nuevo trámite") con gradiente amarillo en lugar de un amarillo plano. Pequeño cambio visual pero da más cuerpo.
- El **modo oscuro** no se modificó.

#### Trámites UTE — vista tabla más legible
- **Encabezados de columnas de fecha** ahora son nombres completos en dos líneas ("Consulta / enviada", "Docs 1 / aprobados", etc.) en lugar de las abreviaturas anteriores en mayúsculas (`CONS.ENV`, `D1.APR`, …). Más fácil de leer de un vistazo.
- **Celdas de fecha** ahora se ven como pills con el color asignado (verde por defecto, o el color que hayas elegido desde el popover). Antes era texto plano.
- Las fechas ya no se cortan en dos renglones cuando la columna es angosta (ej: "14-ene" se mantiene en una sola línea).

#### Calendario mensual — fixes visuales
- Las **barras multi-día** vuelven a verse como una sola barra continua que cruza los días, sin cortes. (Había una iteración previa que las fragmentaba por día.)
- El **número del día** queda en una franja superior reservada de cada celda; las barras arrancan debajo y nunca tapan los números.
- El calendario ahora **ocupa todo el alto disponible** del viewport en desktop, en lugar de quedar comprimido con espacio vacío debajo.
- Cada semana se reparte equitativamente el alto disponible.

## v2.0

### 24 de abril de 2026

#### Nuevo módulo "Trámites UTE"
Módulo completo para gestionar los trámites UTE asociados a cada proyecto. Reemplaza la planilla Excel que se usaba.

- **Vista principal en `/tramites-ute`** con dos modos intercambiables:
  - **Tabla tipo Excel** con todas las fechas del trámite (consulta, aprobaciones, envíos, ensayos, docs 1 y 2, finalización), cliente, etapa, estado, caso, duración total, tiempo nuestro y tiempo UTE.
  - **Kanban** con las 7 etapas en columnas y drag & drop entre ellas. Al mover una tarjeta se abre un modal que pide las fechas correspondientes a la transición.
- **7 etapas** (Consulta, Solicitud, Docs 1, Docs 2, Relevar, Ensayos, Finalizado) y **4 estados** (Cerrado, En proceso, Esperando, Pendiente).
- **Cálculo automático de tiempo "nuestro" vs "UTE"** por trámite. Cada día entre una acción y la siguiente se imputa al lado responsable. Invariante verificada: total = nuestro + UTE.
- **Auto-cálculo de la etapa actual** a partir de las fechas cargadas. Si cambiás la etapa manualmente (dropdown en la tabla o arrastre en el kanban), se fija y ya no se re-deriva automáticamente; se puede desbloquear desde el detalle.
- **Dropdowns inline en la tabla** para cambiar etapa y estado sin abrir el detalle. El campo de caso también es editable directamente en la tabla. Las notas quedan editables sólo desde el drawer/pestaña UTE (con auto-save tras 1 segundo de inactividad).
- **Paleta de 6 colores** aplicable a cada celda de fecha (verde, amarillo, rojo, azul, gris, violeta). Por defecto verde. Los colores son globales (visibles para todos los usuarios).
- **Creación automática del trámite** al crear un proyecto nuevo (manual o por conversión de lead). Todos los proyectos existentes quedaron con un trámite vacío tras el seed.
- **Integración en la ficha del proyecto**: pestaña nueva "UTE" con el detalle completo del trámite (mismo componente que el drawer). Badge en el header del proyecto con la etapa y estado actuales, más link al trámite.
- **Métricas UTE en `/metrics`**: KPIs globales (activos, finalizados del año, duración promedio, tiempo promedio nuestro/UTE, tiempo promedio hasta iniciar trámite), duración promedio por etapa, distribución nuestro vs UTE, y top 5 trámites con más demora de cada lado.
- **Permisos**: módulo nuevo `TRAMITES_UTE` con acciones VIEW, CREATE, EDIT, DELETE asignables desde Admin. ADMIN y OPERACIONES tienen permisos completos; INGENIERIA y ASESOR_COMERCIAL sólo lectura por defecto.

#### Filtros y persistencia
- Los filtros (etapa, estado, búsqueda por cliente) y el modo de vista (tabla/kanban) se guardan en el navegador y se respetan al recargar.

#### Validaciones
- Las fechas de "enviada" deben ser anteriores a las de "aprobada" correspondientes. El backend rechaza combinaciones incoherentes con un mensaje claro.
- Mover una tarjeta hacia atrás en el kanban pide confirmación explícita (puede afectar las métricas).
- Mover a "Finalizado" exige cargar la fecha de finalización.

## v1.3

### 24 de abril de 2026

#### "Mis tareas" abre filtrada por las tuyas
- Al entrar a **Mis tareas**, la vista por defecto ahora es **"Solo mías"** (antes mostraba "Todas"). Así se ve de una el trabajo pendiente propio sin tener que filtrar cada vez.
- El filtro "Todas" sigue disponible en la barra superior para ver las etapas con pendientes del equipo. El link directo con `?scope=all` también funciona y se preserva al navegar.

#### Pre-llenado del responsable en subetapas nuevas
- Al crear una subetapa nueva dentro de una etapa, el campo **"Responsable"** ya viene pre-llenado con el responsable de la etapa padre (si la etapa tiene uno). Si no tiene, queda en "Sin asignar".
- Si cambiás el responsable en el form antes de guardar, se respeta tu elección. El pre-llenado es sólo un default.

#### Propagar responsable de la etapa a las subetapas sin asignar
- Al editar el **responsable de una etapa** y guardar, si la etapa tiene subetapas **sin responsable asignado**, aparece un modal: *"Esta etapa tiene N subetapas sin responsable. ¿Querés asignar el nuevo responsable también a esas subetapas?"*.
- Dos opciones:
  - **Solo cambiar la etapa**: cambia sólo el responsable de la etapa; las subetapas quedan como estaban.
  - **Sí, propagar**: asigna el nuevo responsable a todas las subetapas sin asignar. Las subetapas con otro responsable **nunca se tocan**.
- Si dejás el responsable de la etapa en "Sin asignar", no se propaga nada.
- Si la etapa no tiene subetapas sin asignar, el modal no aparece y se guarda directo.

#### Limpieza de datos históricos
- Se corrió un **script único** que propagó el responsable de cada etapa existente a sus subetapas que estaban sin asignar. Las que ya tenían otro responsable asignado no se modificaron.
- Este paso se hace una sola vez al deploy y es idempotente (correrlo de nuevo no cambia nada).

#### Deprecaciones (no afecta la UI)
- Los campos viejos de **responsable como texto libre** (`responsible` en subetapas/tareas, `responsibleName` en etapas) quedan marcados como deprecados. Se mantienen en la base de datos como referencia histórica pero ya no se editan desde la interfaz.
- El endpoint `/api/users/active` queda abierto a cualquier usuario autenticado (sólo devuelve datos no sensibles: id, nombre, email, rol, avatar), para que el selector de usuarios funcione desde cualquier rol.

## v1.2

### 23 de abril de 2026

#### Favicon con el logo de VOLTIA
- Ahora la pestaña del navegador muestra el **logo del sol azul** de VOLTIA PM (antes aparecía el logo genérico de Vite).
- También aplica al ícono que queda si guardás la app en la pantalla de inicio del celular.

#### Filtros y ordenamiento en la lista de proyectos
- **Sidebar "Clientes activos"**: nuevo selector **"Etapa en proceso"** con las 5 etapas del flujo (Onboarding, Ingeniería, Operaciones, Habilitación UTE, Postventa) + opción "Todas las etapas". Filtra por proyectos cuya etapa esté actualmente en curso.
- Se ampliaron las opciones de **orden** del sidebar a 8:
  - Más recientes · Más antiguos
  - Próxima instalación · Última instalación
  - Más avanzados · Menos avanzados
  - Alfabético A-Z · Alfabético Z-A
- Cada proyecto del sidebar muestra ahora:
  - La **etapa en curso** abajo del nombre (ej. "Ingeniería en curso").
  - Una **barra de progreso** con color progresivo: gris (0–33%), azul (33–66%), verde (66–99%), verde oscuro (100%).
- Los filtros quedan **persistentes**: al volver a abrir la app se restauran los últimos valores.

#### Página de proyectos: filtros y columnas nuevas
- Nuevo filtro **"Etapa en proceso"** arriba de la tabla con las mismas opciones que el sidebar.
- Nueva columna **"Etapa actual"** que muestra la etapa en curso (si hay varias en paralelo, la principal + "+N en paralelo").
- Nueva columna **"Instalación"** con la fecha de inicio de la instalación agendada (o "Sin agendar" si no tiene).
- La columna **"Avance"** ahora usa una escala que excluye Postventa (Habilitación UTE completada = 100%) y tiene la misma barra con colores progresivos.
- Los nuevos ordenamientos por click en el encabezado se suman a los ya existentes.
- Los filtros también persisten en el navegador.



### 23 de abril de 2026

#### Responsables reales en lugar de texto libre
- Los campos "Responsable" de **subetapas, tareas y etapas** ahora se eligen con un **selector de usuarios** (con avatar, nombre, rol y búsqueda) en lugar de escribirse a mano. Esto evita typos y permite filtrar, notificar y asociar tareas al usuario correcto.
- El selector incluye una opción **"Sin asignar"** al principio para dejar un responsable vacío.
- Los responsables cargados antes (texto libre) se siguen mostrando en pantalla con un badge **"legacy"** en gris. Un administrador tiene que **reasignarlos manualmente** desde la UI para que queden como usuarios reales.
- Mientras tanto, donde hoy figura "Responsable:" vas a ver tres estados posibles:
  - Nombre del usuario asignado (flujo nuevo).
  - Texto legacy atenuado + badge **"legacy"** (hay que reasignar).
  - "Sin asignar" en gris (no hay responsable cargado).

#### Admin: ver las tareas de otro usuario
- En la pantalla **"Mis tareas"**, los administradores ahora tienen un selector arriba **"Ver tareas de"** para revisar las tareas de cualquier otro usuario del sistema.
- Al cambiarlo aparece un banner informativo: *"Estás viendo las tareas de Juan Pérez"* con un botón **"Volver a las mías"**.
- Los usuarios no-admin no ven este selector y sólo pueden ver las propias.
- Queda traza en los logs del sistema cuando un admin consulta tareas ajenas (por transparencia).

#### Menos alertas en la ficha del proyecto
- Se eliminó el **banner amarillo** *"Revisá las fechas de instalación · La instalación queda fuera del rango planificado de Operaciones"* que aparecía de forma confusa. Ya no tenía sentido porque quitamos las fechas planificadas de la UI.
- Las validaciones de coherencia entre **instalación ↔ Operaciones** ahora sólo comparan contra fechas reales (inicio real y fin real de la etapa). Se mantienen los bloqueos de seguridad:
  - La instalación no puede empezar antes del inicio real de Operaciones.
  - La instalación no puede terminar después del cierre real de Operaciones.
  - No se puede cerrar Operaciones si la instalación todavía no terminó.
- Las alertas que quedan son **rojas** (errores reales); ya no hay advertencias ámbar por rango planificado.

#### Mis tareas: ordenamiento y URL compartible
- Nuevo selector **"Ordenar"** con 3 opciones:
  - **Urgencia** (por defecto): atrasadas primero, después las que vencen pronto.
  - **Proyecto**: alfabético por nombre de proyecto; dentro de cada proyecto, en el orden del flujo (Onboarding → Ingeniería → Operaciones → Habilitación → Postventa).
  - **Fecha de vencimiento**: las más próximas primero; las que no tienen fecha al final.
- El subtítulo de la página refleja el orden elegido.
- Los filtros aplicados quedan en la URL (ej. `/mis-tareas?sort=project&scope=mine`) para que puedas **guardarla o compartirla** y al abrirla aparezca la misma vista.

## v1.1

### 23 de abril de 2026

#### Nueva sección "Mis tareas"
- Nueva entrada en el menú **"Mis tareas"** (primera opción, disponible para todos los usuarios autenticados).
- Muestra un **dashboard personal** con las etapas de proyectos en las que estás involucrado, ordenadas por urgencia.
- Cada fila es un **proyecto + etapa activa**, con:
  - Barra lateral de color según urgencia (rojo = atrasada o vence hoy, amarillo = ≤ 7 días, verde = > 7 días, gris = sin fecha).
  - Nombre del proyecto, badge de la etapa con color por módulo (Onboarding, Ingeniería, Operaciones, Habilitación, Postventa), código del proyecto.
  - Contador de subetapas pendientes, destacando cuántas son tuyas.
  - Fecha límite de la etapa a la derecha.
- Al expandir cada fila se ven las **subetapas pendientes** con:
  - Estado visual (pendiente / en curso / bloqueada).
  - Nombre, fecha de vencimiento y progreso del checklist (X / Y ítems).
  - Avatar del responsable (con resaltado especial si sos vos).
- **Filtro "Todas" / "Solo mías"** para mostrar o filtrar por etapas con tareas asignadas a vos.
- Stats arriba: etapas activas totales, subetapas pendientes, asignadas a vos y atrasadas.
- Clic en una subetapa o en "Abrir etapa completa" lleva al proyecto con la **etapa ya abierta** en el drawer.
- Cada usuario ve sólo las etapas cuyo módulo corresponda a sus permisos (Ingeniería solo si tiene INGENIERIA.VIEW, etc.).
- Si no hay tareas pendientes, mensaje amistoso: "No tenés etapas activas en este momento. ¡Bien hecho!".

#### Menú para móvil con hamburguesa
- Desde el celular, el ícono ☰ del header ahora **abre un menú lateral** con todas las secciones: Dashboard, Proyectos, Calendario, Ventas, Finanzas, Stock, Métricas y Admin.
- Cada link tiene ícono y la sección en la que estás queda resaltada.
- El menú respeta tus **permisos**: sólo muestra lo que podés ver (por ejemplo, Admin solo para administradores).
- En la parte inferior del menú se ve tu usuario y hay un botón **"Cerrar sesión"**.
- Se cierra tocando fuera, con el ícono ✕ o con la tecla ESC.
- En desktop (pantallas grandes) el menú sigue apareciendo arriba como siempre.

#### Arreglos
- **Preview y descarga de documentos adjuntos**: se corrigió el problema por el que los documentos se veían en blanco al abrir el preview y no se podían descargar. Ahora los PDF e imágenes cargan correctamente en el modal y el botón "Descargar" guarda el archivo con su nombre original. También se muestran las miniaturas de las imágenes en la fila de documentos.

## v1.0

### 22 de abril de 2026

#### Crear proyectos con menos fricción
- Al crear un proyecto ahora sólo son obligatorios **cliente**, **ciudad** y **departamento**. Todo lo demás se puede cargar después.
- El sistema fotovoltaico (inversor y paneles) es 100% opcional al dar de alta el proyecto. Si todavía no tenés los datos técnicos, creá el proyecto vacío y editalo más adelante.
- Se quitaron los asteriscos de "obligatorio" cuando el bloque es opcional, para que el formulario sea menos confuso.

#### Menos fechas en pantalla
- Se eliminaron las "fechas planificadas" de toda la interfaz (modales, cabeceras, tablas, drawer de etapas y Gantt). Ahora sólo se muestran las fechas reales.
- El Gantt del proyecto se simplificó: sólo se ven las barras azules de avance real y los bloques naranjas de instalación, con la línea de "Hoy".

#### Nuevos indicadores del proyecto
- En la ficha de un proyecto se reemplazaron los viejos indicadores ("ritmo en riesgo", "desvío acumulado", "entrega ajustada") por tres más útiles:
  - **Avance general**
  - **Tiempo desde venta** (días desde que se creó el proyecto)
  - **Etapa actual**

#### Métricas renovadas
- La sección Métricas ya no muestra "desvío" ni "eficiencia temporal".
- Nuevo indicador: **promedio de días desde venta hasta entrega** de los proyectos completados.
- El gráfico de duración por etapa ahora muestra el **promedio real** con el rango mínimo/máximo observado, en vez de comparar plan vs real.
- El ranking de proyectos se ordena por avance en lugar de por desvío.

#### Integración proyecto ↔ calendario
- En la ficha del proyecto hay un nuevo botón al lado del nombre del cliente:
  - Si la obra ya está agendada: **📅 Ver en calendario** lleva al calendario con esa instalación seleccionada.
  - Si todavía no está agendada: **📅 Agendar instalación** abre el calendario con el modal de nueva instalación pre-llenado con el proyecto.

#### Calendario: obras con pausas en el medio
- Una misma instalación ahora puede tener **varios tramos de obra** (por ejemplo: trabajar de lunes a miércoles, parar dos días, y volver de sábado a lunes).
- En el panel lateral del calendario hay una nueva sección **"Tramos de obra"** donde podés:
  - Ver cada tramo con sus fechas y cantidad de días.
  - **Agregar tramo** (botón "+ Agregar tramo").
  - Editar un tramo existente (✎).
  - Eliminar un tramo (🗑). El último tramo no se puede eliminar, tiene que quedar al menos uno.
- Cuando reprogramás una obra que tiene varios tramos, el sistema te pide elegir cuál tramo querés mover.
- Si dos tramos del mismo proyecto se superponen, el sistema avisa y no deja guardar.

#### Calendario: se ven más obras en paralelo
- Antes se mostraban hasta 3 instalaciones simultáneas por día. Ahora se muestran hasta **4**.
- Los bloques se achican automáticamente según la cantidad (1 obra = barra grande, 4 obras = 4 barras finas).
- Si hay 5 o más obras el mismo día, aparece un indicador "+X más" para verlas.

#### Calendario: empaquetado más compacto
- Cuando un equipo termina una obra un día y empieza otra al día siguiente, las dos obras ahora quedan en la **misma fila visual**, sin espacios vacíos arriba.
- Esto hace que el calendario se vea más lleno y ordenado, especialmente cuando hay varias obras consecutivas del mismo equipo.

#### Formularios más limpios
- Se eliminaron los textos sugeridos ("placeholders") en los campos de los formularios. Antes muchos campos tenían ejemplos grises adentro que parecían valores cargados; ahora los campos vacíos se ven efectivamente vacíos.
- Se mantienen los placeholders útiles:
  - Campos de búsqueda ("Buscar…").
  - Campos de login y cambio de contraseña.
  - Confirmación de borrado de un proyecto (donde hay que tipear el código del proyecto exacto).

#### Rediseño de la ficha del proyecto
- Se reorganizó toda la ficha del proyecto para que lo importante esté arriba y visible sin scroll: primero los datos del cliente, después el sistema fotovoltaico, después el pipeline de etapas, después los indicadores y los documentos.
- Las métricas y gráficos secundarios (presupuesto ejecutado, generación estimada, CO₂ evitado, avance por área) se movieron a una sección colapsable **"Más datos del proyecto"** al fondo de la página, para no saturar la vista.

#### Datos del cliente integrados al header
- Los datos de contacto del cliente (email, teléfono y dirección) ahora aparecen como una **línea con íconos** justo debajo del código del proyecto, en el header. Se eliminó la card separada para liberar espacio vertical y que el pipeline quede visible sin hacer scroll.
- Si un dato no está cargado, no se muestra (la línea se arma sólo con lo que hay).
- El email es clickeable (abre el cliente de mail) y el teléfono también (llamada directa en móvil).
- Nuevo campo **"Dirección"** en el alta y la edición de proyectos.

#### Control de versiones
- Se agregó un **indicador de versión** fijo en la esquina inferior derecha de todas las pantallas (ej: "v1.0").
- Al hacer clic se abre un modal con el **historial completo de versiones** (este mismo changelog) formateado y con scroll.
- Versión inicial: **v1.0**.

#### Reprogramar a fechas pasadas
- En el calendario ahora se pueden reprogramar obras (y sus tramos) a **fechas anteriores a hoy**. Sirve para ajustar el calendario a las fechas reales en las que se ejecutaron las obras (antes el sistema bloqueaba esto).

#### Pipeline más grande y con tiempos
- Los bloques del pipeline de etapas se ven ~30% más grandes: nombres de etapa y subetapas más legibles.
- Debajo de cada etapa aparece la duración:
  - Etapa completada → "Completada en X días".
  - Etapa en curso → "En curso · X días".
  - Etapa pendiente → "Sin iniciar".
  - Postventa → "Sin fechas asociadas".
- Si hay varias etapas en curso al mismo tiempo (por ejemplo Ingeniería y Onboarding juntas), cada una muestra su propio contador de días en curso.

#### Indicadores rediseñados
- Los indicadores de la ficha del proyecto se simplificaron a **3 tarjetas** debajo del pipeline:
  - **Avance**: porcentaje y "X de Y etapas".
  - **Días desde venta**: días desde que se creó el proyecto.
  - **Etapa actual**: nombre de la etapa en curso y cuántos días lleva.

#### Sección de documentos
- Nueva sección **"Documentos"** en la ficha del proyecto que reúne todos los archivos adjuntos del proyecto (subidos desde cualquier etapa o subetapa) en una fila con scroll horizontal.
- Cada documento se ve como una tarjeta con ícono según el tipo de archivo (PDF, imagen, Word, Excel, otros), nombre, tamaño y fecha de subida.
- Las imágenes muestran una **miniatura directamente** en la tarjeta.
- Al hacer clic en un documento se abre un **modal de vista previa** grande con:
  - Vista previa del archivo (PDF e imágenes se muestran embebidos).
  - Para otros formatos (Word, Excel, ZIP, etc.): mensaje "Vista previa no disponible para este formato" y opción de descargar.
  - Botones "Cerrar" y "Descargar".
  - Origen del documento (ej: "Subetapa Relevamiento Técnico").
- Si el proyecto todavía no tiene documentos, se muestra el mensaje "Este proyecto no tiene documentos adjuntos todavía".

#### Arreglos
- **Editar sistema fotovoltaico**: se corrigió un error que hacía que al modificar datos técnicos (inversor, paneles) aparecía "404 Not Found" y los cambios no se guardaban.
- **Guardado del sistema técnico**: si cargás sólo algunos campos del inversor o los paneles, ahora se guarda lo que cargaste sin borrar el resto. Antes se podía pisar accidentalmente información existente.
- **Números con coma**: si escribís "25,5" en un campo numérico del sistema técnico, ahora se acepta igual que "25.5".
