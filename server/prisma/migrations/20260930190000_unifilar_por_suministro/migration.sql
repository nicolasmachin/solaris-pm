-- Un unifilar por suministro (cuenta UTE), con su propia numeración de
-- versiones. Todo lo existente queda como suministro 1: la unicidad nueva
-- (proyecto, suministro, versión) no puede chocar con los datos actuales.

-- DropIndex
DROP INDEX "unifilar_versions_projectId_versionNumber_key";

-- AlterTable
ALTER TABLE "unifilar_versions" ADD COLUMN     "suministro" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "unifilar_versions_projectId_suministro_versionNumber_key" ON "unifilar_versions"("projectId", "suministro", "versionNumber");

