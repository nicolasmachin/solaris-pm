-- AlterEnum
ALTER TYPE "FileAttachmentTipo" ADD VALUE 'JUSTIFICACION_POTENCIA';

-- CreateTable
CREATE TABLE "justificacion_potencia_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "potenciaSolicitadaKw" DECIMAL(10,2) NOT NULL,
    "textosConIa" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificacion_potencia_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "justificacion_potencia_versions_projectId_idx" ON "justificacion_potencia_versions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "justificacion_potencia_versions_projectId_versionNumber_key" ON "justificacion_potencia_versions"("projectId", "versionNumber");

-- AddForeignKey
ALTER TABLE "justificacion_potencia_versions" ADD CONSTRAINT "justificacion_potencia_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificacion_potencia_versions" ADD CONSTRAINT "justificacion_potencia_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
