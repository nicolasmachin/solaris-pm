-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "salespersonId" TEXT;

-- CreateIndex
CREATE INDEX "projects_salespersonId_idx" ON "projects"("salespersonId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
