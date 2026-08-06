-- CreateEnum
CREATE TYPE "TaskOrigin" AS ENUM ('MANUAL', 'MINUTA', 'MCP');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'WAITING';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "followUpAt" DATE,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "origin" "TaskOrigin" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "waitingReason" TEXT;

-- CreateIndex
CREATE INDEX "tasks_leadId_idx" ON "tasks"("leadId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
