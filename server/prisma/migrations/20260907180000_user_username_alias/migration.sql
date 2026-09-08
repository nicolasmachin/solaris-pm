-- El email pasa a ser opcional: los Generadores del portal muchas veces no
-- tienen mail, y exigirlo era lo que los dejaba sin acceso. Entran con
-- `username` (su cédula o un alias derivado del nombre).
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Alias corto de ingreso, alternativo al mail. Único, y el login busca por los
-- dos campos: por eso un alias nunca puede ser el mail de otro.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
