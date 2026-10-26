-- CreateEnum
CREATE TYPE "DocumentoOrigen" AS ENUM ('MANUAL_SINCRONIZADO', 'SUBIDO');

-- CreateEnum
CREATE TYPE "VinculoLaboral" AS ENUM ('DEPENDIENTE', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "LegajoDocumentoTipo" AS ENUM ('RECIBO_SUELDO', 'CONTRATO', 'CARNE_SALUD', 'LICENCIA_CONDUCIR', 'CEDULA', 'CURSO_ALTURA', 'PRIMEROS_AUXILIOS', 'HABILITACION_ELECTRICA', 'ANTECEDENTES', 'CONSTANCIA_DOMICILIO', 'BPS', 'BSE', 'ENTREGA_EPP', 'AMONESTACION', 'OTRO');

-- CreateEnum
CREATE TYPE "LegajoDocumentoEstado" AS ENUM ('PENDIENTE', 'VALIDADO', 'RECHAZADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'documento_intranet';
ALTER TYPE "AuditEntityType" ADD VALUE 'legajo';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Module" ADD VALUE 'DOCUMENTACION';
ALTER TYPE "Module" ADD VALUE 'RRHH';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'documento_nueva_version';
ALTER TYPE "NotificationType" ADD VALUE 'legajo_vencimiento';
ALTER TYPE "NotificationType" ADD VALUE 'legajo_documento';

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT NOT NULL,
    "origen" "DocumentoOrigen" NOT NULL DEFAULT 'SUBIDO',
    "requiereLectura" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_roles" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "documento_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_versiones" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "vigenteDesde" DATE,
    "notas" TEXT,
    "filename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "publicadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_lecturas" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leidoAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_lecturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legajos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vinculo" "VinculoLaboral" NOT NULL DEFAULT 'DEPENDIENTE',
    "cedula" TEXT,
    "fechaNacimiento" DATE,
    "direccion" TEXT,
    "telefonoPersonal" TEXT,
    "emailPersonal" TEXT,
    "emergenciaNombre" TEXT,
    "emergenciaTelefono" TEXT,
    "emergenciaVinculo" TEXT,
    "mutualista" TEXT,
    "emergenciaMovil" TEXT,
    "grupoSanguineo" TEXT,
    "alergias" TEXT,
    "banco" TEXT,
    "cuentaBancaria" TEXT,
    "talleRopa" TEXT,
    "talleCalzado" TEXT,
    "licenciaConducirCategoria" TEXT,
    "fechaIngreso" DATE,
    "fechaEgreso" DATE,
    "cargo" TEXT,
    "tipoContrato" TEXT,
    "categoria" TEXT,
    "sueldoNominal" DECIMAL(12,2),
    "sueldoMoneda" "Moneda" NOT NULL DEFAULT 'UYU',
    "notasInternas" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legajos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legajo_documentos" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "tipo" "LegajoDocumentoTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "periodo" TEXT,
    "vencimiento" DATE,
    "estado" "LegajoDocumentoEstado" NOT NULL DEFAULT 'VALIDADO',
    "motivoRechazo" TEXT,
    "soloInterno" BOOLEAN NOT NULL DEFAULT false,
    "filename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "validadoPorId" TEXT,
    "validadoAt" TIMESTAMPTZ(6),
    "vistoAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legajo_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_slug_key" ON "documentos"("slug");

-- CreateIndex
CREATE INDEX "documentos_categoria_orden_idx" ON "documentos"("categoria", "orden");

-- CreateIndex
CREATE INDEX "documento_roles_roleId_idx" ON "documento_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "documento_roles_documentoId_roleId_key" ON "documento_roles"("documentoId", "roleId");

-- CreateIndex
CREATE INDEX "documento_versiones_documentoId_createdAt_idx" ON "documento_versiones"("documentoId", "createdAt");

-- CreateIndex
CREATE INDEX "documento_lecturas_userId_idx" ON "documento_lecturas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "documento_lecturas_versionId_userId_key" ON "documento_lecturas"("versionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "legajos_userId_key" ON "legajos"("userId");

-- CreateIndex
CREATE INDEX "legajo_documentos_legajoId_tipo_idx" ON "legajo_documentos"("legajoId", "tipo");

-- CreateIndex
CREATE INDEX "legajo_documentos_vencimiento_idx" ON "legajo_documentos"("vencimiento");

-- AddForeignKey
ALTER TABLE "documento_roles" ADD CONSTRAINT "documento_roles_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_roles" ADD CONSTRAINT "documento_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_lecturas" ADD CONSTRAINT "documento_lecturas_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "documento_versiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_lecturas" ADD CONSTRAINT "documento_lecturas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legajos" ADD CONSTRAINT "legajos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legajo_documentos" ADD CONSTRAINT "legajo_documentos_legajoId_fkey" FOREIGN KEY ("legajoId") REFERENCES "legajos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legajo_documentos" ADD CONSTRAINT "legajo_documentos_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legajo_documentos" ADD CONSTRAINT "legajo_documentos_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
