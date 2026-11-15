-- AlterTable
ALTER TABLE "avisos_automaticos" ADD COLUMN     "condicion" TEXT,
ADD COLUMN     "demoraMinutos" INTEGER;

-- AlterTable
ALTER TABLE "avisos_envios" ADD COLUMN     "contactoDesde" TIMESTAMPTZ(6),
ADD COLUMN     "datosFijos" JSONB,
ADD COLUMN     "eventoFecha" TIMESTAMPTZ(6),
ADD COLUMN     "ocurrioEn" TIMESTAMPTZ(6),
ADD COLUMN     "salirEn" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "avisos_envios_estado_salirEn_idx" ON "avisos_envios"("estado", "salirEn");
