-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'contacto';
ALTER TYPE "AuditEntityType" ADD VALUE 'empresa';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "contactoId" TEXT,
ADD COLUMN     "empresaId" TEXT;

-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "contactoId" TEXT,
ADD COLUMN     "empresaId" TEXT;

-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "documento" TEXT,
    "notas" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "rut" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_empresas" (
    "contactoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cargo" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactos_empresas_pkey" PRIMARY KEY ("contactoId","empresaId")
);

-- CreateIndex
CREATE INDEX "contactos_telefono_idx" ON "contactos"("telefono");

-- CreateIndex
CREATE INDEX "contactos_email_idx" ON "contactos"("email");

-- CreateIndex
CREATE INDEX "contactos_deletedAt_idx" ON "contactos"("deletedAt");

-- CreateIndex
CREATE INDEX "empresas_rut_idx" ON "empresas"("rut");

-- CreateIndex
CREATE INDEX "empresas_deletedAt_idx" ON "empresas"("deletedAt");

-- CreateIndex
CREATE INDEX "contactos_empresas_empresaId_idx" ON "contactos_empresas"("empresaId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_empresas" ADD CONSTRAINT "contactos_empresas_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_empresas" ADD CONSTRAINT "contactos_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
