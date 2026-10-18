-- CreateTable
CREATE TABLE "whatsapp_mensajes" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT,
    "plantilla" TEXT,
    "estado" TEXT,
    "estadoEn" TIMESTAMPTZ(6),
    "errorCodigo" TEXT,
    "errorDetalle" TEXT,
    "enviadoPorId" TEXT,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_estados" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "ocurridoEn" TIMESTAMPTZ(6) NOT NULL,
    "pricing" JSONB,
    "errores" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_estados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_mensajes_waMessageId_key" ON "whatsapp_mensajes"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_mensajes_telefono_ocurridoEn_idx" ON "whatsapp_mensajes"("telefono", "ocurridoEn");

-- CreateIndex
CREATE INDEX "whatsapp_estados_waMessageId_idx" ON "whatsapp_estados"("waMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_estados_waMessageId_estado_key" ON "whatsapp_estados"("waMessageId", "estado");

-- AddForeignKey
ALTER TABLE "whatsapp_mensajes" ADD CONSTRAINT "whatsapp_mensajes_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
