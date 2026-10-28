-- AlterTable
ALTER TABLE "whatsapp_mensajes" ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'API';

-- CreateTable
CREATE TABLE "whatsapp_numeros" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "businessId" TEXT,
    "telefono" TEXT NOT NULL,
    "nombreVerificado" TEXT,
    "tokenCifrado" TEXT NOT NULL,
    "coexistencia" BOOLEAN NOT NULL DEFAULT false,
    "etiqueta" TEXT,
    "responsableId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'CONECTADO',
    "syncContactosId" TEXT,
    "syncContactosEn" TIMESTAMPTZ(6),
    "syncHistorialId" TEXT,
    "syncHistorialEn" TIMESTAMPTZ(6),
    "historialProgreso" INTEGER,
    "historialError" TEXT,
    "syncError" TEXT,
    "conectadoPorId" TEXT,
    "conectadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_numeros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numeros_phoneNumberId_key" ON "whatsapp_numeros"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_phoneNumberId_ocurridoEn_idx" ON "whatsapp_mensajes"("phoneNumberId", "ocurridoEn");

-- AddForeignKey
ALTER TABLE "whatsapp_numeros" ADD CONSTRAINT "whatsapp_numeros_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_numeros" ADD CONSTRAINT "whatsapp_numeros_conectadoPorId_fkey" FOREIGN KEY ("conectadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
