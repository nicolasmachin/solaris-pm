-- CreateTable
CREATE TABLE "ute_document_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ciCliente" TEXT NOT NULL DEFAULT '',
    "calle" TEXT NOT NULL DEFAULT '',
    "numCalle" TEXT NOT NULL DEFAULT '',
    "cuentaUte" TEXT NOT NULL DEFAULT '',
    "casoUte" TEXT NOT NULL DEFAULT '',
    "personaFisica" BOOLEAN NOT NULL DEFAULT true,
    "empresa" BOOLEAN NOT NULL DEFAULT false,
    "representa" TEXT NOT NULL DEFAULT '',
    "ciRepre" TEXT NOT NULL DEFAULT '',
    "calidadRepre" TEXT NOT NULL DEFAULT '',
    "fi" TEXT NOT NULL DEFAULT '',
    "rut" TEXT NOT NULL DEFAULT '',
    "dirFi" TEXT NOT NULL DEFAULT '',
    "ti" TEXT NOT NULL DEFAULT '',
    "ciTi" TEXT NOT NULL DEFAULT '',
    "oficina" TEXT NOT NULL DEFAULT '',
    "repUte" TEXT NOT NULL DEFAULT '',
    "calidadUte" TEXT NOT NULL DEFAULT '',
    "asUte" TEXT NOT NULL DEFAULT '',
    "ps" TEXT NOT NULL DEFAULT '',
    "x" TEXT NOT NULL DEFAULT '',
    "potenciaNomSolicitudImg" TEXT NOT NULL DEFAULT '',
    "intensidadNomSolicitudImg" TEXT NOT NULL DEFAULT '',
    "tension230" BOOLEAN NOT NULL DEFAULT true,
    "tension400" BOOLEAN NOT NULL DEFAULT false,
    "tensionNomInversor230" BOOLEAN NOT NULL DEFAULT true,
    "tensionNomInversor400" BOOLEAN NOT NULL DEFAULT false,
    "fasesMono" BOOLEAN NOT NULL DEFAULT true,
    "fasesTri" BOOLEAN NOT NULL DEFAULT false,
    "tipoGeneradorSincMono" BOOLEAN NOT NULL DEFAULT true,
    "tipoGeneradorSincTri" BOOLEAN NOT NULL DEFAULT false,
    "potImg" TEXT NOT NULL DEFAULT '',
    "potImgLetras" TEXT NOT NULL DEFAULT '',
    "potContratada" TEXT NOT NULL DEFAULT '',
    "potContratadaLetras" TEXT NOT NULL DEFAULT '',
    "potContratada1000" TEXT NOT NULL DEFAULT '',
    "tarifa" TEXT NOT NULL DEFAULT '',
    "fp" TEXT NOT NULL DEFAULT '',
    "normas1" TEXT NOT NULL DEFAULT '',
    "normas2" TEXT NOT NULL DEFAULT '',
    "x1" TEXT NOT NULL DEFAULT '',
    "x2" TEXT NOT NULL DEFAULT '',
    "x3" TEXT NOT NULL DEFAULT '',
    "x4" TEXT NOT NULL DEFAULT '',
    "seriePanel" TEXT NOT NULL DEFAULT '',
    "serieInversor" TEXT NOT NULL DEFAULT '',
    "areaPaneles" TEXT NOT NULL DEFAULT '',
    "fechaDoc" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ute_document_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ute_document_generations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "docsGenerated" TEXT[],
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ute_document_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ute_document_configs_projectId_key" ON "ute_document_configs"("projectId");

-- CreateIndex
CREATE INDEX "ute_document_generations_projectId_idx" ON "ute_document_generations"("projectId");

-- CreateIndex
CREATE INDEX "ute_document_generations_generatedById_idx" ON "ute_document_generations"("generatedById");

-- AddForeignKey
ALTER TABLE "ute_document_configs" ADD CONSTRAINT "ute_document_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ute_document_generations" ADD CONSTRAINT "ute_document_generations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ute_document_generations" ADD CONSTRAINT "ute_document_generations_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
