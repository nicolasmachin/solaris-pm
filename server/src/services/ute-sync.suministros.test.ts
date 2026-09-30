import { test } from "node:test";
import assert from "node:assert/strict";
import type { UteProcess } from "@prisma/client";

import { vistaDelProyecto } from "./ute-sync.service.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

function tramite(suministro: number, extra: Partial<UteProcess> = {}): UteProcess {
  return {
    id: `t${suministro}`,
    projectId: "p",
    suministro,
    currentStage: "ENSAYOS",
    currentStatus: "ESPERANDO",
    stageManuallySet: false,
    caseNumber: null,
    notes: null,
    dateColors: null,
    consultaSentAt: d("2026-09-01"),
    caseOpenedAt: null,
    consultaApprovedAt: null,
    solicitudSentAt: null,
    proyectoApprovedAt: null,
    docs1SentAt: null,
    docs1ApprovedAt: null,
    ensayosSentAt: null,
    ensayosApprovedAt: null,
    docs2SentAt: null,
    finalizedAt: null,
    createdById: null,
    createdAt: d("2026-09-01"),
    updatedAt: d("2026-09-01"),
    deletedAt: null,
    ...extra,
  } as UteProcess;
}

const fin = (s: string): Partial<UteProcess> => ({ currentStage: "FINALIZADO", currentStatus: "CERRADO", finalizedAt: d(s) });

test("un solo trámite: el del proyecto es él tal cual", () => {
  const p = tramite(1, fin("2026-09-20"));
  assert.equal(vistaDelProyecto(p, [p]), p);
});

test("principal habilitado y el otro pendiente: el proyecto NO se ve habilitado", () => {
  const p = tramite(1, fin("2026-09-20"));
  const v = vistaDelProyecto(p, [p, tramite(2)]);
  assert.equal(v.finalizedAt, null);
  assert.notEqual(v.currentStage, "FINALIZADO");
  assert.notEqual(v.currentStatus, "CERRADO");
  // Las fechas de los pasos anteriores no se tocan.
  assert.deepEqual(v.consultaSentAt, p.consultaSentAt);
});

test("el otro habilitado y el principal pendiente: tampoco", () => {
  const p = tramite(1);
  const v = vistaDelProyecto(p, [p, tramite(2, fin("2026-09-18"))]);
  assert.equal(v.finalizedAt, null);
});

test("todos habilitados: la fecha del proyecto es la del ÚLTIMO", () => {
  const p = tramite(1, fin("2026-09-20"));
  const v = vistaDelProyecto(p, [p, tramite(2, fin("2026-09-27"))]);
  assert.deepEqual(v.finalizedAt, d("2026-09-27"));
  assert.equal(v.currentStage, "FINALIZADO");
});

test("uno cerrado a mano sin fecha cuenta como terminado", () => {
  const p = tramite(1, fin("2026-09-20"));
  const cerradoSinFecha = tramite(2, { currentStatus: "CERRADO", currentStage: "FINALIZADO", finalizedAt: null });
  const v = vistaDelProyecto(p, [p, cerradoSinFecha]);
  assert.deepEqual(v.finalizedAt, d("2026-09-20"));
});
