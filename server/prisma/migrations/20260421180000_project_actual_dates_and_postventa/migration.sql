-- Nuevos campos de fechas reales en Project (sincronizados desde Stage al editar)
ALTER TABLE "projects" ADD COLUMN "actualOnboardingEnd"  DATE;
ALTER TABLE "projects" ADD COLUMN "actualEngineeringEnd" DATE;
ALTER TABLE "projects" ADD COLUMN "actualUteStart"       DATE;
ALTER TABLE "projects" ADD COLUMN "actualUteEnd"         DATE;

-- Flag de edición manual en Stage (para mostrar ícono en el drawer)
ALTER TABLE "stages" ADD COLUMN "actualDatesManuallyEdited" BOOLEAN NOT NULL DEFAULT false;

-- Backfill de los nuevos campos de Project desde Stage (si ya hay stages completados)
UPDATE "projects" p
SET "actualOnboardingEnd" = s."actualEndDate"
FROM "stages" s
WHERE s."projectId" = p.id
  AND s.name = 'ONBOARDING'
  AND s."actualEndDate" IS NOT NULL;

UPDATE "projects" p
SET "actualEngineeringEnd" = s."actualEndDate"
FROM "stages" s
WHERE s."projectId" = p.id
  AND s.name = 'INGENIERIA'
  AND s."actualEndDate" IS NOT NULL;

UPDATE "projects" p
SET "actualUteStart" = s."actualStartDate",
    "actualUteEnd"   = s."actualEndDate"
FROM "stages" s
WHERE s."projectId" = p.id
  AND s.name = 'HABILITACION_UTE'
  AND (s."actualStartDate" IS NOT NULL OR s."actualEndDate" IS NOT NULL);

-- Regla de negocio: la etapa POSTVENTA no tiene fechas (es indefinida)
UPDATE "stages"
SET "plannedStartDate" = NULL,
    "plannedEndDate"   = NULL,
    "actualStartDate"  = NULL,
    "actualEndDate"    = NULL,
    "plannedDurationDays" = NULL,
    "actualDurationDays"  = NULL,
    "delayDays"        = NULL
WHERE name = 'POSTVENTA';
