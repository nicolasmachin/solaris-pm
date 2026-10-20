-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'bank_movement';

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "bancoLeidoEn" TIMESTAMP(3),
ADD COLUMN     "bancoSaldo" DECIMAL(14,2),
ADD COLUMN     "numeroCuentaBanco" TEXT;

-- CreateTable
CREATE TABLE "bank_movements" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "documento" TEXT,
    "dependencia" TEXT,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "claveUnica" TEXT NOT NULL,
    "ignoradoAt" TIMESTAMP(3),
    "ignoradoMotivo" TEXT,
    "ignoradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_movements_claveUnica_key" ON "bank_movements"("claveUnica");

-- CreateIndex
CREATE INDEX "bank_movements_accountId_fecha_idx" ON "bank_movements"("accountId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_numeroCuentaBanco_key" ON "accounts"("numeroCuentaBanco");

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_ignoradoPorId_fkey" FOREIGN KEY ("ignoradoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

