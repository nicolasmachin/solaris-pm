// Carga de la base de alimentos ("Datos") y matcher tolerante de nombres.
// El VLOOKUP de la planilla exige que la Comida escrita en el registro coincida
// EXACTAMENTE con el nombre en Datos!D, así que siempre resolvemos a ese nombre.

import { SPREADSHEET_ID, DATOS_TAB, DATOS_RANGE } from './config.js';

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // saca acentos
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

// Devuelve [{ name, calorias, norm }] con las comidas reales (saltea marcadores/vacíos).
export async function loadBase(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${DATOS_TAB}'!${DATOS_RANGE}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const foods = [];
  for (const r of rows) {
    const name = (r[0] ?? '').toString().trim();
    if (!name) continue;
    const calorias = typeof r[1] === 'number' ? r[1] : Number(r[1]);
    foods.push({ name, calorias: Number.isFinite(calorias) ? calorias : null, norm: normalize(name) });
  }
  return foods;
}

// Resuelve una comida escrita libremente al nombre exacto de la base.
// Devuelve { match } si hay uno claro, o { candidates } si es ambiguo/no existe.
export function matchFood(foods, query) {
  const q = normalize(query);
  if (!q) return { match: null, candidates: [] };

  const exact = foods.find((f) => f.norm === q);
  if (exact) return { match: exact, candidates: [] };

  const starts = foods.filter((f) => f.norm.startsWith(q));
  const includes = foods.filter((f) => f.norm.includes(q));
  const seen = new Set();
  const candidates = [...starts, ...includes].filter((f) => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  }).slice(0, 8);

  if (candidates.length === 1) return { match: candidates[0], candidates: [] };
  return { match: null, candidates };
}
