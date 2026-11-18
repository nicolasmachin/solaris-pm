-- AlterTable
ALTER TABLE "soporte_casos" ADD COLUMN     "vistoEn" TIMESTAMPTZ(6),
ADD COLUMN     "vistoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "soporte_casos" ADD CONSTRAINT "soporte_casos_vistoPorId_fkey" FOREIGN KEY ("vistoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los cerrados antes de este cambio no entran a "Se arreglaron solas": la mesa
-- arranca vacía y muestra solo lo que se cierre de acá en adelante.
UPDATE "soporte_casos" SET "vistoEn" = COALESCE("resueltoEn", NOW()) WHERE "estado" <> 'ABIERTO';
