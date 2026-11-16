-- AlterTable
ALTER TABLE "whatsapp_conversaciones" ADD COLUMN     "contactoId" TEXT,
ADD COLUMN     "nombrePerfil" TEXT,
ADD COLUMN     "usuarioId" TEXT;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversaciones" ADD CONSTRAINT "whatsapp_conversaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
