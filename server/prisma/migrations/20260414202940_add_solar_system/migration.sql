-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('MONOFASICO', 'TRIFASICO_230', 'TRIFASICO_400');

-- CreateTable
CREATE TABLE "solar_systems" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "inverterBrand" TEXT,
    "inverterPowerKw" DECIMAL(10,2),
    "inverterQuantity" INTEGER DEFAULT 1,
    "inverterPhaseType" "PhaseType",
    "inverterModel" TEXT,
    "panelQuantity" INTEGER,
    "panelPowerW" INTEGER,
    "panelBrand" TEXT,
    "panelModel" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solar_systems_projectId_idx" ON "solar_systems"("projectId");

-- CreateIndex
CREATE INDEX "solar_systems_deletedAt_idx" ON "solar_systems"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "solar_systems_projectId_order_key" ON "solar_systems"("projectId", "order");

-- AddForeignKey
ALTER TABLE "solar_systems" ADD CONSTRAINT "solar_systems_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
