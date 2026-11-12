-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'caso_tecnico';

-- CreateTable
CREATE TABLE "casos_tecnicos" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "titulo" TEXT NOT NULL,
    "projectId" TEXT,
    "cliente" TEXT,
    "equipos" TEXT NOT NULL,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sintoma" TEXT NOT NULL,
    "descartado" TEXT,
    "causa" TEXT NOT NULL,
    "solucion" TEXT NOT NULL,
    "leccion" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "casos_tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "casos_tecnicos_fecha_idx" ON "casos_tecnicos"("fecha");

-- CreateIndex
CREATE INDEX "casos_tecnicos_projectId_idx" ON "casos_tecnicos"("projectId");

-- AddForeignKey
ALTER TABLE "casos_tecnicos" ADD CONSTRAINT "casos_tecnicos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_tecnicos" ADD CONSTRAINT "casos_tecnicos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
