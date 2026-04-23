-- Tramos disjuntos para cada InstallationSchedule.
-- Antes: cada schedule tenía un único rango plannedWorkStart/End.
-- Ahora: un schedule puede tener N tramos. Migramos cada schedule
-- existente a un único segment que preserva sus fechas.

CREATE TABLE "installation_segments" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "installation_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "installation_segments_scheduleId_idx" ON "installation_segments"("scheduleId");
CREATE INDEX "installation_segments_startDate_idx" ON "installation_segments"("startDate");

ALTER TABLE "installation_segments"
  ADD CONSTRAINT "installation_segments_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "installation_schedules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar datos: un segment por schedule existente (incluidos los soft-deleted).
-- Generamos id con gen_random_uuid() porque cuid() no existe en Postgres puro;
-- los ids de cuid() los genera Prisma en la app, pero para una migración
-- SQL puntual un UUID v4 sirve.
INSERT INTO "installation_segments" ("id", "scheduleId", "startDate", "endDate", "createdAt", "updatedAt")
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  "id",
  "plannedWorkStart",
  "plannedWorkEnd",
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "installation_schedules";

-- Quitar columnas y el índice que ya no existen en el modelo.
DROP INDEX IF EXISTS "installation_schedules_plannedWorkStart_idx";
ALTER TABLE "installation_schedules" DROP COLUMN "plannedWorkStart";
ALTER TABLE "installation_schedules" DROP COLUMN "plannedWorkEnd";
