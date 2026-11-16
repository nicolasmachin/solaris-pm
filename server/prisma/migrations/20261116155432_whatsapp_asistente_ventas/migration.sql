-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'whatsapp_requiere_asesor';

-- AlterTable
ALTER TABLE "whatsapp_conversaciones" ADD COLUMN     "asistenteEn" TIMESTAMPTZ(6),
ADD COLUMN     "asistenteEstado" TEXT,
ADD COLUMN     "asistenteMotivo" TEXT,
ADD COLUMN     "asistentePendientes" JSONB,
ADD COLUMN     "asistenteSombra" JSONB;

-- AlterTable
ALTER TABLE "whatsapp_numeros" ADD COLUMN     "asistente" TEXT NOT NULL DEFAULT 'APAGADO';
