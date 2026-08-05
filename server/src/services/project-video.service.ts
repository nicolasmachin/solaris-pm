import { randomUUID } from "node:crypto";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import {
  AuditAction,
  AuditEntityType,
  FileAttachmentTipo,
  TipoVideo,
  VideoProcessingStatus,
} from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createAuditEntry } from "./audit.service.js";
import { ensureProjectVideoDir, videoOwnerDir } from "./file-storage.service.js";
import {
  calculateProjectProgress,
  syncStageProgress,
  syncSubstageProgress,
} from "./project.service.js";
import { enqueueVideoJob } from "./video-queue.service.js";
import {
  VideoProcessingError,
  extractPoster,
  probeVideo,
  sha256File,
  transcodeToStandard,
} from "./video-transcode.service.js";

/** Marca los ítems de checklist que se respaldan con un video de ensayo. */
export const ENSAYO_VIDEO_EVIDENCE_KIND = "ensayo-video";

/**
 * Tipos que valen como evidencia de un ensayo.
 *
 * Un video de visita técnica o uno suelto NO alcanzan: los ítems de checklist
 * dicen "videos de ensayos", y darlos por cumplidos con cualquier video vaciaría
 * de sentido el control.
 */
const TIPOS_DE_ENSAYO: TipoVideo[] = [TipoVideo.ENSAYO_ANTI_ISLA, TipoVideo.ENSAYO_ENCENDIDO];

/** Identifica en `FileAttachment.toolSource` a los videos del proyecto. */
export const PROJECT_VIDEO_TOOL_SOURCE = "project-video";

const MAX_ATTEMPTS = 3;

/**
 * Prefijo de los archivos que produce la compresión mientras corre. Los deja
 * distinguibles del original subido, que convive en la misma carpeta `.tmp/`.
 */
const OUTPUT_PREFIX = "out_";

function projectVideoTmpDir(ownerDir: string): string {
  return path.resolve(process.cwd(), "..", env.storagePath, ownerDir, "videos", ".tmp");
}

/**
 * Encola el procesamiento de un video recién subido.
 *
 * `originalPath` se pasa en el flujo normal (lo conoce quien acaba de guardar el
 * archivo); al recuperar tras un reinicio se omite y se busca en `.tmp/`.
 */
export function enqueueProjectVideo(projectVideoId: string, originalPath?: string): void {
  enqueueVideoJob(`project-video:${projectVideoId}`, () =>
    processProjectVideo(projectVideoId, originalPath),
  );
}

/**
 * Comprime un video subido y lo deja disponible para reproducir.
 *
 * Corre fuera del ciclo del request (la subida responde 202 y el progreso se
 * sigue por `processingStatus`), así que **nunca lanza**: cualquier problema se
 * registra en la propia fila para que la UI lo pueda mostrar.
 */
export async function processProjectVideo(projectVideoId: string, originalPath?: string) {
  const video = await prisma.projectVideo.findUnique({
    where: { id: projectVideoId },
    select: {
      id: true,
      projectId: true,
      leadId: true,
      substageId: true,
      tipoVideo: true,
      originalFilename: true,
      originalMimeType: true,
      processingAttempts: true,
      uploadedById: true,
      deletedAt: true,
    },
  });

  if (!video || video.deletedAt) return;

  // El path del original no se persiste: es un archivo efímero que existe solo
  // entre la subida y la compresión. En el flujo normal lo pasa quien encola; al
  // recuperar tras un reinicio hay que reconstruirlo desde `.tmp/`.
  const ownerDir = videoOwnerDir(video);
  const inputPath = originalPath ?? (await findOriginalInTmp(ownerDir, projectVideoId));

  if (!inputPath) {
    await failVideo(
      projectVideoId,
      "No se encontró el archivo original para procesar",
      "El archivo temporal se perdió (probablemente por un reinicio antes de que empezara la compresión). Hay que volver a subir el video.",
    );
    return;
  }

  await prisma.projectVideo.update({
    where: { id: projectVideoId },
    data: {
      processingStatus: VideoProcessingStatus.PROCESSING,
      processingAttempts: { increment: 1 },
      processingError: null,
    },
  });

  const dir = await ensureProjectVideoDir(ownerDir);
  const tmpDir = projectVideoTmpDir(ownerDir);
  const uuid = randomUUID();
  const outputName = `${uuid}.mp4`;
  const posterName = `poster_${uuid}.jpg`;

  // Se comprime dentro de `.tmp/` y recién al terminar bien se mueve a la
  // carpeta definitiva. Si el proceso muere a mitad (un deploy, por ejemplo), el
  // archivo a medio escribir queda en `.tmp/`, donde se limpia solo — antes
  // quedaba suelto entre los videos buenos, sin forma de distinguirlo.
  const outputPath = path.join(tmpDir, `${OUTPUT_PREFIX}${outputName}`);
  const posterPath = path.join(tmpDir, `${OUTPUT_PREFIX}${posterName}`);
  const finalOutputPath = path.join(dir, outputName);
  const finalPosterPath = path.join(dir, posterName);

  try {
    const probe = await probeVideo(inputPath);
    const originalSha256 = await sha256File(inputPath);

    const { sizeBytes, sha256 } = await transcodeToStandard(inputPath, outputPath, probe);

    // Las dimensiones se leen del archivo YA comprimido, no del original: un
    // video de iPhone vertical se guarda como 1920x1080 con una matriz de
    // rotación, así que el original informa dimensiones acostadas aunque se vea
    // parado. El comprimido ya tiene la rotación aplicada.
    const finalProbe = await probeVideo(outputPath);

    let posterUrl: string | null = null;
    try {
      await extractPoster(outputPath, posterPath);
      await fsPromises.rename(posterPath, finalPosterPath);
      posterUrl = `${ownerDir}/videos/${posterName}`;
    } catch (error) {
      // La miniatura es prescindible: sin ella la tarjeta muestra un ícono. No
      // vale la pena descartar un video que se comprimió bien.
      console.error(`[project-video] no se pudo generar la miniatura de ${projectVideoId}:`, error);
      await fsPromises.unlink(posterPath).catch(() => undefined);
    }

    await fsPromises.rename(outputPath, finalOutputPath);

    const attachment = await prisma.fileAttachment.create({
      data: {
        projectId: video.projectId,
        leadId: video.leadId,
        substageId: video.substageId,
        filename: buildFinalFilename(video.originalFilename),
        storedFilename: outputName,
        mimeType: "video/mp4",
        sizeBytes,
        url: `${ownerDir}/videos/${outputName}`,
        tipo: FileAttachmentTipo.OTRO,
        toolSource: PROJECT_VIDEO_TOOL_SOURCE,
        toolEntityId: projectVideoId,
        uploadedById: video.uploadedById,
      },
    });

    await prisma.projectVideo.update({
      where: { id: projectVideoId },
      data: {
        fileAttachmentId: attachment.id,
        posterUrl,
        durationSeconds: finalProbe.durationSeconds,
        width: finalProbe.width,
        height: finalProbe.height,
        sizeBytes,
        sha256,
        originalSha256,
        originalProbe: probe.raw as never,
        processingStatus: VideoProcessingStatus.READY,
        processingError: null,
        processedAt: new Date(),
      },
    });

    // El original ya cumplió su función: se conserva su hash y su ffprobe como
    // constancia de procedencia, pero los bytes no entran en el presupuesto de
    // disco de una retención permanente.
    await fsPromises.unlink(inputPath).catch(() => undefined);

    // Solo un video DE ENSAYO destraba el checklist. Uno de visita técnica es
    // documentación del relevamiento, no prueba de que el ensayo se hizo.
    // Solo aplica a videos de un proyecto: un lead todavía no tiene checklist.
    if (video.projectId && TIPOS_DE_ENSAYO.includes(video.tipoVideo)) {
      await autoCompleteEnsayoChecklist(video.projectId, video.uploadedById);
    }
  } catch (error) {
    await fsPromises.unlink(outputPath).catch(() => undefined);
    await fsPromises.unlink(posterPath).catch(() => undefined);
    await fsPromises.unlink(finalOutputPath).catch(() => undefined);
    await fsPromises.unlink(finalPosterPath).catch(() => undefined);

    const message =
      error instanceof VideoProcessingError
        ? error.message
        : "No se pudo procesar el video. Probá subirlo de nuevo.";
    const detail = error instanceof VideoProcessingError ? error.detail : String(error);

    console.error(`[project-video] falló el procesamiento de ${projectVideoId}:`, error);
    await failVideo(projectVideoId, message, detail);

    // Se conserva el original cuando aún quedan intentos, para poder reintentar
    // sin pedirle al operario que vuelva a subir desde la obra.
    if (video.processingAttempts + 1 >= MAX_ATTEMPTS) {
      await fsPromises.unlink(inputPath).catch(() => undefined);
    }
  }
}

async function failVideo(id: string, message: string, detail?: string) {
  await prisma.projectVideo
    .update({
      where: { id },
      data: {
        processingStatus: VideoProcessingStatus.FAILED,
        processingError: detail ? `${message} — ${detail}`.slice(0, 2000) : message,
      },
    })
    .catch((error) => {
      console.error(`[project-video] no se pudo registrar el fallo de ${id}:`, error);
    });
}

/**
 * El nombre visible conserva el del archivo original pero con extensión `.mp4`,
 * que es lo que efectivamente se guarda.
 */
function buildFinalFilename(originalFilename: string): string {
  const base = path.basename(originalFilename, path.extname(originalFilename));
  return `${base || "ensayo"}.mp4`;
}

/**
 * Busca el original de un video en `.tmp/`. Solo hace falta al recuperar
 * trabajos después de un reinicio: mientras el proceso vive, el path viaja en la
 * llamada.
 */
async function findOriginalInTmp(ownerDir: string, projectVideoId: string): Promise<string | null> {
  const marker = await prisma.projectVideo.findUnique({
    where: { id: projectVideoId },
    select: { originalFilename: true },
  });
  if (!marker) return null;

  const tmpDir = projectVideoTmpDir(ownerDir);

  const entries = (await fsPromises.readdir(tmpDir).catch(() => [] as string[])).filter(
    // Los `out_*` son restos de una compresión interrumpida, no originales.
    (name) => !name.startsWith(OUTPUT_PREFIX),
  );
  if (entries.length === 0) return null;

  // Los temporales se nombran con UUID, así que no hay forma de atarlos a una
  // fila por el nombre. Con un solo video pendiente por proyecto es unívoco; si
  // hay varios, se toma el más antiguo (el primero que se encoló).
  const withStats = await Promise.all(
    entries.map(async (name) => {
      const full = path.join(tmpDir, name);
      const stat = await fsPromises.stat(full).catch(() => null);
      return stat?.isFile() ? { full, mtime: stat.mtimeMs } : null;
    }),
  );

  const oldest = withStats
    .filter((entry): entry is { full: string; mtime: number } => entry !== null)
    .sort((a, b) => a.mtime - b.mtime)[0];

  return oldest?.full ?? null;
}

/**
 * Reencola los videos que quedaron a medio procesar.
 *
 * La cola vive en memoria, así que un reinicio del contenedor la vacía. Sin esta
 * recuperación, un video subido justo antes de un deploy quedaría en "Procesando"
 * para siempre, en silencio — y siendo evidencia, el silencio es lo peor que
 * podría pasar.
 */
export async function recoverPendingProjectVideos(): Promise<void> {
  const pendientes = await prisma.projectVideo.findMany({
    where: {
      deletedAt: null,
      processingStatus: { in: [VideoProcessingStatus.PENDING, VideoProcessingStatus.PROCESSING] },
    },
    select: { id: true, processingAttempts: true, projectId: true, leadId: true },
    orderBy: { createdAt: "asc" },
  });

  if (pendientes.length === 0) return;

  // Un reinicio a mitad de una compresión deja el archivo a medio escribir. Se
  // borran antes de reencolar, para que no se acumulen deploy tras deploy.
  await limpiarParcialesInterrumpidos([...new Set(pendientes.map((v) => videoOwnerDir(v)))]);

  for (const video of pendientes) {
    if (video.processingAttempts >= MAX_ATTEMPTS) {
      await failVideo(
        video.id,
        "El video no se pudo procesar después de varios intentos",
        "Hay que volver a subirlo.",
      );
      continue;
    }
    enqueueProjectVideo(video.id);
  }

  console.log(`[project-video] ${pendientes.length} video(s) pendiente(s) reencolado(s)`);
}

/** Borra los archivos a medio comprimir que dejó un proceso interrumpido. */
async function limpiarParcialesInterrumpidos(ownerDirs: string[]): Promise<void> {
  for (const ownerDir of ownerDirs) {
    const tmpDir = projectVideoTmpDir(ownerDir);
    const entries = await fsPromises.readdir(tmpDir).catch(() => [] as string[]);

    for (const name of entries.filter((entry) => entry.startsWith(OUTPUT_PREFIX))) {
      await fsPromises.unlink(path.join(tmpDir, name)).catch(() => undefined);
    }
  }
}

/** ¿El proyecto tiene al menos un video de ensayo listo para ver? */
export async function hasReadyEnsayoVideo(projectId: string): Promise<boolean> {
  const count = await prisma.projectVideo.count({
    where: {
      projectId,
      deletedAt: null,
      processingStatus: VideoProcessingStatus.READY,
      tipoVideo: { in: TIPOS_DE_ENSAYO },
    },
  });
  return count > 0;
}

/**
 * Marca los ítems de checklist que esperaban un video, ahora que existe uno.
 *
 * Es lo que convierte esos ítems de una casilla de confianza en algo respaldado:
 * el operario sube la evidencia y el checklist se actualiza solo, en vez de
 * pedirle que además se acuerde de tildar.
 */
export async function autoCompleteEnsayoChecklist(
  projectId: string,
  userId: string,
): Promise<void> {
  const items = await prisma.checklistItem.findMany({
    where: {
      projectId,
      evidenceKind: ENSAYO_VIDEO_EVIDENCE_KIND,
      completed: false,
      deletedAt: null,
    },
    select: { id: true, substageId: true, label: true, substage: { select: { stageId: true } } },
  });

  if (items.length === 0) return;

  await prisma.checklistItem.updateMany({
    where: { id: { in: items.map((item) => item.id) } },
    data: { completed: true, completedAt: new Date(), completedBy: userId },
  });

  const substageIds = [...new Set(items.map((item) => item.substageId))];
  const stageIds = [...new Set(items.map((item) => item.substage.stageId))];

  for (const substageId of substageIds) {
    await syncSubstageProgress(substageId);
  }
  for (const stageId of stageIds) {
    await syncStageProgress(stageId, { actorUserId: userId });
  }
  await calculateProjectProgress(projectId);

  for (const item of items) {
    await createAuditEntry({
      entityType: AuditEntityType.substage,
      entityId: item.substageId,
      projectId,
      userId,
      action: AuditAction.updated,
      fieldChanged: "completed",
      oldValue: "false",
      newValue: "true",
      description: `Se completó automáticamente "${item.label}" al subirse un video de ensayo`,
    });
  }
}
