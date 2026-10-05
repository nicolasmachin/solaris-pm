// Leer los adjuntos de un proyecto o de un cliente potencial desde el chat.
//
// El caso de uso que la pide: la ingeniería de una obra vive en los PDF que se
// suben al proyecto (memoria, planos, listas de materiales, proyecto final).
// Con esto se traen al chat y se pueden volver a analizar sin descargarlos.
//
// El contenido lo resuelve `services/documentos/lectura.service.ts`: PDF con
// texto → texto; planilla → filas; imagen → la imagen reducida; unifilar →
// el plano vuelto a dibujar, porque en PDF no tiene texto. Un escaneado no se
// puede leer acá y se devuelve su enlace.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { leerContenidoAdjunto } from "../../../services/documentos/lectura.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { contenido, fechaCorta, imagen, texto } from "../format.js";

/** Tope de caracteres de texto por documento en una llamada con varios. */
const TOPE_POR_DOCUMENTO = 30_000;
/** Tope de texto de toda la respuesta: el resultado de una herramienta se corta. */
const TOPE_TOTAL = 120_000;
/** Imágenes por llamada: cada una pesa, y más de esto no se mira de a una. */
const TOPE_IMAGENES = 4;

function kb(bytes: number | null | undefined) {
  return bytes ? `${Math.round(bytes / 1024)} KB` : null;
}

function etiqueta(a: {
  filename: string;
  createdAt: Date;
  sizeBytes: number | null;
  toolSource: string | null;
  toolVersion: number | null;
}) {
  const origen = a.toolSource ? ` · ${a.toolSource}${a.toolVersion ? ` v${a.toolVersion}` : ""}` : "";
  const peso = kb(a.sizeBytes);
  return `${a.filename} · ${fechaCorta(a.createdAt)}${peso ? ` · ${peso}` : ""}${origen}`;
}

export function registerDocumentosTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "leer_documentos",
    {
      title: "Leer documentos adjuntos",
      description:
        "Trae el CONTENIDO de los adjuntos de un proyecto o de un cliente potencial, para " +
        "poder analizarlos en el chat: memorias, planos, listas de materiales, informes, " +
        "proyecto final de ingeniería. De los PDF con texto devuelve el texto; de las " +
        "planillas, las filas; de las fotos y planos escaneados en imagen, la imagen. " +
        "Los ids salen de documentos_proyecto o de documentos_lead. Se pueden pedir varios " +
        "de una (hasta 10). Si un documento es largo se corta y se avisa: con `parte` se " +
        "piden los pedazos siguientes.",
      inputSchema: {
        documento_ids: z
          .array(z.string().min(1))
          .min(1)
          .max(10)
          .describe("Ids de los adjuntos, como los devuelve documentos_proyecto."),
        parte: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Para seguir leyendo un documento largo. Solo con un documento por vez."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ documento_ids, parte }) => {
      const ids = [...new Set(documento_ids)];
      const adjuntos = await prisma.fileAttachment.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          url: true,
          createdAt: true,
          toolSource: true,
          toolVersion: true,
          toolEntityId: true,
          projectId: true,
          leadId: true,
          project: { select: { clientName: true, code: true } },
          lead: { select: { clientName: true, code: true } },
        },
      });

      if (adjuntos.length === 0) {
        return texto(
          "No encontré ninguno de esos documentos. Los ids salen de documentos_proyecto o documentos_lead.",
        );
      }

      // El permiso es el del dueño del archivo: la obra se mira con el permiso
      // de obra y el cliente potencial con el de ventas, igual que las
      // herramientas que los listan.
      if (adjuntos.some((a) => a.projectId)) {
        await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      }
      if (adjuntos.some((a) => a.leadId)) {
        await requirePermission(user, Module.VENTAS, Action.VIEW);
      }

      if (parte !== undefined && adjuntos.length > 1) {
        return texto("`parte` funciona con un documento por vez. Pedí ese documento solo.");
      }

      const bloques: Array<{ type: "text"; text: string } | ReturnType<typeof imagen>> = [];
      const faltantes = ids.filter((id) => !adjuntos.some((a) => a.id === id));
      const dueño = adjuntos[0].project ?? adjuntos[0].lead;
      bloques.push({
        type: "text",
        text:
          `${adjuntos.length} documento${adjuntos.length > 1 ? "s" : ""}` +
          (dueño ? ` de ${dueño.clientName} [${dueño.code}]` : "") +
          (faltantes.length ? ` (${faltantes.length} no existe${faltantes.length > 1 ? "n" : ""})` : ""),
      });

      let presupuesto = TOPE_TOTAL;
      let imagenes = 0;

      for (const a of adjuntos) {
        const cabecera = etiqueta(a);
        const enlace = buildDownloadUrl(
          user.id,
          a.projectId ? "project-file" : "lead-file",
          a.id,
          a.filename,
        );
        const contenidoAdjunto = await leerContenidoAdjunto(a);

        if (contenidoAdjunto.tipo === "no-legible") {
          bloques.push({
            type: "text",
            text: `## ${cabecera}\nNo se puede leer acá: ${contenidoAdjunto.motivo}.\nEnlace (vence en 15 minutos): ${enlace}`,
          });
          continue;
        }

        if (contenidoAdjunto.tipo === "imagen") {
          const entran = contenidoAdjunto.imagenes.slice(0, Math.max(0, TOPE_IMAGENES - imagenes));
          if (entran.length === 0) {
            bloques.push({
              type: "text",
              text: `## ${cabecera}\nQuedó afuera: en una misma consulta entran hasta ${TOPE_IMAGENES} imágenes. Pedila sola.`,
            });
            continue;
          }
          imagenes += entran.length;
          const faltan = contenidoAdjunto.imagenes.length - entran.length;
          bloques.push({
            type: "text",
            text:
              `## ${cabecera}` +
              (contenidoAdjunto.nota ? `\n${contenidoAdjunto.nota}` : "") +
              (contenidoAdjunto.imagenes.length > 1 ? `\n${contenidoAdjunto.imagenes.length} hojas.` : "") +
              (faltan > 0 ? ` Entran ${entran.length}: pedí este documento solo para ver las ${faltan} que faltan.` : ""),
          });
          for (const img of entran) bloques.push(imagen(img.base64, img.mediaType));
          continue;
        }

        // Texto: se corta por documento y por respuesta. `parte` pagina un
        // documento largo pedido solo.
        const completo = contenidoAdjunto.texto;
        const tope = adjuntos.length === 1 ? Math.min(TOPE_TOTAL, presupuesto) : Math.min(TOPE_POR_DOCUMENTO, presupuesto);
        const partes = Math.max(1, Math.ceil(completo.length / tope));
        const indice = Math.min(parte ?? 1, partes);
        const recorte = completo.slice((indice - 1) * tope, indice * tope);
        presupuesto -= recorte.length;

        const aviso =
          partes > 1
            ? `\n\n[Parte ${indice} de ${partes}. Para seguir: leer_documentos con documento_ids ["${a.id}"] y parte ${indice + 1}.]`
            : "";
        bloques.push({ type: "text", text: `## ${cabecera}\n\n${recorte}${aviso}` });

        if (presupuesto <= 0) {
          bloques.push({
            type: "text",
            text: "Se llenó el espacio de la respuesta. Pedí el resto de los documentos en otra consulta.",
          });
          break;
        }
      }

      return contenido(bloques);
    },
  );
}
