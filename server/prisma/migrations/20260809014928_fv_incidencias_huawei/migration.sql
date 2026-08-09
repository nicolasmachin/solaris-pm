-- AlterTable
ALTER TABLE "fv_incidencias" ADD COLUMN     "huaweiPlantId" TEXT,
ALTER COLUMN "growattPlantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "huawei_plants" ADD COLUMN     "monitoreoSilenciadoHasta" DATE,
ADD COLUMN     "monitoreoSilenciadoMotivo" TEXT,
ADD COLUMN     "monitoreoSilenciadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "fv_incidencias_huaweiPlantId_estado_idx" ON "fv_incidencias"("huaweiPlantId", "estado");

-- AddForeignKey
ALTER TABLE "huawei_plants" ADD CONSTRAINT "huawei_plants_monitoreoSilenciadoPorId_fkey" FOREIGN KEY ("monitoreoSilenciadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_incidencias" ADD CONSTRAINT "fv_incidencias_huaweiPlantId_fkey" FOREIGN KEY ("huaweiPlantId") REFERENCES "huawei_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice único PARCIAL agregado a mano: Prisma no sabe expresarlo. Es el gemelo
-- de fv_incidencias_abierta_unica (Growatt) y cumple la misma función: sin él,
-- dos corridas concurrentes del monitor duplican la incidencia de una planta.
CREATE UNIQUE INDEX "fv_incidencias_huawei_abierta_unica"
  ON "fv_incidencias" ("huaweiPlantId", "diagnostico")
  WHERE "estado" = 'ABIERTA' AND "huaweiPlantId" IS NOT NULL;

-- Una incidencia pertenece a exactamente UNA planta: o Growatt o Huawei, nunca
-- ambas ni ninguna. Sin esto, un bug de código dejaría filas huérfanas que el
-- panel no sabría mostrar.
ALTER TABLE "fv_incidencias" ADD CONSTRAINT "fv_incidencias_una_planta"
  CHECK (("growattPlantId" IS NOT NULL) <> ("huaweiPlantId" IS NOT NULL));
