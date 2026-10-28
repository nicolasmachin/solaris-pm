// Configuración de la planilla "Control de alimentación 2026".
//
// Estructura real (confirmada con inspect.js):
//   • "Datos"          → base de alimentos. Comidas en columna D, filas 3..385;
//                        valores por porción en E..O. Es la tabla del VLOOKUP.
//   • "Registro Diario"→ ENTRADA de datos: una fila por alimento consumido.
//                        Es la ÚNICA pestaña donde se escribe.
//   • "Enero 26".."Agosto 26", "INDICADORES" → dashboards que leen de "Registro
//                        Diario" con SUMIFS (por mes/año). NO se escriben.
//
// En "Registro Diario", por fila:
//   A Dia · B Dia2 · C Mes · D Año   → fórmulas derivadas de E (Fecha)
//   E Fecha (input, nº de serie)     F Hora (input, opcional)
//   G Tipo (input, opcional)         H Comida (input, dispara las fórmulas)
//   I Cantidad (input)               J..T nutrientes (fórmulas VLOOKUP × Cantidad)
//
// Las fórmulas de A-D y J-T YA están pre-cargadas cientos de filas hacia abajo:
// alcanza con escribir E, (F), (G), H, I en la primera fila vacía.

export const SPREADSHEET_ID = '1M0U9vGa1YuszujOfI5j1p-0MKdv-gLQA7uElGEOBDEo';

export const REGISTRO_TAB = 'Registro Diario';
export const DATOS_TAB = 'Datos';
export const DATOS_RANGE = 'D3:O385'; // D=Comida, E=Calorias, ... O=Calidad

// Columnas de entrada del registro (letras A1).
export const COL = { fecha: 'E', hora: 'F', tipo: 'G', comida: 'H', cantidad: 'I' };

export const TIPOS = ['Desayuno', 'Almuerzo', 'Cena', 'Colación', 'Merienda'];

// Número de serie de Google Sheets (base 1899-12-30) para una fecha (por sus
// componentes Y/M/D, sin zona horaria).
export function toSheetSerial(date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((utc - epoch) / 86400000);
}
