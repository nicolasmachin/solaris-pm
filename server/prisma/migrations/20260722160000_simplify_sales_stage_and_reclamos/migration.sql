-- Simplifica el pipeline de Ventas: reduce el enum SalesStage de 12 a 7 valores
-- y agrega el contador de reclamos (transversal a la etapa) al lead.
--
-- Valores del enum que se ELIMINAN: PENDIENTE_COTIZAR, VOLVER_CONTACTAR,
-- NEGOCIACION, ONBOARDING, MAS_ADELANTE. Se mantienen: NUEVO_LEAD, COTIZADO,
-- RECLAMADO, AGENDAR_VISITA, VISITADO, CERRADO_GANADO, CERRADO_PERDIDO.
--
-- Postgres no permite DROP VALUE en un enum: se crea un tipo nuevo, se remapean
-- los datos que usan valores a eliminar (ANTES del swap, a valores que existen
-- en el enum viejo) y se hace el type-swap de las 3 columnas que lo usan
-- (sales_leads.stage, sales_activities.fromStage/toStage).

-- 1) Columnas nuevas del contador de reclamos.
ALTER TABLE "sales_leads" ADD COLUMN "reclamosCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales_leads" ADD COLUMN "lastReclamoAt" TIMESTAMPTZ(6);

-- 2) Remapeo de sales_leads.stage por avance real (heurística por fechas).
--    Corre mientras la columna aún es del enum viejo; los destinos existen en él.
UPDATE "sales_leads" SET "stage" = 'VISITADO'
  WHERE "stage" IN ('PENDIENTE_COTIZAR','VOLVER_CONTACTAR','NEGOCIACION','ONBOARDING','MAS_ADELANTE')
    AND "visitCompletedAt" IS NOT NULL;
UPDATE "sales_leads" SET "stage" = 'AGENDAR_VISITA'
  WHERE "stage" IN ('PENDIENTE_COTIZAR','VOLVER_CONTACTAR','NEGOCIACION','ONBOARDING','MAS_ADELANTE')
    AND "visitCompletedAt" IS NULL AND "visitScheduledAt" IS NOT NULL;
UPDATE "sales_leads" SET "stage" = 'COTIZADO'
  WHERE "stage" IN ('PENDIENTE_COTIZAR','VOLVER_CONTACTAR','NEGOCIACION','ONBOARDING','MAS_ADELANTE')
    AND "visitCompletedAt" IS NULL AND "visitScheduledAt" IS NULL AND "proposalSentAt" IS NOT NULL;
UPDATE "sales_leads" SET "stage" = 'NUEVO_LEAD'
  WHERE "stage" IN ('PENDIENTE_COTIZAR','VOLVER_CONTACTAR','NEGOCIACION','ONBOARDING','MAS_ADELANTE')
    AND "visitCompletedAt" IS NULL AND "visitScheduledAt" IS NULL AND "proposalSentAt" IS NULL;

-- 3) Remapeo del historial (sales_activities.fromStage / toStage). Mapeo fijo
--    conservador; los NULL quedan como están. RECLAMADO se mantiene intacto.
UPDATE "sales_activities" SET "fromStage" = 'NUEVO_LEAD' WHERE "fromStage" IN ('PENDIENTE_COTIZAR','ONBOARDING','MAS_ADELANTE');
UPDATE "sales_activities" SET "fromStage" = 'COTIZADO'   WHERE "fromStage" = 'VOLVER_CONTACTAR';
UPDATE "sales_activities" SET "fromStage" = 'VISITADO'   WHERE "fromStage" = 'NEGOCIACION';
UPDATE "sales_activities" SET "toStage"   = 'NUEVO_LEAD' WHERE "toStage"   IN ('PENDIENTE_COTIZAR','ONBOARDING','MAS_ADELANTE');
UPDATE "sales_activities" SET "toStage"   = 'COTIZADO'   WHERE "toStage"   = 'VOLVER_CONTACTAR';
UPDATE "sales_activities" SET "toStage"   = 'VISITADO'   WHERE "toStage"   = 'NEGOCIACION';

-- 4) Soltar el DEFAULT antes de cambiar el tipo de la columna.
ALTER TABLE "sales_leads" ALTER COLUMN "stage" DROP DEFAULT;

-- 5) Crear el enum nuevo y swappear las 3 columnas (el índice de stage se
--    reconstruye solo en el ALTER TYPE).
CREATE TYPE "SalesStage_new" AS ENUM ('NUEVO_LEAD','COTIZADO','RECLAMADO','AGENDAR_VISITA','VISITADO','CERRADO_GANADO','CERRADO_PERDIDO');

ALTER TABLE "sales_leads"
  ALTER COLUMN "stage" TYPE "SalesStage_new" USING ("stage"::text::"SalesStage_new");
ALTER TABLE "sales_activities"
  ALTER COLUMN "fromStage" TYPE "SalesStage_new" USING ("fromStage"::text::"SalesStage_new"),
  ALTER COLUMN "toStage"   TYPE "SalesStage_new" USING ("toStage"::text::"SalesStage_new");

-- 6) Dropear el viejo, renombrar y restaurar el DEFAULT.
DROP TYPE "SalesStage";
ALTER TYPE "SalesStage_new" RENAME TO "SalesStage";
ALTER TABLE "sales_leads" ALTER COLUMN "stage" SET DEFAULT 'NUEVO_LEAD';
