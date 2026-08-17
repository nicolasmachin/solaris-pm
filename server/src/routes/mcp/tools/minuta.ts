// Minutas y adjuntos de un cliente potencial, como TEXTO.
//
// La regla que manda acá: el asistente no puede abrir enlaces. Un enlace de
// descarga sirve para que una persona lo toque en el celular, pero es inútil
// cuando alguien va manejando y pregunta "¿qué decía la minuta?". Todo lo que
// haya que leer viaja en el cuerpo de la respuesta; el enlace acompaña, nunca
// reemplaza.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { getStoredFilePath } from "../../../services/file-storage.service.js";
import { extractTextFromPdf } from "../../../services/minutaExtraction/index.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { campos, fechaCorta, texto } from "../format.js";

import fs from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Tope de texto por respuesta. El protocolo corta cerca de los 150.000
 * caracteres; se deja margen para el resto del mensaje. Una minuta de 13
 * páginas ronda los 20.000, así que en la práctica nunca se toca — pero si
 * alguna lo hace, se avisa en vez de entregar un documento cortado en silencio.
 */
const TOPE_TEXTO = 100_000;

/** Un adjunto es minuta si el bot lo dejó marcado, o si el nombre lo delata. */
function esMinuta(a: { tipo: string | null; filename: string; toolSource: string | null }): boolean {
  if (a.tipo === "MINUTA_RELEVAMIENTO") return true;
  if (a.toolSource === "minuta") return true;
  const n = a.filename.toLowerCase();
  return n.includes("minuta") || n.includes("resumen de visita") || n.includes("relevamiento");
}

export function registerMinutaTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "minuta_lead",
    {
      title: "Minuta de relevamiento del cliente",
      description:
        "Devuelve el TEXTO COMPLETO de la minuta de la visita técnica de un cliente " +
        "potencial: relevamiento del techo con sus medidas, instalación eléctrica, " +
        "recorrido de la bajada, observaciones y pendientes. No es un resumen: es el " +
        "documento entero. Usar antes de una visita o cuando se pregunta por cualquier " +
        "detalle del relevamiento que no esté en la ficha.",
      inputSchema: {
        lead_id: z.string().min(1).describe("Identificador del cliente potencial"),
        documento_id: z
          .string()
          .optional()
          .describe("Una minuta concreta. Por defecto, la más reciente."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lead_id, documento_id }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        select: { id: true, code: true, clientName: true, address: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);

      const adjuntos = await prisma.fileAttachment.findMany({
        where: { leadId: lead.id, deletedAt: null, mimeType: "application/pdf" },
        select: {
          id: true,
          filename: true,
          tipo: true,
          toolSource: true,
          url: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const minutas = adjuntos.filter(esMinuta);
      if (minutas.length === 0) {
        // Puede haber PDFs que no son minutas (una propuesta vieja, una factura).
        const otros = adjuntos.length > 0
          ? ` Sí hay ${adjuntos.length} PDF adjunto${adjuntos.length > 1 ? "s" : ""}: ` +
            `${adjuntos.map((a) => a.filename).join(", ")}. Podés verlos con documentos_lead.`
          : "";
        return texto(`${lead.clientName} no tiene ninguna minuta de visita cargada.${otros}`);
      }

      const elegida = documento_id
        ? minutas.find((m) => m.id === documento_id)
        : minutas[0];
      if (!elegida) {
        return texto(
          `No encontré esa minuta en ${lead.clientName}. Las que hay: ` +
            minutas.map((m) => `${m.filename} (id: ${m.id})`).join(", "),
        );
      }

      const ruta = getStoredFilePath(elegida.url);
      if (!fs.existsSync(ruta)) {
        return texto(
          `La minuta "${elegida.filename}" está registrada pero el archivo no está ` +
            `disponible en el servidor.`,
        );
      }

      let contenido: string;
      try {
        contenido = await extractTextFromPdf(await readFile(ruta));
      } catch {
        // Típicamente un escaneado sin OCR: no hay texto que leer, solo el
        // enlace para que lo abra una persona.
        return texto(
          `No pude leer el texto de "${elegida.filename}" — probablemente sea un ` +
            `escaneado sin reconocimiento de texto.`,
          `Para abrirlo a mano (el enlace vence en 15 minutos):\n` +
            buildDownloadUrl(user.id, "lead-file", elegida.id),
        );
      }

      const recortado = contenido.length > TOPE_TEXTO;
      const cuerpo = recortado ? contenido.slice(0, TOPE_TEXTO) : contenido;

      const cabecera = campos([
        ["Cliente", `${lead.clientName} [${lead.code}]`],
        ["Dirección", lead.address],
        ["Documento", elegida.filename],
        ["Cargada el", fechaCorta(elegida.createdAt)],
        [
          "Otras versiones",
          minutas.length > 1
            ? minutas
                .filter((m) => m.id !== elegida.id)
                .map((m) => `${m.filename} (id: ${m.id})`)
                .join(", ")
            : null,
        ],
      ]);

      return texto(
        cabecera,
        "─".repeat(60),
        cuerpo,
        recortado
          ? `─ El documento sigue: se muestran los primeros ${TOPE_TEXTO.toLocaleString("es-UY")} ` +
            `caracteres de ${contenido.length.toLocaleString("es-UY")}. ─`
          : null,
      );
    },
  );

  server.registerTool(
    "documentos_lead",
    {
      title: "Adjuntos del cliente potencial",
      description:
        "Lista los archivos adjuntos de un cliente potencial: minutas, fotos de la " +
        "visita, videos y documentos. De los PDF con texto devuelve además su " +
        "contenido, para poder leerlos sin abrir nada. Para la minuta completa conviene " +
        "usar minuta_lead directamente.",
      inputSchema: {
        lead_id: z.string().min(1),
        incluir_texto: z
          .boolean()
          .optional()
          .describe("Extraer el texto de los PDF. Por defecto sí."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ lead_id, incluir_texto }) => {
      await requirePermission(user, Module.VENTAS, Action.VIEW);

      const lead = await prisma.salesLead.findFirst({
        where: { id: lead_id, deletedAt: null },
        select: { id: true, code: true, clientName: true },
      });
      if (!lead) return texto(`No encontré ningún cliente potencial con el id ${lead_id}.`);

      const adjuntos = await prisma.fileAttachment.findMany({
        where: { leadId: lead.id, deletedAt: null },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          tipo: true,
          toolSource: true,
          url: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const videos = await prisma.projectVideo.findMany({
        where: { leadId: lead.id, deletedAt: null },
        select: { tipoVideo: true, descripcion: true, durationSeconds: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      if (adjuntos.length === 0 && videos.length === 0) {
        return texto(`${lead.clientName} no tiene adjuntos cargados.`);
      }

      // Las fotos se cuentan, no se listan una por una: son decenas y no se
      // pueden leer por voz de todos modos.
      const fotos = adjuntos.filter((a) => a.mimeType?.startsWith("image/"));
      const pdfs = adjuntos.filter((a) => a.mimeType === "application/pdf");
      const otros = adjuntos.filter(
        (a) => !a.mimeType?.startsWith("image/") && a.mimeType !== "application/pdf",
      );

      const bloques: string[] = [];

      for (const p of pdfs) {
        const meta = `${p.filename} · ${fechaCorta(p.createdAt)} · ${Math.round((p.sizeBytes ?? 0) / 1024)} KB (id: ${p.id})`;
        if (incluir_texto === false) {
          bloques.push(`- ${meta}`);
          continue;
        }
        const ruta = getStoredFilePath(p.url);
        if (!fs.existsSync(ruta)) {
          bloques.push(`- ${meta}\n  (el archivo no está disponible en el servidor)`);
          continue;
        }
        try {
          const t = await extractTextFromPdf(await readFile(ruta));
          const recorte = t.length > 20_000 ? `${t.slice(0, 20_000)}\n[…continúa]` : t;
          bloques.push(`- ${meta}\n\n${recorte}`);
        } catch {
          bloques.push(
            `- ${meta}\n  Sin texto extraíble (escaneado). Enlace: ` +
              buildDownloadUrl(user.id, "lead-file", p.id),
          );
        }
      }

      return texto(
        `Adjuntos de ${lead.clientName} [${lead.code}]`,
        fotos.length > 0 ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} de la visita.` : null,
        videos.length > 0
          ? `VIDEOS\n` +
            videos
              .map(
                (v) =>
                  `- ${v.tipoVideo}${v.descripcion ? `: ${v.descripcion}` : ""}` +
                  (v.durationSeconds ? ` (${Math.round(v.durationSeconds)} s)` : ""),
              )
              .join("\n")
          : null,
        otros.length > 0
          ? `OTROS\n${otros.map((o) => `- ${o.filename} (id: ${o.id})`).join("\n")}`
          : null,
        bloques.length > 0 ? `DOCUMENTOS\n\n${bloques.join("\n\n")}` : null,
      );
    },
  );
}
