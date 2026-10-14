-- AlterTable
ALTER TABLE "cfes_emitidos" ADD COLUMN     "aNombreDeTercero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseSinIva" DECIMAL(14,2),
ADD COLUMN     "porcentaje" DECIMAL(6,2);
