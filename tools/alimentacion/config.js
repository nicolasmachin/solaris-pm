// Configuración de la planilla "Control de alimentación 2026".
//
// El SPREADSHEET_ID no es un secreto crítico (es el id del doc). Las credenciales
// de la service account NO van acá: se cargan en auth.js desde env var o archivo
// gitignored.

export const SPREADSHEET_ID = '1M0U9vGa1YuszujOfI5j1p-0MKdv-gLQA7uElGEOBDEo';

// Nombres reales de las pestañas. El conector de Google Drive no los expone;
// se completan tras correr `node inspect.js` (que los lee con spreadsheets.get).
export const TABS = {
  base: null,      // pestaña con la "Base de alimentos" (catálogo + valores por porción)
  registro: null,  // pestaña del registro diario (una fila por alimento consumido)
};

// Mapa de columnas del registro diario (0-based). Se confirma con inspect.js.
// Orden observado al leer la planilla:
//   Dia | Dia2 | Mes | Año | Fecha | Hora | Tipo | Comida | Cantidad |
//   Calorias | Peso | Carbohidratos | Azucares | Proteinas |
//   Gorduras tot | Gorduras sat | Gorduras trans | Fibra | Sodio | Calidad
export const REGISTRO = {
  // fila del encabezado y primera fila de datos (se confirman con inspect.js)
  headerRow: 1,
  firstDataRow: 2,
  cols: {
    dia: 0, dia2: 1, mes: 2, anio: 3, fecha: 4, hora: 5,
    tipo: 6, comida: 7, cantidad: 8,
  },
  // Columnas que se escriben con valor de entrada vs. las que son fórmulas.
  // Se define con certeza tras ver las fórmulas en inspect.js.
  inputCols: null,   // ej: ['fecha','tipo','comida','cantidad']
  formulaCols: null, // ej: ['dia','dia2','mes','anio', ...derivadas nutricionales]
};

export const TIPOS = ['Desayuno', 'Almuerzo', 'Cena', 'Colación', 'Merienda'];
