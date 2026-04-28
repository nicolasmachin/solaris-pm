-- CreateEnum
CREATE TYPE "DeadlineRuleTipo" AS ENUM ('DIAS_DESDE_CREACION', 'DIAS_ANTES_INSTALACION', 'MANUAL', 'SIN_DEADLINE');

-- AlterTable
ALTER TABLE "substages" ADD COLUMN     "deadline" DATE,
ADD COLUMN     "deadlineManuallySet" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "deadline_rules" (
    "id" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "sopCode" TEXT,
    "substageName" TEXT,
    "tipo" "DeadlineRuleTipo" NOT NULL,
    "dias" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deadline_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deadline_rules_stageType_idx" ON "deadline_rules"("stageType");

-- CreateIndex
CREATE INDEX "deadline_rules_activa_idx" ON "deadline_rules"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "deadline_rules_stageType_sopCode_substageName_key" ON "deadline_rules"("stageType", "sopCode", "substageName");
