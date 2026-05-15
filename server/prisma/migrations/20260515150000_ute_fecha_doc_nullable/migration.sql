-- fechaDoc del UteDocumentConfig pasa a ser nullable. Mantiene el default
-- now() para configs nuevas pero el usuario puede limpiar el campo desde
-- el form si no quiere fecha en los PDFs.
ALTER TABLE "ute_document_configs" ALTER COLUMN "fechaDoc" DROP NOT NULL;
