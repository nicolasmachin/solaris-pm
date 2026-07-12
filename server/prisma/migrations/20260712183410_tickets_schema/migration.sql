-- CreateEnum
CREATE TYPE "TicketEstado" AS ENUM ('ABIERTO', 'DERIVADO', 'EN_PROGRESO', 'RESUELTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TicketPrioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'ticket';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'TICKETS';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ticket_actualizado';

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "TicketEstado" NOT NULL DEFAULT 'ABIERTO',
    "prioridad" "TicketPrioridad" NOT NULL DEFAULT 'MEDIA',
    "areaDerivada" TEXT,
    "origenCliente" BOOLEAN NOT NULL DEFAULT false,
    "creadoPorId" TEXT NOT NULL,
    "asignadoAId" TEXT,
    "resueltoEn" TIMESTAMPTZ(6),
    "resueltoPorId" TEXT,
    "cerradoEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "esInterno" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_projectId_idx" ON "tickets"("projectId");

-- CreateIndex
CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");

-- CreateIndex
CREATE INDEX "ticket_comments_ticketId_idx" ON "ticket_comments"("ticketId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
