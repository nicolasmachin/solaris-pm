-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'PORTAL_CLIENTE';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "clientUserId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordTemporary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_clientUserId_idx" ON "projects"("clientUserId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
