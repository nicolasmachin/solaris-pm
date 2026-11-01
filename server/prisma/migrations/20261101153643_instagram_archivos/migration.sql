-- CreateTable
CREATE TABLE "instagram_archivos" (
    "id" TEXT NOT NULL,
    "mensajeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_archivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_archivos_mensajeId_idx" ON "instagram_archivos"("mensajeId");

-- AddForeignKey
ALTER TABLE "instagram_archivos" ADD CONSTRAINT "instagram_archivos_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "instagram_mensajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
