-- Agrega `leadCreatedAt` (fecha de "alta comercial") al lead. Se diferencia
-- de createdAt en que es editable por el usuario (panel "Fechas del
-- proceso"). Backfill: a los leads existentes se les copia createdAt.

ALTER TABLE "sales_leads" ADD COLUMN "leadCreatedAt" TIMESTAMPTZ(6);

UPDATE "sales_leads"
SET "leadCreatedAt" = "createdAt"
WHERE "leadCreatedAt" IS NULL;
