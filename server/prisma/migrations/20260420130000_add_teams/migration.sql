-- Crear tabla teams
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#378ADD',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");
CREATE INDEX "teams_deletedAt_idx" ON "teams"("deletedAt");

-- Agregar columna teamId a installation_schedules
ALTER TABLE "installation_schedules" ADD COLUMN "teamId" TEXT;
CREATE INDEX "installation_schedules_teamId_idx" ON "installation_schedules"("teamId");

-- Backfill: insertar un Team por cada (teamName, teamColor) distinto
-- Usamos gen_random_uuid (built-in en PG 13+) para ID
INSERT INTO "teams" ("id", "name", "color", "createdAt", "updatedAt")
SELECT
  REPLACE(gen_random_uuid()::text, '-', ''),
  s."teamName",
  -- Tomamos el color más común para ese nombre (MAX por simplicidad)
  MAX(s."teamColor"),
  NOW(),
  NOW()
FROM "installation_schedules" s
WHERE s."deletedAt" IS NULL
GROUP BY s."teamName"
ON CONFLICT ("name") DO NOTHING;

-- Set teamId en cada installation_schedule existente
UPDATE "installation_schedules" inst
SET "teamId" = t.id
FROM "teams" t
WHERE t.name = inst."teamName" AND t."deletedAt" IS NULL;

-- FK
ALTER TABLE "installation_schedules"
  ADD CONSTRAINT "installation_schedules_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Agregar 'team' al enum AuditEntityType
ALTER TYPE "AuditEntityType" ADD VALUE 'team';
