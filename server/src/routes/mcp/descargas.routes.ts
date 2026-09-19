// Descargas del conector.
//
// El protocolo no manda archivos como adjuntos de una conversación, así que las
// herramientas que producen documentos devuelven un enlace. El enlace lleva un
// token de 15 minutos atado al documento concreto, para que abrirlo desde el
// celular no requiera tener sesión de Voltia PM en ese navegador.
//
// Vive en el espacio del conector y no como variante de la ruta normal del PDF:
// ese módulo está entero detrás del login y no conviene abrirle una puerta.

import fs from "node:fs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getVersionById, versionPdfFilename } from "../../services/proposal/version.service.js";
import { readVersionPdf } from "../../services/proposal/proposal-storage.js";
import { getStoredFilePath } from "../../services/file-storage.service.js";
import { contentDisposition } from "../../utils/content-disposition.js";
import { prisma } from "../../lib/prisma.js";
import { issuerUrl } from "./config.js";
import { signDownloadToken, verifyDownloadToken } from "./tokens.js";

/**
 * Tipos de documento que se pueden descargar por enlace.
 *
 * `proposal-generation` es el generador anterior (Excel + script). Sigue vivo
 * porque la mayoría de los clientes históricos tienen sus propuestas ahí.
 */
type RecursoDescargable =
  | "proposal-version"
  | "proposal-generation"
  | "project-file"
  | "lead-file";

/** Arma la URL completa con su token. */
export function buildDownloadUrl(
  userId: string,
  tipo: RecursoDescargable,
  id: string,
  nombreArchivo?: string | null,
): string {
  const recurso = `${tipo}:${id}`;
  const token = signDownloadToken(userId, recurso);
  // El nombre va al final de la ruta porque es lo que usan los navegadores
  // (sobre todo en el celular) al guardar un PDF abierto en pantalla: ignoran
  // el filename del Content-Disposition y toman el último tramo de la URL. El
  // servidor no lo lee — el archivo sale del id y el token —, es solo el nombre.
  const sufijo = nombreArchivo ? `/${encodeURIComponent(nombreArchivo)}` : "";
  return `${issuerUrl()}/mcp/descargas/${tipo}/${id}${sufijo}?t=${token}`;
}

/** Nombre del PDF de una propuesta v2, igual que al descargarla desde la app. */
export function nombrePdfPropuesta(
  version: { snapshot: unknown; versionNumber: number },
  clientNameFallback?: string | null,
): string {
  const snapshot = version.snapshot as { data?: { cliente?: { nombre?: string } } } | null;
  const clientName = snapshot?.data?.cliente?.nombre ?? clientNameFallback ?? "Cliente";
  return versionPdfFilename("full", clientName, version.versionNumber);
}

/** Nombre del PDF de una propuesta del generador anterior (mismo esquema que la app). */
export function nombrePdfPropuestaVieja(clientName: string | null | undefined, version: number): string {
  return versionPdfFilename("full", clientName || "Cliente", version);
}

export async function registerMcpDescargasRoutes(app: FastifyInstance) {
  app.get(
    "/mcp/descargas/proposal-version/:versionId/:nombre?",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { versionId } = request.params as { versionId: string };
      const { t } = request.query as { t?: string };

      if (!t) {
        return reply.code(401).send({ error: true, message: "Enlace inválido" });
      }

      const userId = verifyDownloadToken(t, `proposal-version:${versionId}`);
      if (!userId) {
        return reply.code(401).send({
          error: true,
          message: "El enlace venció o no es válido. Pedí la propuesta de nuevo en el chat.",
        });
      }

      // El usuario se revalida: un enlace generado antes de darlo de baja no
      // debería seguir sirviendo durante los 15 minutos que le quedan.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true },
      });
      if (!user || user.deletedAt) {
        return reply.code(401).send({ error: true, message: "Enlace inválido" });
      }

      const version = await getVersionById(versionId);
      if (!version) {
        return reply.code(404).send({ error: true, message: "No existe esa propuesta" });
      }
      // Una versión descartada no se descarga por enlace: si se descartó, el
      // precio que dice ya no es el vigente.
      if (version.status === "DISCARDED") {
        return reply
          .code(404)
          .send({ error: true, message: "Esa versión de la propuesta fue descartada" });
      }


      let pdf: Buffer;
      try {
        pdf = await readVersionPdf(version.fullPdfPath);
      } catch {
        return reply
          .code(404)
          .send({ error: true, message: "El archivo de la propuesta no está disponible" });
      }

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", contentDisposition("inline", nombrePdfPropuesta(version)))
        // El enlace es de un solo destinatario y de vida corta: que no quede
        // cacheado en el camino.
        .header("Cache-Control", "no-store")
        .send(pdf);
    },
  );

  // Propuestas del generador anterior. El archivo se guarda con ruta absoluta
  // en disco, no bajo el storage de adjuntos.
  app.get(
    "/mcp/descargas/proposal-generation/:proposalId/:nombre?",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { proposalId } = request.params as { proposalId: string };
      const { t } = request.query as { t?: string };

      if (!t) return reply.code(401).send({ error: true, message: "Enlace inválido" });

      const userId = verifyDownloadToken(t, `proposal-generation:${proposalId}`);
      if (!userId) {
        return reply.code(401).send({
          error: true,
          message: "El enlace venció o no es válido. Pedí la propuesta de nuevo en el chat.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true },
      });
      if (!user || user.deletedAt) {
        return reply.code(401).send({ error: true, message: "Enlace inválido" });
      }

      const proposal = await prisma.proposalGeneration.findUnique({
        where: { id: proposalId },
        include: { lead: { select: { clientName: true } } },
      });
      if (!proposal || proposal.discardedAt) {
        return reply.code(404).send({ error: true, message: "No existe esa propuesta" });
      }
      if (proposal.status !== "COMPLETED" || !proposal.outputFilePath) {
        return reply
          .code(404)
          .send({ error: true, message: "Esa propuesta todavía no está lista" });
      }
      if (!fs.existsSync(proposal.outputFilePath)) {
        return reply
          .code(404)
          .send({ error: true, message: "El archivo de la propuesta no está disponible" });
      }

      return reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          contentDisposition("inline", nombrePdfPropuestaVieja(proposal.lead?.clientName, proposal.version)),
        )
        .header("Cache-Control", "no-store")
        .send(fs.createReadStream(proposal.outputFilePath));
    },
  );

  // Adjuntos de un cliente potencial: minutas, fotos de la visita, documentos.
  // Mismo manejo que los de proyecto — se separa el tipo para que un token de
  // un adjunto de lead no sirva para uno de proyecto ni al revés.
  app.get(
    "/mcp/descargas/lead-file/:fileId/:nombre?",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { fileId } = request.params as { fileId: string };
      const { t } = request.query as { t?: string };

      if (!t) return reply.code(401).send({ error: true, message: "Enlace inválido" });

      const userId = verifyDownloadToken(t, `lead-file:${fileId}`);
      if (!userId) {
        return reply.code(401).send({
          error: true,
          message: "El enlace venció o no es válido. Pedí el documento de nuevo en el chat.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true },
      });
      if (!user || user.deletedAt) {
        return reply.code(401).send({ error: true, message: "Enlace inválido" });
      }

      const file = await prisma.fileAttachment.findFirst({
        where: { id: fileId, deletedAt: null },
        select: { filename: true, mimeType: true, url: true },
      });
      if (!file) {
        return reply.code(404).send({ error: true, message: "No existe ese documento" });
      }

      const ruta = getStoredFilePath(file.url);
      if (!fs.existsSync(ruta)) {
        return reply.code(404).send({ error: true, message: "El archivo no está disponible" });
      }

      return reply
        .header("Content-Type", file.mimeType || "application/octet-stream")
        .header("Content-Disposition", contentDisposition("inline", file.filename))
        .header("Cache-Control", "no-store")
        .send(fs.createReadStream(ruta));
    },
  );

  // Documentos de un proyecto: unifilar, pre-ingeniería, proyecto final,
  // presupuestos. Cualquier FileAttachment que cuelgue de un proyecto.
  app.get(
    "/mcp/descargas/project-file/:fileId/:nombre?",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { fileId } = request.params as { fileId: string };
      const { t } = request.query as { t?: string };

      if (!t) return reply.code(401).send({ error: true, message: "Enlace inválido" });

      const userId = verifyDownloadToken(t, `project-file:${fileId}`);
      if (!userId) {
        return reply.code(401).send({
          error: true,
          message: "El enlace venció o no es válido. Pedí el documento de nuevo en el chat.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true },
      });
      if (!user || user.deletedAt) {
        return reply.code(401).send({ error: true, message: "Enlace inválido" });
      }

      const file = await prisma.fileAttachment.findFirst({
        where: { id: fileId, deletedAt: null },
        select: { filename: true, mimeType: true, url: true },
      });
      if (!file) {
        return reply.code(404).send({ error: true, message: "No existe ese documento" });
      }

      const ruta = getStoredFilePath(file.url);
      if (!fs.existsSync(ruta)) {
        return reply.code(404).send({ error: true, message: "El archivo no está disponible" });
      }

      return reply
        .header("Content-Type", file.mimeType || "application/octet-stream")
        .header("Content-Disposition", contentDisposition("inline", file.filename))
        .header("Cache-Control", "no-store")
        .send(fs.createReadStream(ruta));
    },
  );
}
