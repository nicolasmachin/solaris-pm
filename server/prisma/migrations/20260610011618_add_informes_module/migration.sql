-- CreateEnum
CREATE TYPE "InformeEstado" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "InformeRespuesta" AS ENUM ('PENDIENTE', 'APROBADO', 'DEVUELTO');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'informe';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'INFORMES';

-- AlterTable
ALTER TABLE "file_attachments" ADD COLUMN     "informeId" TEXT;

-- CreateTable
CREATE TABLE "informes" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "estado" "InformeEstado" NOT NULL DEFAULT 'BORRADOR',
    "autorId" TEXT NOT NULL,
    "projectId" TEXT,
    "enviadoAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "informes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informe_destinatarios" (
    "id" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "respuesta" "InformeRespuesta" NOT NULL DEFAULT 'PENDIENTE',
    "comentario" TEXT,
    "respondidoAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informe_destinatarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "informes_autorId_idx" ON "informes"("autorId");

-- CreateIndex
CREATE INDEX "informes_projectId_idx" ON "informes"("projectId");

-- CreateIndex
CREATE INDEX "informes_estado_idx" ON "informes"("estado");

-- CreateIndex
CREATE INDEX "informe_destinatarios_usuarioId_idx" ON "informe_destinatarios"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "informe_destinatarios_informeId_usuarioId_key" ON "informe_destinatarios"("informeId", "usuarioId");

-- CreateIndex
CREATE INDEX "file_attachments_informeId_idx" ON "file_attachments"("informeId");

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "informes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes" ADD CONSTRAINT "informes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informes" ADD CONSTRAINT "informes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_destinatarios" ADD CONSTRAINT "informe_destinatarios_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "informes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "informe_destinatarios" ADD CONSTRAINT "informe_destinatarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
