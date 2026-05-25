-- Overrides opcionales del calibre AC en UnifilarVersion. Si quedan en
-- NULL (default), el SVG generator usa la tabla de rules.ts según
-- potencia + tipo de red. Migración no destructiva: versiones existentes
-- mantienen el comportamiento actual.

ALTER TABLE "unifilar_versions" ADD COLUMN "termicaAcCalibre" TEXT;
ALTER TABLE "unifilar_versions" ADD COLUMN "diferencialAcCalibre" TEXT;
