# Novedades

## v2.4

### 26 de abril de 2026

#### Pagos parciales y vista por proveedor

**Nuevo concepto de "Pago" separado de "Factura"**
- Antes: una factura (`FinanceMovement`) sólo podía estar en estado A pagar o Pagado, todo o nada.
- Ahora: cada **pago real** (transferencia, cheque, efectivo) es una entidad separada que puede aplicarse a **una o varias facturas** del mismo proveedor. Una factura puede recibir varios pagos parciales.
- **Estado nuevo: "Parcialmente pagado"** (badge ámbar) para las facturas con pagos pero saldo > 0.

**Página nueva "Pagos" (`/finanzas/pagos`)**
- Tabla con todos los pagos del sistema. Filtros por proveedor, rango de fechas, "solo con saldo sin aplicar".
- 3 KPIs: Pagos del mes, Total aplicado, Saldo sin aplicar (créditos a favor de proveedores).
- Botón **"+ Registrar pago"** abre modal con buscador de proveedor + datos del pago + toggle "Aplicar a facturas ahora".
- Si el toggle está activo, después de guardar abre el modal de aplicación con las facturas pendientes del mismo proveedor.
- Click en cualquier pago abre un drawer lateral con: datos del pago, lista de aplicaciones (botón "Quitar aplicación"), botón "Aplicar a más facturas" si hay saldo, botón rojo "Anular pago" (revierte aplicaciones).

**Modal "Aplicar pago a facturas"**
- Lista las facturas del mismo proveedor en la misma moneda (excluye PAGADO y PREVISTO).
- Cada fila: checkbox + monto editable. Por default propone el saldo pendiente real de la factura.
- Footer: total a aplicar, saldo después, validación de no exceder. Botón "Aplicar" deshabilitado si no cuadra.
- El backend valida en el commit y rechaza con mensaje claro si excede.

**Vista detallada del proveedor (`/finanzas/proveedores/:id`)**
- Header con datos del proveedor + botones Editar / Registrar pago / Nuevo gasto.
- 3 KPIs: Total adeudado (rojo si > 0), Saldo a favor (info si > 0), Saldo neto (verde si tenemos crédito, rojo si debemos).
- 3 tabs:
  - **Facturas**: tabla con monto, pagado, saldo, vencimiento, estado. Filtros: Todas / Pendientes / Parciales / Pagadas. Filas vencidas resaltadas en rojo.
  - **Pagos**: tabla con monto, aplicado, saldo sin aplicar. Filtros: Todos / Con saldo / Aplicados. Click → drawer del pago.
  - **Estado de cuenta**: línea de tiempo cronológica unificada con saldo acumulado en USD (UYU se convierte con el último TC). Muestra deuda (positivo) o saldo a favor (negativo).

**Lista de proveedores rediseñada**
- Columnas nuevas: **Saldo neto** (color rojo si debemos / verde si saldo a favor), **N° facturas pendientes**, **Última actividad**.
- Click en el nombre o en "Ver" lleva a la vista detallada.
- Saldos por moneda separados (USD y UYU no se mezclan).

**Integraciones en Movimientos**
- Filtro de Estado incluye "Parcialmente pagados".
- Detail panel de cada movimiento muestra **monto pagado y saldo pendiente** si tiene pagos aplicados, además de la lista de "Aplicaciones de pago" (cada pago con fecha, método, referencia y monto aplicado).
- Si la factura tiene proveedor y saldo > 0, aparece botón **"Registrar pago a este proveedor"** que abre el flujo de creación de Payment con monto pre-rellenado al saldo pendiente.
- El listing devuelve `saldoPendiente` y `montoPagado` calculados en tiempo real.

**Página "A pagar" actualizada**
- Incluye también las facturas en estado **Parcialmente pagado** (antes solo COMPROMETIDO/A_PAGAR).
- La columna "Monto" muestra el **saldo pendiente** (no el monto total) — abajo en gris muestra "de $X" cuando hay diferencia.
- Los KPIs (Comprometido, A pagar, Vencido, Vence esta semana) se calculan sobre saldos pendientes, no montos totales.
- Acción nueva por fila: cuando la factura tiene proveedor, aparece botón **"💲 Pagar"** que abre el flujo de Payment. Para gastos sin proveedor sigue funcionando la transición manual a PAGADO.

**Cambios técnicos importantes**
- Migración `add_payments_and_applications`: nuevas tablas `payments` y `payment_applications`, enum `FinanceMovementStatus` ampliado. La tabla legacy `finance_payments` (estaba sin uso) fue eliminada.
- Bloqueo de transición manual a PAGADO si el movimiento tiene proveedor: el backend devuelve 400 con sugerencia de usar el flujo de Pagos. Para gastos sin proveedor (ajustes contables) la transición manual sigue disponible.
- El cálculo de status de cada factura es **automático** al aplicar/quitar pagos (no se setea manualmente).
- El módulo Comprobantes (legacy, sin datos) quedó **oculto en la UI** pero el backend y la base de datos lo conservan por si hace falta restaurarlo. Se eliminará en cleanup futuro si no se reactiva (revisar mayo 2026).

## v2.3

### 26 de abril de 2026

#### Stock unificado con catálogo de Materiales + desglose de facturas

**Catálogo único**
- El catálogo de Stock y el de Materiales se unificaron: ahora son la misma tabla. Los productos físicos viven en Admin → Materiales (también editables desde Stock) y comparten precio sugerido, proveedor por defecto, categoría y unidad.
- Cada ítem tiene un toggle **"Gestiona stock"**: si está prendido es un producto físico que entra/sale del depósito; si está apagado es un servicio (mano de obra, trámites) que no impacta inventario pero sí puede aparecer en la lista de materiales del proyecto y generar previstos.
- Campo nuevo **"Ubicación depósito"** por ítem.
- Los datos de prueba viejos del Stock se borraron (los 5 productos demo y sus 2 movimientos). El stock arranca en 0 y se carga manualmente o vía desglose de factura.

**Página Stock rediseñada**
- Tabla muestra: producto, categoría, unidad, stock, mínimo, ubicación, precio sugerido. Filas de servicios se distinguen con badge.
- Crear/editar producto = crear/editar MaterialItem (mismo modal en Stock y en Admin → Materiales).
- Filtro nuevo: "Incluir servicios (sin stock)" — por default sólo se muestran físicos.
- "Valor inventario" se calcula con precio sugerido (el costo promedio dejó de existir).
- Modal de Ingreso pide ahora **causa**: Factura / Devolución de proveedor / Ajuste de inventario / Importación inicial / Otro. Aviso explícito de que para facturas conviene cargar el desglose desde Finanzas.

**Desglose de factura → ingreso al stock**
- Cuando un movimiento de gasto pasa a estado **A pagar** o **Pagado**, aparece un nuevo flujo para cargar el detalle de los ítems comprados.
- En el form de "Nuevo movimiento", al elegir A pagar/Pagado aparece un panel ámbar con dos opciones:
  - Botón **"Cargar desglose ahora"**: guarda el movimiento y abre directamente el modal de desglose.
  - Toggle **"Esta factura no tiene materiales"**: se guarda como sin materiales (servicios, mano de obra) y no impacta stock.
  - Si se ignora, el movimiento queda como "Desglose pendiente" con un toast de aviso.
- En la lista de movimientos, cada factura A pagar/Pagado sin desglose muestra:
  - Badge ámbar "⚠ Desglose pendiente" pegado a la descripción.
  - Botón "Desglose" en la columna de acciones que abre el modal directo.
- Las que ya tienen desglose confirmado muestran badge verde "✓ Stock".
- Filtro nuevo en Movimientos: **"Pendientes de desglose"** que filtra localmente A pagar/Pagado sin desglose ni "sin materiales".

**Modal de desglose**
- Header con monto objetivo del movimiento y toggle "Esta factura no tiene materiales".
- Tabla editable inline: cantidad y precio unitario con blur/Enter; subtotal calculado.
- Selector de productos del catálogo (sólo físicos), agrupado por categoría con buscador.
- Footer con: total ítems, monto del movimiento, **diferencia** en rojo si no cuadra. Botón "Confirmar desglose" deshabilitado hasta que la diferencia sea menor a 1 centavo.
- Al confirmar:
  - Se genera un movimiento de stock de tipo **Ingreso** por cada ítem con causa **Factura**.
  - Se actualiza el stock actual del catálogo automáticamente.
  - La factura queda marcada como "Stock ingresado".
- Si después se anula la factura, todos esos ingresos de stock se revierten automáticamente.

**Anular movimiento**
- En el detalle de un movimiento con desglose confirmado, botón nuevo **"Anular movimiento (revierte stock)"** con confirmación.
- Crea un movimiento de stock espejo (sale lo que entró) para mantener el saldo correcto.
- El movimiento original queda marcado como ANULADO con `deletedAt` (preserva histórico para auditoría).

**Alertas globales**
- En el **Dashboard general** (página principal), si hay facturas con stock sin desglosar, aparece un banner ámbar arriba con link directo (sólo para usuarios con permiso FINANZAS.VIEW).
- En el **Dashboard de Finanzas** (`/finanzas`), banner equivalente al lado del de stock bajo mínimo.

**Pestaña Costos del proyecto rediseñada**
- Antes los KPIs eran Previsto/Comprometido/A pagar/Pagado de FinanceMovements. Ahora la pestaña refleja **costo real consumido** del proyecto, basado en los egresos de stock vinculados al `projectId`.
- KPIs: Costo total (USD + UYU desglosados), ítems consumidos, presupuesto del proyecto, **margen estimado** (presupuesto USD − costo total USD, con porcentaje).
- Tabla por categoría con totales consolidados en USD.
- Tabla detalle de cada consumo: ítem, categoría, cantidad, precio unitario (con marca `cat.` si vino del precio sugerido del catálogo en lugar del costo grabado), subtotal, fecha.
- UYU se convierte a USD con el último tipo de cambio cargado; se aclara explícitamente abajo.

**Pestaña Materiales del proyecto**
- El dropdown del modal "Registrar consumo" ahora sólo lista productos físicos (gestionaStock=true). Servicios no aparecen porque no tiene sentido consumir mano de obra del depósito.

#### Cambios técnicos importantes
- Migración `unify_stock_with_materials_and_invoice_items`: se eliminó la tabla `stock_products`; los movimientos de stock ahora apuntan a `material_items`. Tabla nueva `invoice_items` para el desglose por factura.
- Endpoints nuevos: `GET/POST/PATCH/DELETE /api/finance/movements/:id/invoice-items`, `POST /api/finance/movements/:id/invoice-items/confirm`, `POST /api/finance/movements/:id/mark-no-materials`, `POST /api/finance/movements/:id/cancel`, `GET /api/finance/movements/pending-detail`, `GET /api/projects/:id/cost-summary`.

## v2.2

### 26 de abril de 2026

#### Previsión de gastos por proyecto + estados de movimientos
Sistema completo para planificar el gasto de cada proyecto desde la lista de materiales y seguir el ciclo de cada compromiso hasta el pago.

**Catálogo maestro de materiales (Admin → Materiales)**
- Nueva pestaña en Administración con dos secciones:
  - **Categorías**: 9 categorías precargadas (Paneles, Inversores, Estructura, Cableado, Protecciones, Mano de obra, Trámites, Logística, Otros). Editables, reordenables con flechas, desactivables. Si una categoría tiene ítems vinculados, al eliminarla queda inactiva en lugar de borrarse.
  - **Ítems**: catálogo central de materiales con nombre, descripción, unidad, precio sugerido (USD o UYU) y proveedor por defecto. Filtros por categoría, búsqueda, mostrar inactivos. Si un ítem está usado en algún proyecto, "Eliminar" lo desactiva en lugar de borrarlo.

**Lista de materiales en cada proyecto (etapa Ingeniería)**
- Dentro del drawer de la etapa **Ingeniería** del proyecto aparece una sección "Lista de materiales" con tabla agrupada por categoría.
- Botón **"+ Agregar ítem"** abre un buscador del catálogo agrupado por categorías; permite agregar varios sin cerrar el modal.
- **Cantidad, precio y proveedor** se editan inline (blur o Enter guarda).
- Cada fila puede tener una **nota** (ícono de chincheta).
- Total estimado en el footer; subtotales por categoría en cada header.

**Generación de gastos previstos**
- Botón **"Generar previstos"** crea un movimiento `PREVISTO` por cada material de la lista, vinculado al proyecto. Si hay materiales sin previsto generado, el botón propone generar sólo los faltantes.
- Banner cuando ya hay previstos generados con la fecha de última actualización.
- **Regenerar** (solo admin): borra los previstos actuales y vuelve a generarlos en base a la lista. Pide confirmación.
- Si eliminás un material que tenía previsto generado, se borra también el movimiento.

**Nuevos estados de movimiento (Finanzas → Movimientos)**
- Cada movimiento de gasto tiene ahora un **estado** del ciclo de vida:
  - **Previsto** (gris): proyección desde la lista de materiales, no se crea manualmente.
  - **Comprometido** (azul): compra acordada pero todavía sin fecha de pago.
  - **A pagar** (ámbar): tiene fecha de vencimiento.
  - **Pagado** (verde): cerrado.
- **Filtro nuevo "Estado"** en la lista de movimientos, persistido por usuario.
- **Columna nueva "Vence"** muestra el dueDate; las filas vencidas (status A pagar con fecha pasada) se resaltan en rojo con ⚠.
- **Acciones rápidas** en la fila: si está Comprometido aparece botón "→ A pagar" (pide vencimiento); si está A pagar aparece "→ Pagado" (pide fecha de pago).
- Modal de crear/editar adapta los campos según el estado (fecha esperada para previstos/comprometidos, vencimiento para A pagar).

**Página "Cuentas a pagar" (Finanzas → A pagar)**
- Nueva vista en `/finanzas/a-pagar` con todo lo Comprometido y A pagar ordenado por vencimiento ascendente.
- 4 KPIs en el header: Comprometido total, A pagar total, Vencido (en rojo si > 0), Vence esta semana.
- Filtros por rango (Vencidos / Esta semana / Este mes / Próximos 30 días / Todos), proyecto y proveedor. Persistencia.
- Botón "Marcar como pagado" o "→ A pagar" en cada fila.
- Acceso rápido desde el dashboard de Finanzas.

**Limpieza de previstos al registrar la compra real**
- Al crear o editar un movimiento con estado **Comprometido** o **A pagar**, aparece un botón "🧹 Limpiar previstos asociados…".
- Abre un modal con todos los previstos pendientes agrupados por proyecto, con buscador y checkboxes individuales o por proyecto.
- Muestra el total seleccionado y al confirmar elimina los previstos elegidos para que no queden contados dos veces.

**Pestaña "Costos" en cada proyecto**
- Junto a UTE, en el panel inferior del proyecto, hay una pestaña nueva **Costos** con todos los movimientos vinculados.
- 4 KPIs: Previsto, Comprometido, A pagar, Pagado, separados por moneda.
- Si el proyecto tiene presupuesto cargado, calcula el **margen estimado** (presupuesto − todos los costos en USD) y el porcentaje.
- Filtro rápido por estado.

**Flujo de fondos enriquecido**
- El widget de Flujo de fondos ahora muestra también: Previsto total, Comprometido total, A pagar total.
- Toggle "Incluir previstos en proyección" cambia cómo se calcula el saldo proyectado (con previstos = visión pesimista; sin previstos = sólo compromisos firmes).

**Proveedores con datos de contacto**
- El form de proveedores ahora persiste correctamente **RUT/CUIT, persona de contacto y dirección** (antes RUT se perdía al guardar).
- La tabla de proveedores muestra RUT y contacto. Filtros nuevos: buscador por nombre/RUT/contacto/email + Activos/Todos/Inactivos. Persistencia.
- El nombre del proveedor ahora es **único entre activos**: el backend rechaza duplicados.

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
