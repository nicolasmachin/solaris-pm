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
  version: "2.1",
  date: "25 de abril de 2026",
  sections: [
    {
      title: "Modo claro renovado con identidad Voltia",
      items: [
        "El **modo claro** ahora tiene una paleta cálida que se siente parte del producto, no un blanco frío genérico. Fondos crema suave, bordes cálidos, acentos amarillo Voltia consistentes.",
        "Los **encabezados de tabla** ahora son una franja oscura (zona focal del estilo Voltia), antes se confundían con el fondo.",
        "**Hover de filas** en tablas con tono amarillo muy suave, más cálido que el azul claro previo.",
        "**Botón primario** (ej: \"+ Nuevo trámite\") con gradiente amarillo en lugar de un amarillo plano.",
        "El **modo oscuro** no se modificó.",
      ],
    },
    {
      title: "Trámites UTE — vista tabla más legible",
      items: [
        "**Encabezados de columnas de fecha** ahora son nombres completos en dos líneas (\"Consulta / enviada\", \"Docs 1 / aprobados\") en lugar de las abreviaturas en mayúsculas.",
        "**Celdas de fecha** ahora se ven como pills con el color asignado (verde por defecto, o el que elijas desde el popover de paleta).",
        "Las fechas ya no se cortan en dos renglones cuando la columna es angosta (ej: \"14-ene\" se mantiene en una sola línea).",
      ],
    },
    {
      title: "Calendario mensual — fixes visuales",
      items: [
        "Las **barras multi-día** vuelven a verse como una sola barra continua que cruza los días, sin cortes.",
        "El **número del día** queda en una franja superior reservada de cada celda; las barras arrancan debajo y nunca tapan los números.",
        "El calendario ahora **ocupa todo el alto disponible** del viewport en desktop, en lugar de quedar comprimido con espacio vacío debajo.",
        "Cada semana se reparte equitativamente el alto disponible.",
      ],
    },
  ],
};
