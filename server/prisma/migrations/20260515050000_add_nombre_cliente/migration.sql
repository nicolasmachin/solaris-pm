-- Project.nombreCliente: nombre tal cual figura en la cédula, usado en los
-- documentos UTE. Independiente de clientName (nombre del proyecto). Backfill
-- inicial = clientName para que los UTE docs sigan funcionando en proyectos
-- existentes.

ALTER TABLE "projects" ADD COLUMN "nombreCliente" TEXT NOT NULL DEFAULT '';

UPDATE "projects" SET "nombreCliente" = "clientName" WHERE "nombreCliente" = '';
