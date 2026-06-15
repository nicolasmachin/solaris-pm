// Listas predefinidas de calibres eléctricos para uso en CalibreInput.
// Strings con la unidad incluida (ej "40A 300mA") para que el valor
// guardado en DB sea legible y se pueda imprimir directo en el SVG/PDF.

export const CALIBRES_TERMICA_AC = [
  "10A",
  "16A",
  "20A",
  "25A",
  "32A",
  "40A",
  "50A",
  "63A",
  "80A",
  "100A",
  "125A",
  "160A",
];

export const CALIBRES_DIFERENCIAL_AC = [
  "25A 30mA",
  "25A 300mA",
  "40A 30mA",
  "40A 300mA",
  "63A 300mA",
  "80A 300mA",
];

// Calibre de la protección DC del campo solar (string libre con polaridad).
// La polaridad ("2P", "3P", "4P") va embebida en el string del calibre porque
// es lo que se imprime en el unifilar. La lista es solo sugerencia: el campo
// (CalibreInput) acepta cualquier valor que tipee el usuario.
// Secciones de cable en mm² (sólo el número; el prefijo 2x/3x/4x y el sufijo
// PE/solar los arma el generador del unifilar según el tipo de red). Lista
// orientativa: el campo acepta cualquier valor custom (ej "2.5", "25").
export const SECCIONES_CABLE_MM = ["2.5", "4", "6", "10", "16", "25", "35", "50"];

export const CALIBRES_PROTECCION_DC = [
  "16A 2P",
  "16A 3P",
  "25A 2P",
  "25A 3P",
  "32A 2P",
  "32A 3P",
  "40A 2P",
  "40A 3P",
  "50A 2P",
  "50A 3P",
  "63A 2P",
  "63A 3P",
];
