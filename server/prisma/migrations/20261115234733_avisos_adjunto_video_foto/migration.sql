-- AlterTable
ALTER TABLE "avisos_automaticos" ADD COLUMN     "adjuntoArchivo" TEXT,
ADD COLUMN     "adjuntoMime" TEXT,
ADD COLUMN     "adjuntoNombre" TEXT,
ADD COLUMN     "adjuntoPlantillaEstado" TEXT,
ADD COLUMN     "adjuntoPlantillaId" TEXT,
ADD COLUMN     "adjuntoPlantillaMotivo" TEXT,
ADD COLUMN     "adjuntoPlantillaNombre" TEXT,
ADD COLUMN     "adjuntoTexto" TEXT,
ADD COLUMN     "adjuntoTipo" TEXT,
ADD COLUMN     "adjuntoToken" TEXT,
ADD COLUMN     "adjuntoUnaVez" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "avisos_envios" ADD COLUMN     "esAdjunto" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "avisos_automaticos_adjuntoToken_key" ON "avisos_automaticos"("adjuntoToken");

