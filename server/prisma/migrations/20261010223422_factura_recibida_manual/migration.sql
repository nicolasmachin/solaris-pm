-- AlterTable
ALTER TABLE "facturas_recibidas" ADD COLUMN     "cargadaPorId" TEXT,
ADD COLUMN     "enManual" BOOLEAN NOT NULL DEFAULT false;
