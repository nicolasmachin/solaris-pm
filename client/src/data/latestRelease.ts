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
  version: "4.7",
  date: "30 de abril de 2026",
  sections: [
    {
      title: "Estado de resultado (P&L) mensual y anual",
      items: [
        "Nueva sección /finanzas/resultado con tabs Mensual y Anual.",
        "Mensual: estructura contable formal (Ingresos brutos → Costos directos → Margen bruto → Gastos operativos → Resultado neto), con bar chart de los 12 meses y tabla de evolución.",
        "Cada categoría se expande para ver la lista de movimientos individuales (fecha, descripción, proyecto/proveedor, cuenta, monto USD). Click en un Pago abre el panel lateral.",
        "Anual: planilla mes a mes con todas las categorías, sticky en primera columna y header. Click en cualquier celda lleva a la lista filtrada de movimientos.",
        "Reglas: sólo plata real (PAGADOS/COBRADOS), excluye AJUSTE_CONCILIACION, sin doble conteo de Payments.",
      ],
    },
    {
      title: "Saldo a favor del proveedor — aplicación automática",
      items: [
        "Al cargar una factura A_PAGAR a un proveedor con Payments sin aplicar, el sistema ofrece aplicar ese saldo automáticamente (FIFO).",
        "Modal con detalle de Payments involucrados; aplicación atómica que cierra (parcial o totalmente) la factura sin mover saldo de cuentas.",
        "Botón \"Aplicar saldo a favor\" también en el detail panel de cada factura.",
      ],
    },
    {
      title: "Lista de movimientos unificada",
      items: [
        "/finanzas/movimientos muestra Movements y Payments mezclados cronológicamente, con badge \"Pago\" para diferenciarlos.",
        "Click en una fila de Pago abre el panel del Payment con sus aplicaciones.",
        "Sin doble conteo: si un GASTO tiene Payment aplicado, no se descuenta dos veces.",
      ],
    },
    {
      title: "Cobros por proyecto + fix doble descuento parcial",
      items: [
        "Nueva sección /finanzas/cobros: lista de proyectos con presupuesto vs cobrado y estado de cobranza por color.",
        "Detalle por proyecto con KPIs por moneda y modal \"Registrar cobro\" pre-cargado.",
        "Fix: facturas parcialmente pagadas ahora proyectan sólo saldoPendiente (no monto total). Detail panel con desglose Factura / Pagado / Pendiente.",
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
