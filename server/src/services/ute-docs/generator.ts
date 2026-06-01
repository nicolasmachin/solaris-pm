// Generador de documentos UTE. Lee templates PDF de disk, dibuja texto en las
// coordenadas portadas del script Python (origen bottom-left, igual que pdf-lib),
// arma un ZIP con los PDFs resultantes y registra la generación para auditoría.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";
import { PassThrough } from "node:stream";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import {
  COORDINATES,
  UTE_DOC_LABEL,
  UTE_DOC_TEMPLATE,
  type UteDocKey,
} from "./coordinates.js";
import { MAPPINGS } from "./mappings.js";
import { buildVariables, type UteVariables } from "./variables.js";

const FONT_SIZE = 11;

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src/services/ute-docs → server/src/assets/ute-templates
const TEMPLATES_DIR = path.resolve(here, "../../assets/ute-templates");

async function loadTemplate(filename: string): Promise<Buffer> {
  const file = path.join(TEMPLATES_DIR, filename);
  try {
    return await fs.readFile(file);
  } catch (err) {
    throw notFound(
      "UTE_TEMPLATE_MISSING",
      `Plantilla UTE no encontrada en el server: ${filename}`,
    );
  }
}

/**
 * Aplica el overlay de texto de un doc UTE sobre su plantilla.
 * `coordsByPage` es el array por página (null = sin overlay). `flatData` ya
 * viene en el orden que el mapping definió, en una sola lista plana.
 * Internamente reparte los datos por página según el largo de cada página.
 */
async function overlayDoc(
  templateBytes: Buffer,
  coordsByPage: readonly (readonly (readonly [number, number])[] | null)[],
  flatData: string[],
): Promise<Uint8Array> {
  // ignoreEncryption: las plantillas de UTE vienen con encripción "empty
  // password" (Standard Security Handler con perms restrictivos pero sin
  // password real). pdf-lib bloquea por default; las cargamos igual.
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  let cursor = 0;
  for (let pageIdx = 0; pageIdx < coordsByPage.length; pageIdx++) {
    const pageCoords = coordsByPage[pageIdx];
    if (!pageCoords) continue;
    if (pageIdx >= pages.length) break;
    const page = pages[pageIdx];

    for (let i = 0; i < pageCoords.length; i++) {
      const coord = pageCoords[i];
      const text = flatData[cursor];
      cursor++;
      if (text == null || text === "") continue;
      page.drawText(text, {
        x: coord[0],
        y: coord[1],
        size: FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
  return pdfDoc.save();
}

export type GenerateResult = {
  zipBuffer: Buffer;
  zipFilename: string;
  docsGenerated: UteDocKey[];
  // Para que el endpoint persista el ZIP como FileAttachment (toolSource
  // "ute-docs") con trazabilidad al log de generación (toolEntityId).
  generationId: string;
  projectCode: string;
};

export async function generateUteDocs(args: {
  projectId: string;
  userId: string;
  docs: UteDocKey[];
}): Promise<GenerateResult> {
  const { projectId, userId, docs } = args;
  if (docs.length === 0) throw badRequest("DOCS_EMPTY", "Elegí al menos un documento para generar.");

  // 1) Cargar proyecto + sistema principal + config UTE (con upsert defaults).
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      solarSystems: {
        where: { deletedAt: null, order: 1 },
        orderBy: { order: "asc" },
        take: 1,
      },
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  let config = await prisma.uteDocumentConfig.findUnique({ where: { projectId } });
  if (!config) {
    config = await prisma.uteDocumentConfig.create({ data: { projectId } });
  }

  const primarySolar = project.solarSystems[0] ?? null;
  const variables: UteVariables = buildVariables({ project, config, primarySolar });

  // 2) Generar cada doc y armar el ZIP.
  const zipBufferChunks: Buffer[] = [];
  const passthrough = new PassThrough();
  passthrough.on("data", (chunk) => zipBufferChunks.push(Buffer.from(chunk)));
  const zipDone = new Promise<void>((resolve, reject) => {
    passthrough.on("end", () => resolve());
    passthrough.on("error", (err) => reject(err));
  });

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err: unknown) => passthrough.destroy(err as Error));
  archive.pipe(passthrough);

  const generated: UteDocKey[] = [];
  for (const docKey of docs) {
    if (!(docKey in COORDINATES)) {
      throw badRequest("DOC_KEY_INVALID", `Clave de documento desconocida: ${docKey}`);
    }
    const coordsByPage = COORDINATES[docKey];
    const mapping = MAPPINGS[docKey];
    if (!mapping) throw badRequest("MAPPING_MISSING", `Mapping no definido para: ${docKey}`);
    const templateName = UTE_DOC_TEMPLATE[docKey];
    const templateBytes = await loadTemplate(templateName);
    const flatData = mapping(variables);

    const overlaid = await overlayDoc(templateBytes, coordsByPage, flatData);
    const label = UTE_DOC_LABEL[docKey];
    archive.append(Buffer.from(overlaid), { name: `${label}.pdf` });
    generated.push(docKey);
  }

  await archive.finalize();
  await zipDone;
  const zipBuffer = Buffer.concat(zipBufferChunks);

  // 3) Auditoría: snapshot completo de variables + lista de docs.
  const generation = await prisma.uteDocumentGeneration.create({
    data: {
      projectId,
      configSnapshot: variables as unknown as object,
      docsGenerated: generated,
      generatedById: userId,
    },
  });

  const proyName = (project.clientName ?? "proyecto").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const zipFilename = `docs_ute_${proyName}_${today}.zip`;

  return {
    zipBuffer,
    zipFilename,
    docsGenerated: generated,
    generationId: generation.id,
    projectCode: project.code,
  };
}

export async function getOrCreateConfig(projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  let config = await prisma.uteDocumentConfig.findUnique({ where: { projectId } });
  if (!config) {
    config = await prisma.uteDocumentConfig.create({ data: { projectId } });
  }
  return config;
}

export async function upsertConfig(args: {
  projectId: string;
  data: Record<string, unknown>;
}) {
  const project = await prisma.project.findFirst({ where: { id: args.projectId, deletedAt: null } });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  // Sanitizar: nunca permitir override de projectId, id, createdAt, updatedAt
  const { id: _id, projectId: _pid, createdAt: _ca, updatedAt: _ua, ...rest } = args.data;
  const updated = await prisma.uteDocumentConfig.upsert({
    where: { projectId: args.projectId },
    create: { projectId: args.projectId, ...rest },
    update: { ...rest },
  });
  return updated;
}
