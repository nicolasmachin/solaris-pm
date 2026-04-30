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
  version: "4.4",
  date: "30 de abril de 2026",
  sections: [
    {
      title: "Conciliación simple — el banco siempre dice la verdad",
      items: [
        "Cuando conciliás una cuenta y el saldo real difiere del calculado, ahora el sistema actualiza directamente el saldoInicial y la fechaSaldoInicial al valor real, sin crear movimientos de ajuste falsos.",
        "Movimientos anteriores a la conciliación pasan a histórico (ya consolidados en el nuevo saldoInicial); los posteriores se aplican sobre el saldo recién fijado.",
        "El listado de movimientos ya no se contamina con \"Ajuste conciliación\" cada vez que conciliás.",
      ],
    },
    {
      title: "Modal de conciliación simplificado",
      items: [
        "Se eliminó el toggle \"Crear movimiento de ajuste automático\". Hay un único modo de conciliación.",
        "Si hay diferencia, un panel ámbar explica exactamente qué va a pasar antes de confirmar.",
        "Toast nuevo: muestra el saldo nuevo y la diferencia anterior.",
      ],
    },
    {
      title: "Historial preservado",
      items: [
        "Conciliaciones nuevas (v4.4+): badge \"Saldo actualizado\" cuando hubo diferencia.",
        "Conciliaciones legacy (de versiones previas con movimiento de ajuste): badge \"Ajuste legacy\", sin modificar — la auditoría se preserva.",
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
