-- DropIndex
DROP INDEX "project_materials_movementId_key";

-- CreateIndex
CREATE INDEX "project_materials_movementId_idx" ON "project_materials"("movementId");
