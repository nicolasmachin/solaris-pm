/**
 * Última release publicada — alimenta el cuadro "Novedades" del Dashboard.
 *
 * IMPORTANTE: actualizar este archivo a la par del CHANGELOG.md en cada
 * bump de versión (mismas secciones, mismos bullets, mismo lenguaje de
 * usuario). Ambos son fuente de verdad: CHANGELOG.md para devs/git, este
 * para la UI del Dashboard.
 *
 * Por qué no se importa CHANGELOG.md directo: el container Docker del
 * cliente sólo monta ./client, no la raíz del repo, y un import raw de
 * `../../../CHANGELOG.md` no resuelve sin modificar docker-compose.yml.
 */

export type ReleaseSection = {
  title: string;
  items: string[];
};

export type Release = {
  version: string;
  date: string;
  sections: ReleaseSection[];
};

export const LATEST_RELEASE: Release = {
  version: "10.9",
  date: "19 de septiembre de 2026",
  sections: [
    {
      title: "Indicadores y metas desde el chat de Claude",
      items: [
        "Los indicadores del mail de los lunes se pueden pedir en el chat para cualquier período (semana, mes, trimestre, año o rango de fechas): leads, propuestas, visitas, ventas con su monto, conversión, tiempos del embudo, obras y kWp.",
        "Se puede comparar contra el período anterior, ver el desglose por vendedor y la lista de ventas, visitas y obras.",
        "Avance de las metas del trimestre y del año, y cuánto duran en la realidad las etapas de obra frente a su plazo.",
      ],
    },
    {
      title: "Control de etapas y operaciones desde el chat de Claude",
      items: [
        "Qué obras tienen la etapa vencida o por vencer, con su responsable, como en el panel de operaciones del dashboard.",
        "Clientes sin comunicación según la cadencia de su recorrido, obras vendidas sin fecha de instalación y el panel de trámites UTE.",
      ],
    },
    {
      title: "Fechas del lead desde el chat de Claude",
      items: [
        "Las fechas del proceso de un cliente potencial (alta, propuesta, visita agendada, visita realizada, cierre) se pueden corregir desde el chat. Siguen completándose solas.",
        "Todo cambio de fecha queda en el historial, y una fecha cargada a mano se ve el mismo día en el panel, el listado y las métricas.",
      ],
    },
    {
      title: "Finanzas desde el chat de Claude",
      items: [
        "Estado de resultados de un mes, trimestre, año o cualquier rango de fechas, con los mismos números que la pestaña Estado de resultados.",
        "Cobros a clientes con y sin plan de pagos, cuotas vencidas y por vencer.",
        "Comisiones pendientes de los asesores y pagos pendientes a los instaladores tercerizados.",
      ],
    },
  ],
};

const RELEASE_10_8: Release = {
  version: "10.8",
  date: "18 de septiembre de 2026",
  sections: [
    {
      title: "Reportes fotovoltaicos: el reporte dice qué días cubre",
      items: [
        "El reporte ya no dice solo el mes: muestra el período medido, de qué día a qué día. Sin día de corte es el mes completo (1 al 31 de agosto); con día de corte es el ciclo del medidor de UTE (7 de julio al 6 de agosto).",
        "El asunto y el texto del mail al cliente dicen el mismo período que el PDF.",
        "La pantalla de Reportes FV abre siempre en el mes anterior, que es el que se reporta.",
      ],
    },
    {
      title: "Reportes fotovoltaicos: el envío deja de ser por mes",
      items: [
        "\"Enviar pendientes\" manda todo reporte generado que el cliente todavía no recibió, hasta una fecha de corte, sea del mes que sea. Si a alguien le quedó un mes sin mandar, recibe los dos.",
        "Desde la misma pantalla se pueden regenerar todos los PDF pendientes antes de enviar.",
        "Los clientes con día de corte tienen su reporte listo solos a los 7 días de cerrar su ciclo, sin esperar al mes siguiente.",
      ],
    },
  ],
};

const RELEASE_10_7: Release = {
  version: "10.7",
  date: "17 de septiembre de 2026",
  sections: [
    {
      title: "La comisión se registra sola al ganar la venta",
      items: [
        "Al marcar un lead como ganado, la comisión queda registrada sin confirmar nada, tomando el precio de la última propuesta publicada. Antes, si se cerraba el modal sin confirmar, la venta quedaba sin monto para siempre.",
        "El modal sigue apareciendo, pero ahora es para cambiar la propuesta elegida si el cliente aceptó otra versión: se recalcula la comisión y el pendiente en Finanzas.",
        "En los informes, el monto de cada venta sale de la propuesta y no de la comisión.",
      ],
    },
    {
      title: "El reporte semanal de indicadores llega al correo de la empresa",
      items: [
        "El mail de indicadores que sale los lunes a la madrugada pasa a llegar a la casilla de Voltia, la misma donde llegan el resto de los avisos del sistema. Antes iba a una casilla personal.",
      ],
    },
  ],
};

const RELEASE_10_6: Release = {
  version: "10.6",
  date: "16 de septiembre de 2026",
  sections: [
    {
      title: "El calendario ya no es solo de obras",
      items: [
        'Además de las instalaciones se pueden agendar mantenimientos, soportes/reclamos y visitas técnicas, con el botón "+ Agendar otra cosa".',
        "Se agendan en un día y se le pueden sumar días sueltos, que no tienen por qué ser seguidos: un mantenimiento puede quedar el lunes y el jueves sin tocar el miércoles.",
        "Cada tipo se distingue por una barra de color a la izquierda y un ícono. El fondo sigue siendo el color del equipo y el rayado sigue marcando las fechas sin confirmar.",
        "Filtro para elegir qué ver, y cada uno guarda su propia combinación para la próxima vez.",
        "Si el evento se asigna a un cliente, queda en la ficha del proyecto y aparece en sus novedades. Los de soporte pueden engancharse a un ticket.",
      ],
    },
    {
      title: "Equipos",
      items: [
        "Se dio de baja el equipo Leo: ya no se puede asignar a nada nuevo, pero las obras que hizo siguen mostrando su nombre para no perder el histórico.",
      ],
    },
  ],
};

const RELEASE_10_4: Release = {
  version: "10.4",
  date: "15 de septiembre de 2026",
  sections: [
    {
      title: "Capacitación: videos y documentos para el equipo",
      items: [
        "Nueva sección Capacitación en el menú de tu usuario (arriba a la derecha): videos y documentos para aprender a usar la app y trabajar mejor.",
        "Está dividida por áreas —Ventas, Ingeniería y Tramitación, Operaciones, Experiencia Solar, Finanzas y Otros—, y cada persona ve solo las de su rol.",
        "Los videos se miran dentro de la app, con una lista de reproducción al costado: marca cuáles ya viste, recuerda por dónde ibas y pasa solo al siguiente.",
        "Cada área tiene también sus documentos, que se ven o se descargan.",
        "Botón Copiar enlace para pasarle a un compañero el link a un video puntual.",
        "Quien administra tiene Gestionar: arma las áreas y elige qué roles ven cada una, crea listas, agrega videos de la biblioteca de Voltia eligiéndolos con su miniatura, sube documentos y ve en una tabla quién completó qué.",
      ],
    },
  ],
};

const RELEASE_10_3: Release = {
  version: "10.3",
  date: "13 de septiembre de 2026",
  sections: [
    {
      title: "Ingeniería ya puede dar de alta materiales",
      items: [
        "Quien hace ingeniería entra a Administración y crea ítems nuevos del catálogo sin depender de un administrador.",
        "Dentro de Administración solo ve la sección Materiales: el resto no le aparece.",
        "Puede crear, editar y desactivar ítems. Eliminar y administrar las categorías siguen siendo del administrador.",
      ],
    },
  ],
};

const RELEASE_10_2: Release = {
  version: "10.2",
  date: "9 de septiembre de 2026",
  sections: [
    {
      title: "La etapa del proyecto: quién puede moverla y cómo",
      items: [
        "Fijar la etapa a mano pasó a ser un permiso propio: antes lo podía hacer cualquiera con permiso de edición sobre Operaciones (13 roles, incluidos asesores comerciales, logística e instaladores tercerizados). Ahora solo el Administrador y el Gerente de Operaciones.",
        "Ya se puede retroceder la etapa, no solo avanzarla: si una obra se pospone, se la baja a donde realmente está. Antes el desplegable solo ofrecía avanzar y el sistema ignoraba en silencio cualquier intento de bajarla.",
        'La etapa fijada a mano manda siempre, para adelante y para atrás. Sigue con la marca "manual" al lado y la opción "Volver a automático" devuelve el cálculo por subetapas.',
        "La etapa automática ya no se adelanta por el trámite de UTE: ahora es siempre la primera etapa sin completar. Como el trámite arranca al principio y va en paralelo, antes tapaba cualquier etapa anterior que hubiera quedado abierta.",
      ],
    },
  ],
};

const RELEASE_9_9: Release = {
  version: "9.9",
  date: "27 de agosto de 2026",
  sections: [
    {
      title: "Pagos a instaladores — corregir y anular entregas",
      items: [
        "Ahora se puede corregir o anular una entrega ya registrada a un instalador (por ejemplo, si cargaste un monto que no era), desde el botón de pagos del trabajo, incluso cuando ya está saldado.",
        "La corrección o anulación se refleja al instante en Finanzas: la entrega es un movimiento, así que se actualizan Movimientos, el flujo de fondos y el estado de resultados.",
        "En el listado, el nombre de cada instalador se muestra con su propio color, para identificarlos de un vistazo.",
        "El resumen para WhatsApp ahora muestra las últimas tres obras saldadas (ordenadas por fecha de obra), en vez de solo la última.",
      ],
    },
  ],
};

/** Versiones anteriores para mostrar en el sidebar de novedades. */
export type OldRelease = {
  version: string;
  shortDate: string;
  highlights: string[];
};

export const OLDER_RELEASES: OldRelease[] = [
  {
    version: "10.8",
    shortDate: "18 sep",
    highlights: RELEASE_10_8.sections.map((sec) => sec.title),
  },
  {
    version: "10.7",
    shortDate: "17 sep",
    highlights: RELEASE_10_7.sections.map((sec) => sec.title),
  },
  {
    version: "10.6",
    shortDate: "16 sep",
    highlights: RELEASE_10_6.sections.map((sec) => sec.title),
  },
  {
    version: "10.5",
    shortDate: "15 sep",
    highlights: [
      "Cotizador: costear a medida y números más realistas.",
      "Capacitación: reproductor más cómodo y enlaces con vista previa.",
      "Preguntas en los videos de capacitación.",
    ],
  },
  {
    version: "10.4",
    shortDate: "15 sep",
    highlights: RELEASE_10_4.sections.map((sec) => sec.title),
  },
  {
    version: "10.3",
    shortDate: "13 sep",
    highlights: RELEASE_10_3.sections.map((sec) => sec.title),
  },
  {
    version: "10.2",
    shortDate: "9 sep",
    highlights: RELEASE_10_2.sections.map((sec) => sec.title),
  },
  {
    version: "10.1",
    shortDate: "8 sep",
    highlights: [
      "Experiencia Solar: la ficha del cliente es una sola pantalla, con el recorrido a la izquierda y todo el historial a la derecha.",
      "Una sola fila de enlaces entre módulos (Ventas · Proyecto · Ingeniería · Trámite UTE · Experiencia Solar), igual en todas las pantallas.",
    ],
  },
  {
    version: "10.0",
    shortDate: "28 ago",
    highlights: [
      "El Historial de la ficha del cliente muestra también los comentarios dejados dentro de una etapa, una subetapa o una tarea del proyecto, indicando de dónde salió cada uno.",
    ],
  },
  {
    version: "9.9",
    shortDate: "27 ago",
    highlights: RELEASE_9_9.sections.map((sec) => sec.title),
  },
  {
    version: "9.8",
    shortDate: "21 ago",
    highlights: [
      "Panel de operaciones en el Dashboard (Tiempos & SLA): quién está en riesgo, sin fecha de instalación, sin comunicación y dónde se traba el proceso, con la banda de trámites UTE.",
      "Plan de pagos: se puede armar de una sola cuota por el total, y las cuotas por defecto vienen con nombres más claros (pago previo 50%, obra terminada 30%, obra habilitada 20%).",
      "Aumento de potencia contratada a UTE desde Onboarding, con el formulario oficial adjunto ya completo.",
    ],
  },
  {
    version: "9.7",
    shortDate: "19 ago",
    highlights: [
      "La propuesta ya sale con la fecha del día en que se emite, incluso al hacer una versión nueva sobre un cliente cotizado días antes.",
    ],
  },
  {
    version: "9.6",
    shortDate: "17 ago",
    highlights: [
      "Al ganar un proyecto, la app calcula sola cuánto hay que pagarle al instalador tercerizado, con el IVA incluido.",
      'En Finanzas, pestaña "Instaladores" con el total de cada obra, lo pagado y el saldo, filtro por instalador y "Resumen WhatsApp".',
      'Rol nuevo "Instalador tercerizado", que entra a "Mis cobros" y ve solo sus trabajos.',
    ],
  },
  {
    version: "9.5",
    shortDate: "17 ago",
    highlights: [
      "El chat lee las minutas de visita completas: medidas del techo, instalación eléctrica, recorrido de la bajada, sombras y observaciones.",
      "La ficha del cliente trae el relevamiento (tipo de techo, superficie, montaje, suministro, potencia contratada, tarifa y factura mensual) y los datos de contacto.",
      "Consultar el borrador de una propuesta ya no lo modifica.",
    ],
  },
  {
    version: "9.4",
    shortDate: "15 ago",
    highlights: [
      "Foto de referencia por material en las listas y en el PDF, para no confundir ítems parecidos.",
    ],
  },
  {
    version: "9.3",
    shortDate: "13 ago",
    highlights: [
      "Se puede cotizar una propuesta residencial conversando con Claude desde el celular: dicta los datos que faltan, muestra precio, ahorro y cuotas, y emite el PDF recién con la confirmación.",
      "El chat contesta sobre obras y clientes instalados: qué tengo hoy, en qué etapa va una obra y si está en plazo, trámite de UTE, materiales, documentos e historial.",
      "Al conectarse, el chat avisa si está apuntando a producción o a un entorno de prueba.",
      "Arreglos en el cotizador: el guardado automático ya no falla al abrir una propuesta nueva y las propuestas armadas de noche ya no salen fechadas al día siguiente.",
    ],
  },
  {
    version: "9.2",
    shortDate: "12 ago",
    highlights: [
      "Cotizador B2B: propuestas para empresas, con su propio borrador, datos fiscales, tapa propia y una carta escrita para una empresa y no para una casa.",
      "En las propuestas a empresas la comisión del asesor suma una parte del markup que consiga por encima del de referencia.",
      "El ahorro de los reportes se calcula con la tarifa que tiene contratada el cliente, no siempre con Simple.",
      "El saludo de la carta de la propuesta se escribe solo a partir del nombre del cliente.",
    ],
  },
  {
    version: "9.1",
    shortDate: "10 ago",
    highlights: [
      "Cronómetro en vivo de la etapa en la ficha del proyecto, que se pausa los fines de semana.",
      "El consolidador de materiales ahora funciona con un solo proyecto.",
    ],
  },
  {
    version: "9.0",
    shortDate: "9 ago",
    highlights: [
      "Cada proyecto muestra una cuenta regresiva de la etapa en la que está, con semáforo verde/amarillo/rojo, en la ficha, el pipeline y el listado.",
      "Nueva pantalla Administración → Plazos por etapa para definir en días hábiles cuánto debería durar cada etapa.",
      "En Métricas, cada etapa muestra el porcentaje de proyectos cerrados en plazo y el desvío promedio.",
      "Los mails por cada movimiento se reemplazaron por un único resumen diario por persona; la campana sigue avisando al instante.",
      "Nueva pantalla Administración → Resumen diario (mails) para elegir qué recibe cada rol y a qué hora.",
    ],
  },
  {
    version: "8.9",
    shortDate: "8 ago",
    highlights: [
      'Al subir la minuta desde el bot de Telegram, el cliente potencial pasa solo a "Visitado" con la fecha de la visita cargada.',
      "Todo reporte fotovoltaico enviado al cliente llega también en copia oculta a nmachin@voltia.com.uy.",
      "Se destrabó el envío de reportes al cliente (estaba bloqueado para todos los roles) y quedó habilitado para Administrador y Experiencia Solar.",
      'Botón "Enviar todos" en Reportes FV, columna de retorno de la inversión y botones del cierre mensual ordenados por el flujo real.',
      "El monitoreo diario ahora también vigila las 6 plantas Huawei, que además traen sus datos solas cada mes.",
    ],
  },
  {
    version: "8.8",
    shortDate: "7 ago",
    highlights: [
      "Control diario de las plantas: todas las mañanas se revisa que cada una haya generado, y se avisa por mail solo cuando un problema empieza o se resuelve.",
      "Pestaña nueva Monitoreo en Experiencia Solar, con el estado de cada planta y su historial.",
      "El cliente ve en su portal cuánta energía generó cada día del mes.",
      "Botón para ver el portal tal como lo ve el cliente, desde el listado de Generadores.",
    ],
  },
  {
    version: "8.7",
    shortDate: "6 ago",
    highlights: [
      'La ficha de un cliente potencial tiene una sección "Pendientes" con las tareas de todo el equipo que cuelgan de ese cliente.',
      "Desde ahí se crean, completan y reabren pendientes, que quedan atados al cliente automáticamente.",
    ],
  },
  {
    version: "8.6",
    shortDate: "6 ago",
    highlights: [
      "Voltia PM desde el chat de Claude: consultar y cargar información de ventas conversando, con tu usuario y tus permisos, solo para los usuarios habilitados a mano.",
      "En Ventas, el buscador encuentra también por teléfono, email y código, no solo por nombre y dirección.",
      'Estado nuevo "En espera" para las tareas que dependen de un tercero, con el motivo y la fecha de recontacto, y su propia pestaña en "Mis tareas".',
      "Una tarea puede colgar de un cliente potencial, no solo de un proyecto.",
    ],
  },
  {
    version: "8.5",
    shortDate: "5 ago",
    highlights: [
      "Ya se pueden subir las fotos tal como salen del iPhone (HEIC) en todos los lugares donde se suben fotos: la app las convierte solas a JPG al recibirlas.",
      'Ampliaciones de instalaciones existentes: desde el proyecto original, el botón "Crear ampliación" hereda todo lo del cliente y arranca una obra nueva linkeada a la original.',
      'Videos de obra y de visita técnica, con compresión automática, y fotos y videos en la visita de ventas que pasan solos al proyecto al ganar el lead.',
      'En Fotos de Obra, el "Checklist de fotos" con las 23 fotos obligatorias para la entrega.',
    ],
  },
  {
    version: "8.4",
    shortDate: "3 ago",
    highlights: [
      "Reporte semanal de indicadores por email todos los lunes, con ventas y visitas listadas una por una y el avance de las metas del trimestre.",
      'En Métricas, pestaña "Reporte semanal" para verlo en pantalla y enviarlo del momento.',
      "Comisiones: editar y borrar desde el listado, ajustando la fecha vendida, la de pago prevista y el monto.",
    ],
  },
  {
    version: "8.3",
    shortDate: "31 jul",
    highlights: [
      "Reportes fotovoltaicos mensuales: datos automáticos desde Growatt, preparación mensual automática, envío al cliente y portal con historial por año.",
      'Experiencia Solar: columna "Usuario" y botón "Crear usuario" para dar acceso al portal (también a los cargados por planilla).',
      "Tickets: editar título/descripción/prioridad y eliminar; abrir tickets a generadores de Experiencia Solar.",
      "Tarifas de UTE configurables (cargo fijo, potencia, tramos y franjas) y nuevos roles de Gerencia y Logística.",
    ],
  },
  {
    version: "8.2",
    shortDate: "22 jul",
    highlights: [
      'Ventas: pipeline más simple (menos etapas), vista "Priorizada" y contador de reclamos "xR".',
      'Métricas de Operaciones: se corrigió el conteo de "Instalaciones realizadas" (kWp instalados y obras ponderadas).',
      "Correos automáticos unificados con el diseño de marca Voltia.",
      "Proyecto: subir adjuntos desde la vista general. Documentos UTE con autoguardado.",
    ],
  },
  {
    version: "8.1",
    shortDate: "17 jul",
    highlights: [
      'Ingeniería: plantillas de lista de materiales (Monofásico / Trifásico 230 / Trifásico 400) y panel "Control de costos" en vivo.',
      'Etapa del proyecto modificable a mano ("empujón" hacia adelante) y traspasos que muestran a quiénes se notifica.',
      "Tickets del Generador y encuestas de satisfacción por hitos y aniversario.",
      "Dashboard y filtros de proyecto actualizados a las 8 etapas / áreas nuevas.",
    ],
  },
  {
    version: "8.0",
    shortDate: "10 jul",
    highlights: [
      'Experiencia Solar: "Atención al Cliente" pasó a llamarse Experiencia Solar y los clientes son "Generadores".',
      "Pipeline del proyecto expandido a 8 etapas con Experiencia Solar en paralelo.",
      "Traspasos entre áreas al cerrar cada etapa, con confirmación desde Pendientes.",
      "Importar y editar Generadores; aviso de habilitación al Generador con recordatorio.",
    ],
  },
  {
    version: "7.1",
    shortDate: "8 jul",
    highlights: [
      "Onboarding: generador de contrato y generador de proforma bancaria (BBVA) en PDF, con datos precargados y vista previa en vivo.",
      "Cotizador: el costo de instalación eléctrica escala con el tamaño del sistema (tabla de multiplicadores editable) y muestra el precio final con IVA.",
      'Propuestas: el PDF/Excel se descarga con nombre claro "Propuesta Comercial Voltia - {cliente} - V{n}".',
    ],
  },
  {
    version: "7.0",
    shortDate: "28 jun",
    highlights: [
      "Nueva sección Clientes: cartera completa con búsqueda, filtros, recorrido E1/E2/E3 y bitácora de interacciones.",
      'Renombre de la etapa final del recorrido y del pipeline: "Postventa" pasó a llamarse "Post-Habilitación".',
      "Voltia PM se instala como app en el celular (Android/iPhone), con ícono propio y a pantalla completa.",
      "Ventas con kanban táctil y Finanzas con tablas como tarjetas en el celular.",
    ],
  },
  {
    version: "6.2",
    shortDate: "31 may",
    highlights: [
      "Finanzas: Estado de resultados en dólares (USD).",
      "Finanzas: Flujo de fondos con fix de costos fijos de fin de mes y filtro por tipo de movimiento.",
    ],
  },
  {
    version: "6.1",
    shortDate: "27 may",
    highlights: [
      "Mis Tareas: tareas sueltas (sin proyecto) + vista calendario (semana/mes) con pills por tipo.",
      "Tareas: modal de detalle unificado con comentarios en markdown.",
      "Ventas: fechas del proceso automáticas (alta comercial, visita agendada, cierre).",
      "Unifilares: calibres de protección AC/DC editables y fix de inputs.",
      "Privacidad: fix de notificaciones que llegaban a clientes + guardrail de destinatarios internos.",
    ],
  },
  {
    version: "6.0",
    shortDate: "13 may",
    highlights: [
      "Finanzas: asistente de plan de pagos (4 cuotas pre-cargadas, edición libre, suma en vivo, indicador verde/rojo).",
      "Proyecto Final de Ingeniería: rediseño completo del PDF con paleta Voltia y fusión real de anexos.",
      "Materiales: lista colaborativa con estado de compra, colores, filtros multi-select persistentes en URL, tab Compras.",
      "Finanzas: pendientes en 2 niveles, facturas a pagar a proveedor con cuenta corriente integrada, pagos parciales.",
      "Ventas: generador de PDF de propuesta comercial integrado, con versionado automático por lead.",
    ],
  },
  {
    version: "5.4",
    shortDate: "10 may",
    highlights: [
      "Finanzas: 7 pestañas (Movimientos, Pendientes, Proveedores, Cobros, Flujo de fondos, P&L, Cuentas).",
      "Flujo de fondos con histórico (3 meses atrás + 3 adelante) y línea \"Hoy\" centrada.",
      "Costos fijos predefinidos: sugerencias en formulario según los que faltan pagar este mes.",
      "EFP: borrador con IA apuntando a 6-10 páginas, 3× más rápido y un tercio del costo.",
    ],
  },
  {
    version: "5.2",
    shortDate: "6 may",
    highlights: [
      "Proyecto Final de Ingeniería: documento integrador con 7 secciones, borrador con IA y edición inline con auto-save.",
      "Aviso automático a Operaciones cuando Ingeniería termina un proyecto (in-app + email).",
      "Visita técnica: FAB de audio en pantallas de proyecto e informe único por visita (update in-place).",
    ],
  },
  {
    version: "5.1",
    shortDate: "4 may",
    highlights: [
      "Visita técnica con IA: operario carga audios/fotos/notas y se genera informe automático.",
      "Atajo en dashboard del operario y panel \"Visita técnica (operario)\" en módulo Ingeniería.",
    ],
  },
  {
    version: "5.0",
    shortDate: "3 may",
    highlights: [
      "Módulo Ingeniería completo: workspace por proyecto + sidebar.",
      "Generador de unifilar inline + Pre-ingeniería + Consolidador de materiales + extracción de minuta con IA.",
    ],
  },
  {
    version: "4.9",
    shortDate: "1 may",
    highlights: [
      "Trámites UTE: fix en cálculo de tiempos por la fecha de \"Caso abierto\".",
      "Métricas: \"Duración real por etapa\" arreglada y nueva sección \"Evolución de tiempos UTE\" con últimos 8 trimestres.",
    ],
  },
  {
    version: "4.8",
    shortDate: "30 abr",
    highlights: [
      "Asistente IA con Text-to-SQL (sólo ADMIN): preguntá en lenguaje natural sobre tus datos.",
      "Indicador visual de Movement pagado vía Payment + detalle de movimientos expandible en P&L mensual.",
    ],
  },
  {
    version: "4.7",
    shortDate: "30 abr",
    highlights: [
      "Estado de resultado (P&L) mensual y anual con planilla mes a mes y bar chart.",
      "Detalle de movimientos por categoría expandible. Click en celda anual lleva a movimientos filtrados.",
    ],
  },
  {
    version: "4.6",
    shortDate: "30 abr",
    highlights: [
      "Saldo a favor del proveedor: aplicación FIFO automática a facturas nuevas.",
      "Lista unificada Movements + Payments. Cobros por proyecto. Fix doble descuento en facturas parciales.",
    ],
  },
  {
    version: "4.5",
    shortDate: "30 abr",
    highlights: [
      "Fix: doble descuento al conciliar con movimientos del mismo día.",
      "Semántica nueva: fechaSaldoInicial = saldo al cierre del día.",
    ],
  },
  {
    version: "4.4",
    shortDate: "30 abr",
    highlights: [
      "Conciliación simple: el banco dice la verdad, sin movimientos de ajuste.",
      "Conciliaciones legacy preservadas con badge separado.",
    ],
  },
  {
    version: "4.3",
    shortDate: "29 abr",
    highlights: [
      "Regla de oro: saldo cuentas == flujo unificado de PAGADOS/COBRADOS.",
      "fechaSaldoInicial funcional, validación de fechas, widget de salud y banner de descalce.",
    ],
  },
  {
    version: "4.2",
    shortDate: "29 abr",
    highlights: [
      "Aplicar pago a facturas pendientes desde \"Nuevo movimiento\" GASTO PAGADO.",
      "Modal de distribución entre facturas + movimiento nuevo.",
    ],
  },
  {
    version: "4.1",
    shortDate: "29 abr",
    highlights: [
      "Fix saldo de cuentas: KPI vs columna saldo USD ahora siempre coinciden.",
      "Sin doble conteo: GASTO PAGADO con Auto-Payment ya no se descuenta dos veces.",
    ],
  },
  {
    version: "4.0",
    shortDate: "29 abr",
    highlights: [
      "Fix sistémico de zonas horarias: las fechas date-only ahora se muestran siempre correctamente.",
      "Helper `formatDate` que trabaja sobre strings, sin shifts de zona en 65+ usos.",
    ],
  },
  {
    version: "3.9",
    shortDate: "29 abr",
    highlights: [
      "Conciliación bancaria de cuentas con generación opcional de movimiento de ajuste.",
      "Historial de conciliaciones por cuenta y banner global en Finanzas.",
    ],
  },
  {
    version: "3.8",
    shortDate: "29 abr",
    highlights: [
      "Auto-Payment al crear gastos directamente PAGADOS (con proveedor + cuenta).",
      "Backfill de movimientos PAGADOS legacy sin Payment asociado.",
      "Badge \"Auto\" en pagos generados automáticamente.",
    ],
  },
  {
    version: "3.7",
    shortDate: "28 abr",
    highlights: [
      "IVA en KPIs y saldos de Finanzas: la proyección de saldo se calcula con IVA, con sin IVA como referencia.",
      "Componente reutilizable AmountWithIva.",
    ],
  },
  {
    version: "3.6",
    shortDate: "28 abr",
    highlights: [
      "Monitoreo de liquidez en Movimientos: saldo actual, proyectado final, punto mínimo con fecha y badge de riesgo.",
    ],
  },
  {
    version: "3.5",
    shortDate: "28 abr",
    highlights: [
      "Tasa de IVA por material y columnas \"con IVA\" en Ingeniería, Costos, Finanzas y catálogo.",
      "Total con IVA al pie del PDF de lista de materiales.",
    ],
  },
  {
    version: "3.4",
    shortDate: "28 abr",
    highlights: [
      "Previstos agrupados por categoría (con detalle de ítems como InvoiceItems).",
      "Regenerar previstos preservando movimientos avanzados (A pagar / Pagado).",
      "Tolerancia $1 en validación del desglose de factura.",
    ],
  },
  {
    version: "3.3",
    shortDate: "28 abr",
    highlights: [
      "Fechas reales automáticas en subetapas (primera actividad → actualStartDate).",
      "Notificaciones por usuario: deadline 3 días antes + subetapa anterior completada (in-app, email, WhatsApp).",
      "Widget Deadlines próximos en el Dashboard.",
    ],
  },
  {
    version: "3.2",
    shortDate: "28 abr",
    highlights: [
      "Sistema de deadlines automáticos por subetapa (reglas en Admin + cálculo automático).",
      "Calculadora de triángulos de aluminio en Ingeniería.",
      "Lista de materiales colapsable.",
    ],
  },
  {
    version: "3.1",
    shortDate: "27 abr",
    highlights: [
      'PDF de materiales en dos versiones: "Sin precios" y "Con precios".',
    ],
  },
  {
    version: "3.0",
    shortDate: "27 abr",
    highlights: [
      "Cuentas (caja/bancos), Pagos, Costos previsto vs. real, Saldo USD proyectado.",
      "Mis Tareas con alertas de vencimiento y badges por severidad.",
    ],
  },
  {
    version: "2.1",
    shortDate: "25 abr",
    highlights: [
      "Modo claro renovado con identidad Voltia.",
      "Trámites UTE: vista tabla más legible y fixes en calendario mensual.",
    ],
  },
  {
    version: "2.0",
    shortDate: "24 abr",
    highlights: [
      "Nuevo módulo Trámites UTE con tabla y kanban.",
      "Cálculo automático de tiempo nuestro vs UTE por trámite.",
    ],
  },
];
