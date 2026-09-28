-- CreateEnum
CREATE TYPE "SeguroGranizoEstado" AS ENUM ('PENDIENTE_INICIO', 'ACTIVA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SeguroGranizoOrigen" AS ENUM ('VENTA', 'MANUAL');

-- CreateEnum
CREATE TYPE "SiniestroGranizoEstado" AS ENUM ('REPORTADO', 'EVALUADO', 'REPUESTO', 'RECHAZADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'seguro_granizo_poliza';
ALTER TYPE "AuditEntityType" ADD VALUE 'seguro_granizo_siniestro';

-- AlterEnum
ALTER TYPE "CategoriaPrincipal" ADD VALUE 'SEGURO_GRANIZO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'seguro_granizo_por_vencer';
ALTER TYPE "NotificationType" ADD VALUE 'seguro_granizo_impago';

-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "contrataSeguroGranizo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "seguro_granizo_polizas" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "leadId" TEXT,
    "origen" "SeguroGranizoOrigen" NOT NULL DEFAULT 'MANUAL',
    "estado" "SeguroGranizoEstado" NOT NULL DEFAULT 'PENDIENTE_INICIO',
    "fechaInicio" DATE,
    "fechaVencimiento" DATE,
    "cantidadPaneles" INTEGER NOT NULL,
    "cantidadPanelesFuente" TEXT NOT NULL DEFAULT 'MANUAL',
    "precioPorPanelUsd" DECIMAL(10,2) NOT NULL,
    "montoAnualUsd" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "canceladaEn" TIMESTAMPTZ(6),
    "canceladaPorId" TEXT,
    "motivoCancelacion" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "seguro_granizo_polizas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguro_granizo_periodos" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "precioPorPanelUsd" DECIMAL(10,2) NOT NULL,
    "montoUsd" DECIMAL(12,2) NOT NULL,
    "financeMovementId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguro_granizo_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguro_granizo_siniestros" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fechaEvento" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "panelesAfectados" INTEGER,
    "estado" "SiniestroGranizoEstado" NOT NULL DEFAULT 'REPORTADO',
    "cubiertoAlEvento" BOOLEAN NOT NULL DEFAULT true,
    "evaluadoEn" TIMESTAMPTZ(6),
    "evaluacionNota" TEXT,
    "resueltoEn" TIMESTAMPTZ(6),
    "motivoRechazo" TEXT,
    "costoRealUsd" DECIMAL(12,2),
    "costoDetalle" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "seguro_granizo_siniestros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_polizas_projectId_key" ON "seguro_granizo_polizas"("projectId");

-- CreateIndex
CREATE INDEX "seguro_granizo_polizas_estado_idx" ON "seguro_granizo_polizas"("estado");

-- CreateIndex
CREATE INDEX "seguro_granizo_polizas_fechaVencimiento_idx" ON "seguro_granizo_polizas"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_periodos_financeMovementId_key" ON "seguro_granizo_periodos"("financeMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "seguro_granizo_periodos_polizaId_numero_key" ON "seguro_granizo_periodos"("polizaId", "numero");

-- CreateIndex
CREATE INDEX "seguro_granizo_siniestros_polizaId_idx" ON "seguro_granizo_siniestros"("polizaId");

-- CreateIndex
CREATE INDEX "seguro_granizo_siniestros_projectId_idx" ON "seguro_granizo_siniestros"("projectId");

-- AddForeignKey
ALTER TABLE "seguro_granizo_polizas" ADD CONSTRAINT "seguro_granizo_polizas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguro_granizo_periodos" ADD CONSTRAINT "seguro_granizo_periodos_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "seguro_granizo_polizas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguro_granizo_periodos" ADD CONSTRAINT "seguro_granizo_periodos_financeMovementId_fkey" FOREIGN KEY ("financeMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguro_granizo_siniestros" ADD CONSTRAINT "seguro_granizo_siniestros_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "seguro_granizo_polizas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
