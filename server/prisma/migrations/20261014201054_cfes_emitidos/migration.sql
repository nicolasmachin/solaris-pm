-- CreateEnum
CREATE TYPE "EstadoCfeEmitido" AS ENUM ('EMITIENDO', 'DUDOSO', 'ESPERANDO_DGI', 'ACEPTADO', 'RECHAZADO', 'ERROR');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'cfe_emitido';

-- CreateTable
CREATE TABLE "cfes_emitidos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tipoCfe" INTEGER NOT NULL,
    "numeroInterno" TEXT NOT NULL,
    "estado" "EstadoCfeEmitido" NOT NULL DEFAULT 'EMITIENDO',
    "estadoDgi" TEXT,
    "billerId" TEXT,
    "serie" TEXT,
    "numero" INTEGER,
    "hash" TEXT,
    "fechaEmision" DATE NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "tasaCambio" DECIMAL(12,4),
    "total" DECIMAL(14,2) NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteDocumento" TEXT,
    "referenciaId" TEXT,
    "motivo" TEXT,
    "payload" JSONB NOT NULL,
    "respuesta" JSONB,
    "error" TEXT,
    "pdfAttachmentId" TEXT,
    "emitidoPorId" TEXT NOT NULL,
    "ultimaConsultaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cfes_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cfes_emitidos_numeroInterno_key" ON "cfes_emitidos"("numeroInterno");

-- CreateIndex
CREATE UNIQUE INDEX "cfes_emitidos_billerId_key" ON "cfes_emitidos"("billerId");

-- CreateIndex
CREATE INDEX "cfes_emitidos_projectId_idx" ON "cfes_emitidos"("projectId");

-- CreateIndex
CREATE INDEX "cfes_emitidos_estado_idx" ON "cfes_emitidos"("estado");

-- AddForeignKey
ALTER TABLE "cfes_emitidos" ADD CONSTRAINT "cfes_emitidos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfes_emitidos" ADD CONSTRAINT "cfes_emitidos_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "cfes_emitidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfes_emitidos" ADD CONSTRAINT "cfes_emitidos_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
