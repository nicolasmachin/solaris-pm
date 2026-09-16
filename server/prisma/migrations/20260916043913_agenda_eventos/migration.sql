-- CreateEnum
CREATE TYPE "TipoEventoAgenda" AS ENUM ('MANTENIMIENTO', 'SOPORTE', 'VISITA_TECNICA');

-- AlterEnum
ALTER TYPE "SettingKey" ADD VALUE 'CALENDARIO_FILTROS';

-- CreateTable
CREATE TABLE "agenda_eventos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEventoAgenda" NOT NULL,
    "titulo" TEXT NOT NULL,
    "projectId" TEXT,
    "ticketId" TEXT,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "teamColor" TEXT NOT NULL DEFAULT '#378ADD',
    "notas" TEXT,
    "completadoEn" TIMESTAMPTZ(6),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "agenda_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_evento_dias" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_evento_dias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_eventos_projectId_idx" ON "agenda_eventos"("projectId");

-- CreateIndex
CREATE INDEX "agenda_eventos_ticketId_idx" ON "agenda_eventos"("ticketId");

-- CreateIndex
CREATE INDEX "agenda_eventos_teamId_idx" ON "agenda_eventos"("teamId");

-- CreateIndex
CREATE INDEX "agenda_eventos_deletedAt_idx" ON "agenda_eventos"("deletedAt");

-- CreateIndex
CREATE INDEX "agenda_evento_dias_fecha_idx" ON "agenda_evento_dias"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_evento_dias_eventoId_fecha_key" ON "agenda_evento_dias"("eventoId", "fecha");

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_eventos" ADD CONSTRAINT "agenda_eventos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_evento_dias" ADD CONSTRAINT "agenda_evento_dias_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "agenda_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
