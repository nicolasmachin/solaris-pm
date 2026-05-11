// Consolidador de materiales: herramienta global del módulo Ingeniería que
// agrupa las listas de materiales de varios proyectos en una sola tabla
// (ítem × proyecto + total) y produce PDF + Excel descargables.
//
// A diferencia de las herramientas por proyecto (unifilar, pre-ing, etc.),
// los archivos NO se asocian a un Project — viven en
// `${STORAGE_PATH}/ingenieria/consolidados/`. La autorización va por permiso
// del módulo (INGENIERIA.VIEW para ver / EDIT para crear / DELETE para borrar).

import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { Action, Module } from "@prisma/client";
import ExcelJS from "exceljs";
import type { FastifyInstance } from "fastify";
import PDFDocument from "pdfkit";
import { z } from "zod";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize, authorizeAny } from "../middleware/authorize.middleware.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

function consolidadosDir(): string {
  return path.resolve(process.cwd(), "..", env.storagePath, "ingenieria", "consolidados");
}

function decimalToNumber(d: { toNumber: () => number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

// ─── Snapshot types ─────────────────────────────────────────────────────────

interface ProjectSnapshot {
  id: string;
  nombreCliente: string;
  potenciaKwp: number;
  ubicacion: string;
}

interface ItemConsolidado {
  catalogItemId: string;
  nombre: string;
  categoria: string;
  categoriaOrden: number;
  unidad: string;
  cantidadesPorProyecto: Record<string, number>;
  cantidadTotal: number;
}

// ─── Algoritmo de consolidación ─────────────────────────────────────────────

async function buildConsolidation(projectIds: string[]): Promise<{
  projects: ProjectSnapshot[];
  items: ItemConsolidado[];
}> {
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, deletedAt: null },
    select: {
      id: true,
      clientName: true,
      capacityKwp: true,
      locationCity: true,
      locationProvince: true,
    },
  });

  const projectsSnapshot: ProjectSnapshot[] = projects
    .sort((a, b) => projectIds.indexOf(a.id) - projectIds.indexOf(b.id))
    .map((p) => ({
      id: p.id,
      nombreCliente: p.clientName,
      potenciaKwp: decimalToNumber(p.capacityKwp),
      ubicacion: `${p.locationCity}, ${p.locationProvince}`,
    }));

  const materials = await prisma.projectMaterial.findMany({
    where: { projectId: { in: projectIds } },
    include: {
      materialItem: {
        include: {
          category: { select: { id: true, nombre: true, orden: true } },
        },
      },
    },
  });

  // Agrupación por catalogItemId
  const itemsMap = new Map<string, ItemConsolidado>();
  for (const pm of materials) {
    const item = pm.materialItem;
    if (!item) continue;
    const key = item.id;
    if (!itemsMap.has(key)) {
      itemsMap.set(key, {
        catalogItemId: item.id,
        nombre: item.nombre,
        categoria: item.category?.nombre ?? "Sin categoría",
        categoriaOrden: item.category?.orden ?? 9999,
        unidad: item.unidad,
        cantidadesPorProyecto: {},
        cantidadTotal: 0,
      });
    }
    const consolidated = itemsMap.get(key)!;
    const qty = decimalToNumber(pm.quantity);
    consolidated.cantidadesPorProyecto[pm.projectId] =
      (consolidated.cantidadesPorProyecto[pm.projectId] ?? 0) + qty;
    consolidated.cantidadTotal += qty;
  }

  // Ordenar por categoriaOrden, luego por nombre
  const items = Array.from(itemsMap.values()).sort((a, b) => {
    if (a.categoriaOrden !== b.categoriaOrden) return a.categoriaOrden - b.categoriaOrden;
    if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
    return a.nombre.localeCompare(b.nombre);
  });

  return { projects: projectsSnapshot, items };
}

// ─── Generador de PDF ──────────────────────────────────────────────────────

function generateConsolidadoPdf(
  versionNumber: number,
  label: string | null,
  projects: ProjectSnapshot[],
  items: ItemConsolidado[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const landscape = projects.length >= 4;
    const doc = new PDFDocument({
      size: "A4",
      layout: landscape ? "landscape" : "portrait",
      margin: 35,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const COLOR_PRIMARY = "#1e40af";

    // ── Header
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#000");
    doc.text(`VOLTIA · Consolidado de materiales v${versionNumber}`, { align: "left" });
    if (label) {
      doc.font("Helvetica").fontSize(11).fillColor("#444").text(label);
    }
    doc.font("Helvetica").fontSize(9).fillColor("#666");
    doc.text(`Generado: ${new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "2-digit" })}`);
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9).fillColor("#000");
    doc.text(
      `Proyectos incluidos (${projects.length}): ${projects
        .map((p) => `${p.nombreCliente} (${p.potenciaKwp} kWp)`)
        .join(" · ")}`,
    );
    doc.moveDown(0.6);

    // ── Tabla por categoría
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colItem = Math.floor(pageWidth * 0.35);
    const colTotal = 60;
    const colsForProjects = pageWidth - colItem - colTotal;
    const colProjectW = Math.floor(colsForProjects / projects.length);

    let groupedByCat: Record<string, ItemConsolidado[]> = {};
    for (const it of items) {
      if (!groupedByCat[it.categoria]) groupedByCat[it.categoria] = [];
      groupedByCat[it.categoria].push(it);
    }

    const categories = Object.entries(groupedByCat).sort((a, b) => {
      const oa = a[1][0]?.categoriaOrden ?? 9999;
      const ob = b[1][0]?.categoriaOrden ?? 9999;
      if (oa !== ob) return oa - ob;
      return a[0].localeCompare(b[0]);
    });

    const ROW_H = 18;
    const PAGE_BOTTOM = doc.page.height - doc.page.margins.bottom - 10;

    function drawCategoryHeader(cat: string) {
      ensureSpace(ROW_H + 10);
      const y = doc.y;
      doc.save();
      doc.rect(doc.page.margins.left, y, pageWidth, 18).fill(COLOR_PRIMARY);
      doc
        .fillColor("#fff")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(cat.toUpperCase(), doc.page.margins.left + 5, y + 5, {
          width: pageWidth - 10,
          lineBreak: false,
        });
      doc.restore();
      doc.y = y + 18 + 2;
    }

    function drawTableHeader() {
      ensureSpace(ROW_H + 4);
      const y = doc.y;
      const x0 = doc.page.margins.left;
      doc.save();
      doc.rect(x0, y, pageWidth, ROW_H).fillAndStroke("#eef2ff", "#c7d2e6");
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(8);
      doc.text("Ítem", x0 + 4, y + 5, { width: colItem - 8, lineBreak: false });
      let xCursor = x0 + colItem;
      for (const p of projects) {
        doc.text(p.nombreCliente, xCursor + 2, y + 5, {
          width: colProjectW - 4,
          align: "right",
          lineBreak: false,
        });
        xCursor += colProjectW;
      }
      doc.text("TOTAL", xCursor + 2, y + 5, {
        width: colTotal - 4,
        align: "right",
        lineBreak: false,
      });
      doc.restore();
      doc.y = y + ROW_H;
    }

    function drawRow(item: ItemConsolidado) {
      ensureSpace(ROW_H);
      const y = doc.y;
      const x0 = doc.page.margins.left;
      doc.save();
      doc.lineWidth(0.3).strokeColor("#d0d7e2");
      doc.moveTo(x0, y + ROW_H).lineTo(x0 + pageWidth, y + ROW_H).stroke();
      doc.fillColor("#000").font("Helvetica").fontSize(8.5);
      doc.text(item.nombre, x0 + 4, y + 5, { width: colItem - 8, lineBreak: false });
      doc.fillColor("#666").fontSize(7).text(item.unidad, x0 + 4, y + 12, { width: colItem - 8, lineBreak: false });
      let xCursor = x0 + colItem;
      doc.fillColor("#000").font("Helvetica").fontSize(9);
      for (const p of projects) {
        const qty = item.cantidadesPorProyecto[p.id] ?? 0;
        doc.text(qty > 0 ? formatQty(qty) : "—", xCursor + 2, y + 5, {
          width: colProjectW - 4,
          align: "right",
          lineBreak: false,
        });
        xCursor += colProjectW;
      }
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text(formatQty(item.cantidadTotal), xCursor + 2, y + 5, {
        width: colTotal - 4,
        align: "right",
        lineBreak: false,
      });
      doc.restore();
      doc.y = y + ROW_H;
    }

    function ensureSpace(needed: number) {
      if (doc.y + needed > PAGE_BOTTOM) {
        doc.addPage();
      }
    }

    if (categories.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor("#666").text("(Sin ítems)", { align: "center" });
    } else {
      for (const [cat, catItems] of categories) {
        drawCategoryHeader(cat);
        drawTableHeader();
        for (const it of catItems) drawRow(it);
        doc.moveDown(0.4);
      }
    }

    doc.end();
  });
}

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

// ─── Generador de Excel ────────────────────────────────────────────────────

async function generateConsolidadoXlsx(
  versionNumber: number,
  label: string | null,
  projects: ProjectSnapshot[],
  items: ItemConsolidado[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Voltia PM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Consolidado", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  // Header
  sheet.mergeCells(1, 1, 1, 2 + projects.length + 1);
  sheet.getCell(1, 1).value = `VOLTIA · Consolidado v${versionNumber}${label ? ` — ${label}` : ""}`;
  sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1E40AF" } };

  sheet.mergeCells(2, 1, 2, 2 + projects.length + 1);
  sheet.getCell(2, 1).value = `Generado: ${new Date().toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })} · ${projects.length} proyectos · ${items.length} ítems distintos`;
  sheet.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF555555" } };

  // Espaciado
  sheet.addRow([]);

  // Header de tabla
  const headerRow = sheet.addRow([
    "Ítem",
    "Unidad",
    ...projects.map((p) => p.nombreCliente),
    "TOTAL",
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" } };
  });
  // Ítem y unidad alineados a la izquierda
  headerRow.getCell(1).alignment = { horizontal: "left" };
  headerRow.getCell(2).alignment = { horizontal: "left" };

  // Agrupar por categoría
  const grouped: Record<string, ItemConsolidado[]> = {};
  for (const it of items) {
    if (!grouped[it.categoria]) grouped[it.categoria] = [];
    grouped[it.categoria].push(it);
  }
  const categories = Object.entries(grouped).sort((a, b) => {
    const oa = a[1][0]?.categoriaOrden ?? 9999;
    const ob = b[1][0]?.categoriaOrden ?? 9999;
    if (oa !== ob) return oa - ob;
    return a[0].localeCompare(b[0]);
  });

  for (const [cat, catItems] of categories) {
    const catRow = sheet.addRow([cat.toUpperCase(), ...Array(1 + projects.length + 1).fill("")]);
    catRow.font = { bold: true, color: { argb: "FF1E3A5F" } };
    catRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF2FF" },
    };
    sheet.mergeCells(catRow.number, 1, catRow.number, 2 + projects.length + 1);

    for (const it of catItems) {
      const rowValues: (string | number)[] = [it.nombre, it.unidad];
      for (const p of projects) {
        rowValues.push(it.cantidadesPorProyecto[p.id] ?? 0);
      }
      rowValues.push(it.cantidadTotal);
      const dataRow = sheet.addRow(rowValues);
      // Total en negrita
      dataRow.getCell(2 + projects.length + 1).font = { bold: true };
    }
  }

  // Auto-ancho
  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 8;
  for (let i = 0; i < projects.length; i++) {
    sheet.getColumn(3 + i).width = Math.max(12, projects[i].nombreCliente.length + 2);
  }
  sheet.getColumn(2 + projects.length + 1).width = 10;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ─── Schemas de validación ──────────────────────────────────────────────────

const createBodySchema = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  projectIds: z.array(z.string().min(1)).min(2, "Seleccioná al menos 2 proyectos"),
});

// ─── Rutas ──────────────────────────────────────────────────────────────────

export async function registerConsolidadorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ── Listar proyectos elegibles ─────────────────────────────────────────
  app.get(
    "/ingenieria/materiales-consolidados/proyectos-elegibles",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async () => {
      // Proyectos no eliminados con al menos un ProjectMaterial.
      const projects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          projectMaterials: { some: {} },
        },
        select: {
          id: true,
          clientName: true,
          capacityKwp: true,
          locationCity: true,
          locationProvince: true,
          projectMaterials: {
            select: { updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
          _count: { select: { projectMaterials: true } },
        },
        orderBy: { clientName: "asc" },
      });

      return {
        projects: projects.map((p) => ({
          id: p.id,
          nombreCliente: p.clientName,
          potenciaKwp: decimalToNumber(p.capacityKwp),
          ubicacion: `${p.locationCity}, ${p.locationProvince}`,
          cantidadItems: p._count.projectMaterials,
          ultimaActualizacion: p.projectMaterials[0]
            ? serializeDate(p.projectMaterials[0].updatedAt)
            : null,
        })),
      };
    },
  );

  // ── Listar consolidados ─────────────────────────────────────────────────
  app.get(
    "/ingenieria/materiales-consolidados",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async () => {
      const versions = await prisma.materialesConsolidadosVersion.findMany({
        orderBy: { versionNumber: "desc" },
      });
      return {
        versions: versions.map((v) => {
          const projectsArr = (v.projectsSnapshot as ProjectSnapshot[] | null) ?? [];
          const itemsArr = (v.itemsSnapshot as ItemConsolidado[] | null) ?? [];
          return {
            id: v.id,
            versionNumber: v.versionNumber,
            label: v.label,
            createdAt: serializeDate(v.createdAt),
            cantidadProyectos: projectsArr.length,
            cantidadItems: itemsArr.length,
            hasPdf: !!v.pdfPath,
            hasXlsx: !!v.xlsxPath,
          };
        }),
      };
    },
  );

  // ── Obtener versión completa ────────────────────────────────────────────
  app.get(
    "/ingenieria/materiales-consolidados/:id",
    {
      preHandler: authorizeAny([
        { module: Module.INGENIERIA, action: Action.VIEW },
        { module: Module.OPERACIONES, action: Action.VIEW },
      ]),
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");
      return {
        id: v.id,
        versionNumber: v.versionNumber,
        label: v.label,
        createdAt: serializeDate(v.createdAt),
        projectsSnapshot: v.projectsSnapshot,
        itemsSnapshot: v.itemsSnapshot,
        hasPdf: !!v.pdfPath,
        hasXlsx: !!v.xlsxPath,
      };
    },
  );

  // ── Crear consolidado ────────────────────────────────────────────────────
  app.post(
    "/ingenieria/materiales-consolidados",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      ensureUser(request);
      const body = createBodySchema.parse(request.body);

      // Validar que todos los proyectos existen y no están borrados
      const found = await prisma.project.count({
        where: { id: { in: body.projectIds }, deletedAt: null },
      });
      if (found !== body.projectIds.length) {
        throw badRequest(
          "INVALID_PROJECTS",
          "Alguno de los proyectos seleccionados no existe o fue eliminado",
        );
      }

      const { projects, items } = await buildConsolidation(body.projectIds);

      // Calcular versionNumber correlativo
      const last = await prisma.materialesConsolidadosVersion.findFirst({
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      // Persistir versión primero (sin paths) — los paths se actualizan tras generar archivos.
      const created = await prisma.materialesConsolidadosVersion.create({
        data: {
          versionNumber: nextVersion,
          label: body.label?.trim() || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          projectsSnapshot: projects as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          itemsSnapshot: items as any,
        },
      });

      // Generar archivos
      const dir = consolidadosDir();
      await fsPromises.mkdir(dir, { recursive: true });

      const ts = Date.now();
      const pdfFilename = `consolidado-v${nextVersion}-${ts}.pdf`;
      const xlsxFilename = `consolidado-v${nextVersion}-${ts}.xlsx`;
      const pdfAbs = path.join(dir, pdfFilename);
      const xlsxAbs = path.join(dir, xlsxFilename);

      try {
        const pdfBuffer = await generateConsolidadoPdf(nextVersion, body.label?.trim() || null, projects, items);
        await fsPromises.writeFile(pdfAbs, pdfBuffer);

        const xlsxBuffer = await generateConsolidadoXlsx(nextVersion, body.label?.trim() || null, projects, items);
        await fsPromises.writeFile(xlsxAbs, xlsxBuffer);

        await prisma.materialesConsolidadosVersion.update({
          where: { id: created.id },
          data: {
            pdfPath: `ingenieria/consolidados/${pdfFilename}`,
            xlsxPath: `ingenieria/consolidados/${xlsxFilename}`,
          },
        });
      } catch (err) {
        request.log.error({ err, versionId: created.id }, "[consolidador] error generando archivos");
        // No revertimos la versión — los archivos se pueden regenerar manualmente
        // si hace falta. La tabla en JSON queda accesible.
      }

      reply.code(201);
      return {
        id: created.id,
        versionNumber: nextVersion,
        label: created.label,
        createdAt: serializeDate(created.createdAt),
        cantidadProyectos: projects.length,
        cantidadItems: items.length,
      };
    },
  );

  // ── Descargar PDF ────────────────────────────────────────────────────────
  app.get(
    "/ingenieria/materiales-consolidados/:id/pdf",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
        select: { versionNumber: true, pdfPath: true },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");
      if (!v.pdfPath) throw notFound("PDF_NOT_FOUND", "PDF no generado");

      const abs = path.resolve(process.cwd(), "..", env.storagePath, v.pdfPath);
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="consolidado-v${v.versionNumber}.pdf"`,
      );
      return reply.send(fs.createReadStream(abs));
    },
  );

  // ── Descargar Excel ──────────────────────────────────────────────────────
  app.get(
    "/ingenieria/materiales-consolidados/:id/xlsx",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
        select: { versionNumber: true, xlsxPath: true },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");
      if (!v.xlsxPath) throw notFound("XLSX_NOT_FOUND", "Excel no generado");

      const abs = path.resolve(process.cwd(), "..", env.storagePath, v.xlsxPath);
      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      reply.header(
        "Content-Disposition",
        `attachment; filename="consolidado-v${v.versionNumber}.xlsx"`,
      );
      return reply.send(fs.createReadStream(abs));
    },
  );

  // ── Eliminar consolidado ─────────────────────────────────────────────────
  app.delete(
    "/ingenieria/materiales-consolidados/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request, reply) => {
      ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
        select: { id: true, pdfPath: true, xlsxPath: true },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");

      // Borrar archivos físicos best-effort
      const root = path.resolve(process.cwd(), "..", env.storagePath);
      for (const p of [v.pdfPath, v.xlsxPath]) {
        if (!p) continue;
        const abs = path.join(root, p);
        await fsPromises.unlink(abs).catch(() => undefined);
      }

      await prisma.materialesConsolidadosVersion.delete({ where: { id: params.id } });
      reply.code(204);
      return;
    },
  );

  // ── Vista compras: overlay con estado agregado por item ─────────────────
  // Es un endpoint "lazy" que solo se llama cuando el usuario abre la "Vista
  // compras" del modal del consolidador. Devuelve, para cada catalogItemId
  // del snapshot, el estado agregado a partir de los ProjectMaterials VIVOS
  // (no del snapshot) de los proyectos NO eliminados incluidos en la versión.
  app.get(
    "/ingenieria/materiales-consolidados/:id/compras-overlay",
    {
      preHandler: authorizeAny([
        { module: Module.INGENIERIA, action: Action.VIEW },
        { module: Module.OPERACIONES, action: Action.VIEW },
      ]),
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
        select: { projectsSnapshot: true, itemsSnapshot: true },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");

      const projects = (v.projectsSnapshot as ProjectSnapshot[] | null) ?? [];
      const items = (v.itemsSnapshot as ItemConsolidado[] | null) ?? [];
      const projectIds = projects.map((p) => p.id);
      const catalogItemIds = items.map((it) => it.catalogItemId);
      if (projectIds.length === 0 || catalogItemIds.length === 0) {
        return { items: [] };
      }

      // Filtrar a proyectos no borrados — si un proyecto se eliminó después de
      // crear la versión, no aparece en el overlay (no hay nada que actualizar).
      const aliveProjects = await prisma.project.findMany({
        where: { id: { in: projectIds }, deletedAt: null },
        select: { id: true },
      });
      const aliveIds = new Set(aliveProjects.map((p) => p.id));

      const pms = await prisma.projectMaterial.findMany({
        where: {
          projectId: { in: Array.from(aliveIds) },
          materialItemId: { in: catalogItemIds },
        },
        select: {
          id: true, projectId: true, materialItemId: true,
          status: true, crossed: true,
        },
      });

      const byItem = new Map<string, typeof pms>();
      for (const pm of pms) {
        const list = byItem.get(pm.materialItemId) ?? [];
        list.push(pm);
        byItem.set(pm.materialItemId, list);
      }

      const overlay = items.map((it) => {
        const list = byItem.get(it.catalogItemId) ?? [];
        const statuses = new Set(list.map((x) => x.status));
        const aggregatedStatus = list.length === 0
          ? null
          : statuses.size === 1
            ? Array.from(statuses)[0]
            : "MIXED";
        const isCrossed = list.length > 0 && list.every((x) => x.crossed);
        return {
          catalogItemId: it.catalogItemId,
          aggregatedStatus,
          isCrossed,
          perProjectStatus: list.map((x) => ({
            projectId: x.projectId,
            projectMaterialId: x.id,
            status: x.status,
            crossed: x.crossed,
          })),
        };
      });

      return { items: overlay };
    },
  );

  // ── Cascada: actualizar status/crossed en todos los ProjectMaterials del
  // item dentro de los proyectos del consolidado. Atomico.
  app.post(
    "/ingenieria/materiales-consolidados/:id/items/:materialItemId/cascade-update",
    {
      preHandler: authorizeAny([
        { module: Module.INGENIERIA, action: Action.EDIT },
        { module: Module.OPERACIONES, action: Action.EDIT },
      ]),
    },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({
        id: z.string().min(1),
        materialItemId: z.string().min(1),
      }).parse(request.params);

      const body = z.object({
        status: z.enum(["PENDIENTE", "PEDIDO", "RECIBIDO", "EN_STOCK"]).optional(),
        crossed: z.boolean().optional(),
      }).refine((b) => b.status !== undefined || b.crossed !== undefined, {
        message: "Debe pasarse al menos status o crossed",
      }).parse(request.body);

      const v = await prisma.materialesConsolidadosVersion.findUnique({
        where: { id: params.id },
        select: { projectsSnapshot: true },
      });
      if (!v) throw notFound("CONSOLIDADO_NOT_FOUND", "Consolidado no encontrado");

      const projects = (v.projectsSnapshot as ProjectSnapshot[] | null) ?? [];
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length === 0) return { updatedCount: 0, projectMaterialIds: [] };

      const aliveProjects = await prisma.project.findMany({
        where: { id: { in: projectIds }, deletedAt: null },
        select: { id: true },
      });
      const aliveIds = aliveProjects.map((p) => p.id);
      if (aliveIds.length === 0) return { updatedCount: 0, projectMaterialIds: [] };

      // Atomic: leer ids + update masivo en una transacción.
      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.projectMaterial.findMany({
          where: {
            projectId: { in: aliveIds },
            materialItemId: params.materialItemId,
          },
          select: { id: true },
        });
        if (target.length === 0) return { updatedCount: 0, projectMaterialIds: [] };
        const ids = target.map((x) => x.id);
        const now = new Date();
        await tx.projectMaterial.updateMany({
          where: { id: { in: ids } },
          data: {
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.crossed !== undefined ? { crossed: body.crossed } : {}),
            lastEditedAt: now,
            lastEditedById: user.id,
            lastEditedRole: user.role,
          },
        });
        return { updatedCount: ids.length, projectMaterialIds: ids };
      });

      return result;
    },
  );
}
