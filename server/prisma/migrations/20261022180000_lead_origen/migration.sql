-- Origen del lead ("¿Cómo nos conoció?"). Aditiva: los leads existentes
-- quedan en null.
CREATE TYPE "OrigenLead" AS ENUM ('ANUNCIO_META', 'REDES_ORGANICO', 'RECOMENDACION', 'GOOGLE_WEB', 'LINKEDIN', 'INTELIGENCIA_ARTIFICIAL', 'CLIENTE_EXISTENTE', 'MARCA_ALIADA', 'OTRO');

ALTER TABLE "sales_leads" ADD COLUMN "origen" "OrigenLead",
ADD COLUMN "origenDetalle" TEXT;

CREATE INDEX "sales_leads_origen_idx" ON "sales_leads"("origen");
