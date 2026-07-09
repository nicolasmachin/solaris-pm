-- CreateEnum
CREATE TYPE "ProformaVersionStatus" AS ENUM ('PUBLISHED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'proforma_draft_updated';
ALTER TYPE "AuditAction" ADD VALUE 'proforma_version_published';
ALTER TYPE "AuditAction" ADD VALUE 'proforma_version_discarded';
ALTER TYPE "AuditAction" ADD VALUE 'proforma_version_restored';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'proforma';

-- CreateTable
CREATE TABLE "proforma_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "proforma_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ProformaVersionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "snapshot" JSONB NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "label" TEXT,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,
    "discardedAt" TIMESTAMPTZ(6),
    "discardedById" TEXT,
    "discardReason" TEXT,

    CONSTRAINT "proforma_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proforma_drafts_projectId_key" ON "proforma_drafts"("projectId");

-- CreateIndex
CREATE INDEX "proforma_drafts_projectId_idx" ON "proforma_drafts"("projectId");

-- CreateIndex
CREATE INDEX "proforma_versions_projectId_status_idx" ON "proforma_versions"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proforma_versions_projectId_versionNumber_key" ON "proforma_versions"("projectId", "versionNumber");

-- AddForeignKey
ALTER TABLE "proforma_drafts" ADD CONSTRAINT "proforma_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_drafts" ADD CONSTRAINT "proforma_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_drafts" ADD CONSTRAINT "proforma_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_versions" ADD CONSTRAINT "proforma_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_versions" ADD CONSTRAINT "proforma_versions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
