/*
  Warnings:

  - You are about to drop the `proposal_drafts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `proposal_versions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProposalV2VersionStatus" AS ENUM ('PUBLISHED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'proposal_v2_draft_updated';
ALTER TYPE "AuditAction" ADD VALUE 'proposal_v2_version_published';
ALTER TYPE "AuditAction" ADD VALUE 'proposal_v2_version_discarded';
ALTER TYPE "AuditAction" ADD VALUE 'proposal_v2_version_restored';
ALTER TYPE "AuditAction" ADD VALUE 'proposal_v2_version_pdf_regenerated';

-- DropForeignKey
ALTER TABLE "proposal_drafts" DROP CONSTRAINT "proposal_drafts_leadId_fkey";

-- DropForeignKey
ALTER TABLE "proposal_drafts" DROP CONSTRAINT "proposal_drafts_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_fullPdfAttachmentId_fkey";

-- DropForeignKey
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_leadId_fkey";

-- DropForeignKey
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_summaryPdfAttachmentId_fkey";

-- DropTable
DROP TABLE "proposal_drafts";

-- DropTable
DROP TABLE "proposal_versions";

-- CreateTable
CREATE TABLE "proposal_v2_drafts" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "proposal_v2_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_v2_versions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ProposalV2VersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "snapshot" JSONB NOT NULL,
    "fullPdfPath" TEXT NOT NULL,
    "summaryPdfPath" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,
    "discardedAt" TIMESTAMPTZ(6),
    "discardedById" TEXT,
    "discardReason" TEXT,

    CONSTRAINT "proposal_v2_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_v2_drafts_leadId_key" ON "proposal_v2_drafts"("leadId");

-- CreateIndex
CREATE INDEX "proposal_v2_drafts_leadId_idx" ON "proposal_v2_drafts"("leadId");

-- CreateIndex
CREATE INDEX "proposal_v2_versions_leadId_status_idx" ON "proposal_v2_versions"("leadId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_v2_versions_leadId_versionNumber_key" ON "proposal_v2_versions"("leadId", "versionNumber");

-- AddForeignKey
ALTER TABLE "proposal_v2_drafts" ADD CONSTRAINT "proposal_v2_drafts_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_v2_drafts" ADD CONSTRAINT "proposal_v2_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_v2_drafts" ADD CONSTRAINT "proposal_v2_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_v2_versions" ADD CONSTRAINT "proposal_v2_versions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_v2_versions" ADD CONSTRAINT "proposal_v2_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_v2_versions" ADD CONSTRAINT "proposal_v2_versions_discardedById_fkey" FOREIGN KEY ("discardedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
