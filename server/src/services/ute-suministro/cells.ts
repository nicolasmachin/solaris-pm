// Mapa de celdas del formulario "Solicitud de suministro" de UTE (hoja
// "Individual" de `Solicitud_Suministro_UTE.xlsx`).
//
// A diferencia de los PDFs de UTE —que se rellenan por coordenadas en un array
// posicional, donde un elemento de más corre todo lo que sigue— acá cada campo
// dice explícitamente en qué celda va. Agregar o sacar un campo no puede
// desalinear al resto.
//
// El tipo de dato importa:
//   "text"   fuerza texto. Obligatorio en el teléfono: "098546991" como número
//            perdería el cero inicial.
//   "number" fuerza número.
//   "auto"   número si el valor es un número puro, texto en cualquier otro caso.
//            La potencia es "5.5" (número) pero también puede ser "Potencia
//            excepcional" o "Mayor a 40 KW"; el nro. de puerta puede ser "1234"
//            o "S/N".

export type CellType = "text" | "number" | "auto";

export interface CellSpec {
  cell: string;
  type: CellType;
}

export const SHEET_NAME = "Individual";

export const CELLS = {
  // ─ Datos del suministro ─
  departamento: { cell: "B8", type: "text" },
  localidad: { cell: "E8", type: "text" },
  padron: { cell: "H8", type: "auto" },
  calle: { cell: "B10", type: "text" },
  numero: { cell: "E10", type: "auto" },
  duplicador: { cell: "H10", type: "text" },
  apartamento: { cell: "K10", type: "text" },
  avisoAcceso: { cell: "B13", type: "text" },
  notificaciones: { cell: "L12", type: "text" },

  // ─ Datos del cliente ─
  documento: { cell: "B18", type: "text" },
  documentoNro: { cell: "E18", type: "auto" },
  nombre: { cell: "B20", type: "text" },
  telefono: { cell: "E20", type: "text" },
  email: { cell: "H20", type: "text" },

  // ─ Dirección de envío de notificaciones (solo si no es la del suministro) ─
  notifCalle: { cell: "B26", type: "text" },
  notifNumero: { cell: "E26", type: "auto" },
  notifDuplicador: { cell: "H26", type: "text" },
  notifApartamento: { cell: "K26", type: "text" },
  notifDepartamento: { cell: "B28", type: "text" },
  notifLocalidad: { cell: "E28", type: "text" },

  // ─ Datos técnicos ─
  tipoSolicitud: { cell: "B33", type: "text" },
  pasaLinea: { cell: "E33", type: "text" },
  acometida: { cell: "H33", type: "text" },
  tramite: { cell: "B35", type: "text" },
  requerimiento: { cell: "E35", type: "text" },
  actividad: { cell: "H35", type: "text" },
  tramiteAsociado: { cell: "B37", type: "text" },
  tipoMedida: { cell: "E37", type: "text" },
  tension: { cell: "B39", type: "text" },
  tarifa: { cell: "E39", type: "text" },
  fases: { cell: "H39", type: "text" },
  potenciaSolicitada: { cell: "B41", type: "auto" },
  dobleContratacion: { cell: "E44", type: "text" },
  // "Potencia en Valle" (B46) NO está acá a propósito: en el formulario de UTE
  // es una fórmula que se calcula sola a partir de la potencia solicitada.
  potenciaPunta: { cell: "E46", type: "auto" },
  certificadoCarga: { cell: "B49", type: "text" },
  instaladaCalefaccion: { cell: "E49", type: "text" },
  cargaPerturbadora: { cell: "H49", type: "text" },

  // ─ Observaciones ─
  // Acá va el número de cuenta UTE: el formulario no tiene un campo propio para
  // la cuenta, y UTE espera encontrarla en este texto libre.
  observaciones: { cell: "B54", type: "text" },
} satisfies Record<string, CellSpec>;

export type CampoFormulario = keyof typeof CELLS;

// Valores admitidos por las listas desplegables del formulario (hoja `check`
// del libro de UTE). Se replican acá para que la pantalla ofrezca exactamente
// las mismas opciones: si se manda un valor fuera de la lista, UTE rechaza el
// formulario.
export const OPCIONES = {
  documento: ["CI", "RUT", "Otros"],
  tipoSolicitud: ["Definitiva", "Estimativa"],
  tramite: [
    "Nuevo Servicio",
    "Aumento",
    "Reducción",
    "Rehabilitación",
    "Solicitud Instalación de Enlace",
    "Provisorio General *",
    "Provisorio Obra",
  ],
  pasaLinea: ["Si", "No", "No Declara"],
  acometida: ["Aérea", "Subterránea"],
  requerimiento: ["Informe Técnico", "Presupuesto", "Informe Técnico y Presupuesto"],
  tipoMedida: ["Centralizado", "Descentralizado"],
  actividad: ["Residencial", "General"],
  tension: ["230 V", "400 V", "6,4 KV", "15 KV", "22 KV", "31,5 KV", "63 KV"],
  fases: ["Monofásica", "Trifásica"],
  tarifa: [
    "Residencial Simple",
    "Residencial Doble",
    "Residencial Triple",
    "General Simple",
    "General Hora Estacional",
    "Zafra Estival",
    "Medianos Consumidores",
    "Grandes Consumidores",
  ],
  siNo: ["Si", "No"],
  departamento: [
    "Artigas",
    "Canelones",
    "Cerro Largo",
    "Colonia",
    "Durazno",
    "Flores",
    "Florida",
    "Lavalleja",
    "Maldonado",
    "Montevideo",
    "Paysandú",
    "Río Negro",
    "Rivera",
    "Rocha",
    "Salto",
    "San José",
    "Soriano",
    "Tacuarembó",
    "Treinta y Tres",
  ],
} as const;

// La potencia solicitada NO es texto libre: UTE la ofrece como lista cerrada, y
// los escalones dependen de si el suministro es monofásico o trifásico.
export const POTENCIAS_MONOFASICO = [
  "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5",
  "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5",
  "Potencia excepcional",
] as const;

export const POTENCIAS_TRIFASICO = [
  "6", "8", "10", "12", "15", "20", "25", "30", "35", "40",
  "Mayor a 40 KW",
] as const;
