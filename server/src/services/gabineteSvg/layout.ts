// Constantes de layout y paleta de la lámina de gabinete.
// A4 vertical a 96dpi, igual que el generador de unifilares.

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const MARGIN = 34;

export const COLOR = {
  text: "#111827",
  // Azul de las cotas y de las líneas de referencia, como en el plano que
  // usa el fabricante.
  dim: "#1D3FAF",
  // La chapa: gris claro con borde oscuro. Las caras de la isométrica usan
  // tonos distintos para que se lea el volumen.
  metalFill: "#D8D8D8",
  metalFillLight: "#E4E4E4",
  metalFillDark: "#C2C2C2",
  metalStroke: "#6B7280",
  metalStrokeDark: "#4B5563",
  hole: "#9CA3AF",
  boxBorder: "#374151",
} as const;

export const FONT = "Roboto, Arial, Helvetica, sans-serif";
