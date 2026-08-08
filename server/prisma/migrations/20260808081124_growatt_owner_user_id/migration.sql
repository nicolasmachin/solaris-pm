-- AlterTable
ALTER TABLE "growatt_plants" ADD COLUMN     "ownerUserId" INTEGER;

-- CreateIndex
CREATE INDEX "growatt_plants_ownerUserId_idx" ON "growatt_plants"("ownerUserId");
