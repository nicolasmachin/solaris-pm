-- AlterEnum
ALTER TYPE "SettingKey" ADD VALUE 'DIGEST_SEND_HOUR';

-- CreateTable
CREATE TABLE "digest_preferences" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digest_preferences_roleName_idx" ON "digest_preferences"("roleName");

-- CreateIndex
CREATE UNIQUE INDEX "digest_preferences_roleName_notificationType_key" ON "digest_preferences"("roleName", "notificationType");
