-- Mueve los datos generales del cliente (CI, calle, persona física/empresa)
-- de ute_document_configs a projects. Los datos UTE-específicos del trámite
-- (cuenta, caso, oficina, tarifa, pot_contratada) quedan en config porque
-- son por-expediente. También agrega cedulaPath y facturaUtePath en projects
-- para la feature de extracción de datos con IA.

-- 1. Agregar columnas nuevas a projects.
ALTER TABLE "projects"
  ADD COLUMN "ciCliente"      TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "calle"          TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "numCalle"       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "personaFisica"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "empresa"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cedulaPath"     TEXT,
  ADD COLUMN "facturaUtePath" TEXT;

-- 2. Backfill: copiar valores de la config UTE al project. Solo aplica a
-- proyectos que tienen config (algunos pueden no tener todavía).
UPDATE "projects" p
SET
  "ciCliente"     = c."ciCliente",
  "calle"         = c."calle",
  "numCalle"      = c."numCalle",
  "personaFisica" = c."personaFisica",
  "empresa"       = c."empresa"
FROM "ute_document_configs" c
WHERE c."projectId" = p."id";

-- 3. Eliminar las columnas duplicadas de ute_document_configs.
ALTER TABLE "ute_document_configs"
  DROP COLUMN "ciCliente",
  DROP COLUMN "calle",
  DROP COLUMN "numCalle",
  DROP COLUMN "personaFisica",
  DROP COLUMN "empresa";
