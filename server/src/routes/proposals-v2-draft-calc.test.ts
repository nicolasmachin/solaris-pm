// Tests del endpoint de debug de cálculo del borrador. Runner node:test:
//   npm run test:proposal-draft-calc
//
// El handler se testea con la fábrica makeDraftCalcHandler(getRows): se inyecta
// un stub del service, así se cubre el gating (rol / propagación de errores)
// sin tocar la BD. Los helpers puros (draftMissingFields, buildCalcDebugRows)
// se testean directo.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { FastifyRequest } from "fastify";

import { buildCalcDebugRows, calculatorLabels } from "../services/proposal/calculator-labels.js";
import { draftMissingFields } from "../services/proposal/draft.service.js";
import type { ProposalCalculated } from "../services/proposal/types.js";
import { AppError } from "../utils/errors.js";
import { makeDraftCalcHandler } from "./proposals-v2-drafts-versions.routes.js";

const validDraft = {
  cliente: { nombre: "Jose", ciudad: "El Pinar" },
  factura: { pagaMensualPesos: 6000, tarifa: "Simple", suministro: "trifásico", potenciaContratadaKw: 7 },
  techo: { descripcion: "hormigon", tamanoM2: 32 },
  cotizacion: { distanciaInstalacionKm: 35, cotizacionDolar: 40, markupPorcentaje: 0.2, plazoEntrega: "6 a 8 sem" },
  sistema: {
    cantidadPaneles: 11, potenciaPanelW: 590, marcaPaneles: "Resun",
    potenciaInversorKw: 6, marcaInversor: "Growatt", tipoMontaje: "Techo",
  },
  fecha: "2026-07-03",
  itemsAdicionales: [],
};

const req = (user: unknown, params: unknown = { leadId: "L1" }) =>
  ({ user, params }) as unknown as FastifyRequest;

const okRows = [{ key: "totalConIva", label: "Total con IVA", descripcion: "", unidad: "USD" as const, orden: 250, valor: 1 }];
const statusOf = (e: unknown) => (e instanceof AppError ? e.statusCode : undefined);

// ─── draftMissingFields ─────────────────────────────────────────────────────
test("draftMissingFields: draft completo → null", () => {
  assert.equal(draftMissingFields(validDraft), null);
});
test("draftMissingFields: falta ciudad → la lista la incluye", () => {
  const missing = draftMissingFields({ ...validDraft, cliente: { nombre: "Jose" } });
  assert.ok(missing?.includes("cliente.ciudad"), `esperaba cliente.ciudad en ${JSON.stringify(missing)}`);
});

// ─── buildCalcDebugRows ─────────────────────────────────────────────────────
test("buildCalcDebugRows: ordenado por orden, arrays incluidos, cobertura completa", () => {
  const calc = {
    ...Object.fromEntries(Object.keys(calculatorLabels).map((k) => [k, 0])),
    generacionMensualKwh: [1, 2, 3],
    retornoInversion16Anios: [-100, 0],
    fechaTextoLargo: "3 de julio de 2026",
    mesYAnio: "Julio 2026",
  } as unknown as ProposalCalculated;

  const rows = buildCalcDebugRows(calc);
  assert.equal(rows.length, Object.keys(calculatorLabels).length);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].orden >= rows[i - 1].orden, "las filas deben venir ordenadas por orden asc");
  }
  const gen = rows.find((r) => r.key === "generacionMensualKwh");
  assert.deepEqual(gen?.valor, [1, 2, 3]);
  // Los strings formateados no se muestran.
  assert.ok(!rows.some((r) => r.key === "fechaTextoLargo" || r.key === "mesYAnio"));
});

// ─── makeDraftCalcHandler ───────────────────────────────────────────────────
// El gating de permiso (VENTAS:DEBUG_CALCULADORA) lo hace el middleware
// authorize en el registro de la ruta, no el handler. Acá solo se testea la
// propagación de errores del service y el happy path.

test("handler: draft inexistente → propaga 404", async () => {
  const handler = makeDraftCalcHandler(async () => { throw new AppError(404, "DRAFT_NOT_FOUND", "no hay"); });
  await assert.rejects(() => handler(req({ id: "u1", role: "ADMIN" })), (e) => statusOf(e) === 404);
});

test("handler: admin + draft inválido → propaga 400 con missing", async () => {
  const handler = makeDraftCalcHandler(async () => {
    throw new AppError(400, "PROPOSAL_DRAFT_INVALID", "Faltan campos obligatorios", { missing: ["cliente.ciudad"] });
  });
  await assert.rejects(
    () => handler(req({ id: "u1", role: "ADMIN" })),
    (e) => statusOf(e) === 400 && (e as AppError).details?.missing != null,
  );
});

test("handler: admin OK → devuelve { rows }", async () => {
  const handler = makeDraftCalcHandler(async () => okRows);
  const res = await handler(req({ id: "u1", role: "ADMIN" }));
  assert.deepEqual(res, { rows: okRows });
});
