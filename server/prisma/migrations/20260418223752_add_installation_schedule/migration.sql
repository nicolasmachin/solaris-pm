-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'installation_schedule';

-- CreateTable
CREATE TABLE "installation_schedules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamColor" TEXT NOT NULL DEFAULT '#378ADD',
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6),
    "confirmedBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "installation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installation_schedules_projectId_key" ON "installation_schedules"("projectId");

-- CreateIndex
CREATE INDEX "installation_schedules_weekStart_idx" ON "installation_schedules"("weekStart");

-- CreateIndex
CREATE INDEX "installation_schedules_projectId_idx" ON "installation_schedules"("projectId");

-- CreateIndex
CREATE INDEX "installation_schedules_deletedAt_idx" ON "installation_schedules"("deletedAt");

-- AddForeignKey
ALTER TABLE "installation_schedules" ADD CONSTRAINT "installation_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_schedules" ADD CONSTRAINT "installation_schedules_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
