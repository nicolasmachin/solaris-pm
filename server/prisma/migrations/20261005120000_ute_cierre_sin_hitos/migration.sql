-- Cierre de trámite UTE sin todos los hitos cargados: queda registrado y con
-- motivo, porque ese cierre dispara el aviso de "ya podés encender".
ALTER TABLE "ute_processes" ADD COLUMN "cierreSinHitos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ute_processes" ADD COLUMN "cierreSinHitosMotivo" TEXT;
ALTER TABLE "ute_processes" ADD COLUMN "cierreSinHitosEn" TIMESTAMPTZ(6);
ALTER TABLE "ute_processes" ADD COLUMN "cierreSinHitosPorId" TEXT;
