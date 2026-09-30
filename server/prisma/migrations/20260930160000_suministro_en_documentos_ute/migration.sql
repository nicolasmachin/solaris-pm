-- Papeles de UTE por suministro: a qué cuenta UTE corresponde cada ZIP generado
-- y cada documento firmado. Aditiva: lo existente queda como el principal.

-- AlterTable
ALTER TABLE "file_attachments" ADD COLUMN     "suministro" INTEGER;

-- AlterTable
ALTER TABLE "ute_document_generations" ADD COLUMN     "suministro" INTEGER NOT NULL DEFAULT 1;

