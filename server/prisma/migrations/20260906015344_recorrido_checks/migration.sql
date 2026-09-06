-- CreateTable
CREATE TABLE "recorrido_checks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recorrido" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "venceEn" TIMESTAMPTZ(6),
    "completadoEn" TIMESTAMPTZ(6),
    "completadoPorId" TEXT,
    "nota" TEXT,
    "esDinamico" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recorrido_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recorrido_checks_projectId_idx" ON "recorrido_checks"("projectId");

-- CreateIndex
CREATE INDEX "recorrido_checks_recorrido_idx" ON "recorrido_checks"("recorrido");

-- CreateIndex
CREATE UNIQUE INDEX "recorrido_checks_projectId_codigo_key" ON "recorrido_checks"("projectId", "codigo");

-- AddForeignKey
ALTER TABLE "recorrido_checks" ADD CONSTRAINT "recorrido_checks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrido_checks" ADD CONSTRAINT "recorrido_checks_completadoPorId_fkey" FOREIGN KEY ("completadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
