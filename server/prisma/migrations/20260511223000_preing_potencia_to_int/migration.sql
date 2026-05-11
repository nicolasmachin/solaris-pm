-- Migrar potenciaPaneles de TEXT → INTEGER en preingenieria_versions.
--
-- El campo era texto libre legacy. Los valores reales en producción son:
--   "590"  → 590
--   "570 W" → 570
--   "5 kW"  → 5000  (clave: detectar la unidad kW y multiplicar por 1000)
--
-- El USING evalúa cada fila al cambiar el tipo:
--   * NULL queda NULL.
--   * Si el string contiene "kw" (case-insensitive), toma el primer número
--     decimal y lo multiplica por 1000 (truncando a entero).
--   * En otro caso, extrae todos los dígitos (descarta letras y espacios)
--     y lo castea a INTEGER. Si no queda ningún dígito, queda NULL.
--
-- Pre-migración script (server/scripts/migrate-potencia-paneles.ts) verificó
-- que los 3 registros actuales parsean sin pérdida: 590 → 590, "570 W" → 570,
-- "5 kW" → 5000.

ALTER TABLE "preingenieria_versions"
  ALTER COLUMN "potenciaPaneles" TYPE INTEGER
  USING (
    CASE
      WHEN "potenciaPaneles" IS NULL THEN NULL::INTEGER
      WHEN "potenciaPaneles" ~* 'kw' THEN
        TRUNC(
          NULLIF(
            REGEXP_REPLACE(REPLACE("potenciaPaneles", ',', '.'), '[^0-9.]', '', 'g'),
            ''
          )::NUMERIC * 1000
        )::INTEGER
      ELSE
        NULLIF(REGEXP_REPLACE("potenciaPaneles", '\D', '', 'g'), '')::INTEGER
    END
  );
