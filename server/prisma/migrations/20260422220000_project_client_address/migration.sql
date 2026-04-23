-- Agrega dirección del cliente como campo opcional.
-- Se usa en el bloque "Datos del cliente" de la ficha del proyecto.
ALTER TABLE "projects" ADD COLUMN "clientAddress" TEXT;
