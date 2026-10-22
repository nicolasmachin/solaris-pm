-- CreateEnum
CREATE TYPE "HitoCobro" AS ENUM ('SENIA', 'PREVIO_OBRA', 'OBRA_FINALIZADA', 'HABILITACION');

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "hitoCobro" "HitoCobro";

