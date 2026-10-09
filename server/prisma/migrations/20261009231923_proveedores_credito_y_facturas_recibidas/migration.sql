-- CreateEnum
CREATE TYPE "EstadoFacturaRecibida" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'DESCARTADA');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'factura_recibida';

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "limiteCredito" DECIMAL(14,2),
ADD COLUMN     "limiteCreditoMoneda" "Moneda" NOT NULL DEFAULT 'USD',
ADD COLUMN     "plazoCreditoDias" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "facturas_recibidas" (
    "id" TEXT NOT NULL,
    "rutEmisor" TEXT NOT NULL,
    "razonSocialEmisor" TEXT,
    "tipoCfe" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "moneda" "Moneda" NOT NULL,
    "totalNeto" DECIMAL(14,2),
    "totalIva" DECIMAL(14,2),
    "total" DECIMAL(14,2) NOT NULL,
    "estadoDgi" TEXT,
    "enDgi" BOOLEAN NOT NULL DEFAULT false,
    "enMail" BOOLEAN NOT NULL DEFAULT false,
    "billerId" TEXT,
    "estado" "EstadoFacturaRecibida" NOT NULL DEFAULT 'PENDIENTE',
    "motivoDescarte" TEXT,
    "supplierId" TEXT,
    "movementId" TEXT,
    "resueltaPorId" TEXT,
    "resueltaAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_recibidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_recibidas_movementId_key" ON "facturas_recibidas"("movementId");

-- CreateIndex
CREATE INDEX "facturas_recibidas_estado_idx" ON "facturas_recibidas"("estado");

-- CreateIndex
CREATE INDEX "facturas_recibidas_supplierId_idx" ON "facturas_recibidas"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_recibidas_rutEmisor_tipoCfe_serie_numero_key" ON "facturas_recibidas"("rutEmisor", "tipoCfe", "serie", "numero");

-- AddForeignKey
ALTER TABLE "facturas_recibidas" ADD CONSTRAINT "facturas_recibidas_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_recibidas" ADD CONSTRAINT "facturas_recibidas_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
