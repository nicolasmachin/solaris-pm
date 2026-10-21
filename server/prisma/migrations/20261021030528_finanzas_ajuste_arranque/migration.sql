-- AlterEnum
ALTER TYPE "MetodoPago" ADD VALUE 'AJUSTE';

-- AlterTable
ALTER TABLE "facturas_recibidas" ADD COLUMN     "cargadaSola" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "cuentaDesde" DATE;
