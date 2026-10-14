-- CreateEnum
CREATE TYPE "TipoMontaje" AS ENUM ('COPLANAR', 'ANGULOS', 'HORMIGON', 'SUELO');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "tipoMontaje" "TipoMontaje";
