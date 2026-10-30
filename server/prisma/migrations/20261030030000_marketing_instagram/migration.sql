-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'instagram_conversacion';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'MARKETING';

-- CreateTable
CREATE TABLE "instagram_conversaciones" (
    "id" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "usuario" TEXT,
    "nombre" TEXT,
    "desdeAnuncio" BOOLEAN NOT NULL DEFAULT false,
    "derivadaEn" TIMESTAMPTZ(6),
    "derivadaMotivo" TEXT,
    "tomadaEn" TIMESTAMPTZ(6),
    "tomadaPorId" TEXT,
    "ultimoMensajeEn" TIMESTAMPTZ(6),
    "ultimoClienteEn" TIMESTAMPTZ(6),
    "vistaHasta" TIMESTAMPTZ(6),
    "leadId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "instagram_conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_mensajes" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "enviadoEn" TIMESTAMPTZ(6) NOT NULL,
    "enviadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_conversaciones_persona_key" ON "instagram_conversaciones"("persona");

-- CreateIndex
CREATE INDEX "instagram_conversaciones_ultimoMensajeEn_idx" ON "instagram_conversaciones"("ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "instagram_mensajes_conversacionId_enviadoEn_idx" ON "instagram_mensajes"("conversacionId", "enviadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_mensajes_conversacionId_clave_key" ON "instagram_mensajes"("conversacionId", "clave");

-- AddForeignKey
ALTER TABLE "instagram_conversaciones" ADD CONSTRAINT "instagram_conversaciones_tomadaPorId_fkey" FOREIGN KEY ("tomadaPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_conversaciones" ADD CONSTRAINT "instagram_conversaciones_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_mensajes" ADD CONSTRAINT "instagram_mensajes_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "instagram_conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_mensajes" ADD CONSTRAINT "instagram_mensajes_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

