-- Agrega versionado + adjunto + completedAt a ProposalGeneration.

ALTER TABLE "proposal_generations"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "attachmentId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMPTZ;

ALTER TABLE "proposal_generations"
  ADD CONSTRAINT "proposal_generations_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "file_attachments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: para los registros existentes, asignamos versión incremental por
-- lead (orden cronológico) usando una CTE con ROW_NUMBER.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "leadId" ORDER BY "createdAt") AS rn
  FROM "proposal_generations"
  WHERE "leadId" IS NOT NULL
)
UPDATE "proposal_generations" p
SET "version" = r.rn
FROM ranked r
WHERE p.id = r.id;
