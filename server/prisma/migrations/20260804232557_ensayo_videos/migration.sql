-- CreateEnum
CREATE TYPE "TipoEnsayo" AS ENUM ('ANTI_ISLA', 'ENCENDIDO', 'OTRO');

-- CreateEnum
CREATE TYPE "VideoProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'ensayo_video';

-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "evidenceKind" TEXT;

-- CreateTable
CREATE TABLE "ensayo_videos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "substageId" TEXT,
    "tipoEnsayo" "TipoEnsayo" NOT NULL,
    "descripcion" TEXT,
    "fileAttachmentId" TEXT,
    "posterUrl" TEXT,
    "durationSeconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "processingStatus" "VideoProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "originalFilename" TEXT NOT NULL,
    "originalSizeBytes" INTEGER NOT NULL,
    "originalMimeType" TEXT NOT NULL,
    "originalSha256" TEXT,
    "originalProbe" JSONB,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "deletedById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ensayo_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ensayo_videos_projectId_idx" ON "ensayo_videos"("projectId");

-- CreateIndex
CREATE INDEX "ensayo_videos_substageId_idx" ON "ensayo_videos"("substageId");

-- CreateIndex
CREATE INDEX "ensayo_videos_processingStatus_idx" ON "ensayo_videos"("processingStatus");

-- CreateIndex
CREATE INDEX "ensayo_videos_deletedAt_idx" ON "ensayo_videos"("deletedAt");

-- AddForeignKey
ALTER TABLE "ensayo_videos" ADD CONSTRAINT "ensayo_videos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensayo_videos" ADD CONSTRAINT "ensayo_videos_substageId_fkey" FOREIGN KEY ("substageId") REFERENCES "substages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensayo_videos" ADD CONSTRAINT "ensayo_videos_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensayo_videos" ADD CONSTRAINT "ensayo_videos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensayo_videos" ADD CONSTRAINT "ensayo_videos_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Marca los ítems de checklist que a partir de ahora se respaldan con un video
-- real en vez de ser una casilla de confianza. Los proyectos ya creados tienen
-- sus ítems generados desde el template, así que se etiquetan por label acá y
-- una sola vez; de acá en más los crea `pipeline-definitions.ts` ya marcados.
--
-- Solo alcanza a los ítems del template (isCustom = false): si alguien creó un
-- ítem propio con el mismo texto, es suyo y no se le impone el requisito.
UPDATE "checklist_items"
SET "evidenceKind" = 'ensayo-video'
WHERE "label" IN (
  'Ensayo anti-isla realizado y grabado',
  'Videos de ensayos subidos',
  'Videos de ensayos recibidos y subidos'
)
  AND "isCustom" = false
  AND "deletedAt" IS NULL;
