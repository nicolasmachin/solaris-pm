/**
 * Contenido del "Checklist de fotos para entrega de obra".
 *
 * Es la transcripción del PDF que vive en `client/public/checklist-fotos-entrega-obra.pdf`,
 * para poder consultarlo dentro de la app: en el celular, abrir el PDF sacaba al
 * operario de la pantalla del proyecto (y en iOS, con la app instalada como PWA,
 * lo dejaba sin forma de volver).
 *
 * **Los dos tienen que actualizarse juntos.** Si cambia el checklist, hay que
 * reemplazar el PDF y editar este archivo; si no, la app muestra una cosa y el
 * papel que firma el responsable dice otra.
 *
 * En el detalle, `**texto**` marca lo que en el PDF va resaltado — el dato que
 * hace que la foto sirva o no sirva.
 */

export interface ChecklistFotoItem {
  n: number;
  titulo: string;
  detalle: string;
}

export interface ChecklistFotoSeccion {
  titulo: string;
  nota?: string;
  items: ChecklistFotoItem[];
}

export const CHECKLIST_FOTOS_INTRO =
  "Ninguna obra se da por entregada sin la totalidad de las fotos de esta lista. Cada foto tiene que estar enfocada, con luz suficiente y con el detalle indicado legible. Si un ítem no aplica, dejar escrito el motivo.";

export const CHECKLIST_FOTOS_CIERRE =
  "La firma del responsable en obra acredita que el registro fotográfico está completo y cargado. Las fotos son el respaldo de la instalación ante el cliente y ante UTE: una obra sin registro completo no se factura como entregada.";

export const CHECKLIST_FOTOS_SECCIONES: ChecklistFotoSeccion[] = [
  {
    titulo: "Paneles y estructura",
    items: [
      { n: 1, titulo: "Paneles montados — ángulo 1", detalle: "Vista general del arreglo ya montado." },
      { n: 2, titulo: "Paneles montados — ángulo 2", detalle: "Otro ángulo, que cubra el resto del arreglo." },
      {
        n: 3,
        titulo: "Estructura de montaje",
        detalle: "La estructura debajo de los paneles sobre la que se montaron.",
      },
      { n: 4, titulo: "Tornillería", detalle: "Toda la tornillería utilizada, colocada y ajustada." },
      {
        n: 5,
        titulo: "Sujetadores finales e intermedios",
        detalle: "Que se distingan los finales y los intermedios que se usaron.",
      },
      { n: 6, titulo: "Etiqueta de datos del panel", detalle: "Modelo y número de serie legibles." },
      {
        n: 7,
        titulo: "N° de serie del frente del panel",
        detalle: "El número de serie que va impreso en el frente del panel.",
      },
    ],
  },
  {
    titulo: "Puesta a tierra",
    items: [
      {
        n: 8,
        titulo: "Puesta a tierra de los paneles",
        detalle: "La conexión de tierra sobre los paneles ya montados.",
      },
      {
        n: 9,
        titulo: "Jabalina con la tierra conectada",
        detalle: "La jabalina con el cable de puesta a tierra conectado.",
      },
      {
        n: 10,
        titulo: "Jabalina con el telurímetro",
        detalle:
          "Cable del telurímetro conectado y, en la misma foto, **el cable de tierra desconectado y sin hacer contacto**. La medición se hace con la toma de tierra desconectada, viendo solo la jabalina.",
      },
      {
        n: 11,
        titulo: "Medida del telurímetro — de cerca",
        detalle: "La pantalla del telurímetro con **el valor medido legible**, tomada de cerca.",
      },
      {
        n: 12,
        titulo: "Medida del telurímetro — con contexto",
        detalle:
          "La misma medida en pantalla, con el fondo de la obra a la vista, de modo que se identifique que la medición es de esta instalación.",
      },
      {
        n: 13,
        titulo: "Cámara de registro",
        detalle: "La cámara donde está la jabalina, bien afirmada — que se vea que no está suelta.",
      },
    ],
  },
  {
    titulo: "Canalizaciones",
    items: [{ n: 14, titulo: "Canalizaciones", detalle: "Recorrido de las canalizaciones ejecutadas." }],
  },
  {
    titulo: "Inversor y tableros",
    nota: "La serie de fotos de tablero se repite por cada tablero de la obra.",
    items: [
      {
        n: 15,
        titulo: "Conjunto inversor y tableros",
        detalle:
          "Vista frontal del conjunto completo: el inversor junto con todos los tableros, en una sola foto, de modo que se vea cómo quedó montado el conjunto.",
      },
      { n: 16, titulo: "Inversor de frente", detalle: "El inversor instalado, vista frontal." },
      {
        n: 17,
        titulo: "Sticker de datos del inversor",
        detalle: "Etiqueta del lateral, con número de serie, modelo y parámetros legibles.",
      },
      {
        n: 18,
        titulo: "Tablero abierto",
        detalle: "Todas las conexiones ya realizadas a la vista y **todas las llaves bajas**.",
      },
      {
        n: 19,
        titulo: "Tablero con tapa puesta y puerta abierta",
        detalle: "Tapa colocada, puerta abierta.",
      },
      {
        n: 20,
        titulo: "Tablero cerrado con los stickers",
        detalle: "Tapa puesta, puerta cerrada y stickers reglamentarios visibles.",
      },
    ],
  },
  {
    titulo: "UTE",
    items: [
      { n: 21, titulo: "Medidor de UTE", detalle: "El medidor con el sticker reglamentario colocado." },
      { n: 22, titulo: "ICP general de UTE", detalle: "La llave de corte general, donde se lea «UTE»." },
      {
        n: 23,
        titulo: "Precinto de seguridad",
        detalle:
          "Precinto colocado en la llave baja del interruptor general de microgeneración, con **el número de precinto visible**.",
      },
    ],
  },
];

/** Datos que hay que anotar al cerrar el registro (van en el PDF firmado). */
export const CHECKLIST_FOTOS_DATOS_CIERRE = [
  "N° de precinto",
  "Valor de puesta a tierra",
  "Fotos faltantes",
  "Fecha de control",
];

export const CHECKLIST_FOTOS_TOTAL = CHECKLIST_FOTOS_SECCIONES.reduce(
  (total, seccion) => total + seccion.items.length,
  0,
);
