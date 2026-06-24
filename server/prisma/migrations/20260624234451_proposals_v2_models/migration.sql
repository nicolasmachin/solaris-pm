-- CreateTable
CREATE TABLE "proposal_drafts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "proposal_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "calculated" JSONB NOT NULL,
    "advisor" JSONB NOT NULL,
    "fullPdfAttachmentId" TEXT NOT NULL,
    "summaryPdfAttachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_defaults" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "coverPdfAttachmentId" TEXT,
    "coverOverlay" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "proposal_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_drafts_leadId_key" ON "proposal_drafts"("leadId");

-- CreateIndex
CREATE INDEX "proposal_drafts_leadId_idx" ON "proposal_drafts"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_fullPdfAttachmentId_key" ON "proposal_versions"("fullPdfAttachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_summaryPdfAttachmentId_key" ON "proposal_versions"("summaryPdfAttachmentId");

-- CreateIndex
CREATE INDEX "proposal_versions_leadId_versionNumber_idx" ON "proposal_versions"("leadId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_leadId_versionNumber_key" ON "proposal_versions"("leadId", "versionNumber");

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_fullPdfAttachmentId_fkey" FOREIGN KEY ("fullPdfAttachmentId") REFERENCES "file_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_summaryPdfAttachmentId_fkey" FOREIGN KEY ("summaryPdfAttachmentId") REFERENCES "file_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_defaults" ADD CONSTRAINT "proposal_defaults_coverPdfAttachmentId_fkey" FOREIGN KEY ("coverPdfAttachmentId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_defaults" ADD CONSTRAINT "proposal_defaults_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
