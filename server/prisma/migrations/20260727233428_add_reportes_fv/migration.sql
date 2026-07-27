-- CreateEnum
CREATE TYPE "TarifaUte" AS ENUM ('SIMPLE', 'DOBLE', 'TRIPLE', 'ZAFRAL');

-- CreateEnum
CREATE TYPE "FranjaHoraria" AS ENUM ('PUNTA', 'LLANO', 'VALLE', 'FUERA_PUNTA');

-- CreateEnum
CREATE TYPE "ReporteFvTipoCliente" AS ENUM ('RESIDENCIAL', 'EMPRESA');

-- CreateEnum
CREATE TYPE "ReporteFvFuente" AS ENUM ('GROWATT', 'MANUAL', 'IMPORT_LEGACY');

-- CreateEnum
CREATE TYPE "ReporteFvOrigenDatos" AS ENUM ('GROWATT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReporteFvIngestaModo" AS ENUM ('CRON', 'MANUAL', 'BACKFILL');

-- CreateEnum
CREATE TYPE "ReporteFvIngestaEstado" AS ENUM ('EN_CURSO', 'OK', 'PARCIAL', 'ERROR', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ReporteFvEmisionEstado" AS ENUM ('BORRADOR', 'LISTO', 'ENVIADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "ReporteFvEnvioEstado" AS ENUM ('ENVIADO', 'FALLIDO', 'DRY_RUN', 'OMITIDO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'tarifa_ute_version';
ALTER TYPE "AuditEntityType" ADD VALUE 'reporte_fv_config';
ALTER TYPE "AuditEntityType" ADD VALUE 'reporte_fv_lectura';
ALTER TYPE "AuditEntityType" ADD VALUE 'reporte_fv_emision';

-- AlterEnum
ALTER TYPE "FileAttachmentTipo" ADD VALUE 'REPORTE_FOTOVOLTAICO';

-- CreateTable
CREATE TABLE "tarifa_ute_versiones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "ivaPct" DECIMAL(6,4) NOT NULL DEFAULT 0.2200,
    "irpfPct" DECIMAL(6,4) NOT NULL DEFAULT 0.1200,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "creadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarifa_ute_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifa_ute_cargos" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tarifa" "TarifaUte" NOT NULL,
    "cargoFijo" DECIMAL(12,4) NOT NULL,
    "cargoPotenciaKw" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "tarifa_ute_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifa_ute_tramos" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tarifa" "TarifaUte" NOT NULL,
    "orden" INTEGER NOT NULL,
    "desdeKwh" INTEGER NOT NULL,
    "hastaKwh" INTEGER NOT NULL,
    "precioKwh" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "tarifa_ute_tramos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifa_ute_franjas" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tarifa" "TarifaUte" NOT NULL,
    "franja" "FranjaHoraria" NOT NULL,
    "precioKwh" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "tarifa_ute_franjas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "tipoCliente" "ReporteFvTipoCliente" NOT NULL DEFAULT 'RESIDENCIAL',
    "tarifaContratada" "TarifaUte",
    "potenciaContratadaKw" DECIMAL(8,2) NOT NULL,
    "pctPunta" DECIMAL(6,4) NOT NULL,
    "pctLlano" DECIMAL(6,4) NOT NULL,
    "pctValle" DECIMAL(6,4) NOT NULL,
    "inversionUsd" DECIMAL(12,2),
    "potenciaInstaladaKwp" DECIMAL(8,2),
    "mesInicio" DATE,
    "origenDatos" "ReporteFvOrigenDatos" NOT NULL DEFAULT 'GROWATT',
    "growattPlantId" BIGINT,
    "envioAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "notasFijas" TEXT,
    "actualizadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reporte_fv_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_destinatarios" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "esCopia" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_fv_destinatarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growatt_plants" (
    "id" TEXT NOT NULL,
    "plantId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "peakPowerKw" DECIMAL(10,2),
    "city" TEXT,
    "country" TEXT,
    "projectId" TEXT,
    "ignorada" BOOLEAN NOT NULL DEFAULT false,
    "vinculadaPorId" TEXT,
    "vinculadaEn" TIMESTAMPTZ(6),
    "primeraVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growatt_plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_lecturas" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "generacionKwh" DECIMAL(12,2),
    "consumoKwh" DECIMAL(12,2),
    "exportacionKwh" DECIMAL(12,2),
    "importacionMedidaKwh" DECIMAL(12,2),
    "generacionFuente" "ReporteFvFuente",
    "consumoFuente" "ReporteFvFuente",
    "exportacionFuente" "ReporteFvFuente",
    "motivoFaltante" TEXT,
    "nota" TEXT,
    "editadoPorId" TEXT,
    "editadoEn" TIMESTAMPTZ(6),
    "ingestaItemId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reporte_fv_lecturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_ingestas" (
    "id" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "modo" "ReporteFvIngestaModo" NOT NULL,
    "estado" "ReporteFvIngestaEstado" NOT NULL DEFAULT 'EN_CURSO',
    "iniciadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" TIMESTAMPTZ(6),
    "plantasTotal" INTEGER NOT NULL DEFAULT 0,
    "plantasOk" INTEGER NOT NULL DEFAULT 0,
    "plantasError" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "lanzadaPorId" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "reporte_fv_ingestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_ingesta_items" (
    "id" TEXT NOT NULL,
    "ingestaId" TEXT NOT NULL,
    "growattPlantId" BIGINT NOT NULL,
    "projectId" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "generacionKwh" DECIMAL(12,2),
    "consumoKwh" DECIMAL(12,2),
    "exportacionKwh" DECIMAL(12,2),
    "requests" INTEGER NOT NULL DEFAULT 0,
    "duracionMs" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "reporte_fv_ingesta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_calculos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "tarifaVersionId" TEXT NOT NULL,
    "tipoCambioUsd" DECIMAL(10,4) NOT NULL,
    "tarifaPrincipal" "TarifaUte" NOT NULL,
    "autoconsumoKwh" DECIMAL(12,2) NOT NULL,
    "importacionRedKwh" DECIMAL(12,2) NOT NULL,
    "exportacionMesAnteriorKwh" DECIMAL(12,2) NOT NULL,
    "ahorroAutoconsumo" DECIMAL(14,2) NOT NULL,
    "ahorroVenta" DECIMAL(14,2) NOT NULL,
    "ahorroTotal" DECIMAL(14,2) NOT NULL,
    "ahorroTotalUsd" DECIMAL(14,2) NOT NULL,
    "irpf" DECIMAL(14,2) NOT NULL,
    "ahorroAcumulado" DECIMAL(14,2) NOT NULL,
    "ahorroAcumuladoUsd" DECIMAL(14,2) NOT NULL,
    "irpfAcumulado" DECIMAL(14,2) NOT NULL,
    "ahorroPromedioHistorico" DECIMAL(14,2) NOT NULL,
    "ahorroPromedioHistoricoUsd" DECIMAL(14,2) NOT NULL,
    "mesesConDatosUsd" INTEGER NOT NULL,
    "retornoInversionPct" DECIMAL(7,2) NOT NULL,
    "mesRetornoEstimado" DATE,
    "exportacionAcumuladaAnio" DECIMAL(14,2) NOT NULL,
    "importacionAcumuladaAnio" DECIMAL(14,2) NOT NULL,
    "ratioUte" DECIMAL(7,2) NOT NULL,
    "estadoUte" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "notas" JSONB NOT NULL,
    "calculadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_fv_calculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_calculo_tarifas" (
    "id" TEXT NOT NULL,
    "calculoId" TEXT NOT NULL,
    "tarifa" "TarifaUte" NOT NULL,
    "sinTotalNeto" DECIMAL(14,2) NOT NULL,
    "sinCargoEnergia" DECIMAL(14,2) NOT NULL,
    "conTotalBruto" DECIMAL(14,2) NOT NULL,
    "conTotalNeto" DECIMAL(14,2) NOT NULL,
    "conCargoEnergia" DECIMAL(14,2) NOT NULL,
    "conIva" DECIMAL(14,2) NOT NULL,
    "conIrpf" DECIMAL(14,2) NOT NULL,
    "creditoExportacion" DECIMAL(14,2) NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL,
    "saldoAplicado" DECIMAL(14,2) NOT NULL,
    "saldoGeneradoMes" DECIMAL(14,2) NOT NULL,
    "saldoFinal" DECIMAL(14,2) NOT NULL,
    "ahorroAutoconsumo" DECIMAL(14,2) NOT NULL,
    "ahorroVenta" DECIMAL(14,2) NOT NULL,
    "ahorroTotalDesglose" DECIMAL(14,2) NOT NULL,
    "ahorroTotalTabla" DECIMAL(14,2) NOT NULL,
    "pctAutoconsumo" DECIMAL(6,2) NOT NULL,
    "pctVenta" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "reporte_fv_calculo_tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_emisiones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "version" INTEGER NOT NULL,
    "calculoId" TEXT NOT NULL,
    "estado" "ReporteFvEmisionEstado" NOT NULL DEFAULT 'BORRADOR',
    "snapshotJson" JSONB NOT NULL,
    "fileAttachmentId" TEXT,
    "publicadoEnPortal" BOOLEAN NOT NULL DEFAULT false,
    "publicadoEn" TIMESTAMPTZ(6),
    "enviadoEn" TIMESTAMPTZ(6),
    "generadoPorId" TEXT,
    "generadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_fv_emisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte_fv_envios" (
    "id" TEXT NOT NULL,
    "emisionId" TEXT NOT NULL,
    "estado" "ReporteFvEnvioEstado" NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "emailLogId" TEXT,
    "errorMessage" TEXT,
    "esDryRun" BOOLEAN NOT NULL DEFAULT false,
    "enviadoPorId" TEXT,
    "enviadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_fv_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarifa_ute_versiones_publicada_vigenteDesde_idx" ON "tarifa_ute_versiones"("publicada", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "tarifa_ute_versiones_vigenteDesde_key" ON "tarifa_ute_versiones"("vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "tarifa_ute_cargos_versionId_tarifa_key" ON "tarifa_ute_cargos"("versionId", "tarifa");

-- CreateIndex
CREATE UNIQUE INDEX "tarifa_ute_tramos_versionId_tarifa_orden_key" ON "tarifa_ute_tramos"("versionId", "tarifa", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "tarifa_ute_franjas_versionId_tarifa_franja_key" ON "tarifa_ute_franjas"("versionId", "tarifa", "franja");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_configs_projectId_key" ON "reporte_fv_configs"("projectId");

-- CreateIndex
CREATE INDEX "reporte_fv_configs_habilitado_idx" ON "reporte_fv_configs"("habilitado");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_destinatarios_configId_email_key" ON "reporte_fv_destinatarios"("configId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "growatt_plants_plantId_key" ON "growatt_plants"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "growatt_plants_projectId_key" ON "growatt_plants"("projectId");

-- CreateIndex
CREATE INDEX "growatt_plants_projectId_idx" ON "growatt_plants"("projectId");

-- CreateIndex
CREATE INDEX "growatt_plants_ignorada_idx" ON "growatt_plants"("ignorada");

-- CreateIndex
CREATE INDEX "reporte_fv_lecturas_periodo_idx" ON "reporte_fv_lecturas"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_lecturas_projectId_periodo_key" ON "reporte_fv_lecturas"("projectId", "periodo");

-- CreateIndex
CREATE INDEX "reporte_fv_ingestas_periodo_idx" ON "reporte_fv_ingestas"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_ingesta_items_ingestaId_growattPlantId_key" ON "reporte_fv_ingesta_items"("ingestaId", "growattPlantId");

-- CreateIndex
CREATE INDEX "reporte_fv_calculos_periodo_idx" ON "reporte_fv_calculos"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_calculos_projectId_periodo_key" ON "reporte_fv_calculos"("projectId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_calculo_tarifas_calculoId_tarifa_key" ON "reporte_fv_calculo_tarifas"("calculoId", "tarifa");

-- CreateIndex
CREATE INDEX "reporte_fv_emisiones_periodo_estado_idx" ON "reporte_fv_emisiones"("periodo", "estado");

-- CreateIndex
CREATE INDEX "reporte_fv_emisiones_publicadoEnPortal_idx" ON "reporte_fv_emisiones"("publicadoEnPortal");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_fv_emisiones_projectId_periodo_version_key" ON "reporte_fv_emisiones"("projectId", "periodo", "version");

-- CreateIndex
CREATE INDEX "reporte_fv_envios_emisionId_idx" ON "reporte_fv_envios"("emisionId");

-- AddForeignKey
ALTER TABLE "tarifa_ute_versiones" ADD CONSTRAINT "tarifa_ute_versiones_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa_ute_cargos" ADD CONSTRAINT "tarifa_ute_cargos_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "tarifa_ute_versiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa_ute_tramos" ADD CONSTRAINT "tarifa_ute_tramos_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "tarifa_ute_versiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa_ute_franjas" ADD CONSTRAINT "tarifa_ute_franjas_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "tarifa_ute_versiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_configs" ADD CONSTRAINT "reporte_fv_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_configs" ADD CONSTRAINT "reporte_fv_configs_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_destinatarios" ADD CONSTRAINT "reporte_fv_destinatarios_configId_fkey" FOREIGN KEY ("configId") REFERENCES "reporte_fv_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growatt_plants" ADD CONSTRAINT "growatt_plants_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growatt_plants" ADD CONSTRAINT "growatt_plants_vinculadaPorId_fkey" FOREIGN KEY ("vinculadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_lecturas" ADD CONSTRAINT "reporte_fv_lecturas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_lecturas" ADD CONSTRAINT "reporte_fv_lecturas_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_ingestas" ADD CONSTRAINT "reporte_fv_ingestas_lanzadaPorId_fkey" FOREIGN KEY ("lanzadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_ingesta_items" ADD CONSTRAINT "reporte_fv_ingesta_items_ingestaId_fkey" FOREIGN KEY ("ingestaId") REFERENCES "reporte_fv_ingestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_calculos" ADD CONSTRAINT "reporte_fv_calculos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_calculos" ADD CONSTRAINT "reporte_fv_calculos_tarifaVersionId_fkey" FOREIGN KEY ("tarifaVersionId") REFERENCES "tarifa_ute_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_calculo_tarifas" ADD CONSTRAINT "reporte_fv_calculo_tarifas_calculoId_fkey" FOREIGN KEY ("calculoId") REFERENCES "reporte_fv_calculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_emisiones" ADD CONSTRAINT "reporte_fv_emisiones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_emisiones" ADD CONSTRAINT "reporte_fv_emisiones_calculoId_fkey" FOREIGN KEY ("calculoId") REFERENCES "reporte_fv_calculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_emisiones" ADD CONSTRAINT "reporte_fv_emisiones_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_emisiones" ADD CONSTRAINT "reporte_fv_emisiones_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_envios" ADD CONSTRAINT "reporte_fv_envios_emisionId_fkey" FOREIGN KEY ("emisionId") REFERENCES "reporte_fv_emisiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte_fv_envios" ADD CONSTRAINT "reporte_fv_envios_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
