-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'marketing_automatizacion';

-- AlterTable
ALTER TABLE "instagram_conversaciones" ADD COLUMN     "derivadaLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origenes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "responderDesde" TIMESTAMPTZ(6),
ADD COLUMN     "seguimientoEn" TIMESTAMPTZ(6),
ADD COLUMN     "sigue" BOOLEAN,
ADD COLUMN     "speechEn" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "instagram_mensajes" ADD COLUMN     "importado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "instagram_eventos" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "razon" TEXT,
    "automatizacion" TEXT,
    "persona" TEXT,
    "usuario" TEXT,
    "comentarioId" TEXT,
    "sombra" BOOLEAN NOT NULL DEFAULT false,
    "desdeAnuncio" BOOLEAN NOT NULL DEFAULT false,
    "speech" BOOLEAN NOT NULL DEFAULT false,
    "lead" BOOLEAN NOT NULL DEFAULT false,
    "derivado" BOOLEAN NOT NULL DEFAULT false,
    "costoUsd" DECIMAL(10,6),
    "datos" JSONB NOT NULL DEFAULT '{}',
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comentarios" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "deId" TEXT,
    "usuario" TEXT,
    "mediaId" TEXT,
    "automatizacion" TEXT NOT NULL,
    "atenderDesde" TIMESTAMPTZ(6) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "resultado" TEXT,
    "respuestaPublica" TEXT,
    "mensajePrivado" TEXT,
    "sombra" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidoEn" TIMESTAMPTZ(6),

    CONSTRAINT "instagram_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_contactos" (
    "id" TEXT NOT NULL,
    "persona" TEXT,
    "usuario" TEXT,
    "nombre" TEXT,
    "sigue" BOOLEAN,
    "primeraVez" TIMESTAMPTZ(6) NOT NULL,
    "ultimaVez" TIMESTAMPTZ(6) NOT NULL,
    "importado" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "instagram_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_contacto_etiquetas" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "primera" TIMESTAMPTZ(6) NOT NULL,
    "ultima" TIMESTAMPTZ(6) NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "importada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "instagram_contacto_etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_automatizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "disparador" TEXT NOT NULL,
    "palabras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicaciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "link" TEXT,
    "esperaMinSeg" INTEGER NOT NULL DEFAULT 40,
    "esperaMaxSeg" INTEGER NOT NULL DEFAULT 150,
    "topeDiario" INTEGER NOT NULL DEFAULT 40,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "flujo" TEXT NOT NULL,
    "actualizadoPorId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketing_automatizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_eventos_creadoEn_idx" ON "instagram_eventos"("creadoEn");

-- CreateIndex
CREATE INDEX "instagram_eventos_tipo_creadoEn_idx" ON "instagram_eventos"("tipo", "creadoEn");

-- CreateIndex
CREATE INDEX "instagram_eventos_persona_idx" ON "instagram_eventos"("persona");

-- CreateIndex
CREATE INDEX "instagram_comentarios_estado_atenderDesde_idx" ON "instagram_comentarios"("estado", "atenderDesde");

-- CreateIndex
CREATE INDEX "instagram_comentarios_automatizacion_atendidoEn_idx" ON "instagram_comentarios"("automatizacion", "atendidoEn");

-- CreateIndex
CREATE INDEX "instagram_comentarios_usuario_idx" ON "instagram_comentarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_contactos_persona_key" ON "instagram_contactos"("persona");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_contactos_usuario_key" ON "instagram_contactos"("usuario");

-- CreateIndex
CREATE INDEX "instagram_contactos_ultimaVez_idx" ON "instagram_contactos"("ultimaVez");

-- CreateIndex
CREATE INDEX "instagram_contacto_etiquetas_nombre_idx" ON "instagram_contacto_etiquetas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_contacto_etiquetas_contactoId_nombre_key" ON "instagram_contacto_etiquetas"("contactoId", "nombre");

-- CreateIndex
CREATE INDEX "instagram_conversaciones_responderDesde_idx" ON "instagram_conversaciones"("responderDesde");

-- AddForeignKey
ALTER TABLE "instagram_contactos" ADD CONSTRAINT "instagram_contactos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_contacto_etiquetas" ADD CONSTRAINT "instagram_contacto_etiquetas_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "instagram_contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_automatizaciones" ADD CONSTRAINT "marketing_automatizaciones_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
