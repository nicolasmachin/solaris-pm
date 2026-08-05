-- Los videos dejan de ser solo de ensayos: ahora también se suben desde una
-- visita técnica. Se renombra el dominio en vez de recrearlo, para no perder los
-- videos ya cargados.

-- Tabla y columna
ALTER TABLE "ensayo_videos" RENAME TO "project_videos";
ALTER TABLE "project_videos" RENAME COLUMN "tipoEnsayo" TO "tipoVideo";

-- Índices y constraints (Postgres no los renombra solo al renombrar la tabla, y
-- si quedan con el nombre viejo Prisma detecta drift en cada migración futura).
ALTER INDEX "ensayo_videos_pkey" RENAME TO "project_videos_pkey";
ALTER INDEX "ensayo_videos_projectId_idx" RENAME TO "project_videos_projectId_idx";
ALTER INDEX "ensayo_videos_substageId_idx" RENAME TO "project_videos_substageId_idx";
ALTER INDEX "ensayo_videos_processingStatus_idx" RENAME TO "project_videos_processingStatus_idx";
ALTER INDEX "ensayo_videos_deletedAt_idx" RENAME TO "project_videos_deletedAt_idx";
ALTER TABLE "project_videos" RENAME CONSTRAINT "ensayo_videos_projectId_fkey" TO "project_videos_projectId_fkey";
ALTER TABLE "project_videos" RENAME CONSTRAINT "ensayo_videos_substageId_fkey" TO "project_videos_substageId_fkey";
ALTER TABLE "project_videos" RENAME CONSTRAINT "ensayo_videos_fileAttachmentId_fkey" TO "project_videos_fileAttachmentId_fkey";
ALTER TABLE "project_videos" RENAME CONSTRAINT "ensayo_videos_uploadedById_fkey" TO "project_videos_uploadedById_fkey";
ALTER TABLE "project_videos" RENAME CONSTRAINT "ensayo_videos_deletedById_fkey" TO "project_videos_deletedById_fkey";

-- Enum: los dos ensayos pasan a nombrarse como tales, y se suma el video de visita.
ALTER TYPE "TipoEnsayo" RENAME TO "TipoVideo";
ALTER TYPE "TipoVideo" RENAME VALUE 'ANTI_ISLA' TO 'ENSAYO_ANTI_ISLA';
ALTER TYPE "TipoVideo" RENAME VALUE 'ENCENDIDO' TO 'ENSAYO_ENCENDIDO';
ALTER TYPE "TipoVideo" ADD VALUE 'VISITA';

-- Vínculo con la visita técnica en la que se grabó (si vino por esa vía).
ALTER TABLE "project_videos" ADD COLUMN "visitId" TEXT;
CREATE INDEX "project_videos_visitId_idx" ON "project_videos"("visitId");
ALTER TABLE "project_videos" ADD CONSTRAINT "project_videos_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "technical_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
