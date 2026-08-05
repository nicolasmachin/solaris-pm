-- El video puede grabarse en la visita de VENTAS, cuando el proyecto todavía no
-- existe. Pasa a colgar de un lead o de un proyecto (exactamente uno de los dos):
-- al ganarse el lead se reasigna al proyecto y `leadId` queda como rastro.
ALTER TABLE "project_videos" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "project_videos" ADD COLUMN "leadId" TEXT;
CREATE INDEX "project_videos_leadId_idx" ON "project_videos"("leadId");
ALTER TABLE "project_videos" ADD CONSTRAINT "project_videos_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
