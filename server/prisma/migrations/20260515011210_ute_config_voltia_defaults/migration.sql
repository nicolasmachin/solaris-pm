-- AlterTable
ALTER TABLE "ute_document_configs" ALTER COLUMN "calidadRepre" SET DEFAULT 'TITULAR',
ALTER COLUMN "fi" SET DEFAULT 'MACHIN JUSTET NICOLAS FERNANDO',
ALTER COLUMN "rut" SET DEFAULT '150733900014',
ALTER COLUMN "dirFi" SET DEFAULT 'Rondeau 2110',
ALTER COLUMN "ti" SET DEFAULT 'Nicolás Machín',
ALTER COLUMN "ciTi" SET DEFAULT '4.139.492-7',
ALTER COLUMN "fp" SET DEFAULT '0.95 inductivo – 0.95 capacitivo',
ALTER COLUMN "normas1" SET DEFAULT 'IEC62109-1, IEC62109-2',
ALTER COLUMN "normas2" SET DEFAULT 'IEC62116 y EN50438',
ALTER COLUMN "x3" SET DEFAULT 'X',
ALTER COLUMN "x4" SET DEFAULT 'X';

-- Backfill: configs ya creadas que tienen estos campos en string vacío
-- adoptan los defaults nuevos. No tocamos las que ya tienen otro valor
-- (alguien las editó manualmente).
UPDATE "ute_document_configs" SET "calidadRepre" = 'TITULAR' WHERE "calidadRepre" = '';
UPDATE "ute_document_configs" SET "fi" = 'MACHIN JUSTET NICOLAS FERNANDO' WHERE "fi" = '';
UPDATE "ute_document_configs" SET "rut" = '150733900014' WHERE "rut" = '';
UPDATE "ute_document_configs" SET "dirFi" = 'Rondeau 2110' WHERE "dirFi" = '';
UPDATE "ute_document_configs" SET "ti" = 'Nicolás Machín' WHERE "ti" = '';
UPDATE "ute_document_configs" SET "ciTi" = '4.139.492-7' WHERE "ciTi" = '';
UPDATE "ute_document_configs" SET "fp" = '0.95 inductivo – 0.95 capacitivo' WHERE "fp" = '';
UPDATE "ute_document_configs" SET "normas1" = 'IEC62109-1, IEC62109-2' WHERE "normas1" = '';
UPDATE "ute_document_configs" SET "normas2" = 'IEC62116 y EN50438' WHERE "normas2" = '';
UPDATE "ute_document_configs" SET "x3" = 'X' WHERE "x3" = '';
UPDATE "ute_document_configs" SET "x4" = 'X' WHERE "x4" = '';
