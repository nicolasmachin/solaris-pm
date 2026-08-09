-- AlterEnum
ALTER TYPE "ReporteFvFuente" ADD VALUE 'HUAWEI';

-- AlterEnum
ALTER TYPE "ReporteFvOrigenDatos" ADD VALUE 'HUAWEI';

-- CreateTable
CREATE TABLE "huawei_plants" (
    "id" TEXT NOT NULL,
    "plantCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityKwp" DECIMAL(10,2),
    "gridConnectionDate" DATE,
    "address" TEXT,
    "healthState" INTEGER,
    "ultimoEstadoEn" TIMESTAMPTZ(6),
    "projectId" TEXT,
    "ignorada" BOOLEAN NOT NULL DEFAULT false,
    "vinculadaPorId" TEXT,
    "vinculadaEn" TIMESTAMPTZ(6),
    "primeraVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "huawei_plants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "huawei_plants_plantCode_key" ON "huawei_plants"("plantCode");

-- CreateIndex
CREATE UNIQUE INDEX "huawei_plants_projectId_key" ON "huawei_plants"("projectId");

-- CreateIndex
CREATE INDEX "huawei_plants_projectId_idx" ON "huawei_plants"("projectId");

-- CreateIndex
CREATE INDEX "huawei_plants_ignorada_idx" ON "huawei_plants"("ignorada");

-- AddForeignKey
ALTER TABLE "huawei_plants" ADD CONSTRAINT "huawei_plants_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huawei_plants" ADD CONSTRAINT "huawei_plants_vinculadaPorId_fkey" FOREIGN KEY ("vinculadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
