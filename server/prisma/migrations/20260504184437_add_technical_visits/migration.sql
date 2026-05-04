-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('INICIAL', 'REVISION', 'COMPLEMENTARIA');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('EN_CURSO', 'FINALIZADA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "VisitInputType" AS ENUM ('AUDIO', 'PHOTO', 'NOTE');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "technical_visits" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "visitDate" TIMESTAMPTZ(6) NOT NULL,
    "visitType" "VisitType" NOT NULL DEFAULT 'INICIAL',
    "notes" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'EN_CURSO',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "technical_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_inputs" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "type" "VisitInputType" NOT NULL,
    "fileUrl" TEXT,
    "fileMimeType" TEXT,
    "fileSize" INTEGER,
    "transcription" TEXT,
    "transcriptionStatus" "TranscriptionStatus",
    "noteText" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "visit_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_reports" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "summary" TEXT,
    "changesFromPrevious" TEXT,
    "projectSuggestions" JSONB,
    "inputsUsed" TEXT[],
    "modelUsed" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costUsd" DECIMAL(10,6),
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "pdfPath" TEXT,

    CONSTRAINT "visit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "technical_visits_projectId_idx" ON "technical_visits"("projectId");

-- CreateIndex
CREATE INDEX "technical_visits_createdById_idx" ON "technical_visits"("createdById");

-- CreateIndex
CREATE INDEX "technical_visits_deletedAt_idx" ON "technical_visits"("deletedAt");

-- CreateIndex
CREATE INDEX "visit_inputs_visitId_createdAt_idx" ON "visit_inputs"("visitId", "createdAt");

-- CreateIndex
CREATE INDEX "visit_inputs_deletedAt_idx" ON "visit_inputs"("deletedAt");

-- CreateIndex
CREATE INDEX "visit_reports_visitId_idx" ON "visit_reports"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "visit_reports_visitId_version_key" ON "visit_reports"("visitId", "version");

-- AddForeignKey
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_visits" ADD CONSTRAINT "technical_visits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_inputs" ADD CONSTRAINT "visit_inputs_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "technical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_inputs" ADD CONSTRAINT "visit_inputs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reports" ADD CONSTRAINT "visit_reports_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "technical_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reports" ADD CONSTRAINT "visit_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
