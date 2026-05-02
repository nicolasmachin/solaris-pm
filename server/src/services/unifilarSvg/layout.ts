// Constantes de layout y paleta del generador de unifilares.
// Portado del prototipo Python (docs/features/unifilar/prototipo_referencia.py).

export const PAGE_W = 794; // A4 vertical 96dpi
export const PAGE_H = 1123;
export const MARGIN = 25;

// Columnas reservadas (X)
export const CX_MAIN = 200; // eje principal del flujo
export const CX_DERIV = CX_MAIN + 90; // derivaciones laterales (descargadores)
export const CX_JAB = CX_MAIN + 165; // jabalina común
export const CX_CASA = CX_MAIN + 230; // tablero general casa

export const HEADER_H = 22;
export const CUADRO_W = 280;
export const CUADRO_H = 100;

export const COLOR = {
  voltiaBlue: "#1E40AF",
  text: "#0F172A",
  frame: "#374151",
  tableroBorder: "#DC2626",
  puestoIcpBorder: "#06B6D4",
  wire: "#000000",
  ground: "#16A34A",
  panelBorder: "#1E3A8A",
  panelFill: "#1E3A8A",
} as const;

export const FONT = "Arial, Helvetica, sans-serif";
