-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'capacitacion_comentario';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "capacitacionVideoId" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "link" TEXT;

-- CreateIndex
CREATE INDEX "comments_capacitacionVideoId_idx" ON "comments"("capacitacionVideoId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_capacitacionVideoId_fkey" FOREIGN KEY ("capacitacionVideoId") REFERENCES "capacitacion_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
