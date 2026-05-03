-- AlterEnum
ALTER TYPE "FileAttachmentTipo" ADD VALUE 'PRE_INGENIERIA';

-- CreateTable
CREATE TABLE "preingenieria_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotNombre" TEXT NOT NULL,
    "snapshotDireccion" TEXT,
    "snapshotCiudad" TEXT,
    "snapshotCelular" TEXT,
    "snapshotFechaPrevista" TEXT,
    "tipoTecho" TEXT,
    "tipoTechoOtro" TEXT,
    "infoTecho" TEXT,
    "alturaTecho" TEXT,
    "cantidadPaneles" TEXT,
    "potenciaPaneles" TEXT,
    "inversor" TEXT,
    "stringsLineasDc" TEXT,
    "cableAc" TEXT,
    "termicaAc" TEXT,
    "diferencialAc" TEXT,
    "largoCablesAcMts" TEXT,
    "largoCablesDcMts" TEXT,
    "redMonofasica" BOOLEAN NOT NULL DEFAULT false,
    "redTrifasica230SN" BOOLEAN NOT NULL DEFAULT false,
    "redTrifasica400CN" BOOLEAN NOT NULL DEFAULT false,
    "notasAdicionales" TEXT,
    "unifilarVersionId" TEXT,

    CONSTRAINT "preingenieria_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preingenieria_fotos" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "etiqueta" TEXT,
    "fileAttachmentId" TEXT,

    CONSTRAINT "preingenieria_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preingenieria_versions_projectId_idx" ON "preingenieria_versions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "preingenieria_versions_projectId_versionNumber_key" ON "preingenieria_versions"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "preingenieria_fotos_versionId_idx" ON "preingenieria_fotos"("versionId");

-- CreateIndex
CREATE INDEX "preingenieria_fotos_fileAttachmentId_idx" ON "preingenieria_fotos"("fileAttachmentId");

-- AddForeignKey
ALTER TABLE "preingenieria_versions" ADD CONSTRAINT "preingenieria_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preingenieria_fotos" ADD CONSTRAINT "preingenieria_fotos_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "preingenieria_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preingenieria_fotos" ADD CONSTRAINT "preingenieria_fotos_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
