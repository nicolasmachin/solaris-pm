-- Varios suministros por proyecto: cada inversor distinto es una cuenta UTE
-- con su trámite y sus datos. Aditiva: todo lo existente queda como suministro 1.

-- DropIndex
DROP INDEX "ute_document_configs_projectId_key";

-- AlterTable
ALTER TABLE "ute_document_configs" ADD COLUMN     "calle" TEXT,
ADD COLUMN     "cedulaPath" TEXT,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "facturaUtePath" TEXT,
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "numCalle" TEXT,
ADD COLUMN     "suministro" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "titularCi" TEXT,
ADD COLUMN     "titularEmpresa" BOOLEAN,
ADD COLUMN     "titularNombre" TEXT;

-- AlterTable
ALTER TABLE "ute_processes" ADD COLUMN     "suministro" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ute_document_configs_projectId_idx" ON "ute_document_configs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ute_document_configs_projectId_suministro_key" ON "ute_document_configs"("projectId", "suministro");

-- CreateIndex
CREATE INDEX "ute_processes_projectId_suministro_idx" ON "ute_processes"("projectId", "suministro");

