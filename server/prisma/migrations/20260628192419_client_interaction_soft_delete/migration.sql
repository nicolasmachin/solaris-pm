-- AlterTable
ALTER TABLE "client_interactions" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6),
ADD COLUMN     "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "client_interactions_deletedAt_idx" ON "client_interactions"("deletedAt");

-- AddForeignKey
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
