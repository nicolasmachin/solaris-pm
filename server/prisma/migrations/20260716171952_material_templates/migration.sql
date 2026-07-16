-- CreateTable
CREATE TABLE "material_templates" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "phaseType" "PhaseType",
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "materialItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_templates_nombre_key" ON "material_templates"("nombre");

-- CreateIndex
CREATE INDEX "material_templates_activa_orden_idx" ON "material_templates"("activa", "orden");

-- CreateIndex
CREATE INDEX "material_template_items_templateId_idx" ON "material_template_items"("templateId");

-- CreateIndex
CREATE INDEX "material_template_items_materialItemId_idx" ON "material_template_items"("materialItemId");

-- CreateIndex
CREATE UNIQUE INDEX "material_template_items_templateId_materialItemId_key" ON "material_template_items"("templateId", "materialItemId");

-- AddForeignKey
ALTER TABLE "material_template_items" ADD CONSTRAINT "material_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "material_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_template_items" ADD CONSTRAINT "material_template_items_materialItemId_fkey" FOREIGN KEY ("materialItemId") REFERENCES "material_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
