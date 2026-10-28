-- CreateTable
CREATE TABLE "growatt_altas_visitante" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "canal" TEXT NOT NULL DEFAULT 'LINK',
    "expiraEn" TIMESTAMPTZ(6) NOT NULL,
    "usadoEn" TIMESTAMPTZ(6),
    "usuarioCreado" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creadoPorId" TEXT,
    "anuladoEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growatt_altas_visitante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growatt_altas_visitante_tokenHash_key" ON "growatt_altas_visitante"("tokenHash");

-- CreateIndex
CREATE INDEX "growatt_altas_visitante_projectId_idx" ON "growatt_altas_visitante"("projectId");

-- AddForeignKey
ALTER TABLE "growatt_altas_visitante" ADD CONSTRAINT "growatt_altas_visitante_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
