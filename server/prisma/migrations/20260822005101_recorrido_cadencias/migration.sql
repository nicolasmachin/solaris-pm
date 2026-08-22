-- CreateTable
CREATE TABLE "recorrido_cadencias" (
    "id" TEXT NOT NULL,
    "recorrido" TEXT NOT NULL,
    "diasObjetivo" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recorrido_cadencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recorrido_cadencias_recorrido_key" ON "recorrido_cadencias"("recorrido");
