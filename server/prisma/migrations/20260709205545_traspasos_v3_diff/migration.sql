-- Traspasos spec v3 DIFF sobre lo implementado en Fase 1 (sin commitear).
-- La tabla "traspasos" está vacía, por lo que recrear el enum TraspasoTipo es seguro.

-- 1) Renumeración de TraspasoTipo: 12 -> 13 valores (agrega T4, renombra/renumera
--    desde el viejo T3 en adelante). Se recrea el tipo casteando la columna vacía.
ALTER TYPE "TraspasoTipo" RENAME TO "TraspasoTipo_old";

CREATE TYPE "TraspasoTipo" AS ENUM (
  'T1_ONBOARDING_COMPLETADO',
  'T2_PREINGENIERIA_PRONTA',
  'T3_VALIDACION_OPERACIONES_A_INGENIERIA',
  'T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE',
  'T5_INGENIERIA_FINAL_COMPLETADA',
  'T6_MATERIALES_RECIBIDOS_EN_DEPOSITO',
  'T7_OBRA_TERMINADA',
  'T8_TRAMITE_UTE_FINALIZADO',
  'T9_TICKET_DERIVADO',
  'T10_TICKET_RESUELTO',
  'T11_ENCUESTA_NOTA_BAJA',
  'T12_CLIENTE_AUTOAGENDO_MANTENIMIENTO',
  'T13_MANTENIMIENTO_EJECUTADO'
);

ALTER TABLE "traspasos"
  ALTER COLUMN "tipo" TYPE "TraspasoTipo" USING ("tipo"::text::"TraspasoTipo");

DROP TYPE "TraspasoTipo_old";

-- 2) Etapa 3 renombrada (C6): se agrega VALIDACION_OPERACIONES. REVISION_CAPATAZ
--    queda temporalmente sin uso y se elimina en la migración de datos (Fase 5).
ALTER TYPE "StageType" ADD VALUE 'VALIDACION_OPERACIONES';

-- 3) Estado "no aplica" para sub-tareas condicionales (C13).
ALTER TYPE "SubstageStatus" ADD VALUE 'NO_APLICA';

-- 4) Flag equipo tercerizado en Project (C13).
ALTER TABLE "projects" ADD COLUMN "equipoTercerizado" BOOLEAN NOT NULL DEFAULT false;
