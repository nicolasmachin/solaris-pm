// Rellena el formulario "Solicitud de suministro" de UTE (un libro Excel) con
// los datos del proyecto, y devuelve el archivo listo para adjuntar al mail.
//
// POR QUÉ NO SE USA UNA LIBRERÍA DE EXCEL
// El libro que publica UTE trae imágenes, objetos incrustados, listas
// desplegables con extensiones y fórmulas de validación entre hojas. `exceljs`
// —que ya está en el proyecto— ni siquiera logra abrirlo, y las librerías que
// sí lo abren lo reescriben entero y se pierden esas piezas. Como UTE valida el
// formulario con sus propias fórmulas, un archivo "equivalente" no sirve: tiene
// que ser SU archivo con las celdas completadas.
//
// Por eso se edita el XML de la hoja a mano y se copia todo lo demás tal cual.
// El resultado conserva byte a byte los 57 componentes del libro original.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { notFound } from "../../utils/errors.js";
import { CELLS, SHEET_NAME, type CampoFormulario, type CellType } from "./cells.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src/services/ute-suministro → server/src/assets/ute-templates
const TEMPLATE_FILE = path.resolve(
  here,
  "../../assets/ute-templates/Solicitud_Suministro_UTE.xlsx",
);

export type DatosFormulario = Partial<Record<CampoFormulario, string>>;

function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Un valor es numérico solo si es un número "puro". "099648499" NO cuenta: si
// se escribiera como número perdería el cero inicial del teléfono.
function esNumeroPuro(valor: string): boolean {
  return /^-?\d+([.,]\d+)?$/.test(valor.trim()) && !/^0\d/.test(valor.trim());
}

/**
 * Reemplaza el contenido de una celda conservando su estilo (`s="..."`), que es
 * lo que le da el formato visual dentro del formulario.
 *
 * Devuelve el XML sin cambios si la celda no existe en la hoja: el formulario
 * la trae siempre creada (aunque vacía), así que no encontrarla significa que
 * UTE cambió el formulario y hay que revisar el mapa de celdas.
 */
function escribirCelda(xml: string, coord: string, valor: string, tipo: CellType): string {
  const re = new RegExp(`<c r="${coord}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = re.exec(xml);
  if (!m) return xml;

  const estiloMatch = /\ss="\d+"/.exec(m[1]);
  const estilo = estiloMatch ? estiloMatch[0] : "";

  const limpio = valor.trim();
  let nuevo: string;
  if (limpio === "") {
    nuevo = `<c r="${coord}"${estilo}/>`;
  } else {
    const comoNumero = tipo === "number" || (tipo === "auto" && esNumeroPuro(limpio));
    nuevo = comoNumero
      ? `<c r="${coord}"${estilo}><v>${limpio.replace(",", ".")}</v></c>`
      : `<c r="${coord}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escaparXml(limpio)}</t></is></c>`;
  }
  return xml.slice(0, m.index) + nuevo + xml.slice(m.index + m[0].length);
}

// Resuelve qué archivo XML corresponde a la hoja "Individual". Se hace por
// NOMBRE y no por número de archivo para que siga funcionando si UTE reordena
// o agrega hojas en una versión futura del formulario.
async function resolverHoja(zip: JSZip): Promise<string> {
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbook || !rels) {
    throw notFound("UTE_XLSX_INVALIDO", "La plantilla de UTE no tiene la estructura esperada.");
  }

  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(m[1], m[2]);
  }

  for (const m of workbook.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    if (m[1] === SHEET_NAME) {
      const target = targets.get(m[2]);
      if (target) return `xl/${target.replace(/^\/?xl\//, "")}`;
    }
  }
  throw notFound(
    "UTE_XLSX_HOJA_FALTANTE",
    `La plantilla de UTE no tiene la hoja "${SHEET_NAME}".`,
  );
}

/**
 * Devuelve el formulario de UTE completado con `datos`.
 * Los campos que no vengan quedan vacíos (no se inventa nada).
 */
export async function completarFormularioSuministro(datos: DatosFormulario): Promise<Buffer> {
  let plantilla: Buffer;
  try {
    plantilla = await fs.readFile(TEMPLATE_FILE);
  } catch {
    throw notFound(
      "UTE_XLSX_TEMPLATE_MISSING",
      "Falta la plantilla del formulario de UTE en el servidor.",
    );
  }

  const zip = await JSZip.loadAsync(plantilla);
  const hoja = await resolverHoja(zip);
  let xml = await zip.file(hoja)!.async("string");

  for (const [campo, spec] of Object.entries(CELLS)) {
    const valor = datos[campo as CampoFormulario];
    if (valor === undefined) continue;
    xml = escribirCelda(xml, spec.cell, valor, spec.type);
  }

  zip.file(hoja, xml);
  // `nodebuffer` + DEFLATE: mismo formato que el original. No se recomprime
  // nada más porque el resto de las entradas se copian como venían.
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// Nombre del archivo adjunto. Se sanea el nombre del cliente porque termina en
// un adjunto de correo y en el disco del servidor.
export function nombreArchivoFormulario(clientName: string, esAumento: boolean): string {
  const cliente = (clientName || "cliente").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
  const tramite = esAumento ? "Aumento_Potencia" : "Solicitud_Suministro";
  const hoy = new Date().toISOString().slice(0, 10);
  return `${tramite}_${cliente}_${hoy}.xlsx`;
}
