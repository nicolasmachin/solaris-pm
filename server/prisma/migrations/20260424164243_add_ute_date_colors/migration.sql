-- AlterTable
ALTER TABLE "ute_processes" ADD COLUMN     "dateColors" JSONB,
ADD COLUMN     "stageManuallySet" BOOLEAN NOT NULL DEFAULT false;
