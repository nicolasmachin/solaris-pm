// registrar.js — agrega comidas al final de "Registro Diario".
//
// Solo escribe las celdas de entrada (Fecha, Hora?, Tipo?, Comida, Cantidad);
// las columnas derivadas (día/mes/año y nutrientes) ya son fórmulas pre-cargadas
// que se calculan solas. Si por algún motivo las filas destino no tuvieran las
// fórmulas, las replica desde la última fila con dato.
//
// Uso:
//   node registrar.js --fecha=2026-08-10 \
//     --items='[{"comida":"Cafe con leche","cantidad":1,"tipo":"Desayuno"},
//               {"comida":"Alfajor","cantidad":2}]'
//   node registrar.js --items='[...]' --dry-run   → muestra sin escribir
//   node registrar.js --items='[...]' --clear      → limpia lo que escribiría (deshacer test)
//
// Cada item: { comida (obligatorio), cantidad (obligatorio), tipo?, hora? }.
// La comida se resuelve al nombre EXACTO de la base "Datos".

import { getSheetsClient } from './auth.js';
import {
  SPREADSHEET_ID, REGISTRO_TAB, COL, toSheetSerial,
} from './config.js';
import { loadBase, matchFood } from './base.js';

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def; // corta "--name="
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function parseFecha(str) {
  if (!str) {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str))) return new Date(+m[3], +m[2] - 1, +m[1]);
  throw new Error(`Fecha inválida: "${str}" (usá YYYY-MM-DD o DD/MM/YYYY)`);
}

function fechaTexto(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

async function getSheetId(sheets, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const s = meta.data.sheets.find((x) => x.properties.title === title);
  if (!s) throw new Error(`No encontré la pestaña "${title}"`);
  return s.properties.sheetId;
}

// Asegura que la grilla tenga al menos `neededRow` filas. La API de values.update
// NO agranda la grilla cuando el rango arranca del todo fuera de ella, así que hay
// que agregar filas antes (con un colchón para no expandir en cada escritura).
async function ensureGridRows(sheets, neededRow) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find((x) => x.properties.title === REGISTRO_TAB);
  const rowCount = sheet.properties.gridProperties.rowCount;
  if (neededRow > rowCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ appendDimension: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', length: neededRow - rowCount + 100 } }],
      },
    });
  }
}

async function lastDataRow(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${REGISTRO_TAB}'!H1:H2000`,
  });
  const vals = res.data.values || [];
  let last = 1; // fila 1 = encabezado
  vals.forEach((r, i) => { if ((r[0] ?? '').toString().trim() !== '') last = i + 1; });
  return last;
}

// Garantiza que las filas [start..end] tengan las fórmulas de A-D y J-T; si falta
// alguna, las copia (PASTE_FORMULA) desde la última fila con dato (start-1).
async function ensureFormulas(sheets, start, end) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${REGISTRO_TAB}'!J${start}:J${end}`,
    valueRenderOption: 'FORMULA',
  });
  const rows = res.data.values || [];
  let allHaveFormula = true;
  for (let i = 0; i < end - start + 1; i++) {
    const cell = (rows[i]?.[0] ?? '').toString();
    if (!cell.startsWith('=')) { allHaveFormula = false; break; }
  }
  if (allHaveFormula) return;

  const sheetId = await getSheetId(sheets, REGISTRO_TAB);
  const srcRow = start - 2; // 0-based índice de la fila fuente (start-1)
  const copy = (c0, c1) => ({
    copyPaste: {
      source: { sheetId, startRowIndex: srcRow, endRowIndex: srcRow + 1, startColumnIndex: c0, endColumnIndex: c1 },
      destination: { sheetId, startRowIndex: start - 1, endRowIndex: end, startColumnIndex: c0, endColumnIndex: c1 },
      pasteType: 'PASTE_FORMULA',
    },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [copy(0, 4) /* A:D */, copy(9, 20) /* J:T */] },
  });
  console.log('  (fórmulas replicadas en las filas nuevas)');
}

async function main() {
  const sheets = await getSheetsClient();
  const dry = hasFlag('dry-run');
  const clear = hasFlag('clear');
  const fecha = parseFecha(arg('fecha'));
  const serial = toSheetSerial(fecha);

  let items;
  try { items = JSON.parse(arg('items', '[]')); } catch { throw new Error('--items no es JSON válido'); }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Pasá --items=\'[{"comida":"...","cantidad":1,"tipo":"Desayuno"}]\'');
  }

  const foods = await loadBase(sheets);

  const resolved = [];
  const problems = [];
  for (const it of items) {
    const cantidad = Number(it.cantidad);
    if (!it.comida || !Number.isFinite(cantidad)) { problems.push({ it, candidates: [], reason: 'faltan comida/cantidad' }); continue; }
    const { match, candidates } = matchFood(foods, it.comida);
    if (!match) { problems.push({ it, candidates }); continue; }
    resolved.push({ comida: match.name, cantidad, tipo: it.tipo || '', hora: it.hora || '', calPorcion: match.calorias });
  }

  if (problems.length) {
    console.log('⚠️  No pude resolver estas comidas (no escribo nada):');
    for (const p of problems) {
      const sug = p.candidates?.map((c) => c.name).join(', ');
      console.log(`  • "${p.it.comida}"${p.reason ? ` — ${p.reason}` : ''}${sug ? ` → ¿quisiste decir: ${sug}?` : ' → no está en Datos'}`);
    }
    process.exit(2);
  }

  const start = (await lastDataRow(sheets)) + 1;
  const end = start + resolved.length - 1;

  console.log(`Fecha: ${fechaTexto(fecha)} (serial ${serial}) — filas ${start}..${end} en '${REGISTRO_TAB}'`);
  console.table(resolved.map((r, i) => ({
    fila: start + i, tipo: r.tipo || '—', comida: r.comida, cantidad: r.cantidad,
    '≈kcal': r.calPorcion != null ? +(r.calPorcion * r.cantidad).toFixed(0) : '?',
  })));

  if (dry) { console.log('DRY-RUN: no se escribió nada.'); return; }

  if (clear) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${REGISTRO_TAB}'!${COL.fecha}${start}:${COL.cantidad}${end}`,
    });
    console.log('CLEAR: limpié el rango de entrada de esas filas.');
    return;
  }

  await ensureGridRows(sheets, end);

  const values = resolved.map((r) => [serial, r.hora, r.tipo, r.comida, r.cantidad]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${REGISTRO_TAB}'!${COL.fecha}${start}:${COL.cantidad}${end}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  // Después de escribir (la grilla ya incluye las filas nuevas), garantizar que
  // A-D y J-T tengan las fórmulas. Es clave al cruzar el final de la grilla
  // pre-cargada: antes de escribir, esas filas no existen y copyPaste no puede
  // rellenarlas.
  await ensureFormulas(sheets, start, end);

  const back = (await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${REGISTRO_TAB}'!A${start}:T${end}`,
    valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [];
  console.log('\n✅ Escrito. Filas resultantes (Dia..Calidad):');
  back.forEach((r) => console.log('  ', r.join(' | ')));
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
