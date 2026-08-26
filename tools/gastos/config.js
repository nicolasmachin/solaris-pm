// Planilla "Gastos Viaje São Paulo - Intersolar 2026" (compartida con Gabriel).
// Reutiliza la misma service account del tool de alimentación (ver auth.js).

export const SPREADSHEET_ID = '1sFDRkcM-KndsYVxW99VA4blZif9_dPlkvf3bh73i1QM';

// Nombre real de la pestaña de datos: se confirma con `node inspect.js`.
export const TAB = null;

// Fila del encabezado y primera fila de datos (se confirman con inspect.js).
// Layout observado: fila 1 = encabezados, fila 2 = EJEMPLO, datos desde fila 3.
export const HEADER_ROW = 1;
export const FIRST_DATA_ROW = 3;

// Columnas de la tabla de gastos (letras A1).
export const COLS = {
  fecha: 'A', quien: 'B', categoria: 'C', descripcion: 'D', moneda: 'E',
  monto: 'F', medio: 'G', reparto: 'H', comprobante: 'I', notas: 'J',
};

// Valores válidos (de las "categorías sugeridas" y del ejemplo de la planilla).
export const QUIEN = ['Nico', 'Gabriel'];
export const CATEGORIAS = ['Comida', 'Transporte', 'Alojamiento', 'Feria / entradas', 'Compras / muestras', 'Comunicaciones', 'Otros'];
export const MONEDAS = ['BRL', 'USD', 'UYU'];
export const REPARTO = ['Compartido', 'Individual'];

// Número de serie de Google Sheets (base 1899-12-30) para una fecha.
export function toSheetSerial(date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}
