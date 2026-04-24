-- CreateEnum
CREATE TYPE "UteStage" AS ENUM ('CONSULTA', 'SOLICITUD', 'DOCS_1', 'DOCS_2', 'RELEVAR', 'ENSAYOS', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "UteStatus" AS ENUM ('CERRADO', 'EN_PROCESO', 'ESPERANDO', 'PENDIENTE');

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'TRAMITES_UTE';

-- CreateTable
CREATE TABLE "ute_processes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentStage" "UteStage" NOT NULL DEFAULT 'CONSULTA',
    "currentStatus" "UteStatus" NOT NULL DEFAULT 'PENDIENTE',
    "caseNumber" TEXT,
    "notes" TEXT,
    "consultaSentAt" TIMESTAMPTZ(6),
    "caseOpenedAt" TIMESTAMPTZ(6),
    "consultaApprovedAt" TIMESTAMPTZ(6),
    "solicitudSentAt" TIMESTAMPTZ(6),
    "proyectoApprovedAt" TIMESTAMPTZ(6),
    "docs1SentAt" TIMESTAMPTZ(6),
    "docs1ApprovedAt" TIMESTAMPTZ(6),
    "ensayosSentAt" TIMESTAMPTZ(6),
    "ensayosApprovedAt" TIMESTAMPTZ(6),
    "docs2SentAt" TIMESTAMPTZ(6),
    "finalizedAt" TIMESTAMPTZ(6),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ute_processes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ute_processes_projectId_idx" ON "ute_processes"("projectId");

-- CreateIndex
CREATE INDEX "ute_processes_currentStage_idx" ON "ute_processes"("currentStage");

-- CreateIndex
CREATE INDEX "ute_processes_currentStatus_idx" ON "ute_processes"("currentStatus");

-- CreateIndex
CREATE INDEX "ute_processes_deletedAt_idx" ON "ute_processes"("deletedAt");

-- AddForeignKey
ALTER TABLE "ute_processes" ADD CONSTRAINT "ute_processes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
