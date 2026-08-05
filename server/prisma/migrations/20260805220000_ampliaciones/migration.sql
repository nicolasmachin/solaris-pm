-- Ampliaciones: un proyecto puede colgar de otro (la instalación original a la
-- que se le suma capacidad). "Es una ampliación" = parentProjectId no es null.
--
-- ON DELETE SET NULL y no CASCADE: borrar la obra original no puede arrastrar la
-- ampliación, que tiene su propia plata, sus materiales y su trámite UTE.
ALTER TABLE "projects" ADD COLUMN "parentProjectId" TEXT;

CREATE INDEX "projects_parentProjectId_idx" ON "projects"("parentProjectId");

ALTER TABLE "projects" ADD CONSTRAINT "projects_parentProjectId_fkey"
  FOREIGN KEY ("parentProjectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
