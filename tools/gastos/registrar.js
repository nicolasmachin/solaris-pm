// registrar.js — agrega gastos a la planilla "Gastos Viaje São Paulo".
//
// Solo escribe la fila del gasto (Fecha..Notas); el bloque RESUMEN son fórmulas
// de la planilla que se recalculan solas.
//
// Uso:
//   node registrar.js --fecha=2026-08-25 \
//     --items='[{"quien":"Nico","categoria":"Comida","descripcion":"Almuerzo","moneda":"BRL","monto":80,"medio":"Tarjeta","reparto":"Compartido"}]'
//   node registrar.js --items='[...]' --dry-run
//
// Campos por gasto: quien, categoria, descripcion, moneda, monto (obligatorios los
// que usen las fórmulas: quien/moneda/monto); medio, reparto, comprobante, notas,
// y fecha (por gasto) son opcionales (fecha default = --fecha o hoy).

import { getSheetsClient } from './auth.js';
import {
  SPREADSHEET_ID, TAB, FIRST_DATA_ROW, COLS, toSheetSerial,
} from './config.js';

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function parseFecha(str) {
  if (!str) { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str))) return new Date(+m[3], +m[2] - 1, +m[1]);
  throw new Error(`Fecha inválida: "${str}" (usá YYYY-MM-DD o DD/MM/YYYY)`);
}

async function dataTab(sheets) {
  if (TAB) return TAB;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return meta.data.sheets[0].properties.title; // primera pestaña
}

async function lastDataRow(sheets, tab) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!A1:A1000`,
  });
  const vals = res.data.values || [];
  let last = FIRST_DATA_ROW - 1;
  vals.forEach((r, i) => { if ((r[0] ?? '').toString().trim() !== '') last = i + 1; });
  return Math.max(last, FIRST_DATA_ROW - 1);
}

async function main() {
  const sheets = await getSheetsClient();
  const dry = hasFlag('dry-run');
  const defFecha = parseFecha(arg('fecha'));

  let items;
  try { items = JSON.parse(arg('items', '[]')); } catch { throw new Error('--items no es JSON válido'); }
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Pasá --items=\'[{"quien":"Nico","categoria":"Comida","descripcion":"...","moneda":"BRL","monto":80}]\'');
  }

  const rows = items.map((it) => {
    const fecha = it.fecha ? parseFecha(it.fecha) : defFecha;
    const fechaTxt = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
    return {
      fechaTxt,
      quien: it.quien || '', categoria: it.categoria || '', descripcion: it.descripcion || '',
      moneda: it.moneda || '', monto: Number(it.monto), medio: it.medio || '',
      reparto: it.reparto || '', comprobante: it.comprobante || '', notas: it.notas || '',
    };
  });

  const tab = await dataTab(sheets);
  const start = (await lastDataRow(sheets, tab)) + 1;
  const end = start + rows.length - 1;

  console.log(`Planilla de gastos — pestaña '${tab}', filas ${start}..${end}`);
  console.table(rows.map((r, i) => ({
    fila: start + i, fecha: r.fechaTxt, quien: r.quien, cat: r.categoria,
    desc: r.descripcion, moneda: r.moneda, monto: r.monto, reparto: r.reparto,
  })));
  if (dry) { console.log('DRY-RUN: no se escribió nada.'); return; }

  const values = rows.map((r) => [
    r.fechaTxt, r.quien, r.categoria, r.descripcion, r.moneda,
    r.monto, r.medio, r.reparto, r.comprobante, r.notas,
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${tab}'!${COLS.fecha}${start}:${COLS.notas}${end}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  const back = (await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `'${tab}'!${COLS.fecha}${start}:${COLS.notas}${end}`,
    valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [];
  console.log('\n✅ Gastos escritos:');
  back.forEach((r) => console.log('  ', r.join(' | ')));
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
