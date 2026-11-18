-- CreateEnum
CREATE TYPE "UteTramiteComercialTipo" AS ENUM ('NUEVO_SERVICIO', 'AUMENTO', 'REDUCCION', 'REHABILITACION', 'INSTALACION_ENLACE', 'PROVISORIO_GENERAL', 'PROVISORIO_OBRA', 'OTRO');

-- CreateEnum
CREATE TYPE "UteTramiteComercialEstado" AS ENUM ('A_PEDIR', 'PEDIDO', 'OBSERVADO', 'RESUELTO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'ute_tramite_comercial';

-- CreateTable
CREATE TABLE "ute_tramites_comerciales" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suministro" INTEGER NOT NULL DEFAULT 1,
    "tipo" "UteTramiteComercialTipo" NOT NULL,
    "detalle" TEXT,
    "estado" "UteTramiteComercialEstado" NOT NULL DEFAULT 'PEDIDO',
    "caseNumber" TEXT,
    "notes" TEXT,
    "solicitadoEl" DATE,
    "resueltoEl" DATE,
    "emailLogId" TEXT,
    "fileAttachmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ute_tramites_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ute_tramites_comerciales_projectId_idx" ON "ute_tramites_comerciales"("projectId");

-- CreateIndex
CREATE INDEX "ute_tramites_comerciales_estado_idx" ON "ute_tramites_comerciales"("estado");

-- CreateIndex
CREATE INDEX "ute_tramites_comerciales_deletedAt_idx" ON "ute_tramites_comerciales"("deletedAt");

-- AddForeignKey
ALTER TABLE "ute_tramites_comerciales" ADD CONSTRAINT "ute_tramites_comerciales_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
