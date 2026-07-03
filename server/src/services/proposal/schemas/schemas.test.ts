// Tests de los schemas Zod de Fase E (draft + snapshot). Runner node:test:
//   node --import tsx --test src/services/proposal/schemas/schemas.test.ts

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { draftDataPublishSchema, draftDataStorageSchema } from "./draft.schema.js";
import { SNAPSHOT_VERSION, TEMPLATE_VERSION, snapshotSchema } from "./snapshot.schema.js";

const validDraft = {
  cliente: { nombre: "Jose Gonzalez", dirigidoA: "Estimado Jose Gonzalez,", ciudad: "El Pinar, Uruguay." },
  factura: { pagaMensualPesos: 9000, tarifa: "Doble", suministro: "monofásico", potenciaContratadaKw: 6.6 },
  techo: { descripcion: "de tejas de 8 x 4 mts.", tamanoM2: 32 },
  cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 0.15, plazoEntrega: "6 a 8 semanas" },
  sistema: { cantidadPaneles: 16, potenciaPanelW: 590, marcaPaneles: "Resun", potenciaInversorKw: 10, marcaInversor: "Growatt", tipoMontaje: "Techo chapa" },
  fecha: "2026-06-19",
  itemsAdicionales: [],
};

test("draftDataPublishSchema (strict): acepta un draft completo", () => {
  assert.equal(draftDataPublishSchema.safeParse(validDraft).success, true);
});

test("draftDataPublishSchema (strict): rechaza si falta el nombre del cliente", () => {
  const bad = { ...validDraft, cliente: { dirigidoA: "x", ciudad: "y" } };
  assert.equal(draftDataPublishSchema.safeParse(bad).success, false);
});

test("draftDataPublishSchema (strict): rechaza si falta tipoMontaje o plazoEntrega", () => {
  const sinMontaje = { ...validDraft, sistema: { ...validDraft.sistema, tipoMontaje: undefined } };
  assert.equal(draftDataPublishSchema.safeParse(sinMontaje).success, false);
  const sinPlazo = { ...validDraft, cotizacion: { ...validDraft.cotizacion, plazoEntrega: undefined } };
  assert.equal(draftDataPublishSchema.safeParse(sinPlazo).success, false);
});

test("draftDataPublishSchema (strict): rechaza campos desconocidos", () => {
  assert.equal(draftDataPublishSchema.safeParse({ ...validDraft, campoExtra: 1 }).success, false);
});

test("draftDataStorageSchema (lenient): acepta un borrador parcial", () => {
  assert.equal(draftDataStorageSchema.safeParse({ cliente: { nombre: "Ana" } }).success, true);
  assert.equal(draftDataStorageSchema.safeParse({}).success, true);
  assert.equal(draftDataStorageSchema.safeParse(validDraft).success, true);
});

test("draftDataStorageSchema (lenient): sigue validando tipos de lo presente", () => {
  assert.equal(draftDataStorageSchema.safeParse({ factura: { pagaMensualPesos: "no-numero" } }).success, false);
});

const validSnapshot = {
  version: SNAPSHOT_VERSION,
  data: validDraft,
  defaults: { precioPanelUsdSinIva: 105, marcaPanelesDefault: "Resun" },
  coverOverlay: {
    clientName: { x: 100, y: 900, fontSize: 32, color: "#FFFFFF", fontWeight: "bold" },
    city: { x: 100, y: 850, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
    date: { x: 100, y: 800, fontSize: 18, color: "#FFFFFF", fontWeight: "regular" },
  },
  coverPdfAttachmentId: null,
  calc: { totalConIva: 12345, cualquierCampo: "ok" },
  templateVersion: TEMPLATE_VERSION,
  renderedAt: "2026-06-30T15:20:00Z",
};

test("snapshotSchema: acepta un snapshot válido", () => {
  const r = snapshotSchema.safeParse(validSnapshot);
  assert.equal(r.success, true);
});

test("snapshotSchema: acepta coverPdfAttachmentId string", () => {
  const r = snapshotSchema.safeParse({ ...validSnapshot, coverPdfAttachmentId: "att_123" });
  assert.equal(r.success, true);
});

test("snapshotSchema: rechaza si falta calc", () => {
  const { calc: _omit, ...bad } = validSnapshot;
  assert.equal(snapshotSchema.safeParse(bad).success, false);
});

test("snapshotSchema: rechaza version distinta de la actual", () => {
  const r = snapshotSchema.safeParse({ ...validSnapshot, version: 2 });
  assert.equal(r.success, false);
});
