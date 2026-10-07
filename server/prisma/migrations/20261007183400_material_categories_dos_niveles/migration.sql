-- AlterTable
ALTER TABLE "material_categories" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "material_categories_parentId_idx" ON "material_categories"("parentId");

-- AddForeignKey
ALTER TABLE "material_categories" ADD CONSTRAINT "material_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
