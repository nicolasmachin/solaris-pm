-- CreateTable
CREATE TABLE "materiales_consolidados_versions" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectsSnapshot" JSONB NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,

    CONSTRAINT "materiales_consolidados_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materiales_consolidados_versions_versionNumber_key" ON "materiales_consolidados_versions"("versionNumber");

-- CreateIndex
CREATE INDEX "materiales_consolidados_versions_createdAt_idx" ON "materiales_consolidados_versions"("createdAt");
