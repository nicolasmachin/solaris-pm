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
// es lo que se imprime en el unifilar.
export const CALIBRES_PROTECCION_DC = [
  "16A 2P",
  "25A 2P",
  "32A 2P",
  "40A 2P",
  "50A 2P",
  "63A 2P",
];
