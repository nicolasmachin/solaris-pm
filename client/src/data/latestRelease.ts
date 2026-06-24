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
  version: "7.0",
  date: "24 de junio de 2026",
  sections: [
    {
      title: "Ya podés instalar Voltia PM como app en el celular",
      items: [
        'Desde el celular: en Android, Chrome ofrece "Instalar app"; en iPhone, Safari → Compartir → "Agregar a inicio".',
        "Queda con su ícono propio en la pantalla de inicio y abre a pantalla completa, sin la barra del navegador.",
        "Cierre de la adaptación a móvil: las secciones de campo (Ventas, Operaciones y Finanzas) quedan cómodas en el celular.",
      ],
    },
    {
      title: "Ventas — Kanban táctil en el celular",
      items: [
        "Mover tarjetas sin arrastrar: el ícono ⋮⋮ abre una lista de etapas para mandar el lead a otra columna con un toque.",
        'El arrastre arranca con un "toque sostenido" (no se pelea con el scroll), y el tablero muestra una columna por pantalla.',
      ],
    },
    {
      title: "Finanzas — Más cómodo en el celular",
      items: [
        "Proveedores, Cobros, Flujo de fondos y el resto de las tablas se ven como tarjetas en el celular; las ventanas se abren como panel desde abajo.",
        'La pestaña Pendientes se ve como tarjetas (no una tabla ancha): el botón "⋯" abre las acciones (marcar pagado, editar, reagendar, eliminar). Filtros en un panel "Filtros".',
        'Se puede borrar un movimiento desde el celular (zona de peligro con "Eliminar movimiento").',
      ],
    },
    {
      title: "Portal de cliente — Trámite UTE más claro",
      items: [
        "Las fechas de cada hito coinciden con las cargadas por el equipo (antes salían con un día menos).",
        'La etapa que se está esperando se ve como pendiente (no cumplida); el último hito con fecha lleva el rótulo "Último avance".',
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
