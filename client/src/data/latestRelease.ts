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
  version: "9.5",
  date: "17 de agosto de 2026",
  sections: [
    {
      title: "El chat ahora lee las minutas de visita",
      items: [
        "Se puede pedir la minuta completa de un cliente y escucharla: medidas del techo, instalación eléctrica, recorrido de la bajada, sombras y observaciones. Antes solo llegaba el resumen corto y el resto quedaba en un PDF.",
        "También se pueden listar los adjuntos de un cliente potencial —minutas, fotos y videos— y leer el texto de los documentos.",
      ],
    },
    {
      title: "La ficha del cliente trae el relevamiento",
      items: [
        "Bloque de contacto (teléfono, email, dirección) y bloque de relevamiento (tipo de techo, superficie, montaje, suministro, potencia contratada, tarifa y factura mensual).",
        "Los campos vacíos se muestran con una raya en lugar de desaparecer, así se distingue lo que falta cargar de lo que el sistema no muestra.",
      ],
    },
    {
      title: "Consultar la propuesta sin modificarla",
      items: [
        "Preguntar por el borrador ya no lo guarda: si no hay cambios, lo dice y no escribe nada.",
        "El borrador muestra todo lo que tiene cargado, no solo lo que falta, y la propuesta emitida incluye la configuración técnica.",
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
