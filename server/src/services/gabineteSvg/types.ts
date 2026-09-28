// Entradas de la lámina de gabinete. Es el contrato entre el constructor de la
// UI, el preview en vivo y el PDF: los tres dibujan desde acá.

export interface SpecExtra {
  etiqueta: string;
  valor: string;
}

export interface GabineteContacto {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
}

export interface GabineteInputs {
  /** Título de la lámina. Sale del nombre del gabinete. */
  titulo: string;

  // Medidas exteriores en cm.
  anchoCm: number;
  altoCm: number;
  profundidadCm: number;

  // Construcción
  fondoAbierto: boolean;
  pestanaAmure: boolean;
  pestanaAnchoCm: number;
  alaTapaCm?: number | null;
  union?: string | null;
  tornillos?: string | null;

  // Encuentro puerta / marco, para el corte transversal.
  perfilPuertaCm?: number | null;
  perfilMarcoCm?: number | null;
  solapePuertaCm?: number | null;
  holguraPuertaMm?: number | null;

  // Chapa y terminación
  material: string;
  espesorMm: number;
  acabado: string;

  // Cierre y aberturas
  tipoCierre: string;
  bisagras: string;
  ventilacion: boolean;
  gradoIp?: string | null;

  toleranciaMm: number;

  // Pedido
  cantidad: number;
  notas?: string | null;
  specsExtra?: SpecExtra[];

  // Encabezado / pie
  cliente?: string | null;
  proyectoCodigo?: string | null;
  /** Texto ya formateado, ej. "28 de septiembre de 2026". */
  fecha: string;
  contacto?: GabineteContacto | null;
}
