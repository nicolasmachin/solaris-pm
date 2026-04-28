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
  version: "3.3",
  date: "28 de abril de 2026",
  sections: [
    {
      title: "Nuevo",
      items: [
        "**Fechas reales automáticas**: la fecha de inicio de cada subetapa se llena sola con la primera actividad (comentario, cambio de estado, archivo). La fecha de fin se setea al completar y se limpia si reabrís.",
        '**Notificaciones por usuario** (Configuración → "Notificaciones de proyecto"): elegí si querés recibir alerta 3 días antes de un deadline y/o aviso cuando se completa la subetapa anterior. Canales: in-app, email, WhatsApp.',
        "**Cron diario a las 9 AM** que dispara las alertas de deadline cercano según las preferencias de cada responsable.",
        "**Widget Deadlines próximos** en el Dashboard: subetapas tuyas que vencen en los próximos 7 días, con código de colores.",
      ],
    },
    {
      title: "Mejoras",
      items: [
        "Al **completar una subetapa**, se avisa automáticamente al responsable de la siguiente.",
        "**Cambiar el deadline** (manual o automático) resetea la marca de notificación para volver a avisar del nuevo plazo.",
        "**Drawer de subetapa** muestra fechas reales (Iniciada / Completada) cuando existen.",
        "**Edición manual de fechas reales** (ADMIN) si quedaron mal cargadas.",
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
