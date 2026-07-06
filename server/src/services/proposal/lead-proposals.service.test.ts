// Tests del armado unificado de propuestas del lead (función pura, sin DB).
//   npm run test:lead-proposals

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { mapProposalListItems } from "./lead-proposals.service.js";

const d = (iso: string) => new Date(iso);

const input = {
  versions: [
    { id: "v-pub", versionNumber: 3, status: "PUBLISHED" as const, publishedAt: d("2026-03-10T12:00:00Z"), clientName: "Jose", totalConIva: 12846 },
    { id: "v-dis", versionNumber: 2, status: "DISCARDED" as const, publishedAt: d("2026-03-05T12:00:00Z"), clientName: "Jose", totalConIva: 9000 },
  ],
  generations: [
    { id: "g-done", version: 1, status: "COMPLETED", outputFilePath: "/x.pdf", inputFilePath: "/x.xlsx", discardedAt: null, createdAt: d("2026-03-08T12:00:00Z") },
    { id: "g-fail", version: 1, status: "FAILED", outputFilePath: null, inputFilePath: null, discardedAt: null, createdAt: d("2026-03-01T12:00:00Z") },
  ],
  leadClientName: "Jose Gonzalez",
};

test("mezcla nuevas + viejas y ordena por fecha DESC", () => {
  const rows = mapProposalListItems(input);
  assert.deepEqual(rows.map((r) => r.id), ["v-pub", "g-done", "v-dis", "g-fail"]);
  assert.deepEqual(rows.map((r) => r.tipo), ["nueva", "vieja", "nueva", "vieja"]);
});

test("nueva activa: full/summary/preview/discard, sin restore/excel", () => {
  const r = mapProposalListItems(input).find((x) => x.id === "v-pub")!;
  assert.equal(r.status, "activa");
  assert.equal(r.totalConIva, 12846);
  assert.equal(r.versionNumber, 3);
  assert.deepEqual(r.actions, {
    canDownloadFull: true, canDownloadSummary: true, canDownloadExcel: false,
    canPreview: true, canDiscard: true, canRestore: false,
  });
});

test("nueva descartada: solo restore", () => {
  const r = mapProposalListItems(input).find((x) => x.id === "v-dis")!;
  assert.equal(r.status, "descartada");
  assert.deepEqual(r.actions, {
    canDownloadFull: false, canDownloadSummary: false, canDownloadExcel: false,
    canPreview: false, canDiscard: false, canRestore: true,
  });
});

test("vieja COMPLETED con Excel: full + preview + excel + discard; status activa", () => {
  const r = mapProposalListItems(input).find((x) => x.id === "g-done")!;
  assert.equal(r.status, "activa");
  assert.equal(r.clientName, "Jose Gonzalez");
  assert.equal(r.actions.canDownloadFull, true);
  assert.equal(r.actions.canPreview, true);
  assert.equal(r.actions.canDownloadExcel, true);
  assert.equal(r.actions.canDiscard, true);
  assert.equal(r.actions.canRestore, false);
});

test("vieja FAILED / sin PDF ni Excel: sin descargas, pero descartable", () => {
  const r = mapProposalListItems(input).find((x) => x.id === "g-fail")!;
  assert.equal(r.actions.canDownloadFull, false);
  assert.equal(r.actions.canPreview, false);
  assert.equal(r.actions.canDownloadExcel, false);
  assert.equal(r.actions.canDiscard, true);
});

test("vieja descartada: solo restore", () => {
  const rows = mapProposalListItems({
    versions: [],
    generations: [
      { id: "g-disc", version: 1, status: "COMPLETED", outputFilePath: "/x.pdf", inputFilePath: "/x.xlsx", discardedAt: d("2026-03-09T12:00:00Z"), createdAt: d("2026-03-08T12:00:00Z") },
    ],
    leadClientName: "Jose Gonzalez",
  });
  const r = rows[0];
  assert.equal(r.status, "descartada");
  assert.deepEqual(r.actions, {
    canDownloadFull: false, canDownloadSummary: false, canDownloadExcel: false,
    canPreview: false, canDiscard: false, canRestore: true,
  });
});
