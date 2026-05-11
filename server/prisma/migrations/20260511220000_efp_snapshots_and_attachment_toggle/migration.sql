-- Refactor EFP — Fase A:
-- 1. Snapshots congelados en EFPVersion. Antes el PDF re-leía Project /
--    PreIngeniería / UTE / Materiales en cada export, mutando documentos
--    aprobados cuando los datos cambiaban. Estos 4 JSONs anclan los datos
--    al momento de crear la versión.
-- 2. EFPAttachment.includeInPdf flag: permite excluir adjuntos del PDF final
--    sin removerlos de la lista en UI.
--
-- Defaults: snapshots quedan NULL en los registros existentes (los llena el
-- script server/scripts/backfill-efp-snapshots.ts). includeInPdf default true
-- preserva el comportamiento previo (todos los adjuntos se incluían).

ALTER TABLE "efp_versions"
  ADD COLUMN "snapshotProject"   JSONB,
  ADD COLUMN "snapshotPreIng"    JSONB,
  ADD COLUMN "snapshotUte"       JSONB,
  ADD COLUMN "snapshotMaterials" JSONB;

ALTER TABLE "efp_attachments"
  ADD COLUMN "includeInPdf" BOOLEAN NOT NULL DEFAULT true;
