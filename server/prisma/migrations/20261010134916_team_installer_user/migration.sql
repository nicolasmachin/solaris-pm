-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "installerUserId" TEXT;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_installerUserId_fkey" FOREIGN KEY ("installerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
