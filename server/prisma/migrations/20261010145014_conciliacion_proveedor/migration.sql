-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'conciliacion_proveedor';

-- CreateTable
CREATE TABLE "conciliaciones_proveedor" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "fechaCorte" DATE NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoMime" TEXT NOT NULL,
    "extraccion" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "saldoProveedor" DECIMAL(14,2),
    "saldoVoltia" DECIMAL(14,2) NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensInput" INTEGER NOT NULL,
    "tokensOutput" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,4) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conciliaciones_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conciliaciones_proveedor_supplierId_createdAt_idx" ON "conciliaciones_proveedor"("supplierId", "createdAt");

-- AddForeignKey
ALTER TABLE "conciliaciones_proveedor" ADD CONSTRAINT "conciliaciones_proveedor_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
