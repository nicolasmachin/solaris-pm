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
  version: "5.0",
  date: "3 de mayo de 2026",
  sections: [
    {
      title: "Módulo Ingeniería — workspace técnico por proyecto",
      items: [
        "Nuevo módulo en la barra superior (sólo roles con permiso INGENIERIA).",
        "Dashboard /ingenieria con estadísticas y listado de proyectos del módulo.",
        "Workspace /ingenieria/proyecto/:id con sidebar lateral + herramientas en accordion (2 columnas, una abierta a la vez).",
        "Sección \"Documentos técnicos generados\" tanto en el workspace como compacta en el StageDrawer del proyecto.",
      ],
    },
    {
      title: "Generador de unifilar — inline en el workspace",
      items: [
        "Lista de las 3 últimas versiones con Ver / Duplicar / Descargar SVG/PDF / Eliminar.",
        "Botón \"Historial completo\" si hay más de 3 versiones (modal con búsqueda + filtro por tipo de red).",
        "Modal de nueva versión más ancho (1400px) con form a la izquierda y preview SVG en vivo a la derecha.",
        "El PDF vigente en Documentos se reemplaza automáticamente al crear una versión nueva.",
      ],
    },
    {
      title: "Lista de materiales y calculadora de triángulos — al módulo Ingeniería",
      items: [
        "Ambas herramientas dejaron el StageDrawer del proyecto. Se acceden desde el workspace de Ingeniería.",
        "El PDF de lista de materiales se versiona independiente para \"con precios\" y \"sin precios\".",
        "El botón principal de la calculadora pasó a llamarse \"Generar PDF y guardar\".",
      ],
    },
    {
      title: "Pre-ingeniería (\"Resumen Técnico\") — nueva herramienta",
      items: [
        "Genera el PDF que antes se hacía a mano en una herramienta externa. Página 1 con formulario + páginas siguientes con fotos.",
        "Datos del cliente pre-rellenados desde el proyecto. Botón para pre-rellenar los datos eléctricos desde una versión de unifilar existente.",
        "Subida de fotos múltiples con thumbnails, etiquetas, reordenamiento.",
        "Vista previa del PDF embebida en la app.",
        "Versionado 1:N inmutable: cada versión queda guardada con snapshot completo.",
      ],
    },
    {
      title: "Extracción de minuta con IA",
      items: [
        "Subís el PDF de la minuta del relevamiento (la que genera el bot externo) y la IA pre-rellena los campos del formulario de Pre-ingeniería.",
        "Cada campo extraído se marca con ✨ al lado del label; al editarlo, el ícono desaparece.",
        "Validado contra 3 minutas reales (Diego Trías, Percovich, Edgar Valdés) con 100% de acierto en campos críticos.",
        "Claude Haiku 4.5, ~5s de latencia, ~USD 0.005 por minuta.",
      ],
    },
    {
      title: "Consolidador de materiales (herramienta global)",
      items: [
        "Vive en el dashboard de Ingeniería, no en un proyecto. Pensado para el comprador.",
        "Seleccionás varios proyectos y obtenés tabla unificada agrupada por categoría: filas = ítems, columnas = proyectos + TOTAL.",
        "Descarga PDF (A4 horizontal si 4+ proyectos, vertical si 2-3) y Excel (XLSX) listo para usar en compras.",
        "Sólo se ofrecen como opciones los proyectos con lista de materiales cargada. Las versiones quedan en un historial.",
      ],
    },
    {
      title: "Documentos del proyecto — badge y filtros",
      items: [
        "Badge azul \"Ingeniería · Unifilar v3\", \"Ingeniería · Materiales v2 (con precios)\", \"Ingeniería · Triángulos v1\", \"Ingeniería · Pre-ingeniería v4\" según el origen.",
        "Filtro por origen agregado al sidebar de Documentos.",
        "Documentos generados desde herramientas no se editan ni eliminan desde Documentos del proyecto — para reemplazarlos hay que crear una versión nueva (soft-deletea la anterior automáticamente).",
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
