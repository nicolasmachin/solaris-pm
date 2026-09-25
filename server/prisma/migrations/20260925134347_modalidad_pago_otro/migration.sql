-- AlterEnum
ALTER TYPE "ModalidadPago" ADD VALUE 'OTRO';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "modalidadPagoNota" TEXT;
