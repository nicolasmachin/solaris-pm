ALTER TABLE "comments"
ADD COLUMN "leadId" TEXT;

CREATE INDEX "comments_leadId_idx" ON "comments"("leadId");

ALTER TABLE "comments"
ADD CONSTRAINT "comments_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
