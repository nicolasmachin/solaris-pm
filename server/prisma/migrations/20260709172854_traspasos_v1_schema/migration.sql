-- CreateEnum
CREATE TYPE "TraspasoTipo" AS ENUM ('T1_ONBOARDING_COMPLETADO', 'T2_PREINGENIERIA_PRONTA', 'T3_REPORTE_CAPATAZ', 'T4_INGENIERIA_FINAL_COMPLETADA', 'T5_MATERIALES_RECIBIDOS_EN_DEPOSITO', 'T6_OBRA_TERMINADA', 'T7_TRAMITE_UTE_FINALIZADO', 'T8_TICKET_DERIVADO', 'T9_TICKET_RESUELTO', 'T10_ENCUESTA_NOTA_BAJA', 'T11_CLIENTE_AUTOAGENDO_MANTENIMIENTO', 'T12_MANTENIMIENTO_EJECUTADO');

-- CreateEnum
CREATE TYPE "TraspasoEstado" AS ENUM ('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'ESCALADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "SubRolOperaciones" AS ENUM ('CAPATACIA', 'COMPRAS', 'GERENTE');

-- CreateEnum
CREATE TYPE "PostHabilitacionSubFase" AS ENUM ('E3_A_COMPROMISO_COMERCIAL', 'E3_B_VIDA_UTIL_EXTENDIDA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Action" ADD VALUE 'CONFIRM';
ALTER TYPE "Action" ADD VALUE 'ADMIN_REPORT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'traspaso_confirmado';
ALTER TYPE "AuditAction" ADD VALUE 'traspaso_escalado';
ALTER TYPE "AuditAction" ADD VALUE 'traspaso_cancelado';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'traspaso';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'TRASPASOS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'traspaso_asignado';
ALTER TYPE "NotificationType" ADD VALUE 'traspaso_escalado';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StageType" ADD VALUE 'PRE_INGENIERIA';
ALTER TYPE "StageType" ADD VALUE 'REVISION_CAPATAZ';
ALTER TYPE "StageType" ADD VALUE 'INGENIERIA_FINAL';
ALTER TYPE "StageType" ADD VALUE 'COMPRAS';
ALTER TYPE "StageType" ADD VALUE 'EJECUCION_OBRA';
ALTER TYPE "StageType" ADD VALUE 'TRAMITACION_UTE';
ALTER TYPE "StageType" ADD VALUE 'POST_HABILITACION';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "postHabilitacionFechaAproximada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postHabilitacionInicioEn" TIMESTAMPTZ(6),
ADD COLUMN     "postHabilitacionSubFase" "PostHabilitacionSubFase";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subRolesOperaciones" "SubRolOperaciones"[];

-- CreateTable
CREATE TABLE "traspasos" (
    "id" TEXT NOT NULL,
    "tipo" "TraspasoTipo" NOT NULL,
    "estado" "TraspasoEstado" NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
    "projectId" TEXT NOT NULL,
    "payload" JSONB,
    "condicionDetectadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modalUsuarioId" TEXT NOT NULL,
    "modalMostradoEn" TIMESTAMPTZ(6),
    "confirmadoEn" TIMESTAMPTZ(6),
    "confirmadoPorId" TEXT,
    "notaAlReceptor" TEXT,
    "escaladoEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "traspasos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traspaso_destinatarios" (
    "id" TEXT NOT NULL,
    "traspasoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "esCopia" BOOLEAN NOT NULL DEFAULT false,
    "notificadoInApp" BOOLEAN NOT NULL DEFAULT false,
    "notificadoEmail" BOOLEAN NOT NULL DEFAULT false,
    "leidoEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traspaso_destinatarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traspasos_projectId_idx" ON "traspasos"("projectId");

-- CreateIndex
CREATE INDEX "traspasos_estado_idx" ON "traspasos"("estado");

-- CreateIndex
CREATE INDEX "traspasos_modalUsuarioId_estado_idx" ON "traspasos"("modalUsuarioId", "estado");

-- CreateIndex
CREATE INDEX "traspasos_tipo_condicionDetectadaEn_idx" ON "traspasos"("tipo", "condicionDetectadaEn");

-- CreateIndex
CREATE INDEX "traspaso_destinatarios_usuarioId_leidoEn_idx" ON "traspaso_destinatarios"("usuarioId", "leidoEn");

-- CreateIndex
CREATE UNIQUE INDEX "traspaso_destinatarios_traspasoId_usuarioId_key" ON "traspaso_destinatarios"("traspasoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_modalUsuarioId_fkey" FOREIGN KEY ("modalUsuarioId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspaso_destinatarios" ADD CONSTRAINT "traspaso_destinatarios_traspasoId_fkey" FOREIGN KEY ("traspasoId") REFERENCES "traspasos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspaso_destinatarios" ADD CONSTRAINT "traspaso_destinatarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
