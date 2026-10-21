-- AlterTable
ALTER TABLE "facturas_recibidas" ADD COLUMN     "ajusteId" TEXT;

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "montoIva" DECIMAL(14,2),
ADD COLUMN     "montoNeto" DECIMAL(14,2);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_recibidas_ajusteId_key" ON "facturas_recibidas"("ajusteId");


-- Backfill: neto e IVA de las facturas recibidas ya confirmadas.
UPDATE "finance_movements" m
SET "montoNeto" = f."totalNeto", "montoIva" = f."totalIva"
FROM "facturas_recibidas" f
WHERE f."movementId" = m.id AND f."totalNeto" IS NOT NULL;
