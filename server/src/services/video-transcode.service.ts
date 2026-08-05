import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";

import { env } from "../config/env.js";

/**
 * Compresión de videos de ensayos (anti-isla, encendido) con ffmpeg.
 *
 * Un video crudo de celular pesa ~150 MB/min (más si es 4K60). El mismo video
 * recomprimido con el perfil de acá queda en ~6-23 MB/min según cuánto movimiento
 * tenga. Eso es lo que hace viable guardar la evidencia de forma permanente en el
 * disco del VPS en vez de necesitar object storage.
 *
 * El perfil de salida está elegido para dos requisitos que compiten:
 *
 * 1. **Se tiene que leer el display del inversor.** Es el contenido informativo
 *    del video; si los caracteres del LCD se emborronan, el archivo no sirve como
 *    evidencia. Por eso 720p (480p no alcanza) y CRF 21 (más nítido que el 23 por
 *    defecto de x264).
 * 2. **Se tiene que poder abrir dentro de diez años en cualquier máquina.** Por eso
 *    H.264 High@4.0 y no HEVC/AV1, que comprimen mejor pero no reproducen en
 *    Chrome/Linux ni en muchos escritorios corporativos.
 */

const TRANSCODE_TIMEOUT_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 60 * 1000;

/** Transferencias de color que indican HDR y requieren tonemapping a SDR. */
const HDR_TRANSFERS = new Set(["arib-std-b67", "smpte2084"]);

export interface VideoProbe {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  codecName: string | null;
  colorTransfer: string | null;
  isHdr: boolean;
  /** Salida cruda de ffprobe, se persiste como parte de la cadena de custodia. */
  raw: unknown;
}

export interface TranscodeResult {
  sizeBytes: number;
  sha256: string;
}

/** Error con causa legible para mostrar en la UI y persistir en processingError. */
export class VideoProcessingError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

/**
 * Corre un binario con argv (NUNCA un string de shell: los nombres de archivo
 * vienen del usuario). Mata el proceso si supera el timeout — un container
 * corrupto puede colgar a ffmpeg indefinidamente y dejar un job trabado para
 * siempre.
 */
function run(
  command: string,
  args: string[],
  { timeoutMs, label }: { timeoutMs: number; label: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      // ffmpeg escribe todo su log por stderr, incluso cuando termina bien.
      // Se acumula solo la cola: un video largo genera cientos de líneas de
      // progreso que no aportan nada al diagnóstico.
      stderr = (stderr + String(chunk)).slice(-4000);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new VideoProcessingError(
          `No se pudo ejecutar ${command}`,
          err instanceof Error ? err.message : String(err),
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new VideoProcessingError(
            `El procesamiento del video superó el tiempo máximo (${Math.round(timeoutMs / 60000)} min)`,
            label,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(new VideoProcessingError(`${label} falló (código ${code})`, stderr.trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

/** Lee metadata del video: duración, dimensiones, codec y espacio de color. */
export async function probeVideo(absolutePath: string): Promise<VideoProbe> {
  const stdout = await run(
    env.ffprobePath,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name,color_transfer,color_primaries,r_frame_rate",
      "-show_entries",
      "format=duration,format_name",
      "-of",
      "json",
      absolutePath,
    ],
    { timeoutMs: PROBE_TIMEOUT_MS, label: "ffprobe" },
  );

  let parsed: {
    streams?: Array<{
      width?: number;
      height?: number;
      codec_name?: string;
      color_transfer?: string;
    }>;
    format?: { duration?: string };
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new VideoProcessingError("No se pudo leer la información del video", stdout.slice(0, 500));
  }

  const stream = parsed.streams?.[0];
  if (!stream) {
    throw new VideoProcessingError(
      "El archivo no contiene una pista de video",
      "ffprobe no encontró ningún stream de video",
    );
  }

  const duration = Number(parsed.format?.duration);
  const colorTransfer = stream.color_transfer ?? null;

  return {
    durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
    width: stream.width ?? null,
    height: stream.height ?? null,
    codecName: stream.codec_name ?? null,
    colorTransfer,
    isHdr: colorTransfer != null && HDR_TRANSFERS.has(colorTransfer),
    raw: parsed,
  };
}

/**
 * Cadena de filtros de video.
 *
 * `scale` capea el lado largo en 1280 respetando aspecto **y orientación**: un
 * video vertical de 1080x1920 sale 720x1280, uno horizontal sale 1280x720.
 * `force_divisible_by=2` es obligatorio para yuv420p (que exige dimensiones pares).
 *
 * `fps=30` porque muchos celulares graban a 60: bajarlo corta el bitrate a la
 * mitad sin perder nada de legibilidad en un plano casi estático.
 */
function buildVideoFilter(probe: VideoProbe): string {
  const scaleAndFps =
    "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30";

  if (!probe.isHdr) return scaleAndFps;

  // Los iPhone recientes graban en Dolby Vision / HLG de 10 bits. Una conversión
  // directa a SDR deja el video lavado y grisáceo — justo lo que arruina la
  // legibilidad de un display. El tonemapping preserva el contraste.
  const tonemap = [
    "zscale=t=linear:npl=100",
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=tonemap=hable:desat=0",
    "zscale=t=bt709:m=bt709:r=tv",
    "format=yuv420p",
  ].join(",");

  return `${tonemap},${scaleAndFps}`;
}

/**
 * Comprime el video al perfil estándar de archivo.
 *
 * Corre bajo `nice` para que el kernel le dé prioridad a Fastify y a Postgres: en
 * un VPS de 4 cores, una transcodificación sin ceder CPU se nota en la latencia de
 * toda la app.
 */
export async function transcodeToStandard(
  inputPath: string,
  outputPath: string,
  probe: VideoProbe,
): Promise<TranscodeResult> {
  const ffmpegArgs = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
    "-vf",
    buildVideoFilter(probe),
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-preset",
    "medium",
    "-crf",
    "21",
    // Techo duro de bitrate: sin esto, un paneo a mano alzada por el tablero puede
    // escalar a 8 Mbps y generar un archivo de 100 MB.
    "-maxrate",
    "3M",
    "-bufsize",
    "6M",
    // Sin forzar 8 bits 4:2:0, el MP4 que sale de un original HEVC de 10 bits no
    // reproduce en Safari ni en QuickTime.
    "-pix_fmt",
    "yuv420p",
    // Keyframe cada 2 segundos: sin esto, adelantar el video es pastoso.
    "-g",
    "60",
    // El audio NO se descarta: la narración del operario ("abro el interruptor, el
    // inversor desconecta a los dos segundos") es parte de la evidencia del ensayo.
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-ac",
    "1",
    // Mueve el índice al principio del archivo. Sin esto el navegador tiene que
    // bajar el archivo entero antes del primer frame y los range requests no
    // sirven de nada.
    "-movflags",
    "+faststart",
    // Deja 2 de los 4 cores libres para el resto de la app.
    "-threads",
    "2",
    outputPath,
  ];

  await run("nice", ["-n", "10", env.ffmpegPath, ...ffmpegArgs], {
    timeoutMs: TRANSCODE_TIMEOUT_MS,
    label: "ffmpeg (compresión)",
  });

  const stats = await fsPromises.stat(outputPath);
  const sha256 = await sha256File(outputPath);
  return { sizeBytes: stats.size, sha256 };
}

/**
 * Extrae una miniatura del video ya comprimido (no del original: repetir el
 * tonemapping sería trabajo al pedo). Arranca en el segundo 1 para no quedarse
 * con el frame negro del principio.
 */
export async function extractPoster(videoPath: string, posterPath: string): Promise<void> {
  await run(
    "nice",
    [
      "-n",
      "10",
      env.ffmpegPath,
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      "-q:v",
      "4",
      posterPath,
    ],
    { timeoutMs: PROBE_TIMEOUT_MS, label: "ffmpeg (miniatura)" },
  );
}

/**
 * Hash del contenido de un archivo. Se usa como cadena de custodia: del original
 * antes de descartarlo, y del comprimido para poder detectar alteraciones.
 */
export function sha256File(absolutePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(absolutePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
