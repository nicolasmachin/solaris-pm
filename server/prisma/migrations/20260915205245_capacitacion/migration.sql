-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'capacitacion';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'CAPACITACION';

-- CreateTable
CREATE TABLE "capacitacion_secciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacitacion_secciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacitacion_seccion_roles" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "capacitacion_seccion_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacitacion_listas" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacitacion_listas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacitacion_videos" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "bunnyLibraryId" TEXT NOT NULL,
    "bunnyVideoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracionSeg" INTEGER,
    "thumbnailFileName" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(6),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacitacion_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacitacion_documentos" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "listaId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "filename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(6),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacitacion_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacitacion_vistas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "segundosVistos" INTEGER NOT NULL DEFAULT 0,
    "completadoAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacitacion_vistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capacitacion_secciones_orden_idx" ON "capacitacion_secciones"("orden");

-- CreateIndex
CREATE INDEX "capacitacion_seccion_roles_roleId_idx" ON "capacitacion_seccion_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "capacitacion_seccion_roles_seccionId_roleId_key" ON "capacitacion_seccion_roles"("seccionId", "roleId");

-- CreateIndex
CREATE INDEX "capacitacion_listas_seccionId_orden_idx" ON "capacitacion_listas"("seccionId", "orden");

-- CreateIndex
CREATE INDEX "capacitacion_videos_listaId_orden_idx" ON "capacitacion_videos"("listaId", "orden");

-- CreateIndex
CREATE INDEX "capacitacion_videos_bunnyVideoId_idx" ON "capacitacion_videos"("bunnyVideoId");

-- CreateIndex
CREATE INDEX "capacitacion_documentos_seccionId_orden_idx" ON "capacitacion_documentos"("seccionId", "orden");

-- CreateIndex
CREATE INDEX "capacitacion_documentos_listaId_idx" ON "capacitacion_documentos"("listaId");

-- CreateIndex
CREATE INDEX "capacitacion_vistas_videoId_idx" ON "capacitacion_vistas"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "capacitacion_vistas_userId_videoId_key" ON "capacitacion_vistas"("userId", "videoId");

-- AddForeignKey
ALTER TABLE "capacitacion_seccion_roles" ADD CONSTRAINT "capacitacion_seccion_roles_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "capacitacion_secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_seccion_roles" ADD CONSTRAINT "capacitacion_seccion_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_listas" ADD CONSTRAINT "capacitacion_listas_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "capacitacion_secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_videos" ADD CONSTRAINT "capacitacion_videos_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "capacitacion_listas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_videos" ADD CONSTRAINT "capacitacion_videos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_documentos" ADD CONSTRAINT "capacitacion_documentos_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "capacitacion_secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_documentos" ADD CONSTRAINT "capacitacion_documentos_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "capacitacion_listas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_documentos" ADD CONSTRAINT "capacitacion_documentos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_vistas" ADD CONSTRAINT "capacitacion_vistas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacitacion_vistas" ADD CONSTRAINT "capacitacion_vistas_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "capacitacion_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
