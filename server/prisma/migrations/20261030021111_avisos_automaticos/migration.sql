-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'aviso_automatico';

-- CreateTable
CREATE TABLE "avisos_automaticos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "disparador" TEXT NOT NULL,
    "dias" INTEGER,
    "canal" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "plantillaNombre" TEXT,
    "plantillaIdioma" TEXT NOT NULL DEFAULT 'es',
    "plantillaId" TEXT,
    "plantillaEstado" TEXT,
    "plantillaMotivo" TEXT,
    "plantillaVariables" JSONB,
    "cierraCheck" TEXT,
    "activadoEn" TIMESTAMPTZ(6),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "avisos_automaticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_envios" (
    "id" TEXT NOT NULL,
    "avisoId" TEXT NOT NULL,
    "projectId" TEXT,
    "claveHecho" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destino" TEXT,
    "estado" TEXT NOT NULL,
    "detalle" TEXT,
    "texto" TEXT,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avisos_automaticos_disparador_idx" ON "avisos_automaticos"("disparador");

-- CreateIndex
CREATE INDEX "avisos_envios_projectId_idx" ON "avisos_envios"("projectId");

-- CreateIndex
CREATE INDEX "avisos_envios_createdAt_idx" ON "avisos_envios"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "avisos_envios_avisoId_claveHecho_key" ON "avisos_envios"("avisoId", "claveHecho");

-- AddForeignKey
ALTER TABLE "avisos_automaticos" ADD CONSTRAINT "avisos_automaticos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_envios" ADD CONSTRAINT "avisos_envios_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "avisos_automaticos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_envios" ADD CONSTRAINT "avisos_envios_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
