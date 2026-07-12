-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "importedFromCsv" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_importedFromCsv_idx" ON "projects"("importedFromCsv");

-- Backfill: marcar los Generadores ya cargados por CSV (identificados por su
-- auditoría metadata.source='import_csv') como livianos, para sacarlos de la
-- lista de Proyectos. Reproducible en prod vía `migrate deploy`.
UPDATE "projects" p
SET "importedFromCsv" = true
WHERE EXISTS (
  SELECT 1 FROM "audit_logs" a
  WHERE a."entityType" = 'project'
    AND a."entityId" = p.id
    AND a.metadata->>'source' = 'import_csv'
);
