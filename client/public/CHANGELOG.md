# Novedades

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
