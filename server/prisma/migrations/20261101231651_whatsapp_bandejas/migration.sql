-- AlterTable
ALTER TABLE "whatsapp_numeros" ADD COLUMN     "uso" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_conversaciones" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "leidoHasta" TIMESTAMPTZ(6),
    "leidoPorId" TEXT,
    "resueltoHasta" TIMESTAMPTZ(6),
    "projectId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_conversaciones_projectId_idx" ON "whatsapp_conversaciones"("projectId");

-- CreateIndex
CREATE INDEX "whatsapp_conversaciones_leadId_idx" ON "whatsapp_conversaciones"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversaciones_phoneNumberId_telefono_key" ON "whatsapp_conversaciones"("phoneNumberId", "telefono");

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_leidoPorId_fkey" FOREIGN KEY ("leidoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
