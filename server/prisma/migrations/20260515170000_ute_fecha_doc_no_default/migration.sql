-- fechaDoc del UteDocumentConfig pierde el default = now(). Las configs
-- nuevas arrancan con NULL en este campo; el usuario lo carga explícito
-- desde el form. Las configs existentes mantienen el valor actual.
ALTER TABLE "ute_document_configs" ALTER COLUMN "fechaDoc" DROP DEFAULT;
