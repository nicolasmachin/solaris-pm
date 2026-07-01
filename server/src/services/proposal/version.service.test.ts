// Tests de los helpers PUROS del version.service (sin DB). El resto (publish,
// discard, restore, regenerate, race) va en el script e2e de 1.7. Runner:
//   node --import tsx --test src/services/proposal/version.service.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { SNAPSHOT_VERSION, TEMPLATE_VERSION } from "./schemas/snapshot.schema.js";
import { buildSnapshot, clientLastName, versionPdfFilename } from "./version.service.js";

test("clientLastName: último token, sin acentos ni símbolos", () => {
  assert.equal(clientLastName("Jose Gonzalez"), "Gonzalez");
  assert.equal(clientLastName("María Núñez"), "Nunez");
  assert.equal(clientLastName("  "), "cliente");
});

test("versionPdfFilename: prefijo por tipo + apellido + versión", () => {
  assert.equal(versionPdfFilename("full", "Jose Gonzalez", 1), "propuesta-Gonzalez-v1.pdf");
  assert.equal(versionPdfFilename("summary", "Jose Gonzalez", 3), "resumen-Gonzalez-v3.pdf");
});

const validDraft = {
  cliente: { nombre: "Jose Gonzalez", dirigidoA: "Estimado Jose Gonzalez,", ciudad: "El Pinar, Uruguay." },
  factura: { pagaMensualPesos: 9000, tarifa: "Doble", suministro: "monofásico", potenciaContratadaKw: 6.6 },
  techo: { descripcion: "de tejas", tamanoM2: 32 },
  cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 0.15 },
  sistema: { cantidadPaneles: 16, potenciaPanelW: 590, marcaPaneles: "Resun", potenciaInversorKw: 10, marcaInversor: "Growatt" },
  fecha: "2026-06-19",
  itemsAdicionales: [],
};

const overlay = {
  clientName: { x: 100, y: 900, fontSize: 32, color: "#FFFFFF", fontWeight: "bold" },
  city: { x: 100, y: 850, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
  date: { x: 100, y: 800, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
};

test("buildSnapshot: arma y valida con las constantes actuales", () => {
  const snap = buildSnapshot({
    data: validDraft,
    defaults: { precioPanelUsdSinIva: 105 },
    coverOverlay: overlay,
    coverPdfAttachmentId: null,
    calc: { totalConIva: 12345, fechaTextoLargo: "19 de junio de 2026" },
    renderedAt: "2026-06-30T15:20:00Z",
  });
  assert.equal(snap.version, SNAPSHOT_VERSION);
  assert.equal(snap.templateVersion, TEMPLATE_VERSION);
  assert.equal(snap.coverPdfAttachmentId, null);
});

test("buildSnapshot: rechaza data inválido (tira ZodError)", () => {
  assert.throws(() =>
    buildSnapshot({
      data: { cliente: { nombre: "x" } }, // incompleto
      defaults: {},
      coverOverlay: overlay,
      coverPdfAttachmentId: null,
      calc: {},
      renderedAt: "2026-06-30T15:20:00Z",
    }),
  );
});
