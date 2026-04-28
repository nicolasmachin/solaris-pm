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
  version: "3.2",
  date: "28 de abril de 2026",
  sections: [
    {
      title: "Nuevo",
      items: [
        "**Deadlines automáticos por subetapa**: nueva tab en Admin para configurar reglas (días desde creación, días antes de instalación, manual o sin deadline). Cada proyecto recibe los deadlines automáticamente al crearse y se recalculan al cambiar la fecha de instalación.",
        "**Edición manual de deadlines** (ADMIN y OPERACIONES) desde el drawer de la etapa, con código de colores (rojo vencido, naranja ≤3d, amarillo ≤7d) y badge *manual* cuando aplica.",
        "**Calculadora de triángulos de aluminio** dentro de Ingeniería: tres modos de cálculo, visualización SVG con medidas, descarga JPG/SVG y guardado automático en Documentos del proyecto (JPG + PDF).",
      ],
    },
    {
      title: "Mejoras",
      items: [
        "**Fechas de etapa coherentes en Mis Tareas**: el badge ya no usa la fecha planificada vieja del alta del proyecto, ahora refleja la subetapa más urgente.",
        "**Fecha límite editable a nivel etapa** desde el StageDrawer (todos los roles).",
        "**Lista de materiales colapsable** con resumen mini y persistencia por proyecto.",
        '**PDF de materiales con dos versiones**: desplegable con "Sin precios (para proveedores)" y "Con precios (uso interno)".',
        "**Fecha esperada al generar previstos**: el modal de generación pide la fecha de compra esperada (precargada con el inicio planificado), mejorando la proyección de flujo de fondos.",
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
