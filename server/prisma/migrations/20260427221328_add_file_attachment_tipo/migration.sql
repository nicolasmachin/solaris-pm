-- CreateEnum
CREATE TYPE "FileAttachmentTipo" AS ENUM ('UPLOAD_MANUAL', 'LISTA_MATERIALES', 'PRESUPUESTO', 'OTRO');

-- AlterTable
ALTER TABLE "file_attachments" ADD COLUMN     "tipo" "FileAttachmentTipo";
