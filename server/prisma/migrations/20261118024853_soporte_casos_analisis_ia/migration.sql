-- AlterTable
ALTER TABLE "soporte_casos" ADD COLUMN     "analisisIa" TEXT,
ADD COLUMN     "analisisIaEn" TIMESTAMPTZ(6),
ADD COLUMN     "analisisIaEstado" TEXT,
ADD COLUMN     "analisisIaTipo" "SoporteCasoTipo";
