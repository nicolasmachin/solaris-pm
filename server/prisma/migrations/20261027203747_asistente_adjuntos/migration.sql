-- CreateTable
CREATE TABLE "asistente_adjuntos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mensajeId" TEXT,
    "nombre" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistente_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asistente_adjuntos_userId_createdAt_idx" ON "asistente_adjuntos"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "asistente_adjuntos_mensajeId_idx" ON "asistente_adjuntos"("mensajeId");

-- AddForeignKey
ALTER TABLE "asistente_adjuntos" ADD CONSTRAINT "asistente_adjuntos_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "asistente_mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
