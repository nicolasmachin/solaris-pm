-- Valores nuevos de CategoriaPrincipal (van solos: PostgreSQL no deja usarlos en la misma transacción).
ALTER TYPE "CategoriaPrincipal" ADD VALUE 'CUENTA_SOCIO';
ALTER TYPE "CategoriaPrincipal" ADD VALUE 'ADELANTO_PERSONAL';
