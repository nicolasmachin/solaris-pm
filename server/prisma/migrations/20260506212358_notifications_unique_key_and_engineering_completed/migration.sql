-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'engineering_completed';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "uniqueKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_uniqueKey_key" ON "notifications"("uniqueKey");
