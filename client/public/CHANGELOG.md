# Novedades

## v1.2

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
