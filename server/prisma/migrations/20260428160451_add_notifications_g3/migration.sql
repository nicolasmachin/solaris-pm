-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'deadline_warning';
ALTER TYPE "NotificationType" ADD VALUE 'prev_substage_completed';

-- AlterTable
ALTER TABLE "substages" ADD COLUMN     "deadlineNotificationSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deadlineNotifiedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deadlineWarning" BOOLEAN NOT NULL DEFAULT true,
    "deadlineWarningInApp" BOOLEAN NOT NULL DEFAULT true,
    "deadlineWarningEmail" BOOLEAN NOT NULL DEFAULT false,
    "deadlineWarningWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "prevSubstageCompleted" BOOLEAN NOT NULL DEFAULT true,
    "prevSubstageCompletedInApp" BOOLEAN NOT NULL DEFAULT true,
    "prevSubstageCompletedEmail" BOOLEAN NOT NULL DEFAULT false,
    "prevSubstageCompletedWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_userId_key" ON "user_notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "substages_deadline_idx" ON "substages"("deadline");

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
