-- CreateEnum
CREATE TYPE "GoalArea" AS ENUM ('VENTAS', 'OPERACIONES');

-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('INSTALLATIONS_COUNT', 'KWP_INSTALLED', 'LEADS_CREATED', 'PROPOSALS_SENT', 'CLOSED_WON');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('ANNUAL', 'QUARTERLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'goals_not_configured';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "firstDateScheduledAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "closedAt" TIMESTAMPTZ(6),
ADD COLUMN     "proposalSentAt" TIMESTAMPTZ(6),
ADD COLUMN     "visitCompletedAt" TIMESTAMPTZ(6),
ADD COLUMN     "visitScheduledAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "area" "GoalArea" NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_area_idx" ON "goals"("area");

-- CreateIndex
CREATE INDEX "goals_year_idx" ON "goals"("year");

-- CreateIndex
CREATE UNIQUE INDEX "goals_area_metric_period_year_quarter_key" ON "goals"("area", "metric", "period", "year", "quarter");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
