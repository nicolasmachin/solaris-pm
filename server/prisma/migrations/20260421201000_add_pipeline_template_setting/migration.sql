-- Agregar PIPELINE_TEMPLATE al enum SettingKey
-- Usado para persistir el template editable del pipeline (etapas + subetapas + checklist + weights)
ALTER TYPE "SettingKey" ADD VALUE 'PIPELINE_TEMPLATE';
