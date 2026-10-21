-- AlterTable
ALTER TABLE "bank_movements" ADD COLUMN     "movementId" TEXT,
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "vinculadoAt" TIMESTAMP(3),
ADD COLUMN     "vinculadoPorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bank_movements_movementId_key" ON "bank_movements"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_movements_paymentId_key" ON "bank_movements"("paymentId");

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

