// Facturación al cliente por chat (pedido de Nicolás del 19-nov-2026): emitir
// la factura de un proyecto por Biller y, a pedido, mandar el PDF por WhatsApp.
//
// Es un documento fiscal: NADA se emite sin la vista previa con los datos
// exactos y la confirmación del usuario. El borrador sale del MISMO servicio
// que la pantalla de Finanzas (armarBorradorFactura → emitirCfe), con todas sus
// validaciones y sus frenos contra la doble emisión.

import { readFile } from "node:fs/promises";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, EstadoCfeEmitido, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  ETIQUETA_TIPO,
  armarBorradorFactura,
  datosRutDgi,
  emitirCfe,
  guardarPdf,
  totalesBorrador,
  validarBorrador,
  type BorradorCfe,
} from "../../../services/biller/cfe-emitidos.service.js";
import { getStoredFilePath } from "../../../services/file-storage.service.js";
import { normalizarTelefono, ventanaAbierta } from "../../../services/whatsapp-cloud/api.service.js";
import { bandejaDeNumero, mandarArchivo } from "../../../services/whatsapp-cloud/bandejas.service.js";
import { buscarChat, elegirNumero } from "../../../services/whatsapp-cloud/secretario.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { texto, usd } from "../format.js";
import { aplicarCambios, huellaBorrador, primerTelefono, type CambiosFactura } from "./facturacion.logic.js";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const VIVOS: EstadoCfeEmitido[] = [EstadoCfeEmitido.ESPERANDO_DGI, EstadoCfeEmitido.ACEPTADO];

/** Proyecto por id, código (PRY-…) o nombre del cliente. Si hay varios, pide precisión. */
async function proyectoDe(q: string) {
  const s = q.trim();
  const porId = await prisma.project.findFirst({
    where: { deletedAt: null, OR: [{ id: s }, { code: { equals: s, mode: "insensitive" } }] },
    select: { id: true, code: true, clientName: true, clientPhone: true },
  });
  if (porId) return porId;
  const varios = await prisma.project.findMany({
    where: { deletedAt: null, clientName: { contains: s, mode: "insensitive" } },
    select: { id: true, code: true, clientName: true, clientPhone: true },
    take: 6,
  });
  if (varios.length === 1) return varios[0];
  if (!varios.length) throw new Error(`No encontré ningún proyecto "${s}".`);
  throw new Error(`Hay varios proyectos con "${s}": ${varios.map((p) => `${p.code} ${p.clientName}`).join("; ")}. Decime cuál (el código).`);
}

function resumenBorrador(b: BorradorCfe) {
  const t = totalesBorrador(b);
  const doc = b.cliente.tipoDocumento === 2 ? "RUT" : "Cédula";
  return [
    `Comprobante: ${ETIQUETA_TIPO[b.tipoCfe] ?? b.tipoCfe} · ${b.formaPago === 1 ? "Contado" : `Crédito, vence ${b.fechaVencimiento}`} · emisión ${b.fechaEmision} · ${b.moneda}`,
    `A nombre de: ${b.cliente.nombre} · ${doc} ${b.cliente.documento || "(FALTA)"}${b.receptor === "TERCERO" ? " (un tercero, no el cliente del proyecto)" : ""}`,
    `Domicilio: ${b.cliente.direccion}, ${b.cliente.ciudad}, ${b.cliente.departamento}`,
    ...b.items.map((i) => `Renglón: ${i.concepto} · ${i.cantidad} × ${usd(i.precio)} sin IVA`),
    `Neto ${usd(t.neto)} + IVA ${usd(t.iva)} = TOTAL ${usd(t.total)}`,
    b.adenda ? `Adenda: ${b.adenda}` : null,
  ].filter(Boolean) as string[];
}

export function registerFacturacionTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "facturar_proyecto",
    {
      title: "Facturar un proyecto (Biller)",
      description:
        "Emite la factura electrónica (e-Factura con RUT o e-Ticket con cédula) de un proyecto por Biller, igual que " +
        "el botón Emitir de Finanzas → Facturación. ES UN DOCUMENTO FISCAL: llamala primero SIN `confirmar` para " +
        "obtener la vista previa con todos los datos, mostrásela COMPLETA al usuario y emití solo cuando él diga que " +
        "sí, pasando `confirmar: true` y la `huella` de esa vista previa. Si algo cambió entre medio, no emite y " +
        "devuelve la vista previa nueva. Los datos salen de la ficha del proyecto y de 'qué se le factura' (lo que " +
        "falta facturar, sin IVA); se pueden corregir con los parámetros. Si el proyecto tiene mail, Biller le manda " +
        "la factura por mail. Un proyecto tiene una sola factura: para corregir una emitida hace falta una nota de " +
        "crédito, que se hace desde la pantalla.",
      inputSchema: {
        proyecto: z.string().trim().min(2).describe("Código (PRY-…), id o nombre del cliente"),
        documento: z.string().trim().min(6).max(20).optional().describe("Cédula o RUT (12 dígitos = RUT → e-Factura)"),
        nombre: z.string().trim().min(2).max(70).optional().describe("Nombre o razón social. Con RUT, por defecto el registrado en DGI"),
        direccion: z.string().trim().min(2).max(70).optional(),
        ciudad: z.string().trim().min(2).max(30).optional(),
        departamento: z.string().trim().min(2).max(30).optional(),
        tercero: z.boolean().optional().describe("true = se le factura a otra persona o empresa, no al cliente del proyecto (pasar su documento)"),
        monto_sin_iva_usd: z.number().positive().optional().describe("Monto SIN IVA. Por defecto, lo que falta facturar de lo acordado"),
        concepto: z.string().trim().min(3).max(80).optional(),
        fecha_emision: z.string().regex(FECHA).optional().describe("AAAA-MM-DD. Por defecto hoy"),
        fecha_vencimiento: z.string().regex(FECHA).optional().describe("Solo si es a crédito (AAAA-MM-DD). Sin esto, contado"),
        email: z.string().trim().email().optional().describe("Mail al que Biller manda la factura. Por defecto el del proyecto"),
        sin_mail: z.literal(true).optional().describe("No mandar la factura por mail"),
        confirmar: z.literal(true).optional().describe("Solo después de que el usuario aprobó la vista previa"),
        huella: z.string().trim().length(8).optional().describe("La huella que devolvió la vista previa aprobada"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ proyecto, confirmar, huella, ...cambios }) => {
      await requirePermission(user, Module.FINANZAS, Action.EDIT);
      const p = await proyectoDe(proyecto);
      const armado = await armarBorradorFactura(p.id);
      if (armado.facturaVigente) {
        return texto(`${p.code} ${p.clientName} ya tiene una factura emitida. Para corregirla hace falta una nota de crédito (desde Finanzas → Facturación).`);
      }

      // Con RUT, nombre y domicilio salen de DGI salvo que se pasen.
      const c: CambiosFactura = { ...cambios };
      const doc = (c.documento ?? armado.borrador.cliente.documento).replace(/\D/g, "");
      let dgi: Awaited<ReturnType<typeof datosRutDgi>> = null;
      if (doc.length === 12) {
        dgi = await datosRutDgi(doc);
        if (dgi?.razonSocial && c.nombre == null) c.nombre = dgi.razonSocial;
        if (c.tercero && dgi) {
          c.direccion ??= dgi.direccion || undefined;
          c.ciudad ??= dgi.ciudad || undefined;
          c.departamento ??= dgi.departamento || undefined;
        }
      }
      const b = aplicarCambios(armado.borrador, c);
      const problemas = validarBorrador(b);
      if (!b.cliente.documento) {
        const i = problemas.findIndex((x) => x.startsWith("La cédula no es válida"));
        if (i >= 0) problemas.splice(i, 1);
        problemas.unshift("Falta la cédula o el RUT del cliente (no está en la ficha): pasalo en `documento`");
      }
      if (!b.cliente.direccion || !b.cliente.ciudad || !b.cliente.departamento) problemas.unshift("Falta el domicilio (dirección, ciudad y departamento)");
      const h = huellaBorrador(b);

      const fuente: Record<string, string> = {
        A_FACTURAR: "lo que falta facturar de lo acordado al ganar",
        COTIZACION: `la última propuesta publicada (v${armado.base.version}), porque 'qué se le factura' está a definir`,
        PRESUPUESTO: "el presupuesto sin IVA, porque no hay propuesta ni 'qué se le factura'",
      };
      const mail = !b.emailCliente
        ? "No se manda por mail (el proyecto no tiene mail o se pidió que no)."
        : armado.emision.ambiente === "PRODUCCION"
          ? `Biller le manda la factura por mail a ${b.emailCliente}.`
          : `Ambiente de PRUEBA: no se manda mail (iría a ${b.emailCliente}).`;

      if (!confirmar || huella !== h) {
        const encabezado = confirmar && huella !== h
          ? "NO SE EMITIÓ: los datos cambiaron desde la vista previa aprobada (o la huella no coincide). Esta es la vista previa nueva; mostrásela al usuario y confirmá de nuevo."
          : "Vista previa de la factura — todavía NO se emitió nada. Mostrale estos datos al usuario y emití solo si confirma.";
        return texto(
          encabezado,
          [
            `Proyecto: ${p.code} ${p.clientName}`,
            ...resumenBorrador(b),
            c.monto_sin_iva_usd == null && armado.base.fuente ? `El monto sale de ${fuente[armado.base.fuente]}.` : null,
            c.monto_sin_iva_usd == null && !armado.base.fuente
              ? "SIN MONTO: 'qué se le factura' está a definir y no hay propuesta ni presupuesto. Preguntale al usuario el monto sin IVA (monto_sin_iva_usd)."
              : null,
            armado.acordado.modo === "A_DEFINIR" ? "Ojo: en la ficha, 'qué se le factura' está A DEFINIR (Ventas no lo cargó)." : null,
            armado.acordado.yaFacturadoSinIva > 0 ? `Ya facturado antes, sin IVA: ${usd(armado.acordado.yaFacturadoSinIva)}.` : null,
            armado.nota ? `Nota de Ventas sobre la factura: ${armado.nota}` : null,
            dgi && c.tercero ? `Datos del RUT tomados de DGI.` : null,
            mail,
            !armado.emision.habilitada ? `OJO: la emisión no está habilitada en este servidor (${armado.emision.motivo}).` : null,
            problemas.length ? `NO SE PUEDE EMITIR así: ${problemas.join(". ")}.` : `Para emitir: confirmar: true, huella: "${h}".`,
          ].filter(Boolean).join("\n"),
        );
      }

      if (problemas.length) return texto(`No se emitió: ${problemas.join(". ")}.`);
      const cfe = await emitirCfe({ projectId: p.id, borrador: b, userId: user.id });
      // El PDF puede tardar: si Biller todavía no lo tiene, queda para cuando la DGI lo acepte.
      const pdf = await guardarPdf(cfe.id).catch(() => null);
      return texto(
        `Factura emitida: ${cfe.tipoLabel} ${cfe.serie ?? ""}-${cfe.numero ?? ""} · ${usd(cfe.total)} · ${p.code} ${p.clientName}.`,
        [
          `Estado: ${cfe.estado === "ACEPTADO" ? "aceptada por la DGI" : "esperando a la DGI (se actualiza sola cada 5 minutos)"}.`,
          mail.replace("le manda", "le manda (o le mandará)"),
          pdf ? "El PDF quedó en los documentos del proyecto." : "El PDF todavía no está en Biller; queda en los documentos del proyecto cuando la DGI la acepte.",
          "Si la quieren por WhatsApp: enviar_factura_whatsapp.",
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "enviar_factura_whatsapp",
    {
      title: "Mandar la factura por WhatsApp",
      description:
        "Manda el PDF de la factura emitida de un proyecto por WhatsApp, desde un número de Voltia (por defecto el de " +
        "quien pregunta) al teléfono del cliente o al que se indique. SOLO cuando el usuario lo pide. Sin `confirmar` " +
        "muestra a quién, desde qué número y qué archivo; con `confirmar: true`, lo manda. WhatsApp solo deja mandarlo " +
        "si esa persona escribió a ese número en las últimas 24 horas.",
      inputSchema: {
        proyecto: z.string().trim().min(2).describe("Código (PRY-…), id o nombre del cliente"),
        quien: z.string().trim().min(2).max(80).optional().describe("Teléfono o nombre. Por defecto el teléfono del proyecto"),
        numero: z.string().trim().max(40).optional().describe("Desde qué número de Voltia (teléfono o responsable)"),
        mensaje: z.string().trim().max(1000).optional().describe("Texto que acompaña al PDF"),
        confirmar: z.literal(true).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ proyecto, quien, numero, mensaje, confirmar }) => {
      await requirePermission(user, Module.FINANZAS, Action.VIEW);
      const p = await proyectoDe(proyecto);
      const factura = await prisma.cfeEmitido.findFirst({
        where: { projectId: p.id, referenciaId: null, estado: { in: VIVOS } },
        orderBy: { createdAt: "desc" },
      });
      if (!factura) return texto(`${p.code} ${p.clientName} no tiene una factura emitida.`);
      const adjunto = await guardarPdf(factura.id);
      if (!adjunto) return texto("La factura todavía no tiene PDF en Biller (espera a la DGI). Probá en unos minutos.");

      const destino = quien ?? primerTelefono(p.clientPhone);
      if (!destino) return texto(`El proyecto no tiene teléfono: decime a qué número mandarla (\`quien\`).`);
      const n = await elegirNumero({ id: user.id, role: user.role }, numero);
      const tel = await buscarChat(n.phoneNumberId, destino);
      const abierta = await ventanaAbierta(normalizarTelefono(tel), n.phoneNumberId);
      const nombre = `${ETIQUETA_TIPO[factura.tipoCfe] ?? "Factura"} ${factura.serie}-${factura.numero}.pdf`;

      if (!confirmar) {
        return texto(
          "Vista previa — todavía NO se mandó nada.",
          [
            `Archivo: ${nombre} (${usd(Number(factura.total))}, ${p.code} ${p.clientName})`,
            `Desde: ${n.telefono} · A: +${tel}`,
            mensaje ? `Mensaje: ${mensaje}` : "Sin mensaje (solo el PDF)",
            abierta
              ? "Para mandarla: confirmar: true."
              : "NO SE PUEDE MANDAR: esa persona no escribió a este número en las últimas 24 horas (regla de WhatsApp). Que escriba primero, o mandala por mail.",
          ].join("\n"),
        );
      }
      if (!abierta) return texto("No se mandó: esa persona no escribió a este número en las últimas 24 horas (regla de WhatsApp).");
      const bytes = await readFile(getStoredFilePath(adjunto.url));
      const bandeja = await bandejaDeNumero(n.phoneNumberId);
      const m = await mandarArchivo(
        bandeja,
        { telefono: tel, archivo: { bytes, mime: "application/pdf", nombre }, caption: mensaje ?? null },
        user.id,
      );
      return texto(`Factura mandada por WhatsApp desde ${n.telefono} a +${tel} (estado: ${m.estado ?? "aceptado"}).`);
    },
  );
}
