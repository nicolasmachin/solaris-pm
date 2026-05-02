-- AlterTable
ALTER TABLE "substages" ADD COLUMN     "uteAction" TEXT;

-- CreateIndex
CREATE INDEX "substages_uteAction_idx" ON "substages"("uteAction");
