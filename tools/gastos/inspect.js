// inspect.js — muestra pestañas y primeras filas (con FÓRMULAS) de la planilla
// de gastos, para confirmar el layout real y las fórmulas del bloque RESUMEN.
//
// Uso:
//   node inspect.js
//   node inspect.js --rows=25
//   node inspect.js --tab='Nombre' --range='L1:L10'

import { getSheetsClient } from './auth.js';
import { SPREADSHEET_ID } from './config.js';

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}
function printRows(values) {
  (values || []).forEach((row, i) => {
    console.log(String(i + 1).padStart(3), '|', row.map((c) => (c === '' || c == null ? '·' : String(c))).join(' | '));
  });
  if (!values || !values.length) console.log('   (vacío)');
}

async function main() {
  const sheets = await getSheetsClient();
  const tab = arg('tab');
  const range = arg('range');
  if (tab && range) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!${range}`, valueRenderOption: 'FORMULA',
    });
    console.log(`===== '${tab}'!${range} (FORMULA) =====`);
    printRows(res.data.values);
    return;
  }
  const rows = Number(arg('rows', '20'));
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  console.log('# Planilla:', meta.data.properties.title);
  for (const p of meta.data.sheets.map((s) => s.properties)) {
    const g = p.gridProperties || {};
    console.log(`\n===== "${p.title}" (gid ${p.sheetId}, ${g.rowCount}x${g.columnCount}) — ${rows} filas (FORMULA) =====`);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `'${p.title}'!A1:N${rows}`, valueRenderOption: 'FORMULA',
    });
    printRows(res.data.values);
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
