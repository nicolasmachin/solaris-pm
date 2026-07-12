-- CreateTable
CREATE TABLE "project_non_material_costs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "fecha" DATE,
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_non_material_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_non_material_costs_projectId_idx" ON "project_non_material_costs"("projectId");

-- AddForeignKey
ALTER TABLE "project_non_material_costs" ADD CONSTRAINT "project_non_material_costs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
