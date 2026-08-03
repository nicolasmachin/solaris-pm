// Lectura de las planillas del sistema Python legacy.
//
// Aisla todo lo feo de los Excel (nombres de columna inconsistentes, NaN como
// string, tildes, celdas vacías) para que el script de migración trabaje con
// datos ya limpios.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import ExcelJS from "exceljs";

export interface FilaConstantes {
  cliente: string;
  potenciaContratadaKw: number | null;
  pctPunta: number | null;
  pctLlano: number | null;
  pctValle: number | null;
  inversionUsd: number | null;
  potenciaInstaladaKwp: number | null;
  mesInicio: string | null; // YYYY-MM
  tipoCliente: "residencial" | "empresa";
  tarifa: string | null;
  habilitado: boolean;
}

export interface FilaLectura {
  cliente: string;
  periodo: string; // YYYY-MM
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
}

export interface FilaHistorico extends FilaLectura {
  autoconsumoKwh: number | null;
  importacionRedKwh: number | null;
  ahorroAutoconsumo: number | null;
  ahorroVenta: number | null;
  ahorroTotal: number | null;
  ahorroTotalUsd: number | null;
  saldoFinal: number | null;
}

export interface FilaEmail {
  cliente: string; // razón social UTE
  planta: string; // el nombre que matchea `constantes.cliente`
  emails: string[];
  habilitado: boolean;
}

export interface FilaPlanta {
  plantId: string;
  nombre: string | null;
}

export interface CuadroLegacy {
  cargos: Record<string, { cargoFijo: number; cargoPotenciaKw: number }>;
  tramosSimple: Array<{ desdeKwh: number; hastaKwh: number; precioKwh: number }>;
  franjas: Record<string, Record<string, number>>;
}

// ─── Helpers de celda ────────────────────────────────────────────────────────

/** Texto de una celda, resolviendo fórmulas y rich text. Vacío → "". */
function texto(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("text" in v) return String((v as { text: unknown }).text ?? "").trim();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  return s.toLowerCase() === "nan" ? "" : s;
}

/** Número de una celda. Vacío, "nan" o no numérico → null. */
function numero(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = texto(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Normaliza texto para comparar: sin tildes, minúsculas, espacios colapsados. */
export function normalizar(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[~"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "2024-08", "2024-08-01", un Date → "2024-08". */
function periodo(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const s = texto(v);
  const m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${String(mes).padStart(2, "0")}`;
}

/** Mapa nombre-normalizado-de-columna → índice (1-based, como ExcelJS). */
function encabezados(sheet: ExcelJS.Worksheet, filaHeader = 1): Map<string, number> {
  const out = new Map<string, number>();
  sheet.getRow(filaHeader).eachCell((cell, col) => {
    const nombre = normalizar(texto(cell.value)).replace(/\s/g, "_");
    if (nombre) out.set(nombre, col);
  });
  return out;
}

async function abrir(dir: string, archivo: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(dir, archivo));
  return wb;
}

function hoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const s = wb.worksheets.find((w) => normalizar(w.name) === normalizar(nombre));
  if (!s) {
    throw new Error(
      `No se encontró la hoja "${nombre}". Hojas disponibles: ${wb.worksheets.map((w) => w.name).join(", ")}`,
    );
  }
  return s;
}

// ─── Lectores ────────────────────────────────────────────────────────────────

export async function leerConstantes(dir: string): Promise<FilaConstantes[]> {
  const sheet = hoja(await abrir(dir, "datos_clientes.xlsx"), "constantes");
  const h = encabezados(sheet);
  // La planilla renombró la columna en algún momento; se aceptan las dos.
  const colFecha = h.get("fecha_inst") ?? h.get("fecha_ins");
  const out: FilaConstantes[] = [];

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const cliente = texto(row.getCell(h.get("cliente") ?? 1).value);
    if (!cliente) return;

    let pctPunta = numero(row.getCell(h.get("pct_punta") ?? 0).value);
    let pctLlano = numero(row.getCell(h.get("pct_llano") ?? 0).value);
    let pctValle = numero(row.getCell(h.get("pct_valle") ?? 0).value);
    // La planilla acepta 0-1 o 0-100; se normaliza a 0-1 como hacía el original.
    if ((pctPunta ?? 0) > 1 || (pctLlano ?? 0) > 1 || (pctValle ?? 0) > 1) {
      pctPunta = pctPunta == null ? null : pctPunta / 100;
      pctLlano = pctLlano == null ? null : pctLlano / 100;
      pctValle = pctValle == null ? null : pctValle / 100;
    }

    const tipo = normalizar(texto(row.getCell(h.get("tipo") ?? 0).value));
    const reporte = numero(row.getCell(h.get("reporte") ?? 0).value);

    out.push({
      cliente,
      potenciaContratadaKw: numero(row.getCell(h.get("potencia_contratada_kw") ?? 0).value),
      pctPunta,
      pctLlano,
      pctValle,
      inversionUsd: numero(row.getCell(h.get("inversion") ?? 0).value),
      potenciaInstaladaKwp: numero(row.getCell(h.get("pot_inst") ?? 0).value),
      mesInicio: colFecha ? periodo(row.getCell(colFecha).value) : null,
      tipoCliente: tipo === "empresa" ? "empresa" : "residencial",
      tarifa: normalizar(texto(row.getCell(h.get("tarifa") ?? 0).value)) || null,
      habilitado: reporte === 1,
    });
  });

  return out;
}

/** Tipo de cambio global de la hoja `constantes_globales` (celda "Dólar"). */
export async function leerTipoCambio(dir: string): Promise<number | null> {
  const sheet = hoja(await abrir(dir, "datos_clientes.xlsx"), "constantes_globales");
  let valor: number | null = null;
  sheet.eachRow((row) => {
    if (normalizar(texto(row.getCell(1).value)) === "dolar") valor = numero(row.getCell(2).value);
  });
  return valor;
}

export async function leerDatos(dir: string): Promise<FilaLectura[]> {
  const sheet = hoja(await abrir(dir, "datos_clientes.xlsx"), "datos");
  const h = encabezados(sheet);
  const out: FilaLectura[] = [];

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const cliente = texto(row.getCell(h.get("cliente") ?? 1).value);
    const p = periodo(row.getCell(h.get("mes") ?? 2).value);
    if (!cliente || !p) return;
    out.push({
      cliente,
      periodo: p,
      generacionKwh: numero(row.getCell(h.get("generacion_kwh") ?? 0).value),
      consumoKwh: numero(row.getCell(h.get("consumo_kwh") ?? 0).value),
      exportacionKwh: numero(row.getCell(h.get("exportacion_kwh") ?? 0).value),
    });
  });

  return out;
}

export async function leerHistorico(dir: string): Promise<FilaHistorico[]> {
  const sheet = hoja(await abrir(dir, "historico_clientes.xlsx"), "historico");
  const h = encabezados(sheet);
  const out: FilaHistorico[] = [];

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const cliente = texto(row.getCell(h.get("cliente") ?? 1).value);
    const p = periodo(row.getCell(h.get("mes") ?? 2).value);
    if (!cliente || !p) return;
    const n = (col: string) => numero(row.getCell(h.get(col) ?? 0).value);
    out.push({
      cliente,
      periodo: p,
      generacionKwh: n("generacion_kwh"),
      consumoKwh: n("consumo_kwh"),
      exportacionKwh: n("exportacion_kwh"),
      autoconsumoKwh: n("autoconsumo_kwh"),
      importacionRedKwh: n("importacion_kwh"),
      ahorroAutoconsumo: n("ahorro_autoconsumo"),
      ahorroVenta: n("ahorro_venta"),
      ahorroTotal: n("ahorro_total"),
      ahorroTotalUsd: n("ahorro_total_usd"),
      saldoFinal: n("saldo"),
    });
  });

  return out;
}

export async function leerEmails(dir: string): Promise<FilaEmail[]> {
  const sheet = hoja(await abrir(dir, "emails_clientes.xlsx"), "Resumen");
  const h = encabezados(sheet);
  const RE_EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const out: FilaEmail[] = [];

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const cliente = texto(row.getCell(h.get("cliente") ?? 1).value);
    const planta = texto(row.getCell(h.get("planta") ?? 0).value);
    if (!cliente && !planta) return;

    // "No encontrado" y similares quedan afuera por el regex.
    const emails = [texto(row.getCell(h.get("email1") ?? 0).value), texto(row.getCell(h.get("email2") ?? 0).value)]
      .map((e) => e.trim())
      .filter((e) => RE_EMAIL.test(e));

    out.push({
      cliente,
      planta,
      emails: [...new Set(emails.map((e) => e.toLowerCase()))],
      habilitado: numero(row.getCell(h.get("reporte") ?? 0).value) === 1,
    });
  });

  return out;
}

/** CSV simple (sin comillas anidadas, que es como están estos archivos). */
export function leerCsvPlantas(dir: string, archivo: string): FilaPlanta[] {
  let raw: string;
  try {
    raw = readFileSync(join(dir, archivo), "utf8");
  } catch {
    return [];
  }

  const lineas = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length === 0) return [];

  const cols = lineas[0].split(",").map((c) => normalizar(c).replace(/\s/g, "_"));
  const iId = cols.findIndex((c) => c === "plant_id" || c === "plantid" || c === "id");
  const iNombre = cols.findIndex((c) => c === "nombre" || c === "name" || c === "plant_name");
  if (iId < 0) return [];

  const out: FilaPlanta[] = [];
  for (const linea of lineas.slice(1)) {
    const celdas = linea.split(",");
    const plantId = (celdas[iId] ?? "").trim();
    if (!/^\d+$/.test(plantId)) continue;
    out.push({
      plantId,
      nombre: iNombre >= 0 ? (celdas[iNombre] ?? "").trim() || null : null,
    });
  }
  return out;
}

/** Un pliego tarifario con la fecha desde la que rige ("YYYY-MM"). */
export interface PliegoLegacy {
  vigenciaDesde: string;
  cuadro: CuadroLegacy;
}

/**
 * Lee `tarifas.xlsx` agrupando por la columna `vigencia_desde` de cada hoja, así
 * que devuelve todos los pliegos (2024, 2025, 2026…) para cargarlos cada uno con
 * su vigencia. Si una hoja no tiene esa columna (planillas viejas de un solo
 * pliego), todo cae en "2024-01".
 */
export async function leerTarifasPorVigencia(dir: string): Promise<PliegoLegacy[]> {
  const wb = await abrir(dir, "tarifas.xlsx");

  const vigDe = (row: ExcelJS.Row, h: Map<string, number>): string => {
    const col = h.get("vigencia_desde");
    const v = col ? normalizar(texto(row.getCell(col).value)) : "";
    return v || "2024-01";
  };

  const porVig = new Map<string, CuadroLegacy>();
  const cuadroDe = (vig: string): CuadroLegacy => {
    let c = porVig.get(vig);
    if (!c) porVig.set(vig, (c = { cargos: {}, tramosSimple: [], franjas: {} }));
    return c;
  };

  // Hoja `parametros`: (tarifa, concepto, valor, vigencia_desde)
  const par = hoja(wb, "parametros");
  const hp = encabezados(par);
  par.eachRow((row, i) => {
    if (i === 1) return;
    const tarifa = normalizar(texto(row.getCell(hp.get("tarifa") ?? 1).value));
    const concepto = normalizar(texto(row.getCell(hp.get("concepto") ?? 2).value));
    const valor = numero(row.getCell(hp.get("valor") ?? 3).value);
    if (!tarifa || valor == null) return;
    const cargos = cuadroDe(vigDe(row, hp)).cargos;
    cargos[tarifa] ??= { cargoFijo: 0, cargoPotenciaKw: 0 };
    if (concepto === "cargo_fijo") cargos[tarifa].cargoFijo = valor;
    if (concepto === "potencia_cont") cargos[tarifa].cargoPotenciaKw = valor;
  });

  // Hoja `precios_simple`: tramos escalonados. La columna del precio se llama
  // `precio` en esta hoja y `precio_kwh` en las de franjas.
  const sim = hoja(wb, "precios_simple");
  const hs = encabezados(sim);
  const colPrecio = hs.get("precio") ?? hs.get("precio_kwh");
  sim.eachRow((row, i) => {
    if (i === 1) return;
    const desdeKwh = numero(row.getCell(hs.get("desde_kwh") ?? 1).value);
    const hastaKwh = numero(row.getCell(hs.get("hasta_kwh") ?? 2).value);
    const precioKwh = colPrecio ? numero(row.getCell(colPrecio).value) : null;
    if (desdeKwh == null || hastaKwh == null || precioKwh == null) return;
    cuadroDe(vigDe(row, hs)).tramosSimple.push({ desdeKwh, hastaKwh, precioKwh });
  });

  // Hojas de franjas. `zafral` no lleva el prefijo `precios_`.
  for (const [tarifa, nombreHoja] of [
    ["doble", "precios_doble"],
    ["triple", "precios_triple"],
    ["zafral", "zafral"],
  ] as const) {
    const s = hoja(wb, nombreHoja);
    const hf = encabezados(s);
    s.eachRow((row, i) => {
      if (i === 1) return;
      const franja = normalizar(texto(row.getCell(hf.get("franja") ?? 1).value));
      const precio = numero(row.getCell(hf.get("precio_kwh") ?? 2).value);
      if (!franja || precio == null) return;
      const franjas = cuadroDe(vigDe(row, hf)).franjas;
      (franjas[tarifa] ??= {})[franja] = precio;
    });
  }

  return [...porVig.entries()]
    .map(([vigenciaDesde, cuadro]) => {
      cuadro.tramosSimple.sort((a, b) => a.desdeKwh - b.desdeKwh);
      return { vigenciaDesde, cuadro };
    })
    .sort((a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde));
}

/** El cuadro más reciente (mayor vigencia). Compat con usos de un solo pliego. */
export async function leerTarifas(dir: string): Promise<CuadroLegacy> {
  const pliegos = await leerTarifasPorVigencia(dir);
  return pliegos[pliegos.length - 1]?.cuadro ?? { cargos: {}, tramosSimple: [], franjas: {} };
}
