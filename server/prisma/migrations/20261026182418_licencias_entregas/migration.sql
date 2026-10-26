-- CreateEnum
CREATE TYPE "LicenciaTipo" AS ENUM ('ANUAL', 'ENFERMEDAD', 'ESTUDIO', 'PATERNIDAD', 'MATERNIDAD', 'DUELO', 'MATRIMONIO', 'DONACION_SANGRE', 'SIN_GOCE', 'OTRA');

-- CreateEnum
CREATE TYPE "LicenciaEstado" AS ENUM ('SOLICITADA', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EntregaEstado" AS ENUM ('PENDIENTE_FIRMA', 'FIRMADA', 'ANULADA');

-- CreateTable
CREATE TABLE "licencias" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" "LicenciaTipo" NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "dias" INTEGER NOT NULL,
    "nota" TEXT,
    "estado" "LicenciaEstado" NOT NULL DEFAULT 'SOLICITADA',
    "motivoRechazo" TEXT,
    "solicitadaPorId" TEXT NOT NULL,
    "resueltaPorId" TEXT,
    "resueltaAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencia_contingentes" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "dias" INTEGER NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "licencia_contingentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_materiales" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "observaciones" TEXT,
    "estado" "EntregaEstado" NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "entregadoPorId" TEXT NOT NULL,
    "firmaUrl" TEXT,
    "firmadaAt" TIMESTAMPTZ(6),
    "firmaPresencial" BOOLEAN NOT NULL DEFAULT false,
    "documentoId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entregas_materiales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "licencias_legajoId_desde_idx" ON "licencias"("legajoId", "desde");

-- CreateIndex
CREATE INDEX "licencias_estado_idx" ON "licencias"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "licencia_contingentes_legajoId_anio_key" ON "licencia_contingentes"("legajoId", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_materiales_documentoId_key" ON "entregas_materiales"("documentoId");

-- CreateIndex
CREATE INDEX "entregas_materiales_legajoId_fecha_idx" ON "entregas_materiales"("legajoId", "fecha");

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "legajos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencia_contingentes" ADD CONSTRAINT "licencia_contingentes_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "legajos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_materiales" ADD CONSTRAINT "entregas_materiales_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "legajos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_materiales" ADD CONSTRAINT "entregas_materiales_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
