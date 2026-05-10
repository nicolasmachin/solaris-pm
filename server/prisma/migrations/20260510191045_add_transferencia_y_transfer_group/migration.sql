-- AlterEnum
ALTER TYPE "CategoriaPrincipal" ADD VALUE 'TRANSFERENCIA';

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN "transferGroupId" TEXT;

-- CreateIndex
CREATE INDEX "finance_movements_transferGroupId_idx" ON "finance_movements"("transferGroupId");
