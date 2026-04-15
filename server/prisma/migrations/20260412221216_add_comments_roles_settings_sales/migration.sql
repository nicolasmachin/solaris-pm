-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ASESOR_COMERCIAL', 'INGENIERIA', 'OPERACIONES');

-- CreateEnum
CREATE TYPE "Module" AS ENUM ('VENTAS', 'ONBOARDING', 'INGENIERIA', 'OPERACIONES', 'HABILITACION', 'POSTVENTA', 'METRICAS', 'CONFIGURACION', 'USUARIOS');

-- CreateEnum
CREATE TYPE "Action" AS ENUM ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'COMPLETE', 'COMMENT');

-- CreateEnum
CREATE TYPE "SettingLevel" AS ENUM ('SYSTEM', 'PROJECT', 'USER');

-- CreateEnum
CREATE TYPE "SettingKey" AS ENUM ('DEFAULT_CURRENCY', 'DATE_FORMAT', 'TIMEZONE', 'NOTIFICATIONS_EMAIL', 'NOTIFICATIONS_WHATSAPP', 'SHOW_BUDGET_IN_PIPELINE', 'DEFAULT_LANGUAGE', 'CO2_FACTOR', 'PROPOSAL_SCRIPT_PATH');

-- CreateEnum
CREATE TYPE "SalesStage" AS ENUM ('NUEVO_LEAD', 'PENDIENTE_COTIZAR', 'COTIZADO', 'RECLAMADO', 'VOLVER_CONTACTAR', 'NEGOCIACION', 'AGENDAR_VISITA', 'VISITADO', 'ONBOARDING', 'CERRADO_GANADO', 'CERRADO_PERDIDO', 'MAS_ADELANTE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'comment_added';
ALTER TYPE "AuditAction" ADD VALUE 'comment_edited';
ALTER TYPE "AuditAction" ADD VALUE 'comment_deleted';
ALTER TYPE "AuditAction" ADD VALUE 'lead_created';
ALTER TYPE "AuditAction" ADD VALUE 'lead_stage_changed';
ALTER TYPE "AuditAction" ADD VALUE 'lead_converted';
ALTER TYPE "AuditAction" ADD VALUE 'proposal_generated';
ALTER TYPE "AuditAction" ADD VALUE 'setting_changed';
ALTER TYPE "AuditAction" ADD VALUE 'role_changed';
ALTER TYPE "AuditAction" ADD VALUE 'permission_changed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'comment';
ALTER TYPE "AuditEntityType" ADD VALUE 'lead';
ALTER TYPE "AuditEntityType" ADD VALUE 'proposal';
ALTER TYPE "AuditEntityType" ADD VALUE 'setting';
ALTER TYPE "AuditEntityType" ADD VALUE 'permission';

-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'OPERACIONES';

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "module" "Module" NOT NULL,
    "action" "Action" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "substageId" TEXT,
    "checklistItemId" TEXT,
    "taskId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "level" "SettingLevel" NOT NULL,
    "key" "SettingKey" NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_leads" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "address" TEXT,
    "stage" "SalesStage" NOT NULL DEFAULT 'NUEVO_LEAD',
    "estimatedKwp" DECIMAL(10,2),
    "estimatedBudgetUsd" DECIMAL(14,2),
    "uteBillMonthlyUsd" DECIMAL(10,2),
    "roofType" TEXT,
    "notes" TEXT,
    "lostReason" TEXT,
    "assignedToId" TEXT,
    "convertedToProjectId" TEXT,
    "convertedAt" TIMESTAMPTZ(6),
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStage" "SalesStage",
    "toStage" "SalesStage",
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_generations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "projectId" TEXT,
    "inputFilePath" TEXT,
    "outputFilePath" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposal_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permissions_role_idx" ON "permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_role_module_action_key" ON "permissions"("role", "module", "action");

-- CreateIndex
CREATE INDEX "comments_projectId_idx" ON "comments"("projectId");

-- CreateIndex
CREATE INDEX "comments_stageId_idx" ON "comments"("stageId");

-- CreateIndex
CREATE INDEX "comments_substageId_idx" ON "comments"("substageId");

-- CreateIndex
CREATE INDEX "comments_checklistItemId_idx" ON "comments"("checklistItemId");

-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "comments"("taskId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");

-- CreateIndex
CREATE INDEX "settings_level_key_idx" ON "settings"("level", "key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_level_key_userId_projectId_key" ON "settings"("level", "key", "userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_leads_code_key" ON "sales_leads"("code");

-- CreateIndex
CREATE INDEX "sales_leads_stage_idx" ON "sales_leads"("stage");

-- CreateIndex
CREATE INDEX "sales_leads_assignedToId_idx" ON "sales_leads"("assignedToId");

-- CreateIndex
CREATE INDEX "sales_leads_createdAt_idx" ON "sales_leads"("createdAt");

-- CreateIndex
CREATE INDEX "sales_leads_deletedAt_idx" ON "sales_leads"("deletedAt");

-- CreateIndex
CREATE INDEX "sales_activities_leadId_idx" ON "sales_activities"("leadId");

-- CreateIndex
CREATE INDEX "sales_activities_createdAt_idx" ON "sales_activities"("createdAt");

-- CreateIndex
CREATE INDEX "proposal_generations_leadId_idx" ON "proposal_generations"("leadId");

-- CreateIndex
CREATE INDEX "proposal_generations_projectId_idx" ON "proposal_generations"("projectId");

-- CreateIndex
CREATE INDEX "proposal_generations_status_idx" ON "proposal_generations"("status");

-- CreateIndex
CREATE INDEX "checklist_items_deletedAt_idx" ON "checklist_items"("deletedAt");

-- CreateIndex
CREATE INDEX "stages_deletedAt_idx" ON "stages"("deletedAt");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_substageId_fkey" FOREIGN KEY ("substageId") REFERENCES "substages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_convertedToProjectId_fkey" FOREIGN KEY ("convertedToProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_generations" ADD CONSTRAINT "proposal_generations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_generations" ADD CONSTRAINT "proposal_generations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_generations" ADD CONSTRAINT "proposal_generations_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
