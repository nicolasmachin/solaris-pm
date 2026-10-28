-- CreateEnum
CREATE TYPE "SoporteCasoTipo" AS ENUM ('SIN_GENERACION', 'SIN_COMUNICACION', 'FALLA_INVERSOR', 'BAJO_RENDIMIENTO');

-- CreateEnum
CREATE TYPE "SoporteCasoEstado" AS ENUM ('ABIERTO', 'RESUELTO', 'DESCARTADO');

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'SOPORTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'soporte_alerta';
ALTER TYPE "NotificationType" ADD VALUE 'soporte_aviso_cliente';

-- CreateTable
CREATE TABLE "soporte_estado_plantas" (
    "growattPlantId" BIGINT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" INTEGER,
    "potenciaW" DOUBLE PRECISION,
    "energiaTotalKwh" DOUBLE PRECISION,
    "energiaInicioDiaKwh" DOUBLE PRECISION,
    "diaInicio" DATE,
    "leidoEn" TIMESTAMPTZ(6) NOT NULL,
    "factorNormal" DOUBLE PRECISION,
    "ceroConSol" INTEGER NOT NULL DEFAULT 0,
    "desconectadaConSol" INTEGER NOT NULL DEFAULT 0,
    "ultimaGeneracionEn" TIMESTAMPTZ(6),

    CONSTRAINT "soporte_estado_plantas_pkey" PRIMARY KEY ("growattPlantId")
);

-- CreateTable
CREATE TABLE "soporte_casos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "growattPlantId" BIGINT,
    "tipo" "SoporteCasoTipo" NOT NULL,
    "estado" "SoporteCasoEstado" NOT NULL DEFAULT 'ABIERTO',
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "codigoFalla" INTEGER,
    "detectadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPorId" TEXT,
    "motivoCierre" TEXT,
    "clienteAvisadoEn" TIMESTAMPTZ(6),
    "clienteAvisadoPorId" TEXT,
    "mensajeCliente" TEXT,

    CONSTRAINT "soporte_casos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "soporte_estado_plantas_projectId_idx" ON "soporte_estado_plantas"("projectId");

-- CreateIndex
CREATE INDEX "soporte_casos_estado_idx" ON "soporte_casos"("estado");

-- CreateIndex
CREATE INDEX "soporte_casos_projectId_estado_idx" ON "soporte_casos"("projectId", "estado");

-- AddForeignKey
ALTER TABLE "soporte_estado_plantas" ADD CONSTRAINT "soporte_estado_plantas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soporte_casos" ADD CONSTRAINT "soporte_casos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soporte_casos" ADD CONSTRAINT "soporte_casos_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soporte_casos" ADD CONSTRAINT "soporte_casos_clienteAvisadoPorId_fkey" FOREIGN KEY ("clienteAvisadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
