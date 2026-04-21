-- Agregar columna actualWorkEnd a installation_schedules
-- Registra la fecha real en que terminó la obra (puede ser distinta a plannedWorkEnd)
ALTER TABLE "installation_schedules" ADD COLUMN "actualWorkEnd" DATE;
