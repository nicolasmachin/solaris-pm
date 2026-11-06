// inspect.js — revela la estructura REAL de la planilla:
//   • nombres y gids de todas las pestañas
//   • primeras filas de cada una, mostrando FÓRMULAS (no valores calculados)
//
// Uso:
//   node inspect.js                      → resumen de todas las pestañas
//   node inspect.js --rows=20            → más filas por pestaña
//   node inspect.js --tab='Nombre' --range='A2:T2'   → lectura puntual (con fórmulas)
//
// Sirve para confirmar: nombres de pestaña, en qué columna arranca cada tabla, y
// si las columnas nutricionales del registro son fórmulas (VLOOKUP × Cantidad) o
// valores estáticos. De eso depende cómo escribimos cada comida.

import { getSheetsClient } from './auth.js';
import { SPREADSHEET_ID } from './config.js';

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
}

function printRows(values) {
  (values || []).forEach((row, i) => {
    const cells = row.map((c) => (c === '' || c == null ? '·' : String(c)));
    console.log(String(i + 1).padStart(3), '|', cells.join(' | '));
  });
  if (!values || values.length === 0) console.log('   (vacío)');
}

async function main() {
  const sheets = await getSheetsClient();

  // Modo puntual: --tab + --range
  const tab = arg('tab');
  const range = arg('range');
  if (tab && range) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab}'!${range}`,
      valueRenderOption: 'FORMULA',
    });
    console.log(`===== '${tab}'!${range} (FORMULA) =====`);
    printRows(res.data.values);
    return;
  }

  const rows = Number(arg('rows', '14'));
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  console.log('# Planilla:', meta.data.properties.title);
  console.log('# Pestañas:');
  const props = meta.data.sheets.map((s) => s.properties);
  for (const p of props) {
    const g = p.gridProperties || {};
    console.log(`  - "${p.title}"  (gid ${p.sheetId}, ${g.rowCount}x${g.columnCount})`);
  }

  for (const p of props) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${p.title}'!A1:AZ${rows}`,
      valueRenderOption: 'FORMULA',
    });
    console.log(`\n===== ${p.title} — primeras ${rows} filas (FORMULA) =====`);
    printRows(res.data.values);
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
