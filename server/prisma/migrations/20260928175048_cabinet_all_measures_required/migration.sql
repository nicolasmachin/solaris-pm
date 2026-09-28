/*
  Warnings:

  - Made the column `alaTapaCm` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `union` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tornillos` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `holguraPuertaMm` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `perfilMarcoCm` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `perfilPuertaCm` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `solapePuertaCm` on table `cabinet_designs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "cabinet_designs" ADD COLUMN     "agujeroAmureDiamMm" DOUBLE PRECISION NOT NULL DEFAULT 6,
ADD COLUMN     "agujerosAmureHorizontal" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "agujerosAmureVertical" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "bisagraDistExtremoCm" DOUBLE PRECISION NOT NULL DEFAULT 12,
ADD COLUMN     "bisagrasCantidad" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "bisagrasLado" TEXT NOT NULL DEFAULT 'Izquierda',
ADD COLUMN     "pasoTornillosCm" DOUBLE PRECISION NOT NULL DEFAULT 15,
ADD COLUMN     "radioDoblezMm" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN     "solapeUnionCm" DOUBLE PRECISION NOT NULL DEFAULT 3,
ALTER COLUMN "alaTapaCm" SET NOT NULL,
ALTER COLUMN "alaTapaCm" SET DEFAULT 3,
ALTER COLUMN "union" SET NOT NULL,
ALTER COLUMN "union" SET DEFAULT 'Dos piezas en L atornilladas',
ALTER COLUMN "tornillos" SET NOT NULL,
ALTER COLUMN "tornillos" SET DEFAULT 'Tornillo punta mecha tipo T1',
ALTER COLUMN "holguraPuertaMm" SET NOT NULL,
ALTER COLUMN "holguraPuertaMm" SET DEFAULT 2,
ALTER COLUMN "perfilMarcoCm" SET NOT NULL,
ALTER COLUMN "perfilMarcoCm" SET DEFAULT 2,
ALTER COLUMN "perfilPuertaCm" SET NOT NULL,
ALTER COLUMN "perfilPuertaCm" SET DEFAULT 2,
ALTER COLUMN "solapePuertaCm" SET NOT NULL,
ALTER COLUMN "solapePuertaCm" SET DEFAULT 1;
