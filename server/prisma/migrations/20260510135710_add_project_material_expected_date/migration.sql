-- AlterTable
ALTER TABLE "project_materials" ADD COLUMN "expectedDate" DATE;

-- CreateIndex
CREATE INDEX "project_materials_expectedDate_idx" ON "project_materials"("expectedDate");
