-- Seguimientos paralelos de Atención al Cliente (§10). Todo aditivo/nullable.

-- Motivo y dirección de las interacciones de bitácora.
CREATE TYPE "InteractionDirection" AS ENUM ('ENTRANTE', 'SALIENTE');
CREATE TYPE "InteractionReason" AS ENUM ('BIENVENIDA', 'SEGUIMIENTO', 'AVISO_HABILITACION', 'CONSULTA', 'OTRO');

ALTER TABLE "client_interactions" ADD COLUMN "direction" "InteractionDirection";
ALTER TABLE "client_interactions" ADD COLUMN "reason" "InteractionReason";

-- Regla de Oro del aviso post-habilitación.
ALTER TABLE "projects" ADD COLUMN "avisoHabilitacionEn" TIMESTAMPTZ(6);

-- Nuevo tipo de notificación.
ALTER TYPE "NotificationType" ADD VALUE 'aviso_habilitacion_pendiente';
