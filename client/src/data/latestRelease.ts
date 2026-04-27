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
  version: "2.4",
  date: "26 de abril de 2026",
  sections: [
    {
      title: "Nuevo",
      items: [
        "**Pagos parciales**: cada pago a proveedor es una entidad separada que se aplica a una o varias facturas. Las facturas pueden quedar en estado *Parcialmente pagado*.",
        "Página nueva **Pagos** (/finanzas/pagos) con KPIs, filtros y modal de aplicación a múltiples facturas.",
        "**Vista detallada por proveedor** con tabs Facturas / Pagos / Estado de cuenta cronológico.",
        "Pestaña **Costos** del proyecto rediseñada con consumos reales de stock.",
      ],
    },
    {
      title: "Mejoras",
      items: [
        "Lista de proveedores: ahora muestra saldo neto, n° de facturas pendientes y última actividad.",
        "Cuentas a pagar muestra saldo pendiente real (no monto total).",
        "Stock unificado con el catálogo de Materiales: misma tabla, mismos campos.",
      ],
    },
    {
      title: "Correcciones",
      items: [
        "Filtros de Movimientos guardaban valores incorrectos al cambiar de pestaña.",
        "Comprobantes legacy quedaron ocultos hasta confirmar que ya no se usan.",
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
    version: "2.3",
    shortDate: "26 abr",
    highlights: [
      "Stock unificado con materiales + desglose de facturas por ítem.",
      "Pestaña Costos del proyecto basada en consumos reales.",
    ],
  },
  {
    version: "2.2",
    shortDate: "25 abr",
    highlights: [
      "Estados de movimiento (Previsto / Comprometido / A pagar / Pagado).",
      "Lista de materiales por proyecto + generación de previstos.",
      "Página Cuentas a pagar.",
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
];
