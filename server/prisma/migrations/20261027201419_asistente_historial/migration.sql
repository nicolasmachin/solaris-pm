-- CreateTable
CREATE TABLE "asistente_conversaciones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asistente_conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistente_mensajes" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modelo" TEXT,
    "herramientas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistente_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistente_perfiles" (
    "userId" TEXT NOT NULL,
    "notas" TEXT NOT NULL,
    "mensajesDesdeActualizacion" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asistente_perfiles_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "asistente_conversaciones_userId_updatedAt_idx" ON "asistente_conversaciones"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "asistente_mensajes_conversacionId_createdAt_idx" ON "asistente_mensajes"("conversacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "asistente_mensajes" ADD CONSTRAINT "asistente_mensajes_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "asistente_conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
