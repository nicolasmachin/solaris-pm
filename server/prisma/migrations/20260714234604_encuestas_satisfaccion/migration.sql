-- CreateEnum
CREATE TYPE "SurveyTipo" AS ENUM ('OBRA', 'HABILITACION', 'ANIVERSARIO');

-- CreateEnum
CREATE TYPE "SurveyEstado" AS ENUM ('PENDIENTE', 'RESPONDIDA');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'survey';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'ENCUESTAS';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'encuesta_disponible';

-- CreateTable
CREATE TABLE "satisfaction_surveys" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tipo" "SurveyTipo" NOT NULL,
    "estado" "SurveyEstado" NOT NULL DEFAULT 'PENDIENTE',
    "edicion" INTEGER NOT NULL DEFAULT 0,
    "nota" INTEGER,
    "comentario" TEXT,
    "respondidaEn" TIMESTAMPTZ(6),
    "respondidaPorId" TEXT,
    "traspasoId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "satisfaction_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "satisfaction_surveys_projectId_idx" ON "satisfaction_surveys"("projectId");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_estado_idx" ON "satisfaction_surveys"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaction_surveys_projectId_tipo_edicion_key" ON "satisfaction_surveys"("projectId", "tipo", "edicion");

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
