-- AlterTable
ALTER TABLE "soporte_casos" ADD COLUMN     "huaweiPlantCode" TEXT;

-- CreateTable
CREATE TABLE "soporte_estado_huawei" (
    "plantCode" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "salud" INTEGER,
    "diaKwh" DOUBLE PRECISION,
    "totalKwh" DOUBLE PRECISION,
    "potenciaW" DOUBLE PRECISION,
    "leidoEn" TIMESTAMPTZ(6) NOT NULL,
    "diaLectura" DATE,
    "sinComunicacionConSol" INTEGER NOT NULL DEFAULT 0,
    "conFallaConSol" INTEGER NOT NULL DEFAULT 0,
    "sinSumarConSol" INTEGER NOT NULL DEFAULT 0,
    "ultimaGeneracionEn" TIMESTAMPTZ(6),

    CONSTRAINT "soporte_estado_huawei_pkey" PRIMARY KEY ("plantCode")
);

-- CreateIndex
CREATE INDEX "soporte_estado_huawei_projectId_idx" ON "soporte_estado_huawei"("projectId");

-- AddForeignKey
ALTER TABLE "soporte_estado_huawei" ADD CONSTRAINT "soporte_estado_huawei_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
