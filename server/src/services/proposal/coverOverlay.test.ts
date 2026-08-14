// Tests del acomodo de texto de la tapa. Runner builtin node:test:
//   node --import tsx --test src/services/proposal/coverOverlay.test.ts
//
// El caso que motivó esto: las coordenadas y el cuerpo del overlay se
// configuran una vez pensando en un nombre de persona, y con el cotizador B2B
// empezaron a entrar razones sociales que se salían de la página.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import { acomodarTexto } from "./coverOverlay.js";

const fontPromise: Promise<PDFFont> = (async () => {
  const pdf = await PDFDocument.create();
  return pdf.embedFont(StandardFonts.HelveticaBold);
})();

// Ancho disponible real de la tapa con la configuración vigente:
// A4 = 595 pt de ancho, el nombre arranca en x=300, margen derecho 34.
const MAX_WIDTH = 595 - 300 - 34;
const SIZE = 32;

test("un nombre corto no se toca: una línea, cuerpo intacto", async () => {
  const font = await fontPromise;
  const r = acomodarTexto("Jose Gonzalez", font, SIZE, MAX_WIDTH);
  assert.deepEqual(r.lineas, ["Jose Gonzalez"]);
  assert.equal(r.size, SIZE);
});

test("un nombre apenas largo se encoge, sin partirse", async () => {
  const font = await fontPromise;
  const r = acomodarTexto("Juan Pedro Fernández", font, SIZE, MAX_WIDTH);
  assert.equal(r.lineas.length, 1, "no debería partirse todavía");
  assert.ok(r.size < SIZE && r.size >= SIZE * 0.7, `cuerpo fuera de rango: ${r.size}`);
});

test("una razón social larga se parte en dos líneas y NO se recorta", async () => {
  const font = await fontPromise;
  const r = acomodarTexto("Cooperativa Agraria del Litoral S.A.", font, SIZE, MAX_WIDTH);
  assert.equal(r.lineas.length, 2, "debería usar dos líneas");
  assert.equal(r.lineas.join(" "), "Cooperativa Agraria del Litoral S.A.", "no se pierde texto");
  for (const linea of r.lineas) {
    assert.ok(
      font.widthOfTextAtSize(linea, r.size) <= MAX_WIDTH,
      `la línea "${linea}" se sale del ancho`,
    );
  }
});

test("una sola palabra larguísima se recorta con puntos suspensivos", async () => {
  const font = await fontPromise;
  const r = acomodarTexto("Superextracalifragilisticoespialidosisimo", font, SIZE, MAX_WIDTH);
  assert.equal(r.lineas.length, 1);
  assert.ok(r.lineas[0].endsWith("…"), "debería terminar en …");
  assert.ok(font.widthOfTextAtSize(r.lineas[0], r.size) <= MAX_WIDTH, "el recorte no alcanzó");
});

test("ancho no disponible: devuelve el texto tal cual en vez de romper", async () => {
  const font = await fontPromise;
  const r = acomodarTexto("Cualquier Cosa", font, SIZE, 0);
  assert.deepEqual(r.lineas, ["Cualquier Cosa"]);
  assert.equal(r.size, SIZE);
});
