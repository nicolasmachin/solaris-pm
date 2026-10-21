-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'cierre_mes';

-- CreateTable
CREATE TABLE "cierres_mes" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "cerradoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoPorId" TEXT NOT NULL,
    "notaCierre" TEXT,
    "foto" JSONB NOT NULL,
    "checklist" JSONB NOT NULL,
    "reabiertoAt" TIMESTAMP(3),
    "reabiertoPorId" TEXT,
    "motivoReapertura" TEXT,

    CONSTRAINT "cierres_mes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierres_mes_anio_mes_idx" ON "cierres_mes"("anio", "mes");

-- AddForeignKey
ALTER TABLE "cierres_mes" ADD CONSTRAINT "cierres_mes_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_mes" ADD CONSTRAINT "cierres_mes_reabiertoPorId_fkey" FOREIGN KEY ("reabiertoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

