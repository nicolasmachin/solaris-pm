-- CreateTable
CREATE TABLE "cabinet_designs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anchoCm" DOUBLE PRECISION NOT NULL,
    "altoCm" DOUBLE PRECISION NOT NULL,
    "profundidadCm" DOUBLE PRECISION NOT NULL,
    "fondoAbierto" BOOLEAN NOT NULL DEFAULT true,
    "pestanaAmure" BOOLEAN NOT NULL DEFAULT true,
    "pestanaAnchoCm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "alaTapaCm" DOUBLE PRECISION,
    "union" TEXT,
    "tornillos" TEXT,
    "material" TEXT NOT NULL DEFAULT 'Chapa galvanizada en caliente',
    "espesorMm" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "acabado" TEXT NOT NULL DEFAULT 'Galvanizado',
    "tipoCierre" TEXT NOT NULL DEFAULT 'A presión (sin candado)',
    "bisagras" TEXT NOT NULL DEFAULT 'Ocultas (interior)',
    "ventilacion" BOOLEAN NOT NULL DEFAULT false,
    "gradoIp" TEXT DEFAULT 'IP54',
    "toleranciaMm" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "notas" TEXT,
    "specsExtra" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "cabinet_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_design_versions" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT,
    "fileAttachmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_design_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cabinet_designs_projectId_deletedAt_idx" ON "cabinet_designs"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "cabinet_design_versions_designId_idx" ON "cabinet_design_versions"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_design_versions_designId_versionNumber_key" ON "cabinet_design_versions"("designId", "versionNumber");

-- AddForeignKey
ALTER TABLE "cabinet_designs" ADD CONSTRAINT "cabinet_designs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_design_versions" ADD CONSTRAINT "cabinet_design_versions_designId_fkey" FOREIGN KEY ("designId") REFERENCES "cabinet_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
