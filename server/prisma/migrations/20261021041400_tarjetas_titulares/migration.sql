-- CreateEnum
CREATE TYPE "ReglaTarjeta" AS ENUM ('VOLTIA', 'PERSONAL', 'MIXTA');




-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "descontadoAt" TIMESTAMP(3),
ADD COLUMN     "descontadoPorId" TEXT,
ADD COLUMN     "tarjetaTitularId" TEXT;

-- CreateTable
CREATE TABLE "tarjeta_titulares" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "regla" "ReglaTarjeta" NOT NULL DEFAULT 'VOLTIA',
    "personalComo" "CategoriaPrincipal" NOT NULL DEFAULT 'ADELANTO_PERSONAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarjeta_titulares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarjeta_titulares_accountId_idx" ON "tarjeta_titulares"("accountId");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_tarjetaTitularId_fkey" FOREIGN KEY ("tarjetaTitularId") REFERENCES "tarjeta_titulares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjeta_titulares" ADD CONSTRAINT "tarjeta_titulares_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

