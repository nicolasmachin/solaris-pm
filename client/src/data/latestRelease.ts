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
  version: "3.0",
  date: "27 de abril de 2026",
  sections: [
    {
      title: "Nuevo",
      items: [
        "**Cuentas (caja, bancos, tarjetas)**: módulo nuevo con saldos en tiempo real, total por moneda y total unificado en USD. Cuenta obligatoria al concretar dinero.",
        "**Pagos como entidad separada**: aplicación a una o varias facturas, parciales, anulación con reversión correcta de saldos. Pagos negativos como notas de crédito.",
        "**Costos del proyecto: previsto vs. real** lado a lado con desviación, margen y comparación por ítem.",
        "**Saldo USD proyectado** en la lista de Movimientos: cuenta TODOS los estados ordenados por fecha efectiva. Distingue real (PAGADO/cobrado) de proyectado.",
        "**Mis Tareas con alertas de vencimiento**: banner si hay vencidas/de hoy, dot pulsante por fila, badges con plazo, fondo sutil por severidad.",
      ],
    },
    {
      title: "Mejoras",
      items: [
        "Catálogo unificado de Materiales y Stock con toggle *Gestiona stock* (productos vs. servicios).",
        "Lista de materiales por proyecto + generación/limpieza de previstos.",
        "Desglose de factura → ingreso al stock con botón **+ Crear nuevo material** dentro del modal.",
        "Vista detallada del proveedor con tabs Facturas / Pagos / Estado de cuenta cronológico.",
        "Página *A pagar* con saldos pendientes reales, KPIs y acción **💲 Pagar** por fila.",
        "Identificación de proyectos por nombre del cliente; cantidades enteras en todo el sistema.",
      ],
    },
    {
      title: "Correcciones",
      items: [
        "Mis Tareas: subetapas con responsable explícito ya no aparecen para el responsable de la etapa (respeta herencia correctamente).",
        "Borrar un movimiento con pagos aplicados libera correctamente esos pagos como saldo a favor del proveedor.",
        "Anular un pago con aplicaciones parciales restituye el estado correcto de cada factura asociada.",
        "Modal *Aplicar pago* pre-carga `min(saldo pendiente, saldo del pago)` en lugar del monto total.",
        "Transición a *A pagar* con proveedor abre automáticamente el modal de desglose si todavía no se cargó.",
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
