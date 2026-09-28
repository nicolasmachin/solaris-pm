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
  //
  // Todo se fabrica en chapa plegada y se entrega sin herrajes y sin ninguna
  // perforación: no hay bisagras, cierre, ventilación, grado IP ni agujeros de
  // amure porque no son parte del pedido.
  union: string;
  tornillos: string;
  solapeUnionCm: number;
  pasoTornillosCm: number;

  // Encuentro tapa / cuerpo.
  rebordeTapaCm: number;
  rebordeFrenteCm: number;
  solapeTapaCm: number;
  holguraTapaMm: number;

  // Chapa y terminación
  material: string;
  espesorMm: number;
  acabado: string;

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
