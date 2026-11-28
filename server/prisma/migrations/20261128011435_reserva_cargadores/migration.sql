-- CreateEnum
CREATE TYPE "FranjaCargador" AS ENUM ('MANANA', 'TARDE');

-- CreateEnum
CREATE TYPE "EstadoReservaCargador" AS ENUM ('RESERVADA', 'A_CONFIRMAR', 'CANCELADA');

-- AlterEnum
ALTER TYPE "SettingKey" ADD VALUE 'AGENDA_CARGADORES';

-- AlterEnum
ALTER TYPE "TipoEventoAgenda" ADD VALUE 'CARGADOR_EV';

-- CreateTable
CREATE TABLE "reservas_cargador" (
    "id" TEXT NOT NULL,
    "estado" "EstadoReservaCargador" NOT NULL,
    "nombre" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "enZona" BOOLEAN NOT NULL,
    "fecha" DATE,
    "franja" "FranjaCargador",
    "tieneCargador" BOOLEAN NOT NULL,
    "modeloCargador" TEXT,
    "modeloAuto" TEXT,
    "notas" TEXT,
    "leadId" TEXT,
    "agendaEventoId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "canceladaEn" TIMESTAMPTZ(6),

    CONSTRAINT "reservas_cargador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_cargador_fecha_franja_idx" ON "reservas_cargador"("fecha", "franja");

-- CreateIndex
CREATE INDEX "reservas_cargador_estado_idx" ON "reservas_cargador"("estado");
