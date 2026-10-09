-- Plazo negociado con EFERGIA: 10 días (el resto queda en 30 por default).
UPDATE "suppliers" SET "plazoCreditoDias" = 10 WHERE upper("nombre") LIKE 'EFERGIA%';
