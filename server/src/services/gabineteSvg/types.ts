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

  // ── Medidas de taller ──
  // Ninguna es opcional: el dibujo nunca inventa una medida en silencio. Si el
  // fabricante no especificó algo, sale impreso el valor por defecto, que es
  // una decisión tomada y corregible, no un hueco.
  alaTapaCm: number;
  radioDoblezMm: number;
  union: string;
  tornillos: string;
  solapeUnionCm: number;
  pasoTornillosCm: number;
  agujeroAmureDiamMm: number;
  agujerosAmureVertical: number;
  agujerosAmureHorizontal: number;

  // Encuentro puerta / marco, para el corte transversal.
  perfilPuertaCm: number;
  perfilMarcoCm: number;
  solapePuertaCm: number;
  holguraPuertaMm: number;

  // Bisagras
  bisagrasCantidad: number;
  bisagrasLado: string;
  bisagraDistExtremoCm: number;

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
