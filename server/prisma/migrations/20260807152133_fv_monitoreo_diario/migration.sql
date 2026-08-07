-- CreateEnum
CREATE TYPE "FvDiagnostico" AS ENUM ('OK', 'GENERACION_BAJA', 'SIN_GENERACION', 'SIN_COMUNICACION', 'ERROR_DISPOSITIVO', 'ESPERANDO_HABILITACION', 'SILENCIADA', 'SIN_DATOS_API');

-- CreateEnum
CREATE TYPE "FvIncidenciaEstado" AS ENUM ('ABIERTA', 'RESUELTA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "FvMonitorCorridaModo" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "FvMonitorCorridaEstado" AS ENUM ('EN_CURSO', 'OK', 'PARCIAL', 'ERROR');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'fv_incidencia';

-- AlterTable
ALTER TABLE "growatt_plants" ADD COLUMN     "monitoreoSilenciadoHasta" DATE,
ADD COLUMN     "monitoreoSilenciadoMotivo" TEXT,
ADD COLUMN     "monitoreoSilenciadoPorId" TEXT;

-- CreateTable
CREATE TABLE "growatt_devices" (
    "id" TEXT NOT NULL,
    "growattPlantId" BIGINT NOT NULL,
    "deviceSn" TEXT NOT NULL,
    "dataloggerSn" TEXT,
    "tipo" INTEGER NOT NULL,
    "model" TEXT,
    "lost" BOOLEAN,
    "statusRaw" INTEGER,
    "ultimoDatoEn" TIMESTAMPTZ(6),
    "faultCode" INTEGER,
    "warnCode" INTEGER,
    "faultTexto" TEXT,
    "statusText" TEXT,
    "primeraVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoChequeoEn" TIMESTAMPTZ(6),

    CONSTRAINT "growatt_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_generaciones_diarias" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "generacionKwh" DECIMAL(10,2) NOT NULL,
    "fuente" "ReporteFvFuente" NOT NULL DEFAULT 'GROWATT',
    "growattPlantId" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reporte_fv_generaciones_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_monitor_corridas" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "modo" "FvMonitorCorridaModo" NOT NULL,
    "estado" "FvMonitorCorridaEstado" NOT NULL DEFAULT 'EN_CURSO',
    "iniciadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" TIMESTAMPTZ(6),
    "plantasTotal" INTEGER NOT NULL DEFAULT 0,
    "plantasOk" INTEGER NOT NULL DEFAULT 0,
    "plantasError" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "incidenciasAbiertas" INTEGER NOT NULL DEFAULT 0,
    "incidenciasCerradas" INTEGER NOT NULL DEFAULT 0,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "lanzadaPorId" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "fv_monitor_corridas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_monitor_items" (
    "id" TEXT NOT NULL,
    "corridaId" TEXT NOT NULL,
    "growattPlantId" BIGINT NOT NULL,
    "projectId" TEXT,
    "diagnostico" "FvDiagnostico" NOT NULL,
    "generacionKwh" DECIMAL(10,2),
    "diasSinGeneracion" INTEGER,
    "detalle" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "duracionMs" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "fv_monitor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fv_incidencias" (
    "id" TEXT NOT NULL,
    "growattPlantId" BIGINT NOT NULL,
    "projectId" TEXT,
    "diagnostico" "FvDiagnostico" NOT NULL,
    "estado" "FvIncidenciaEstado" NOT NULL DEFAULT 'ABIERTA',
    "primeraDeteccionEn" DATE NOT NULL,
    "ultimaDeteccionEn" DATE NOT NULL,
    "resueltaEn" DATE,
    "diasAfectados" INTEGER NOT NULL DEFAULT 1,
    "detalle" TEXT,
    "ultimaGeneracionEn" DATE,
    "revisadaPorId" TEXT,
    "revisadaEn" TIMESTAMPTZ(6),
    "nota" TEXT,
    "notificadaEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fv_incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growatt_devices_growattPlantId_idx" ON "growatt_devices"("growattPlantId");

-- CreateIndex
CREATE UNIQUE INDEX "growatt_devices_growattPlantId_deviceSn_key" ON "growatt_devices"("growattPlantId", "deviceSn");

-- CreateIndex
CREATE INDEX "reporte_fv_generaciones_diarias_fecha_idx" ON "reporte_fv_generaciones_diarias"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_generaciones_diarias_projectId_fecha_key" ON "reporte_fv_generaciones_diarias"("projectId", "fecha");

-- CreateIndex
CREATE INDEX "fv_monitor_corridas_fecha_idx" ON "fv_monitor_corridas"("fecha");

-- CreateIndex
CREATE INDEX "fv_monitor_items_growattPlantId_idx" ON "fv_monitor_items"("growattPlantId");

-- CreateIndex
CREATE UNIQUE INDEX "fv_monitor_items_corridaId_growattPlantId_key" ON "fv_monitor_items"("corridaId", "growattPlantId");

-- CreateIndex
CREATE INDEX "fv_incidencias_growattPlantId_estado_idx" ON "fv_incidencias"("growattPlantId", "estado");

-- CreateIndex
CREATE INDEX "fv_incidencias_estado_diagnostico_idx" ON "fv_incidencias"("estado", "diagnostico");

-- CreateIndex
CREATE INDEX "fv_incidencias_projectId_idx" ON "fv_incidencias"("projectId");

-- AddForeignKey
ALTER TABLE "growatt_plants" ADD CONSTRAINT "growatt_plants_monitoreoSilenciadoPorId_fkey" FOREIGN KEY ("monitoreoSilenciadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growatt_devices" ADD CONSTRAINT "growatt_devices_growattPlantId_fkey" FOREIGN KEY ("growattPlantId") REFERENCES "growatt_plants"("plantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_generaciones_diarias" ADD CONSTRAINT "reporte_fv_generaciones_diarias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_monitor_corridas" ADD CONSTRAINT "fv_monitor_corridas_lanzadaPorId_fkey" FOREIGN KEY ("lanzadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_monitor_items" ADD CONSTRAINT "fv_monitor_items_corridaId_fkey" FOREIGN KEY ("corridaId") REFERENCES "fv_monitor_corridas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_incidencias" ADD CONSTRAINT "fv_incidencias_growattPlantId_fkey" FOREIGN KEY ("growattPlantId") REFERENCES "growatt_plants"("plantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_incidencias" ADD CONSTRAINT "fv_incidencias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fv_incidencias" ADD CONSTRAINT "fv_incidencias_revisadaPorId_fkey" FOREIGN KEY ("revisadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice único PARCIAL: una sola incidencia ABIERTA por planta y diagnóstico.
-- Prisma no sabe expresar el WHERE, así que va a mano. Sin esto, dos corridas
-- concurrentes (el cron y el botón "Correr ahora") duplican la incidencia.
CREATE UNIQUE INDEX "fv_incidencias_abierta_unica"
  ON "fv_incidencias" ("growattPlantId", "diagnostico")
  WHERE "estado" = 'ABIERTA';
