-- Rename InstallationSchedule columns: weekStart/weekEnd → plannedWorkStart/plannedWorkEnd
ALTER TABLE "installation_schedules" RENAME COLUMN "weekStart" TO "plannedWorkStart";
ALTER TABLE "installation_schedules" RENAME COLUMN "weekEnd" TO "plannedWorkEnd";

-- Rename matching index
ALTER INDEX "installation_schedules_weekStart_idx" RENAME TO "installation_schedules_plannedWorkStart_idx";
