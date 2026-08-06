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
import { prisma } from "../../lib/prisma.js";
import { issuerUrl } from "./config.js";
import { signDownloadToken, verifyDownloadToken } from "./tokens.js";

/**
 * Tipos de documento que se pueden descargar por enlace.
 *
 * `proposal-generation` es el generador anterior (Excel + script). Sigue vivo
 * porque la mayoría de los clientes históricos tienen sus propuestas ahí.
 */
type RecursoDescargable = "proposal-version" | "proposal-generation";

/** Arma la URL completa con su token. */
export function buildDownloadUrl(userId: string, tipo: RecursoDescargable, id: string): string {
  const recurso = `${tipo}:${id}`;
  const token = signDownloadToken(userId, recurso);
  return `${issuerUrl()}/mcp/descargas/${tipo}/${id}?t=${token}`;
}

export async function registerMcpDescargasRoutes(app: FastifyInstance) {
  app.get(
    "/mcp/descargas/proposal-version/:versionId",
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

      const snapshot = version.snapshot as { data?: { cliente?: { nombre?: string } } };
      const clientName = snapshot?.data?.cliente?.nombre ?? "Cliente";

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
        .header(
          "Content-Disposition",
          `inline; filename="${versionPdfFilename("full", clientName, version.versionNumber)}"`,
        )
        // El enlace es de un solo destinatario y de vida corta: que no quede
        // cacheado en el camino.
        .header("Cache-Control", "no-store")
        .send(pdf);
    },
  );

  // Propuestas del generador anterior. El archivo se guarda con ruta absoluta
  // en disco, no bajo el storage de adjuntos.
  app.get(
    "/mcp/descargas/proposal-generation/:proposalId",
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
        .header("Content-Disposition", `inline; filename="propuesta-v${proposal.version}.pdf"`)
        .header("Cache-Control", "no-store")
        .send(fs.createReadStream(proposal.outputFilePath));
    },
  );
}
