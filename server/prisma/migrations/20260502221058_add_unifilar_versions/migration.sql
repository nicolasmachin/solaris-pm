-- CreateEnum
CREATE TYPE "TipoRed" AS ENUM ('MONO_230', 'TRI_230_SN', 'TRI_400_CN');

-- CreateEnum
CREATE TYPE "TipoProteccionDC" AS ENUM ('TERMOMAGNETICO', 'FUSIBLE');

-- CreateTable
CREATE TABLE "unifilar_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotCliente" TEXT NOT NULL,
    "snapshotUbicacion" TEXT NOT NULL,
    "snapshotFecha" TIMESTAMPTZ(6) NOT NULL,
    "snapshotAutor" TEXT NOT NULL,
    "tipoRed" "TipoRed" NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "potenciaPanelW" INTEGER NOT NULL DEFAULT 580,
    "cantidadStrings" INTEGER NOT NULL DEFAULT 2,
    "potenciaContratadaKw" DOUBLE PRECISION NOT NULL,
    "tipoProteccionDc" "TipoProteccionDC" NOT NULL DEFAULT 'TERMOMAGNETICO',
    "modeloPanel" TEXT,
    "modeloInversor" TEXT NOT NULL,
    "potenciaInversorKw" DOUBLE PRECISION NOT NULL,
    "modeloMedidorMonitoreo" TEXT,
    "calibreProteccionDc" TEXT NOT NULL DEFAULT '25A 2P',
    "largoDcPanelesM" INTEGER NOT NULL,
    "largoDcEsLargo" BOOLEAN NOT NULL DEFAULT false,
    "largoAcInversorIcpM" INTEGER NOT NULL,
    "largoAcIcpTableroM" INTEGER NOT NULL,

    CONSTRAINT "unifilar_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unifilar_versions_projectId_idx" ON "unifilar_versions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "unifilar_versions_projectId_versionNumber_key" ON "unifilar_versions"("projectId", "versionNumber");

-- AddForeignKey
ALTER TABLE "unifilar_versions" ADD CONSTRAINT "unifilar_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
