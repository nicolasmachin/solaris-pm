-- CreateEnum
CREATE TYPE "EFPStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "engineering_final_projects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "EFPStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "engineering_final_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "efp_versions" (
    "id" TEXT NOT NULL,
    "efpId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "checklist" JSONB,
    "sourceVisitIds" TEXT[],
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "modelUsed" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costUsd" DECIMAL(10,6),
    "changesFromPrevious" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "efp_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "efp_attachments" (
    "id" TEXT NOT NULL,
    "efpId" TEXT NOT NULL,
    "fileAttachmentId" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "efp_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "engineering_final_projects_projectId_key" ON "engineering_final_projects"("projectId");

-- CreateIndex
CREATE INDEX "engineering_final_projects_deletedAt_idx" ON "engineering_final_projects"("deletedAt");

-- CreateIndex
CREATE INDEX "efp_versions_efpId_version_idx" ON "efp_versions"("efpId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "efp_versions_efpId_version_key" ON "efp_versions"("efpId", "version");

-- CreateIndex
CREATE INDEX "efp_attachments_efpId_idx" ON "efp_attachments"("efpId");

-- CreateIndex
CREATE INDEX "efp_attachments_fileAttachmentId_idx" ON "efp_attachments"("fileAttachmentId");

-- AddForeignKey
ALTER TABLE "engineering_final_projects" ADD CONSTRAINT "engineering_final_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efp_versions" ADD CONSTRAINT "efp_versions_efpId_fkey" FOREIGN KEY ("efpId") REFERENCES "engineering_final_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efp_versions" ADD CONSTRAINT "efp_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efp_attachments" ADD CONSTRAINT "efp_attachments_efpId_fkey" FOREIGN KEY ("efpId") REFERENCES "engineering_final_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efp_attachments" ADD CONSTRAINT "efp_attachments_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "efp_attachments" ADD CONSTRAINT "efp_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
