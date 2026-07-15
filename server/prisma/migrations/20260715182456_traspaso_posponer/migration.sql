-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'traspaso_pospuesto';

-- AlterTable
ALTER TABLE "traspasos" ADD COLUMN     "pospuestoHasta" TIMESTAMPTZ(6);
